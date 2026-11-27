"""Read models for the Produtos screen, built from the scoped RSYS snapshot."""
from datetime import date, datetime, timezone
from decimal import Decimal
import json
import unicodedata

from historico import linhas_json

ABAS = frozenset(('marcas', 'top', 'categoria', 'sem-giro', 'resumo', 'produto', 'filtros'))
# The RSYS projection has only the principal seller. Use the same aliases and
# precedence as vendedores1004.ts for that field.
CCH = (
    ('999', 'BRUNO B', ('999',)), ('8', 'DARI', ('DARI',)),
    ('250', 'DAYVID', ('1032', 'DAYVID')), ('512', 'EDER', ('512',)),
    ('99', 'ELIANE', ('99',)), ('20', 'ELIELTON', ('20',)),
    ('87', 'EVALDO', ('87',)), ('34', 'FERNANDO M', ('45', 'FERNANDO M', 'FERNANDO M CCH')),
    ('14', 'MAGALHÃES', ('14',)), ('11', 'MARCIO', ('11',)),
    ('47', 'RAFAEL', ('85', 'RAFAEL', 'RAFAEL CCH')),
    ('10', 'XEXEU', ('XEXEU', 'XEXEU CCH')),
)
# Version the on-disk derived table independently from the RSYS watermark.
FATOS = 'produtos_painel_fatos_v1'
RESUMO = 'produtos_painel_resumo_v2'
RANKING = 'produtos_painel_ranking_v1'

def normalizar(coluna):
    return f"upper(strip_accents(trim(coalesce({coluna},''))))"


def combina_vendedor(codigo, nome, alvo):
    regras = []
    for canonico, _, aliases in CCH:
        if aliases == (canonico,):
            continue
        corresponde = ' OR '.join(f"{codigo}='{item}' OR contains({normalizar(nome)},'{item}')" for item in aliases)
        regras.append(f"WHEN {alvo}='{canonico}' THEN ({corresponde})")
    return f"""CASE WHEN {alvo}='999' AND {normalizar(nome)}='BRUNO B' THEN TRUE
        {' '.join(regras)}
        ELSE {codigo}={alvo} OR contains({normalizar(nome)}, {normalizar(alvo)}) END"""


