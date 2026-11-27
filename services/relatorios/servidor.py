"""Consulta por um gateway interno que já autorizou a empresa e o usuário."""
from datetime import date, datetime, timezone
import gzip
from hmac import compare_digest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import BoundedSemaphore
from time import perf_counter
from urllib.parse import parse_qs, urlsplit

from historico import RelatorioVencido, VALIDADE, VersaoTrocada, linhas_json


ROTA = '/interno/relatorios/vendas-perdidas'
ROTA_PRODUTOS = '/interno/relatorios/produtos'
PARAMETROS = {'cod_empresa_bi', 'inicio', 'fim', 'offset', 'limit', 'versao'}


def data(texto):
    if texto is None:
        return None
    valor = date.fromisoformat(texto)
    if valor.isoformat() != texto:
        raise ValueError('Data fora do formato ISO')
    return valor


def aceita_gzip(header):
    for encoding in header.lower().split(','):
        name, *parameters = encoding.strip().split(';')
        if name.strip() == 'gzip':
            return all(float(p.partition('=')[2]) > 0 for p in parameters if p.strip().startswith('q='))
    return False


def servidor(bases, token, porta, *, produtos=None):
    if len(token) < 32 or not token.isascii():
        raise ValueError('Configure o segredo do gateway interno')
    esperado = ('Bearer ' + token).encode('ascii')
    consultas = BoundedSemaphore(10)
    rotas = {ROTA: bases}
    if produtos is not None:
        rotas[ROTA_PRODUTOS] = produtos

    class Consulta(BaseHTTPRequestHandler):
        timeout = 5

        def log_message(self, *_args):
            return

        def enviar(self, codigo, payload, *, origem=None, versao=None, tempo=None):
            body = linhas_json(payload).encode('utf-8')
            try:
                comprimir = len(body) >= 2048 and aceita_gzip(self.headers.get('Accept-Encoding', ''))
            except ValueError:
                comprimir = False
            if comprimir:
                body = gzip.compress(body, compresslevel=3, mtime=0)
            if origem and datetime.now(timezone.utc) - origem >= VALIDADE:
                self.enviar(503, {'code': 'DATA_UNAVAILABLE'})
                return
            self.send_response(codigo)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'private, no-store')
            self.send_header('Vary', 'Accept-Encoding')
            if comprimir:
                self.send_header('Content-Encoding', 'gzip')
            if origem:
                self.send_header('X-Data-As-Of', origem.isoformat())
                self.send_header('X-Data-Version', versao)
            if tempo is not None:
                self.send_header('Server-Timing', f'local;dur={tempo:.1f}')
            if codigo == 503:
                self.send_header('Retry-After', '5')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            url = urlsplit(self.path)
            if url.path not in rotas:
                self.enviar(404, {'code': 'NOT_FOUND'})
                return
            autorizacao = self.headers.get_all('Authorization') or []
            if len(autorizacao) != 1 or not compare_digest(autorizacao[0].encode('latin1'), esperado):
                self.enviar(401, {'code': 'UNAUTHORIZED'})
                return
            try:
                filtros = PARAMETROS | {'vendedor'} if url.path == ROTA_PRODUTOS else PARAMETROS
                pares = parse_qs(url.query, keep_blank_values=True, max_num_fields=len(filtros))
                if set(pares) - filtros or any(len(v) != 1 for v in pares.values()):
                    raise ValueError('Filtro desconhecido ou repetido')
                params = {key: value[0] for key, value in pares.items()}
                inicio, fim = data(params.get('inicio')), data(params.get('fim'))
                offset, limit = int(params.get('offset', 0)), int(params.get('limit', 50))
                if offset > 2_147_483_647:
                    raise ValueError('Página muito grande')
                versao = params.get('versao')
                extra = {}
                if 'vendedor' in params:
                    vendedor = int(params['vendedor'])
                    if not 0 <= vendedor <= 2_147_483_647:
                        raise ValueError('Vendedor inválido')
                    extra['vendedor'] = vendedor
            except ValueError:
                self.enviar(422, {'code': 'INVALID_FILTER'})
                return
            base = rotas[url.path].get(params.get('cod_empresa_bi'))
            if not base:
                self.enviar(403, {'code': 'FORBIDDEN'})
                return
            if not consultas.acquire(blocking=False):
                self.enviar(503, {'code': 'DATA_UNAVAILABLE'})
                return
            try:
                start = perf_counter()
                resultado = base.consultar(inicio, fim, offset, limit, versao=versao, **extra)
                elapsed = (perf_counter() - start) * 1000
            except ValueError:
                self.enviar(422, {'code': 'INVALID_FILTER'})
            except VersaoTrocada:
                self.enviar(409, {'code': 'VERSION_CHANGED'})
            except RelatorioVencido:
                self.enviar(503, {'code': 'DATA_UNAVAILABLE'})
            else:
                self.enviar(200, resultado, origem=resultado['origem'], versao=resultado['versao'], tempo=elapsed)
            finally:
                consultas.release()

    return ThreadingHTTPServer(('127.0.0.1', porta), Consulta)


def main():
    import argparse
    from contextlib import ExitStack, closing
    import logging
    from pathlib import Path
    from historico import FILIAIS, Historico

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--diretorio', type=Path, required=True)
    parser.add_argument('--token-file', type=Path, required=True)
    parser.add_argument('--porta', type=int, default=8328)
    parser.add_argument('--produtos-sql-credencial', type=Path,
                        help='Abre as bases de Produtos e ativa a atualização incremental')
    parser.add_argument('--produtos-porta-tunel', type=int)
    parser.add_argument('--somente-produtos', action='store_true')
    options = parser.parse_args()
    if options.somente_produtos and not options.produtos_sql_credencial:
        parser.error('--somente-produtos exige --produtos-sql-credencial')
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    with ExitStack() as cleanup:
        bases = {} if options.somente_produtos else {
            empresa: cleanup.enter_context(closing(Historico(options.diretorio, empresa, filial)))
            for empresa, filial in FILIAIS.items()
        }
        produtos = None
        if options.produtos_sql_credencial:
            from produtos import Produtos
            from sincronizar_produtos import executar_atualizacoes

            produtos = {empresa: cleanup.enter_context(closing(Produtos(options.diretorio, empresa)))
                        for empresa in FILIAIS}
            cleanup.enter_context(executar_atualizacoes(produtos, options.produtos_sql_credencial,
                                                        porta_tunel=options.produtos_porta_tunel))
        with servidor(bases, options.token_file.read_text(encoding='ascii').strip(), options.porta,
                      produtos=produtos) as api:
            api.serve_forever()


if __name__ == '__main__':
    main()
