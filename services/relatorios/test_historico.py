from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from historico import Historico, RelatorioVencido, VersaoTrocada, Registro


ORIGEM = datetime(2026, 11, 27, 12, tzinfo=timezone.utc)
DIA = date(2026, 11, 20)


def linha(nota, valor, vendedor=47, filial=2):
    return Registro(filial, DIA, nota, vendedor, Decimal(valor), {'Pedido.Codigo Pedido': nota})


class HistoricoTest(unittest.TestCase):
    def setUp(self):
        self.files = TemporaryDirectory()
        self.db = Historico(Path(self.files.name), '10041', 2)
        self.addCleanup(self.files.cleanup)
        self.addCleanup(self.db.close)

    def test_calcula_totais_de_todo_recorte_e_pagina_os_detalhes(self):
        versao = self.db.publicar(ORIGEM, [linha('A', '2.50'), linha('B', '1'), linha('B', '3', 14)])
        primeira = self.db.consultar(DIA, DIA, 0, 1, versao=versao, agora=ORIGEM)
        segunda = self.db.consultar(DIA, DIA, 1, 1, versao=versao, agora=ORIGEM)
        self.assertEqual(primeira['total'], 3)
        self.assertEqual(primeira['pedidos'], 2)
        self.assertEqual(primeira['valor_itens'], '6.5000')
        self.assertEqual(primeira['ranking'][0]['vendedor'], 47)
        self.assertNotEqual(primeira['linhas'], segunda['linhas'])
        self.assertEqual(primeira['origem'], ORIGEM)

    def test_rotacao_remove_registros_antigos_e_invalida_pagina_da_versao_anterior(self):
        anterior = self.db.publicar(ORIGEM, [linha('A', '1'), linha('B', '4')])
        self.db.publicar(ORIGEM + timedelta(seconds=10), [linha('B', '9'), linha('C', '2')])
        with self.assertRaises(VersaoTrocada):
            self.db.consultar(None, None, 1, 1, versao=anterior, agora=ORIGEM + timedelta(seconds=10))
        resultado = self.db.consultar(None, None, 0, 100, agora=ORIGEM + timedelta(seconds=10))
        self.assertEqual({r['Pedido.Codigo Pedido'] for r in resultado['linhas']}, {'B', 'C'})
        self.assertEqual(resultado['valor_itens'], '11.0000')

    def test_recusa_contaminacao_e_vencimento_mesmo_depois_de_reabrir(self):
        versao = self.db.publicar(ORIGEM, [linha('A', '1')])
        with self.assertRaises(ValueError):
            self.db.publicar(ORIGEM + timedelta(seconds=10), [linha('B', '3', filial=1)])
        outro = Historico(Path(self.files.name), '1004', 1)
        self.addCleanup(outro.close)
        with self.assertRaises(RelatorioVencido):
            outro.consultar(None, None, 0, 1, agora=ORIGEM)
        self.assertEqual(self.db.consultar(None, None, 0, 1, agora=ORIGEM + timedelta(seconds=59))['versao'], versao)
        with self.assertRaises(RelatorioVencido):
            self.db.consultar(None, None, 0, 1, agora=ORIGEM + timedelta(seconds=60))

    def test_falha_na_carga_preserva_a_versao_e_rejeita_relogio_retrocedido(self):
        versao = self.db.publicar(ORIGEM, [linha('A', '1')])
        def carga_interrompida():
            yield linha('B', '2')
            raise OSError('Falhou antes de terminar a leitura')
        with self.assertRaises(OSError):
            self.db.publicar(ORIGEM + timedelta(seconds=1), carga_interrompida())
        with self.assertRaises(ValueError):
            self.db.publicar(ORIGEM - timedelta(seconds=1), [linha('C', '3')])
        self.assertEqual(self.db.consultar(None, None, 0, 1, agora=ORIGEM)['versao'], versao)


if __name__ == '__main__':
    unittest.main()
