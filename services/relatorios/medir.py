"""Mede a capacidade do piloto com dados sintéticos em um diretório temporário."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack, closing, contextmanager
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from resource import RUSAGE_SELF, getrusage
from secrets import token_urlsafe
from tempfile import TemporaryDirectory
from threading import Event, Thread
from time import perf_counter
from urllib.request import Request, urlopen
import gzip
import json

from historico import FILIAIS, Historico, Registro
from servidor import ROTA, servidor


def disco(diretorio):
    tamanho = 0
    for path in diretorio.rglob('*'):
        try:
            if path.is_file():
                tamanho += path.stat().st_size
        except FileNotFoundError:
            continue
    return tamanho


def recursos(diretorio):
    usage = getrusage(RUSAGE_SELF)
    rss = next(line for line in Path('/proc/self/status').read_text().splitlines() if line.startswith('VmRSS:'))
    return {
        'rss_mib': round(int(rss.split()[1]) / 1024, 2),
        'pico_rss_mib': round(usage.ru_maxrss / 1024, 2),
        'cpu_segundos': round(usage.ru_utime + usage.ru_stime, 3),
        'disco_mib': round(disco(diretorio) / 1024**2, 2),
    }


@contextmanager
def observar(diretorio):
    parar = Event()
    pico = {'pico_disco_mib': disco(diretorio) / 1024**2, 'pico_vcpu_amostrado': 0.0}
    def acompanhar():
        antes = recursos(diretorio)
        ts = perf_counter()
        while not parar.wait(0.1):
            atual = recursos(diretorio)
            agora = perf_counter()
            pico['pico_disco_mib'] = max(pico['pico_disco_mib'], atual['disco_mib'])
            taxa = (atual['cpu_segundos'] - antes['cpu_segundos']) / (agora - ts)
            pico['pico_vcpu_amostrado'] = max(pico['pico_vcpu_amostrado'], taxa)
            antes, ts = atual, agora
    thread = Thread(target=acompanhar, daemon=True)
    thread.start()
    try:
        yield pico
    finally:
        parar.set()
        thread.join()


def carga(filial, tamanho):
    for i in range(tamanho):
        yield Registro(filial, date(2010, 1, 1) + timedelta(days=i % 6000), str(i), i % 80,
                       Decimal('3.25'), {'descricao': f'Peça de teste {i}', 'filial': filial})


def medir():
    with TemporaryDirectory(prefix='pelegrini-medicao-') as temp, ExitStack() as cleanup:
        diretorio = Path(temp)
        bases = {empresa: cleanup.enter_context(closing(Historico(diretorio, empresa, filial)))
                 for empresa, filial in FILIAIS.items()}
        def carregar(empresa):
            bases[empresa].publicar(datetime.now(timezone.utc), carga(FILIAIS[empresa], 10_000))
        for empresa in bases:
            carregar(empresa)
        token = token_urlsafe(32)
        api = cleanup.enter_context(servidor(bases, token, 0))
        Thread(target=api.serve_forever, daemon=True).start()
        cleanup.callback(api.shutdown)
        print(json.dumps({'dados': 'sinteticos', 'linhas_por_empresa': 10_000, 'repouso': recursos(diretorio)}), flush=True)

        def usuario(id_):
            empresa = ('1004', '10041')[id_ % 2]
            filial = FILIAIS[empresa]
            url = f'http://127.0.0.1:{api.server_port}{ROTA}?cod_empresa_bi={empresa}&limit=50'
            tempos, idades, bytes_rede = [], [], []
            for _ in range(8):
                inicio = perf_counter()
                req = Request(url, headers={'Authorization': f'Bearer {token}', 'Accept-Encoding': 'gzip'})
                with urlopen(req, timeout=10) as resposta:
                    body = resposta.read()
                    bytes_rede.append(len(body))
                    as_of = datetime.fromisoformat(resposta.headers['X-Data-As-Of'])
                    idades.append((datetime.now(timezone.utc) - as_of).total_seconds())
                    payload = json.loads(gzip.decompress(body) if resposta.headers['Content-Encoding'] == 'gzip' else body)
                assert payload['total'] == 10_000
                assert len(payload['linhas']) == 50 and all(r['filial'] == filial for r in payload['linhas'])
                tempos.append((perf_counter() - inicio) * 1000)
            return max(tempos), max(idades), max(bytes_rede)

        with ThreadPoolExecutor(max_workers=2) as sync:
            for n, atualizar in [(1, False), (5, False), (10, False), (10, True)]:
                with observar(diretorio) as picos:
                    futures = [sync.submit(carregar, empresa) for empresa in bases] if atualizar else []
                    with ThreadPoolExecutor(max_workers=n) as pool:
                        leitura = list(pool.map(usuario, range(n)))
                    for f in futures:
                        f.result()
                print(json.dumps({'usuarios': n, 'atualizacoes_simultaneas': atualizar, 'amostras': n * 8,
                                  'maior_ms': round(max(num for num, _, _ in leitura), 2),
                                  'maior_idade_s': round(max(age for _, age, _ in leitura), 2),
                                  'maior_resposta_bytes': max(size for _, _, size in leitura),
                                  **recursos(diretorio), **{k: round(v, 2) for k, v in picos.items()}}), flush=True)


if __name__ == '__main__':
    medir()