def fonte(empresa, join=''):
    regras_codigo, regras_nome = [], []
    for codigo, nome, _ in CCH:
        condicao = combina_vendedor('cod_vendedor', 'nome_vendedor', f"'{codigo}'")
        regras_codigo.append(f"WHEN {condicao} THEN '{codigo}'")
        regras_nome.append(f"WHEN {condicao} THEN '{nome}'")
    if empresa == '10041':
        vendedor = f"""CASE {' '.join(regras_codigo)}
            ELSE coalesce(nullif(nullif(cod_vendedor,''),'0'), nullif(nullif(nome_vendedor,''),'0')) END"""
        vendedor_nome = f"""CASE {' '.join(regras_nome)}
            ELSE coalesce(nullif(nullif(nome_vendedor,''),'0'),
                          'Vendedor ' || nullif(nullif(cod_vendedor,''),'0')) END"""
    else:
        vendedor, vendedor_nome = 'cod_vendedor', 'nullif(coalesce(nullif(nome_vendedor,\'\'), cod_vendedor),\'\')'

    # Fixed paths use the exact aliases of the pinned RSYS procedure.
    return f"""
      WITH dados AS (
        SELECT p.* EXCLUDE (registro), json_extract_string(p.registro, [
          '$.cod_pedido', '$.num_nf', '$.data_movimento', '$.vendedor',
          '$.cod_cliente', '$.cliente', '$.cidade', '$.valordescontoitem', '$.num_cfop'
        ]) AS j
        FROM produtos p {join}
      ), valores AS (
        SELECT tipo, documento, movimento, dia, coalesce(j[3], dia::VARCHAR) AS data,
          coalesce(codigo,'') AS codigo,
          coalesce(nullif(trim(produto),''), 'Produto #' || nullif(codigo,''), 'Sem descrição') AS descricao,
          CASE WHEN regexp_full_match(trim(marca), '[0-9]+') THEN NULL ELSE nullif(trim(marca),'') END AS marca,
          grupo, coalesce(j[1],'') AS pedido, j[2] AS nf,
          trim(coalesce(j[4],'')) AS nome_vendedor, coalesce(vendedor::VARCHAR,'') AS cod_vendedor,
          j[5] AS cod_cliente, j[6] AS cliente, j[7] AS cidade,
          (CASE WHEN tipo=1 THEN -1 ELSE 1 END)*abs(coalesce(quantidade,0)) AS qtd,
          (CASE WHEN tipo=1 THEN -1 ELSE 1 END)*abs(coalesce(custo,0)) AS custo,
          coalesce(venda,0) AS venda, coalesce(devolucao,0) AS devolucao, coalesce(liquido,0) AS liquido,
          coalesce(try_cast(j[8] AS DECIMAL(26,4)),0) AS desconto,
          regexp_replace(coalesce(j[9],''),'[^0-9]','','g') AS cfop
        FROM dados
      ), corrigidos AS (
        SELECT * EXCLUDE (cod_vendedor, nome_vendedor),
            CASE WHEN corrigir THEN '63' ELSE cod_vendedor END AS cod_vendedor,
            CASE WHEN corrigir THEN 'FABIO R' ELSE nome_vendedor END AS nome_vendedor
        FROM (
          SELECT *, '{empresa}'='1004' AND trim(pedido)='529460' AND movimento=2176384
            AND documento=246509 AND trim(nf)='177852' AND cod_vendedor IN ('','0')
            AND nome_vendedor='' AS corrigir
          FROM valores
        )
      )
      SELECT tipo, documento, movimento, dia, data, codigo, descricao, marca, grupo, pedido, nf,
        upper(trim(coalesce(marca,'SEM MARCA'))) AS chave_marca,
        coalesce(nullif(grupo,''), marca, 'Sem categoria') AS categoria,
        {vendedor} AS codigo_vendedor, {vendedor_nome} AS vendedor_nome,
        cod_cliente, cliente, cidade, qtd, custo,
        CASE WHEN tipo=1 THEN -CASE WHEN cfop='1411' AND liquido<>0 THEN abs(liquido)
          ELSE greatest(0,abs(coalesce(nullif(devolucao,0),liquido))-CASE WHEN cfop='2202' THEN greatest(0,desconto) ELSE 0 END) END
        ELSE coalesce(nullif(abs(venda),0), nullif(abs(liquido),0), greatest(0,abs(venda)-abs(desconto))) END AS receita,
        (tipo=1 OR trim(pedido) NOT IN ('','0'))
          AND len(list_filter([pedido,nf,codigo,descricao,cliente,nome_vendedor,grupo,marca],
            v -> regexp_matches({normalizar('v')},'^(TOTAL|TOTAIS)( |$)') AND
              ({normalizar('v')} IN ('TOTAL','TOTAIS') OR starts_with({normalizar('v')},'TOTAIS '))))=0 AS elegivel
      FROM corrigidos
      QUALIFY row_number() OVER (PARTITION BY documento,movimento ORDER BY data,codigo,tipo)=1
    """


def preparar(db, empresa):
    db.execute(f'CREATE TABLE IF NOT EXISTS {FATOS} AS {fonte(empresa)}')
    gravar_resumo(db)


def atualizar(db, empresa, *, alterados):
    if alterados:
        documentos = '(SELECT DISTINCT documento FROM alterados) a'
        db.execute(f'DELETE FROM {FATOS} f USING {documentos} WHERE f.documento=a.documento')
        db.execute(f'INSERT INTO {FATOS} ' + fonte(empresa, f'JOIN {documentos} ON a.documento=p.documento'))
    else:
        db.execute(f'CREATE OR REPLACE TABLE {FATOS} AS {fonte(empresa)}')
    gravar_resumo(db)


