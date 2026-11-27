"""Read the approved Produtos projection and its changed documents in one RSYS snapshot."""
from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
import re


PROCEDURE_DIGEST = '053bcdaf004a511711f4365b0be0c3888995d1ce3edb6fd0548176462d133157'
DATABASES = {'1004': 'RSYS2003_CT', '10041': 'RSYS2003_PELEGRINI'}
KEYS = {
    'NotasFiscais': ('Empresa', 'TipoControle', 'CodControle'),
    'MovEstoque': ('Empresa', 'NumLancamento'),
    'MovEstoqueImposto': ('Empresa', 'NumLancamento'),
    'Pedidos': ('Empresa', 'CodPedido'),
    'Operacoes': ('Codigo',),
    'Entidades': ('Codigo',),
    'Produtos': ('Codigo',),
    'Grupos': ('Codigo',),
    'Vendedores': ('Codigo',),
    'Cidades': ('Codigo',),
    'Marcas': ('Codigo',),
    'Empresas': ('Codigo',),
}
REFERENCE_KEYS = {
    'Operacoes': ('nf.CodOperacao',),
    'Entidades': ('nf.CodEntidade',),
    'Produtos': ('me.CodProduto',),
    'Grupos': ('prod.CodGrupo',),
    'Vendedores': ('ISNULL(pd.CodVendInterno, nf.CodVendInterno)',),
    'Cidades': ('et.CodCidade',),
    'Marcas': ('prod.CodMarca',),
    'Empresas': ('nf.Empresa',),
}
MOVEMENTS = ('MovEstoque', 'MovEstoqueImposto')
MAX_DOCUMENTS = 10_000
BATCH = 200

# Same seller exclusions as vendedorForcaP1004. Apply before reading item data.
BLOCKED_SELLERS = (999, 250, 1032, 155, 33, 1082, 1083, 929, 940, 588, 54)
BLOCKED_NAMES = ('BRUNO B', 'DAYVID', 'DAVID', 'SERVICO DE TERCEIRO', 'SERVICOS DE TERCEIRO',
                 'SERVICO TERCEIRO', 'SERVICOS TERCEIRO', 'NATA', 'THIAGO THOMAS', 'THIAGO TOMAS',
                 'THIAGO TOMAZ', 'WANDERSON VIANA')


class RecargaNecessaria(RuntimeError):
    pass


@dataclass(frozen=True)
class Snapshot:
    origem: datetime
    versao: int | None
    identidade: str


@dataclass(frozen=True)
class Projecao:
    select: str
    joins: str
    eligibility: str


def projecao_aprovada(definition, empresa):
    if empresa not in DATABASES:
        raise ValueError('Empresa inválida para a projeção de Produtos')
    definition = (definition or '').replace('\r\n', '\n')
    if sha256(definition.encode()).hexdigest() != PROCEDURE_DIGEST:
        raise ValueError('A definição de sp_api_produto mudou no RSYS')
    # Each IF block has its own SELECT but shares the procedure's output contract.
    block = re.search(rf'IF @cod_empresa_bi = {empresa}\s+BEGIN\s+(SELECT\s+.+?)\s+'
                      r'ORDER BY nf.DataMovimento, me.CodProduto;', definition, re.DOTALL)
    if not block:
        raise ValueError('Projeção de Produtos indisponível para a empresa')
    query = block[1].replace('RSYS2003_PELEGRINI.dbo.', 'dbo.')
    select, tail = re.split(r'\s+FROM\s+', query, maxsplit=1)
    joins, condition = re.split(r'\s+WHERE\s+', tail, maxsplit=1)
    condition = re.sub(r'\s+AND nf.DataMovimento (>= @data_ini|< @data_fim)\b', '', condition)
    if '@data_' in condition or not select.startswith('SELECT'):
        raise ValueError('Filtros da projeção de Produtos não reconhecidos')
    # qualify the local branch of the procedure and filter Força P in the origin.
    joins = re.sub(r'(?m)^(\s*LEFT JOIN )(?=[A-Z]\w+\s)', r'\1dbo.', joins)
    if joins.startswith('NotasFiscais '):
        joins = 'dbo.' + joins
    codes = ','.join(str(code) for code in BLOCKED_SELLERS)
    names = ''.join(f"\nAND COALESCE(vi.Nome, '') COLLATE Latin1_General_CI_AI NOT LIKE '%%{name}%%'"
                    for name in BLOCKED_NAMES)
    where = (f'{condition}\nAND nf.Empresa = %s\n'
             f'AND COALESCE(pd.CodVendInterno, nf.CodVendInterno, 0) NOT IN ({codes}){names}')
    if empresa == '10041':
        # RSYS stores formatted codes such as '1.411' in a varchar field.
        cfop = "COALESCE(CONVERT(varchar(40), me.NumCFOP), '')"
        for separator in ("'.'", "' '", "'-'", "'/'", 'CHAR(9)', 'CHAR(160)'):
            cfop = f"REPLACE({cfop}, {separator}, '')"
        where += f"\nAND {cfop} NOT IN ('5933', '6933')"
        where += "\nAND LTRIM(RTRIM(COALESCE(prod.Descricao, ''))) COLLATE Latin1_General_CI_AI " \
                 "NOT IN ('SERVICO','SERVICOS')"
    return Projecao(select + ', nf.TipoControle AS tipo_documento', 'FROM ' + joins, where)


