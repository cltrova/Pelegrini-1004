"""Produtos em disco, com publicação transacional da leitura e da versão RSYS."""
from contextlib import closing
import csv
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import json
from tempfile import NamedTemporaryFile
from threading import Lock
from uuid import uuid4

import duckdb

from historico import FILIAIS, RelatorioVencido, VALIDADE, VersaoTrocada, linhas_json
from produtos_rsys import RecargaNecessaria


class Produtos:
    def __init__(self, diretorio, empresa):
        self.empresa = empresa
        self.filial = FILIAIS[empresa]
        self.diretorio = diretorio
        self._escrita = Lock()
        diretorio.mkdir(parents=True, exist_ok=True, mode=0o700)
        self._db = duckdb.connect(str(diretorio / f'produtos-{empresa}.duckdb'), config={
            'threads': 1, 'memory_limit': '384MB', 'max_temp_directory_size': '4GB',
        })
        self._db.execute('''
            CREATE TABLE IF NOT EXISTS produtos (
                tipo TINYINT NOT NULL, documento BIGINT NOT NULL, movimento BIGINT,
                dia DATE NOT NULL, vendedor INTEGER,
                codigo VARCHAR, produto VARCHAR, marca VARCHAR, grupo VARCHAR,
                quantidade DECIMAL(26,4), venda DECIMAL(26,4), devolucao DECIMAL(26,4),
                liquido DECIMAL(26,4), custo DECIMAL(26,4), registro JSON NOT NULL
            );
            CREATE INDEX IF NOT EXISTS produtos_documento ON produtos (documento);
            CREATE TABLE IF NOT EXISTS produtos_revisao (
                versao VARCHAR NOT NULL, origem TIMESTAMP NOT NULL, identidade VARCHAR NOT NULL,
                watermark BIGINT, quantidade BIGINT NOT NULL, inicio DATE, fim_exclusivo DATE,
                confirmado BOOLEAN NOT NULL, proximo_lote DATE
            );
        ''')

    def close(self):
        self._db.close()

    def estado(self):
        with closing(self._db.cursor()) as db:
            return self._revisao(db)

    @staticmethod
    def _revisao(db):
        row = db.execute('SELECT * FROM produtos_revisao').fetchone()
        if row:
            return (row[0], row[1].replace(tzinfo=timezone.utc), *row[2:])

    def documentos_anteriores(self, movimentos):
        if not movimentos:
            return []
        with closing(self._db.cursor()) as db:
            return db.execute('SELECT DISTINCT tipo, documento FROM produtos '
                              'WHERE movimento IN (SELECT unnest(?::BIGINT[]))', [movimentos]).fetchall()

    def _registro(self, row, inicio, fim_exclusivo, documentos):
        tipo, documento = int(row['tipo_documento']), int(row['cod_documento'])
        date_value = row['data_movimento']
        dia = date_value.date() if isinstance(date_value, datetime) else date_value
        if (tipo not in (1, 2) or row['codempresa_bi'] != int(self.empresa)
                or row['cod_empresa'] != self.filial
                or (inicio and dia < inicio) or (fim_exclusivo and dia >= fim_exclusivo)
                or (documentos is not None and (tipo, documento) not in documentos)):
            raise ValueError('Movimento fora do escopo de Produtos')
        valores = [row[field] for field in ('quantidade', 'valorvenda', 'valordevolucao',
                                           'valorliquidofinal', 'valor_custo')]
        for value in valores:
            if value is None:
                continue
            decimal = Decimal(value)
            if not decimal.is_finite() or decimal != decimal.quantize(Decimal('0.0001')):
                raise ValueError('Precisão numérica inesperada em Produtos')
        return (tipo, documento, row['num_lancamento'], dia, row['cod_vendedor'], row['cod_produto'],
                row['produto'], row['marca'], row['grupo_produto'], *valores, linhas_json(row))

    def _copiar_csv(self, arquivo, registros, inicio, fim_exclusivo, documentos):
        writer = csv.writer(arquivo, quoting=csv.QUOTE_ALL)
        inseridos = 0
        for row in registros:
            writer.writerow([r'\N' if value is None else value
                             for value in self._registro(row, inicio, fim_exclusivo, documentos)])
            inseridos += 1
        arquivo.flush()
        return inseridos

    @staticmethod
    def _carregar_csv(db, arquivo, quantidade):
        if quantidade:
            db.execute(r"COPY produtos FROM ? (FORMAT CSV, HEADER false, AUTO_DETECT false, NULLSTR '\N')",
                       [arquivo.name])

    def gravar_lote_inicial(self, esperado, inicio, fim, registros):
        with NamedTemporaryFile(mode='w', encoding='utf-8', newline='', suffix='.csv', dir=self.diretorio) as arquivo:
            inseridos = self._copiar_csv(arquivo, registros, inicio, fim, None)
            with self._escrita, closing(self._db.cursor()) as db:
                db.begin()
                try:
                    atual = self._revisao(db)
                    if atual != esperado or atual[7] or atual[8] != inicio or not inicio < fim <= atual[6]:
                        raise RecargaNecessaria('A carga de Produtos avançou durante a leitura')
                    self._carregar_csv(db, arquivo, inseridos)
                    terminou = fim == atual[6]
                    db.execute('UPDATE produtos_revisao SET quantidade=quantidade+?, inicio=?, fim_exclusivo=?, '
                               'proximo_lote=?', [inseridos, None if terminou else atual[5],
                                                  None if terminou else atual[6], None if terminou else fim])
                    db.commit()
                except BaseException:
                    db.rollback()
                    raise
        return inseridos

    def publicar(self, snapshot, registros, *, documentos=None, cobertura=(None, None), esperado=None,
                 verificar_idade=True, confirmado=True):
        inicio, fim_exclusivo = cobertura
        with NamedTemporaryFile(mode='w', encoding='utf-8', newline='', suffix='.csv', dir=self.diretorio) as arquivo:
            inseridos = self._copiar_csv(arquivo, registros, inicio, fim_exclusivo, documentos)
            with self._escrita, closing(self._db.cursor()) as db:
                db.begin()
                try:
                    atual = self._revisao(db)
                    if atual != esperado or (atual and atual[1] >= snapshot.origem):
                        raise RecargaNecessaria('A base de Produtos avançou durante a leitura')
                    versao = uuid4().hex
                    if documentos is None:
                        db.execute('DELETE FROM produtos')
                        total = inseridos
                    elif documentos:
                        tipos, codigos = map(list, zip(*sorted(documentos), strict=True))
                        db.execute('CREATE TEMP TABLE alterados AS SELECT unnest(?)::TINYINT tipo, '
                                   'unnest(?)::BIGINT documento', [tipos, codigos])
                        filtro = ' USING alterados a WHERE produtos.documento=a.documento AND produtos.tipo=a.tipo'
                        removidos = db.execute('DELETE FROM produtos' + filtro).fetchone()[0]
                        total = atual[4] - removidos + inseridos
                    else:
                        versao, total = atual[0], atual[4]
                    self._carregar_csv(db, arquivo, inseridos)
                    if verificar_idade:
                        verificar_frescor(snapshot.origem)
                    db.execute('DELETE FROM produtos_revisao')
                    db.execute('INSERT INTO produtos_revisao VALUES (?,?,?,?,?,?,?,?,?)',
                               [versao, snapshot.origem.astimezone(timezone.utc).replace(tzinfo=None),
                                snapshot.identidade, snapshot.versao, total,
                                inicio, fim_exclusivo, confirmado, inicio if not confirmado else None])
                    db.commit()
                except BaseException:
                    db.rollback()
                    raise
        return inseridos

    def consultar(self, inicio, fim, offset, limit, *, versao=None, vendedor=None):
        if not 1 <= limit <= 100 or not 0 <= offset <= 2_147_483_647 or (inicio and fim and inicio > fim):
            raise ValueError('Página ou período inválido')
        with closing(self._db.cursor()) as db:
            db.begin()
            try:
                revisao = self._revisao(db)
                if not revisao or not revisao[7]:
                    raise RelatorioVencido('Primeira carga de Produtos ainda indisponível')
                atual, origem, _, _, _, cobertura_inicio, cobertura_fim, _, _ = revisao
                verificar_frescor(origem)
                if versao and versao != atual:
                    raise VersaoTrocada('A lista precisa ser aberta na versão atual')
                if ((cobertura_inicio and (inicio is None or inicio < cobertura_inicio))
                        or (cobertura_fim and (fim is None or fim >= cobertura_fim))):
                    raise RelatorioVencido('A base de Produtos ainda não cobre este intervalo')
                filtro = ' WHERE TRUE'
                params = []
                for value, clause in ((inicio, 'dia >= ?'), (fim, 'dia <= ?'), (vendedor, 'vendedor = ?')):
                    if value is not None:
                        filtro += ' AND ' + clause
                        params.append(value)

                total, quantidade, vendas, devolucoes, liquido, custo = db.execute('''
                    SELECT count(*), coalesce(sum(quantidade),0), coalesce(sum(venda),0),
                           coalesce(sum(devolucao),0), coalesce(sum(liquido),0), coalesce(sum(custo),0)
                    FROM produtos''' + filtro, params).fetchone()
                ranking = {}
                for chave in ('produto', 'marca', 'grupo'):
                    colunas = 'codigo, produto' if chave == 'produto' else chave
                    ranking[chave] = db.execute(f'''
                        SELECT {colunas}, count(*), coalesce(sum(quantidade),0), coalesce(sum(liquido),0) AS receita
                        FROM produtos{filtro} GROUP BY {colunas}
                        ORDER BY receita DESC, {colunas} LIMIT 50
                    ''', params).fetchall()
                detalhes = db.execute('SELECT registro FROM produtos' + filtro +
                                      ' ORDER BY dia DESC, tipo, documento, movimento, registro LIMIT ? OFFSET ?',
                                      [*params, limit, offset]).fetchall()
                verificar_frescor(origem)
                return {'versao': atual, 'origem': origem, 'total': total,
                        'resumo': dict(quantidade=quantidade, vendas=vendas, devolucoes=devolucoes,
                                       liquido=liquido, custo=custo),
                        'ranking': ranking, 'linhas': [json.loads(row[0]) for row in detalhes]}
            finally:
                db.rollback()


def verificar_frescor(origem):
    idade = datetime.now(timezone.utc) - origem
    if not timedelta(0) <= idade < VALIDADE:
        raise RelatorioVencido('Origem sem uma leitura atual')