def objetos(cursor):
    cols = [column[0] for column in cursor.description]
    return [{key: float(value) if isinstance(value, Decimal) else value
             for key, value in zip(cols, row, strict=True)} for row in cursor.fetchall()]


def marcas(db, base, args):
    rows = objetos(db.execute(base + """
        SELECT chave_marca AS marca,
            count(*) FILTER (WHERE tipo=2 AND receita>0)>0 AS vendeu,
            sum(receita) FILTER (WHERE tipo=2 AND receita>0) AS receita_venda,
            sum(custo) FILTER (WHERE tipo=2 AND receita>0) AS custo_venda,
            sum(qtd) FILTER (WHERE tipo=2 AND receita>0) AS qtd_venda,
            count(DISTINCT codigo) FILTER (WHERE tipo=2 AND receita>0) AS skus_venda,
            sum(receita) FILTER (WHERE tipo=1 AND receita<0) AS receita_devolucao,
            sum(custo) FILTER (WHERE tipo=1 AND receita<0) AS custo_devolucao,
            sum(qtd) FILTER (WHERE tipo=1 AND receita<0) AS qtd_devolucao,
            count(DISTINCT codigo) FILTER (WHERE tipo=1 AND receita<0) AS skus_devolucao
        FROM vendas
        WHERE (tipo=2 AND receita>0) OR (tipo=1 AND receita<0)
        GROUP BY 1
    """, args))
    total = sum(r['receita_venda'] or 0 for r in rows)
    result = []
    for row in rows:
        somente_devolucao = not row['vendeu']
        parte = 'devolucao' if somente_devolucao else 'venda'
        receita, custo = (row[f'{campo}_{parte}'] for campo in ('receita', 'custo'))
        lucro = receita - custo
        result.append(dict(marca=row['marca'], faturamento=receita, custo=custo, lucro=lucro,
                           margem=None if somente_devolucao else 100 * lucro / receita,
                           quantidade=row[f'qtd_{parte}'], produtos=row[f'skus_{parte}'],
                           participacao=0 if somente_devolucao or not total else 100 * receita / total,
                           somenteDevolucao=somente_devolucao))
    result.sort(key=lambda x: (x['somenteDevolucao'], -x['faturamento'], x['marca']))
    return result


def busca_sql(campos):
    return ' OR '.join(f"contains(lower(strip_accents(coalesce({col},''))), ?)" for col in campos)


def sku_base(base):
    return base + """, skus AS (
        SELECT codigo, first(descricao ORDER BY data,documento,movimento) AS descricao,
          first(marca ORDER BY data,documento,movimento) AS marca,
          first(grupo ORDER BY data,documento,movimento) AS grupo,
          sum(abs(qtd)) AS quantidade, sum(abs(receita)) AS faturamento, count(*) AS pedidos
        FROM vendas WHERE tipo=2 GROUP BY codigo
    )"""


def resumo_painel(db, base, params, termo, marca, *, sem_giro=None):
    linhas = marcas(db, base, params)
    filtros, args = busca_skus(termo, marca)
    if filtros:
        total_skus, visiveis = db.execute(sku_base(base) + f"""
            SELECT count(*), count(*) FILTER (WHERE {' AND '.join(filtros)}) FROM skus
        """, [*params, *args]).fetchone()
    else:
        total_skus, = db.execute(base + 'SELECT count(DISTINCT codigo) FROM vendas WHERE tipo=2', params).fetchone()
        visiveis = total_skus
    if termo:
        encontrados = set(r[0] for r in db.execute(base + f"""
            SELECT DISTINCT chave_marca FROM vendas WHERE marca IS NOT NULL AND
            ({busca_sql(('marca','descricao','cliente','nf','codigo'))})
        """, [*params, *([termo]*5)]).fetchall())
        linhas_visiveis = [x for x in linhas if x['marca'] in encontrados or termo in tirar_acentos(x['marca'])]
    else:
        linhas_visiveis = linhas
    if marca:
        linhas_visiveis = [x for x in linhas_visiveis if x['marca'] == marca]
    if sem_giro is None:
        sem_giro, _ = consultar_sem_giro(db, base, params, termo, marca, listar=False)
    return dict(porMarca=linhas_visiveis, totalMarcas=len(linhas), totalSkus=total_skus,
                totalSkusVisiveis=visiveis, semGiro=sem_giro,
                encontrouDados=bool(linhas or total_skus or sem_giro or db.execute(base + 'SELECT 1 FROM vendas LIMIT 1', params).fetchone()))


