"""Capture and refresh the commercial Produtos report from RSYS."""
from contextlib import closing, contextmanager
from datetime import date, datetime, timedelta, timezone
import json
import logging
from threading import Event, Thread
from time import perf_counter

from historico import RelatorioVencido
from produtos_rsys import (
    DATABASES, RecargaNecessaria, Snapshot, documentos_alterados, iniciar_snapshot, linhas, validar_versao,
)


def conectar(credencial, empresa, *, timeout):
    import pymssql

    sql = json.loads(credencial.read_text(encoding='utf-8'))
    return pymssql.connect(server=sql['host'], port=str(sql.get('port', 1433)), database=DATABASES[empresa],
                           user=sql['user'], password=sql['password'], read_only=True, charset='UTF-8',
                           encryption=sql.get('encryption', 'require'), login_timeout=5, timeout=timeout,
                           appname='T2A-Pelegrini-Produtos', autocommit=True)


def cobertura_carga(cursor):
    limites = []
    for order in ('ASC', 'DESC'):
        cursor.execute(f'''SELECT TOP (1) CONVERT(date, DataMovimento) FROM dbo.NotasFiscais
            WHERE DataMovimento IS NOT NULL ORDER BY DataMovimento {order} OPTION (MAXDOP 1)''')
        row = cursor.fetchone()
        if not row:
            return (None, None)
        limites.append(row[0])
    inicio, ultimo = limites
    return inicio, ultimo + timedelta(days=1)


def carregar_historico(base, cursor, snapshot, estado, dias_por_lote):
    if estado and (estado[7] or estado[3] is None):
        raise RecargaNecessaria('Use uma base nova para reconstruir Produtos')
    if estado:
        if estado[2] != snapshot.identidade:
            raise RecargaNecessaria('A origem de Produtos mudou durante a carga')
        ancora = Snapshot(estado[1], estado[3], estado[2])
    else:
        ancora = snapshot
    validar_versao(cursor, ancora.versao, snapshot.versao)
    if not estado:
        limites = cobertura_carga(cursor)
        base.publicar(ancora, (), cobertura=limites, verificar_idade=False, confirmado=False)
        estado = base.estado()
    cursor.execute('ROLLBACK TRANSACTION')

    copiados = 0
    while estado[8] is not None:
        inicio = estado[8]
        fim = min(estado[6], inicio + timedelta(days=dias_por_lote))
        lote, consulta = iniciar_snapshot(cursor, base.empresa)
        if lote.identidade != ancora.identidade:
            raise RecargaNecessaria('A origem de Produtos mudou durante a carga')
        validar_versao(cursor, ancora.versao, lote.versao)

        def extrair_lote():
            yield from linhas(cursor, consulta, base.filial, inicio=inicio, fim_exclusivo=fim)
            cursor.execute('ROLLBACK TRANSACTION')

        copiados += base.gravar_lote_inicial(estado, inicio, fim, extrair_lote())
        estado = base.estado()
        logging.getLogger('produtos').info('Produtos %s carregado até %s (%d linhas)', base.empresa, fim, estado[4])
    return copiados, ancora


