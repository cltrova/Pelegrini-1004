"""Compare the prepared Produtos read and collect timing and source-age evidence."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import gzip
import json
from os import environ
from pathlib import Path
from time import perf_counter, sleep
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from historico import FILIAIS
from produtos_rsys import DATABASES, iniciar_snapshot
from sincronizar_produtos import conectar


CAMPOS = ('quantidade', 'vendas', 'devolucoes', 'liquido', 'custo')
INTERVALOS = ((date(2019, 11, 1), date(2019, 11, 5)), (date(2026, 11, 24), date(2026, 11, 26)))


def consultar(token, porta, empresa, **filtros):
    start = perf_counter()
    query = urlencode({'cod_empresa_bi': empresa, **filtros})
    url = f'http://127.0.0.1:{porta}/interno/relatorios/produtos?{query}'
    request = Request(url, headers={'Authorization': f'Bearer {token}', 'Accept-Encoding': 'gzip'})
    with urlopen(request, timeout=8) as reply:
        body = reply.read()
        raw = gzip.decompress(body) if reply.headers.get('Content-Encoding') == 'gzip' else body
        data = json.loads(raw)
        stamp = datetime.fromisoformat(reply.headers['X-Data-As-Of'])
        idade = (datetime.now(timezone.utc) - stamp).total_seconds()
        if not 0 <= idade < 60 or data['versao'] != reply.headers['X-Data-Version']:
            raise AssertionError('Versão ou idade de Produtos inválida')
    return data, round((perf_counter() - start) * 1000, 1), round(idade, 3), len(body)


def conferir(credencial, token, porta, empresa, inicio, fim):
    local, api_ms, idade, tamanho = consultar(token, porta, empresa, inicio=inicio, fim=fim, limit=10)
    start = perf_counter()
    with closing(conectar(credencial, empresa, timeout=9, porta_tunel=15007)) as source, closing(source.cursor()) as cur:
        _, projection = iniciar_snapshot(cur, empresa)
        cur.execute(f'''SELECT COUNT_BIG(*), coalesce(sum(quantidade),0), coalesce(sum(ValorVenda),0),
             coalesce(sum(ValorDevolucao),0), coalesce(sum(ValorLiquidoFinal),0), coalesce(sum(valor_custo),0)
             FROM ({projection.select} {projection.joins} WHERE {projection.eligibility}
             AND nf.DataMovimento >= %s AND nf.DataMovimento < %s) itens OPTION (MAXDOP 1)''',
                    (FILIAIS[empresa], inicio, fim + timedelta(days=1)))
        count, *totals = cur.fetchone()
        cur.execute('ROLLBACK TRANSACTION')
    esperado = [Decimal(str(value)) for value in totals]
    atual = [Decimal(local['resumo'][column]) for column in CAMPOS]
    if local['total'] != count or atual != esperado:
        campos = [name for name, x, y in zip(CAMPOS, atual, esperado, strict=True) if x != y]
        raise AssertionError(f'{empresa} {inicio} contagens {local["total"]}/{count} campos {campos}')
    print(json.dumps(dict(empresa=empresa, inicio=str(inicio), fim=str(fim), linhas=count, status='MATCH',
                          api_ms=api_ms, origem_ms=round((perf_counter() - start) * 1000, 1),
                          idade_s=idade, bytes=tamanho)), flush=True)


def main():
    cred = Path(environ['CREDENTIALS_DIRECTORY'])
    token = (cred / 'relatorios-token').read_text(encoding='ascii').strip()
    porta = int(environ.get('VERIFICAR_PORTA', '8328'))
    empresas = tuple(environ.get('VERIFICAR_EMPRESAS', ','.join(DATABASES)).split(','))
    if not empresas or not set(empresas) <= set(DATABASES):
        raise ValueError('Empresa inválida na verificação de Produtos')

    for tentativa in range(12):
        try:
            for empresa in empresas:
                consultar(token, porta, empresa, limit=1)
            break
        except (HTTPError, OSError) as error:
            if tentativa == 11 or (isinstance(error, HTTPError) and error.code != 503):
                raise
            sleep(2)

    for empresa in empresas:
        for inicio, fim in INTERVALOS:
            conferir(cred / 'sql.json', token, porta, empresa, inicio, fim)

    def historico(indice):
        empresa = empresas[indice % len(empresas)]
        data, ms, idade, tamanho = consultar(token, porta, empresa, limit=50)
        if len(data['linhas']) != min(50, data['total']):
            raise AssertionError('Página de Produtos incompleta')
        return empresa, data['total'], ms, idade, tamanho

    for usuarios in (1, 5, 10):
        with ThreadPoolExecutor(max_workers=usuarios) as pool:
            valores = list(pool.map(historico, range(usuarios)))
        print(json.dumps(dict(historico='todo', usuarios=usuarios, empresas={x[0]: x[1] for x in valores},
                              max_ms=max(x[2] for x in valores), max_idade_s=max(x[3] for x in valores),
                              max_bytes=max(x[4] for x in valores))), flush=True)


if __name__ == '__main__':
    main()