def tirar_acentos(value):
    return ''.join(c for c in unicodedata.normalize('NFD', value.lower()) if not '\u0300' <= c <= '\u036f')


def busca_skus(termo, marca):
    filtros, args = [], []
    if marca:
        filtros.append("upper(trim(coalesce(marca,'')))=?")
        args.append(marca)
    if termo:
        filtros.append(f"""({busca_sql(('descricao','marca','codigo'))} OR lower(marca) IN (
            SELECT DISTINCT lower(marca) FROM vendas WHERE marca IS NOT NULL AND
              ({busca_sql(('marca','descricao','cliente','nf','codigo'))})))""")
        args += [termo] * 8
    return filtros,args


def consultar_top(db, base, args, termo, marca, busca_top, limit, offset):
    filtros, params = busca_skus(termo, marca)
    if busca_top:
        filtros.append('(' + ' OR '.join(f"contains(lower(coalesce({col},'')),?)"
                                         for col in ('descricao','marca','codigo')) + ')')
        params += [busca_top] * 3
    filtro = ' WHERE ' + ' AND '.join(filtros) if filtros else ''
    origem = (f'WITH skus AS (SELECT * FROM {RANKING})' if not args and not termo else sku_base(base))
    consulta = origem + f""", total AS (SELECT coalesce(sum(faturamento),0) AS geral FROM skus),
        filtrados AS (SELECT * FROM skus{filtro}),
        totais AS (SELECT count(*) AS total,coalesce(sum(faturamento),0) AS receita,
                   coalesce(sum(quantidade),0) AS qtd FROM filtrados)
        SELECT f.codigo AS cod_produto, f.descricao, f.marca, f.grupo, f.quantidade, f.faturamento, f.pedidos,
          coalesce(100*f.faturamento/nullif(geral,0),0) AS participacao,
          totais.total, totais.receita AS somaReceita, totais.qtd AS somaQuantidade
        FROM totais CROSS JOIN total LEFT JOIN LATERAL (
          SELECT * FROM filtrados ORDER BY faturamento DESC, codigo LIMIT ? OFFSET ?
        ) f ON TRUE ORDER BY f.faturamento DESC, f.codigo"""
    rows = objetos(db.execute(consulta,[*args,*params,limit,offset]))
    totais = {k: rows[0][k] for k in ('total','somaReceita','somaQuantidade')}
    produtos = []
    for row in rows:
        if row['cod_produto'] is not None:
            for key in totais:
                row.pop(key)
            produtos.append(row)
    return {**totais,'produtos':produtos}


def consultar_categorias(db, base, args, termo):
    where = f" WHERE {busca_sql(('chave',))}" if termo else ''
    return objetos(db.execute(base + f"""
        , grupos AS (
          SELECT categoria AS chave,sum(receita) AS faturamento,sum(qtd) AS quantidade,count(DISTINCT codigo) AS produtos
          FROM vendas GROUP BY 1
        ), total AS (SELECT sum(greatest(0,faturamento)) AS geral FROM grupos)
        SELECT chave,faturamento,quantidade,produtos,coalesce(100*faturamento/nullif(geral,0),0) AS participacao
        FROM grupos CROSS JOIN total{where} ORDER BY faturamento DESC, chave
    """, [*args, *([termo] if termo else [])]))


