from datetime import date, datetime, timezone
from decimal import Decimal
import gzip
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import unittest

from historico import Historico, Registro
from servidor import servidor


class RelatoriosHttpTest(unittest.TestCase):
    def setUp(self):
        self.files = TemporaryDirectory()
        self.db = Historico(Path(self.files.name), '10041', 2)
        self.server = servidor({'10041': self.db}, 't' * 48, 0)
        thread = Thread(target=self.server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(self.files.cleanup)
        self.addCleanup(self.db.close)
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        self.url = f'http://127.0.0.1:{self.server.server_port}/interno/relatorios/vendas-perdidas'

    def get(self, query, token='t' * 48):
        return urlopen(Request(self.url + '?' + query, headers={
            'Authorization': 'Bearer ' + token, 'Accept-Encoding': 'gzip',
        }), timeout=2)

    def test_recusa_requisicao_anonima_e_escopo_indisponivel(self):
        with self.assertRaises(HTTPError) as unauthorized:
            self.get('cod_empresa_bi=10041', token='indevido')
        self.assertEqual(unauthorized.exception.code, 401)
        with self.assertRaises(HTTPError) as forbidden:
            self.get('cod_empresa_bi=1004')
        self.assertEqual(forbidden.exception.code, 403)

    def test_sem_leitura_atual_tem_503_em_vez_de_sucesso_vazio(self):
        with self.assertRaises(HTTPError) as unavailable:
            self.get('cod_empresa_bi=10041')
        self.assertEqual(unavailable.exception.code, 503)
        self.assertEqual(json.load(unavailable.exception)['code'], 'DATA_UNAVAILABLE')

    def test_preserva_metadados_da_origem_e_comprime_pagina_grande(self):
        fonte = datetime.now(timezone.utc)
        versao = self.db.publicar(fonte, [
            Registro(2, date.today(), 'A', 1, Decimal('1.20'), {'descricao': 'teste ' * 500}),
        ])
        with self.get('cod_empresa_bi=10041&limit=1') as response:
            self.assertEqual(response.headers['X-Data-Version'], versao)
            self.assertEqual(response.headers['X-Data-As-Of'], fonte.isoformat())
            self.assertEqual(response.headers['Content-Encoding'], 'gzip')
            self.assertEqual(response.headers['Cache-Control'], 'private, no-store')
            self.assertEqual(json.loads(gzip.decompress(response.read()))['linhas'][0]['descricao'], 'teste ' * 500)


if __name__ == '__main__':
    unittest.main()