def sincronizar(base, conectar_banco, *, carga=False, cobertura=(None, None), leitura_avulsa=False,
                dias_por_lote=90):
    if (leitura_avulsa and (not carga or None in cobertura)) or (not carga and cobertura != (None, None)):
        raise ValueError('A leitura avulsa exige um intervalo explícito')
    esperado = base.estado()
    if not carga and (not esperado or esperado[3] is None):
        raise RecargaNecessaria('Produtos precisa de uma carga inicial com Change Tracking')
    inicio = perf_counter()
    fim_sql = None
    with closing(conectar_banco()) as connection, closing(connection.cursor()) as cursor:
        snapshot, projection = iniciar_snapshot(cursor, base.empresa, exigir_ct=not leitura_avulsa)
        documentos = None
        carga_completa = carga and not leitura_avulsa
        if carga_completa:
            copiados, snapshot = carregar_historico(base, cursor, snapshot, esperado, dias_por_lote)
            fim_sql = perf_counter()
        else:
            if not carga:
                if esperado[2] != snapshot.identidade:
                    raise RecargaNecessaria('O banco de origem de Produtos foi substituído')
                if esperado[5:7] != (None, None) or esperado[8] is not None:
                    raise RecargaNecessaria('Produtos precisa de uma carga inicial de todo o histórico')
                validar_versao(cursor, esperado[3], snapshot.versao)
                documentos = documentos_alterados(cursor, projection, base.filial, esperado[3], snapshot.versao,
                                                   base.documentos_anteriores)

            def extrair():
                nonlocal fim_sql
                yield from linhas(cursor, projection, base.filial, inicio=cobertura[0], fim_exclusivo=cobertura[1],
                                  documentos=documentos)
                cursor.execute('ROLLBACK TRANSACTION')
                fim_sql = perf_counter()

            copiados = base.publicar(snapshot, extrair(), documentos=documentos, cobertura=cobertura, esperado=esperado)
    versao, _, _, _, total, _, _, confirmado, proximo = base.estado()
    return {'empresa': base.empresa, 'versao': versao, 'origem': snapshot.origem.isoformat(), 'total': total,
            'copiados': copiados, 'documentos_alterados': len(documentos) if documentos is not None else None,
            'confirmado': confirmado, 'proximo_lote': proximo.isoformat() if proximo else None,
            'extracao_ms': round((fim_sql - inicio) * 1000), 'ciclo_ms': round((perf_counter() - inicio) * 1000),
            'idade_s': round((datetime.now(timezone.utc) - snapshot.origem).total_seconds(), 3)}


@contextmanager
def executar_atualizacoes(bases, credencial):
    import duckdb
    import pymssql

    parar = Event()
    logger = logging.getLogger('produtos')

    def atualizar():
        while not parar.is_set():
            for empresa, base in bases.items():
                if parar.is_set():
                    return
                try:
                    sincronizar(base, lambda: conectar(credencial, empresa, timeout=12))
                except (RecargaNecessaria, RelatorioVencido, pymssql.Error, duckdb.Error, ValueError, OSError) as error:
                    logger.warning('Atualização de Produtos %s falhou (%s)', empresa, type(error).__name__)
            parar.wait(10)

    thread = Thread(target=atualizar, name='atualizar-produtos')
    thread.start()
    try:
        yield
    finally:
        parar.set()
        thread.join()


def main():
    from argparse import ArgumentParser
    from pathlib import Path
    from produtos import Produtos
    import pymssql

    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--empresa', choices=DATABASES, required=True)
    parser.add_argument('--diretorio', type=Path, required=True)
    parser.add_argument('--credencial', type=Path, required=True)
    parser.add_argument('--carga', action='store_true')
    parser.add_argument('--dias-por-lote', choices=(7, 30, 90), type=int, default=90)
    parser.add_argument('--intervalo-avulso', type=date.fromisoformat, nargs=2, metavar=('INICIO', 'FIM_EXCLUSIVO'))
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    try:
        with closing(Produtos(args.diretorio, args.empresa)) as base:
            resultado = sincronizar(base, lambda: conectar(args.credencial, args.empresa, timeout=25),
                                    carga=args.carga or bool(args.intervalo_avulso),
                                    cobertura=tuple(args.intervalo_avulso or (None, None)),
                                    leitura_avulsa=bool(args.intervalo_avulso), dias_por_lote=args.dias_por_lote)
    except pymssql.Error as error:
        number = error.args[0] if error.args and isinstance(error.args[0], int) else 'desconhecido'
        raise SystemExit(f'Falha na comunicação com o RSYS (código {number})') from None
    except (RecargaNecessaria, RelatorioVencido) as error:
        raise SystemExit(str(error)) from None
    print(json.dumps(resultado), flush=True)


if __name__ == '__main__':
    main()