def consultar_sem_giro(db, base, params, termo, marca, *, listar):
    filtros, args = [], []
    if marca:
        filtros.append("upper(trim(coalesce(marca,'')))=?")
        args.append(marca)
    if termo:
        filtros.append(f"({busca_sql(('descricao','marca','codigo'))})")
        args += [termo]*3
    filtro = ' AND ' + ' AND '.join(filtros) if filtros else ''
    sql = base + f"""
       , catalogo AS (
           SELECT DISTINCT ON (codigo) codigo, descricao, marca, data
           FROM escopo ORDER BY codigo, data DESC, documento, movimento
       ), sem_giro AS (
           SELECT * FROM catalogo c WHERE NOT EXISTS (SELECT 1 FROM vendas v WHERE v.tipo=2 AND v.codigo=c.codigo){filtro}
       )
    """
    args = [*params, *args]
    if not listar:
        count, = db.execute(sql + 'SELECT count(*) FROM sem_giro', args).fetchone()
        return count, []
    result = objetos(db.execute(sql + """SELECT codigo AS cod_produto,descricao,marca,data AS ultimaVenda,
            date_diff('day',try_cast(data AS DATE), current_date) AS diasSemVenda,
            count(*) OVER () AS total FROM sem_giro ORDER BY data NULLS FIRST, codigo LIMIT 300""", args))
    total = result[0]['total'] if result else 0
    for row in result:
        row.pop('total')
    return total,result


COLUNAS_NF = """data,nf AS num_nf,codigo AS cod_produto,descricao,marca,cod_cliente AS cliente_codigo,
    cliente AS cliente_razao,cidade AS cliente_cidade,receita,custo,receita-custo AS lucro,
    coalesce(100*(receita-custo)/nullif(abs(receita),0),0) AS margem,vendedor_nome,
    CASE WHEN tipo=1 THEN 'DEVOLUCAO' ELSE 'PEDIDO' END AS tipo"""


def consultar_nf(db, base, args, termo, marca, tipo, limit, offset):
    filtros = ['tipo=?']
    params = [*args, tipo]
    if marca:
        filtros.append("upper(trim(coalesce(marca,'')))=?")
        params.append(marca)
    if termo:
        filtros.append(f"({busca_sql(('descricao','cliente','marca','vendedor_nome','nf','codigo'))})")
        params += [termo]*6
    where = ' AND '.join(filtros)
    total, = db.execute(base + f'SELECT count(*) FROM vendas WHERE {where}', params).fetchone()
    rows = objetos(db.execute(base + f"""
        SELECT {COLUNAS_NF} FROM vendas WHERE {where}
        ORDER BY data DESC,codigo,documento,movimento LIMIT ? OFFSET ?
    """, [*params, limit, offset]))
    return {'linhas': rows, 'total': total}


def detalhes_produto(db, base, params, codigo, tipo):
    base += ', item AS (SELECT * FROM vendas WHERE codigo=? AND tipo=?)'
    params = [*params, codigo, tipo]
    totais, = objetos(db.execute(base + '''SELECT coalesce(sum(receita),0) AS receita,
        coalesce(sum(custo),0) AS custo, count(*) AS pedidos FROM item''', params))
    venda = tipo == 2
    clientes = objetos(db.execute(base + """
        SELECT coalesce(nullif(cliente,''),'Cliente '||coalesce(cod_cliente,'undefined')) AS nome,
            sum(abs(receita)) AS receita,count(*) AS pedidos FROM item
        GROUP BY 1 ORDER BY receita DESC,nome LIMIT 5
    """, params))
    evolucao = objetos(db.execute(base + """
        SELECT strftime(dia,'%Y-%m') AS mes, sum(abs(receita)) AS valor FROM item GROUP BY 1 ORDER BY 1
    """, params))
    notas = objetos(db.execute(base + f"SELECT {COLUNAS_NF} FROM item ORDER BY data DESC,documento,movimento LIMIT 8", params))
    receita, custo = (totais[k] if venda else abs(totais[k]) for k in ('receita','custo'))
    lucro = receita - custo if venda else 0
    return dict(receita=receita,custo=custo,lucro=lucro,margem=100*lucro/receita if venda and receita else 0,
                pedidos=totais['pedidos'],topClientes=clientes,evolucaoMensal=evolucao,ultimasNFs=notas)