def iniciar_snapshot(cursor, empresa, *, exigir_ct=True):
    definicao_sql = "SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.sp_api_produto'))" if empresa == '1004' else '''
        SELECT definition FROM RSYS2003_CT.sys.sql_modules M
        JOIN RSYS2003_CT.sys.objects O ON M.object_id=O.object_id
        JOIN RSYS2003_CT.sys.schemas S ON O.schema_id=S.schema_id
        WHERE O.name='sp_api_produto' AND S.name='dbo'
    '''
    cursor.execute(f'''
        SET NOCOUNT ON; SET DEADLOCK_PRIORITY LOW; SET LOCK_TIMEOUT 2000;
        SET TRANSACTION ISOLATION LEVEL SNAPSHOT; BEGIN TRANSACTION;
        SELECT DB_NAME(), SYSUTCDATETIME(), CHANGE_TRACKING_CURRENT_VERSION(),
            CONVERT(varchar(36),database_guid), CONVERT(varchar(36),recovery_fork_guid),
            CONVERT(varchar(128),DATABASEPROPERTYEX(DB_NAME(),'Collation'))
        FROM sys.database_recovery_status WHERE database_id = DB_ID();
        {definicao_sql};
    ''')
    nome, origem, versao, database_guid, fork, collation = cursor.fetchone()
    if nome != DATABASES[empresa] or not database_guid or not fork or collation != 'Latin1_General_CI_AS':
        raise RecargaNecessaria('A origem do RSYS não corresponde à empresa')
    if versao is None and exigir_ct:
        raise RecargaNecessaria('Change Tracking está desativado na origem')
    row = cursor.fetchone() if cursor.nextset() else None
    projection = projecao_aprovada(row[0] if row else None, empresa)
    base_identity = f'{database_guid}:{fork}:{collation}:{PROCEDURE_DIGEST}'
    if empresa == '10041':
        base_identity += ':cfop-texto'
    fingerprint = sha256(base_identity.encode()).hexdigest()
    return Snapshot(origem.replace(tzinfo=timezone.utc), versao, fingerprint), projection


def validar_versao(cursor, anterior, atual):
    columns = ','.join(f"CHANGE_TRACKING_MIN_VALID_VERSION(OBJECT_ID('dbo.{name}'))" for name in KEYS)
    cursor.execute('SELECT ' + columns)
    if anterior is None or atual is None or any(
        minimum is None or not 0 <= minimum <= anterior <= atual for minimum in cursor.fetchone()
    ):
        raise RecargaNecessaria('A versão anterior saiu da retenção do SQL Server ou a tabela perdeu Change Tracking')


def chaves_alteradas(cursor, filial, since, current):
    statements = ['DECLARE @since bigint=%s, @through bigint=%s, @filial int=%s;']
    for table, columns in KEYS.items():
        scope = ' AND T.Empresa = @filial' if 'Empresa' in columns else ''
        statements.append(f'''SELECT TOP ({MAX_DOCUMENTS + 1}) {', '.join(columns)}
            FROM CHANGETABLE(CHANGES dbo.[{table}], @since) T
            WHERE T.SYS_CHANGE_VERSION <= @through {scope} OPTION (MAXDOP 1);''')
    cursor.execute('\n'.join(statements), (since, current, filial))
    results = {}
    for table in KEYS:
        if results and not cursor.nextset():
            raise RecargaNecessaria('O RSYS não retornou todas as tabelas de Change Tracking')
        rows = cursor.fetchall()
        if len(rows) > MAX_DOCUMENTS:
            raise RecargaNecessaria('Volume de mudanças acima do limite de atualização de Produtos')
        results[table] = rows
    return results


