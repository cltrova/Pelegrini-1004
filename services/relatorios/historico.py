"""Base privada do relatório de perdas. Um processo abre cada arquivo DuckDB."""
from contextlib import closing
import csv
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import json
from pathlib import Path
from tempfile import NamedTemporaryFile
from threading import Lock
from uuid import uuid4

import duckdb


FILIAIS = {'1004': 1, '10041': 2}
VALIDADE = timedelta(seconds=60)


class RelatorioVencido(RuntimeError):
    pass


class VersaoTrocada(RuntimeError):
    pass


@dataclass(frozen=True)
class Registro:
    filial: int
    dia: date
    pedido: str
    vendedor: int | None
    valor: Decimal
    original: dict


def linhas_json(registro):
    def serializar(valor):
        if isinstance(valor, Decimal) and valor.is_finite():
            return str(valor)
        if isinstance(valor, (datetime, date)):
            return valor.isoformat()
        raise TypeError('Formato de campo desconhecido no RSYS')
    return json.dumps(registro, default=serializar, ensure_ascii=False, allow_nan=False, separators=(',', ':'))


class Historico:
    def __init__(self, diretorio: Path, empresa: str, filial: int):
        if empresa not in FILIAIS or FILIAIS[empresa] != filial:
            raise ValueError('Empresa ou filial inválida para este relatório')
        self.filial = filial
        self.diretorio = diretorio
        self._escrita = Lock()
        diretorio.mkdir(parents=True, exist_ok=True, mode=0o700)
        self._db = duckdb.connect(str(diretorio / f'perdas-{empresa}.duckdb'), config={
            'threads': 1, 'memory_limit': '256MB', 'max_temp_directory_size': '2GB',
        })
        self._db.execute('''
            CREATE TABLE IF NOT EXISTS dados (
                seq BIGINT PRIMARY KEY, dia DATE NOT NULL, pedido VARCHAR NOT NULL,
                vendedor INTEGER, valor DECIMAL(24, 4) NOT NULL, registro JSON NOT NULL
            );
            CREATE INDEX IF NOT EXISTS indice_periodo ON dados (dia);
            CREATE TABLE IF NOT EXISTS revisao (
                versao VARCHAR NOT NULL, origem TIMESTAMP NOT NULL
            );
        ''')

    def close(self):
        self._db.close()

    def publicar(self, origem, registros):
        if not isinstance(origem, datetime) or origem.utcoffset() is None:
            raise ValueError('A leitura da origem precisa de um horário UTC válido')
        origem = origem.astimezone(timezone.utc).replace(tzinfo=None)
        with self._escrita, closing(self._db.cursor()) as db:
            db.begin()
            try:
                atual = db.execute('SELECT origem FROM revisao').fetchone()
                if atual and atual[0] >= origem:
                    raise ValueError('A leitura da origem é anterior à versão atual')
                db.execute('DELETE FROM dados')
                with NamedTemporaryFile(mode='w', encoding='utf-8', newline='', suffix='.csv', dir=self.diretorio) as arquivo:
                    gravar = csv.writer(arquivo, quoting=csv.QUOTE_ALL)
                    for seq, item in enumerate(registros):
                        if item.filial != self.filial or not item.pedido or not item.valor.is_finite():
                            raise ValueError('Registro fora do escopo ou inválido')
                        if item.valor != item.valor.quantize(Decimal('0.0001')):
                            raise ValueError('Precisão monetária inesperada na origem')
                        gravar.writerow((seq, item.dia, item.pedido, item.vendedor, item.valor, linhas_json(item.original)))
                    if arquivo.tell() > 0:
                        arquivo.flush()
                        db.execute('COPY dados FROM ? (FORMAT CSV, HEADER false, AUTO_DETECT false)', [arquivo.name])
                versao = uuid4().hex
                db.execute('DELETE FROM revisao')
                db.execute('INSERT INTO revisao VALUES (?, ?)', (versao, origem))
                db.commit()
                return versao
            except BaseException:
                db.rollback()
                raise

    def consultar(self, inicio, fim, offset, limit, *, versao=None, agora=None):
        if not 1 <= limit <= 100 or offset < 0 or (inicio and fim and inicio > fim):
            raise ValueError('Página ou período inválido')
        filtro = ' WHERE dia BETWEEN ? AND ?'
        parametros = [inicio or date.min, fim or date.max]
        def confirmar_frescor(origem):
            idade = (agora or datetime.now(timezone.utc)) - origem
            if not timedelta(0) <= idade < VALIDADE:
                raise RelatorioVencido('Origem sem uma leitura atual')
        with closing(self._db.cursor()) as db:
            db.begin()
            try:
                revisao = db.execute('SELECT versao, origem FROM revisao').fetchone()
                if not revisao:
                    raise RelatorioVencido('Primeira carga ainda indisponível')
                fonte = revisao[1].replace(tzinfo=timezone.utc)
                confirmar_frescor(fonte)
                if versao and versao != revisao[0]:
                    raise VersaoTrocada('A lista precisa ser aberta na versão atual')
                total, pedidos, valor = db.execute(
                    'SELECT count(*), count(DISTINCT pedido), coalesce(sum(valor), 0) FROM dados' + filtro,
                    parametros,
                ).fetchone()
                resumo = db.execute(
                    'SELECT vendedor, count(DISTINCT pedido), sum(valor) AS valor_total FROM dados' + filtro
                    + ' GROUP BY vendedor ORDER BY valor_total DESC, vendedor ASC NULLS LAST LIMIT 50', parametros,
                ).fetchall()
                linhas = db.execute(
                    'SELECT registro FROM dados' + filtro + ' ORDER BY dia DESC, pedido, seq LIMIT ? OFFSET ?',
                    [*parametros, limit, offset],
                ).fetchall()
                confirmar_frescor(fonte)
                return dict(versao=revisao[0], origem=fonte, total=total, pedidos=pedidos,
                            valor_itens=str(valor), ranking=[dict(vendedor=a, pedidos=b, valor=str(c)) for a,b,c in resumo],
                            linhas=[json.loads(row[0]) for row in linhas])
            finally:
                db.rollback()