def base_painel(inicio, fim, vendedores, movimento=None):
    recorte, args = [], []
    for value, clause in ((inicio,'dia>=?'),(fim,'dia<=?')):
        if value is not None:
            recorte.append(clause)
            args.append(value)
    periodo = (' WHERE ' + ' AND '.join(recorte)) if recorte else ''
    base = f'WITH escopo AS (SELECT * FROM {FATOS}{periodo}), vendas AS (SELECT * FROM escopo WHERE elegivel'
    if movimento is not None:
        base += ' AND tipo=?'
        args.append(movimento)
    if vendedores:
        matches = combina_vendedor("coalesce(codigo_vendedor,'')", 'vendedor_nome', 'v.alvo')
        base += f' AND EXISTS(SELECT 1 FROM unnest(?::VARCHAR[]) v(alvo) WHERE {matches})'
        args.append(vendedores)
    return base + ') ', args


def gravar_resumo(db):
    base, args = base_painel(None, None, [])
    total, produtos = consultar_sem_giro(db, base, args, '', '', listar=True)
    payload = {
        'marcas': resumo_painel(db, base, args, '', '', sem_giro=total),
        'categoria': {'categorias': consultar_categorias(db, base, args, '')},
        'sem-giro': {'total': total, 'produtos': produtos},
    }
    db.execute(f'CREATE OR REPLACE TABLE {RESUMO} AS SELECT ?::JSON AS dados', [linhas_json(payload)])
    db.execute(f'CREATE OR REPLACE TABLE {RANKING} AS ' + sku_base(base) + ' SELECT * FROM skus')


def consultar(db, *, aba, inicio, fim, vendedores, busca, marca, tipo, codigo, limit, offset, busca_top='', movimento=None):
    base, args = base_painel(inicio, fim, vendedores, movimento)
    termo = tirar_acentos(busca.strip())
    marca = marca.strip().upper()
    if aba in ('marcas', 'categoria', 'sem-giro') and not args and not termo and not marca:
        dados = json.loads(db.execute(f'SELECT dados FROM {RESUMO}').fetchone()[0])[aba]
        if aba == 'sem-giro':
            hoje = datetime.now(timezone.utc).date()
            for produto in dados['produtos']:
                produto['diasSemVenda'] = (hoje - date.fromisoformat(produto['ultimaVenda'][:10])).days
        return dados
    if aba == 'marcas':
        return resumo_painel(db,base,args,termo,marca)
    if aba == 'top':
        return consultar_top(db,base,args,termo,marca,busca_top.strip().lower(),limit,offset)
    if aba == 'categoria':
        return {'categorias': consultar_categorias(db,base,args,termo)}
    if aba == 'sem-giro':
        count, rows = consultar_sem_giro(db,base,args,termo,marca,listar=True)
        return {'total': count, 'produtos': rows}
    if aba == 'resumo':
        return consultar_nf(db,base,args,termo,marca,tipo,limit,offset)
    if aba == 'produto':
        return detalhes_produto(db,base,args,codigo,tipo)
    if aba == 'filtros':
        anos = [str(r[0]) for r in db.execute(f'SELECT DISTINCT year(dia) FROM {FATOS} ORDER BY 1 DESC').fetchall()]
        vendedores = objetos(db.execute(f'''SELECT codigo_vendedor AS codigo, min(vendedor_nome) AS nome
            FROM {FATOS} WHERE codigo_vendedor IS NOT NULL AND codigo_vendedor NOT IN ('','0')
            GROUP BY 1 ORDER BY 2,1'''))
        return {'anos': anos, 'vendedores': vendedores}
    raise ValueError('Aba inválida')