def lotes(rows):
    for start in range(0, len(rows), BATCH):
        batch = rows[start:start + BATCH]
        placeholders = '(' + ','.join(['%s'] * len(batch[0])) + ')'
        yield ','.join([placeholders] * len(batch)), tuple(value for row in batch for value in row)


def documentos_alterados(cursor, projection, filial, since, current, documentos_anteriores):
    if since == current:
        return set()
    changes = chaves_alteradas(cursor, filial, since, current)
    docs = {(int(kind), int(code)) for _, kind, code in changes['NotasFiscais'] if kind in (1, 2)}
    movements = {int(number) for table in MOVEMENTS for _, number in changes[table]}
    docs.update(documentos_anteriores(sorted(movements)))
    for placeholders, params in lotes([(number,) for number in sorted(movements)]):
        cursor.execute(f'''SELECT M.TipoControle, M.CodControle FROM dbo.MovEstoque M
            JOIN (VALUES {placeholders}) K(lancamento) ON K.lancamento=M.NumLancamento
            WHERE M.Empresa=%s AND M.TipoControle IN (1,2) OPTION (MAXDOP 1)''', (*params, filial))
        docs.update((int(kind), int(code)) for kind, code in cursor.fetchall() if code is not None)

    # The movement retains the foreign key when the order itself was deleted.
    for placeholders, params in lotes(changes['Pedidos']):
        cursor.execute(f'''SELECT DISTINCT TOP ({MAX_DOCUMENTS + 1}) M.TipoControle, M.CodControle
            FROM dbo.MovEstoque M JOIN (VALUES {placeholders}) K(Empresa, CodPedido)
            ON K.Empresa=M.Empresa AND K.CodPedido=M.CodPedido
            WHERE M.TipoControle IN (1,2) AND M.CodControle IS NOT NULL OPTION (MAXDOP 1)''', params)
        docs.update((int(kind), int(code)) for kind, code in cursor.fetchall())

    for table, references in REFERENCE_KEYS.items():
        changed = changes[table]
        key_names = ','.join(KEYS[table])
        predicate = ' AND '.join(f'K.{key}={ref}' for key, ref in zip(KEYS[table], references, strict=True))
        for placeholders, params in lotes(changed):
            cursor.execute(f'''SELECT DISTINCT TOP ({MAX_DOCUMENTS + 1}) nf.TipoControle, nf.CodControle
                {projection.joins} JOIN (VALUES {placeholders}) K({key_names}) ON {predicate}
                WHERE nf.Empresa=%s AND nf.TipoControle IN (1,2) OPTION (MAXDOP 1)''', (*params, filial))
            docs.update((int(kind), int(code)) for kind, code in cursor.fetchall())
            if len(docs) > MAX_DOCUMENTS:
                raise RecargaNecessaria('Uma mudança cadastral exige reconstruir Produtos')
    if len(docs) > MAX_DOCUMENTS:
        raise RecargaNecessaria('Volume de documentos acima do limite de atualização de Produtos')
    return docs


def linhas(cursor, projection, filial, *, inicio=None, fim_exclusivo=None, documentos=None):
    if documentos is None:
        if inicio is None and fim_exclusivo is None:
            batches = [('', ' AND nf.DataMovimento IS NOT NULL', (filial,))]
        elif inicio and fim_exclusivo and inicio < fim_exclusivo:
            batches = [('', ' AND nf.DataMovimento >= %s AND nf.DataMovimento < %s', (filial, inicio, fim_exclusivo))]
        else:
            raise ValueError('Informe início e fim válidos para a carga')
    else:
        batches = [(f'JOIN (VALUES {values}) K(tipo, documento) ON '
                    'K.tipo=nf.TipoControle AND K.documento=nf.CodControle',
                    ' AND nf.DataMovimento IS NOT NULL', (*params, filial))
                   for values, params in lotes(sorted(documentos))]
    for join, interval, params in batches:
        cursor.execute(f'{projection.select}\n{projection.joins}\n{join}\nWHERE {projection.eligibility}'
                       f'{interval}\nOPTION (MAXDOP 1)', params)
        columns = [column[0].lower() for column in cursor.description]
        if len(set(columns)) != len(columns):
            raise ValueError('Campos repetidos na projeção de Produtos')
        while batch := cursor.fetchmany(2_000):
            yield from (dict(zip(columns, row, strict=True)) for row in batch)
