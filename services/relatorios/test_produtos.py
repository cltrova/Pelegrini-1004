from contextlib import closing
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from historico import RelatorioVencido, VersaoTrocada
from produtos import Produtos
from produtos_rsys import (KEYS, Projecao, RecargaNecessaria, Snapshot, documentos_alterados,
                          validar_versao)


def registro(doc, mov, *, dia=date(2026, 11, 24), vendedor=15, liquido='12.0550', tipo=2, filial=1):
    return dict(tipo_documento=tipo, cod_documento=doc, codempresa_bi=1004, cod_empresa=filial,
                data_movimento=dia, num_lancamento=mov, cod_vendedor=vendedor, cod_produto='123',
                produto='Produto', marca='Marca', grupo_produto='Grupo', quantidade=Decimal('1.5'),
                valorvenda=Decimal(liquido) if tipo == 2 else None, valorliquidofinal=Decimal(liquido),
                valordevolucao=-Decimal(liquido) if tipo == 1 else None, valor_custo=Decimal('7.5'))


class ProdutosTest(unittest.TestCase):
    def setUp(self):
        scratch = self.enterContext(tempfile.TemporaryDirectory())
        self.base = self.enterContext(closing(Produtos(Path(scratch), '1004')))
        self.origem = datetime.now(timezone.utc) - timedelta(seconds=10)

    def snapshot(self, version):
        return Snapshot(self.origem + timedelta(seconds=version), version, 'database-fork-query')

    def test_dirty_documents_remove_old_rows_and_keep_other_kinds(self):
        self.base.publicar(self.snapshot(1), [registro(7, 1), registro(7, 2, tipo=1, liquido='-2.55'),
                                            registro(10, 3, vendedor=16)])
        primeira = self.base.consultar(None, None, 1, 1)
        self.assertEqual(primeira['total'], 3)
        self.assertEqual(primeira['resumo']['liquido'], Decimal('21.5600'))
        self.assertEqual(set(self.base.documentos_anteriores([1, 2, 3])), {(2, 7), (1, 7), (2, 10)})

        self.base.publicar(self.snapshot(2), [registro(10, 1, liquido='5.1000')],
                          documentos={(2, 7), (2, 10)}, esperado=self.base.estado())
        with self.assertRaises(VersaoTrocada):
            self.base.consultar(None, None, 0, 10, versao=primeira['versao'])
        atual = self.base.consultar(None, None, 0, 10)
        self.assertEqual(atual['total'], 2)
        self.assertEqual(atual['resumo']['liquido'], Decimal('2.5500'))
        self.assertEqual(atual['ranking']['marca'], [('Marca', 2, Decimal('3'), Decimal('2.55'))])
        self.assertEqual(self.base.consultar(None, None, 0, 10, vendedor=16)['total'], 0)

    def test_no_changes_advance_watermark_and_keep_the_pagination_version(self):
        self.base.publicar(self.snapshot(1), [registro(7, 1)])
        anterior = self.base.estado()
        self.base.publicar(self.snapshot(2), [], documentos=set(), esperado=anterior)
        self.assertEqual(self.base.estado()[0], anterior[0])
        self.assertEqual(self.base.estado()[1], self.snapshot(2).origem)
        self.assertEqual(self.base.estado()[3], 2)

    def test_wrong_scope_failed_import_and_expiration(self):
        self.base.publicar(self.snapshot(1), [registro(7, 1)])
        anterior = self.base.estado()
        with self.assertRaises(ValueError):
            self.base.publicar(self.snapshot(2), [registro(7, 1, filial=2)], esperado=anterior)
        self.assertEqual(self.base.estado(), anterior)
        with self.assertRaises(RecargaNecessaria):
            self.base.publicar(self.snapshot(2), [], documentos=set())
        old = Snapshot(self.origem - timedelta(seconds=60), 3, 'database-fork-query')
        with tempfile.TemporaryDirectory() as scratch, closing(Produtos(Path(scratch), '1004')) as outra:
            outra.publicar(old, [registro(7, 1)], verificar_idade=False)
            with self.assertRaises(RelatorioVencido):
                outra.consultar(None, None, 0, 1)

    def test_partial_capture_does_not_answer_for_the_whole_history(self):
        inicio, fim = date(2026, 11, 24), date(2026, 12, 1)
        self.base.publicar(self.snapshot(1), [registro(7, 1)], cobertura=(inicio, fim))
        self.assertEqual(self.base.consultar(inicio, date(2026, 11, 30), 0, 1)['total'], 1)
        with self.assertRaises(RelatorioVencido):
            self.base.consultar(None, None, 0, 1)
        with self.assertRaises(RelatorioVencido):
            self.base.consultar(inicio, fim, 0, 1)

    def test_bootstrap_resumes_after_failed_batch_and_waits_for_change_tracking(self):
        inicio, meio, fim = date(2026, 11, 24), date(2026, 11, 25), date(2026, 11, 26)
        self.base.publicar(self.snapshot(1), [], cobertura=(inicio, fim), confirmado=False)
        first = self.base.estado()
        self.assertEqual(self.base.gravar_lote_inicial(first, inicio, meio, [registro(7, 1)]), 1)
        intermediate = self.base.estado()
        self.assertEqual(intermediate[8], meio)

        def falhar():
            yield registro(9, 2, dia=meio)
            raise TimeoutError('carga interrompida')

        with self.assertRaises(TimeoutError):
            self.base.gravar_lote_inicial(intermediate, meio, fim, falhar())
        self.assertEqual(self.base.estado(), intermediate)
        self.base.gravar_lote_inicial(intermediate, meio, fim, [registro(9, 2, dia=meio)])
        load = self.base.estado()
        self.assertEqual(load[4], 2)
        self.assertIsNone(load[8])
        with self.assertRaises(RelatorioVencido):
            self.base.consultar(None, None, 0, 1)
        self.base.publicar(self.snapshot(2), [], documentos=set(), esperado=load)
        self.assertEqual(self.base.consultar(None, None, 0, 1)['total'], 2)


class Cursor:
    def __init__(self, *results):
        self.results = iter(results)
        self.calls = []

    def execute(self, sql, params=()):
        self.calls.append((sql, params))

    def fetchall(self):
        return next(self.results)

    fetchone = fetchall


class SourceTest(unittest.TestCase):
    def test_minimum_version_validated_for_every_dependency(self):
        minima = [5] * len(KEYS)
        cursor = Cursor(tuple(minima))
        validar_versao(cursor, 5, 10)
        self.assertTrue(all(f'dbo.{table}' in cursor.calls[0][0] for table in KEYS))
        for invalid in (6, None):
            with self.assertRaises(RecargaNecessaria):
                validar_versao(Cursor((*minima[:-1], invalid)), 5, 10)

    def test_deleted_and_moved_items_invalidate_both_documents(self):
        keys = {'NotasFiscais': [(1, 1, 20)], 'MovEstoque': [(1, 10), (1, 11)],
                'MovEstoqueImposto': [(1, 12)], 'Pedidos': [(1, 90)], 'Vendedores': [(8,)]}
        cursor = Cursor([(2, 7), (2, 8)], [(2, 32)], [(2, 40)])
        with patch('produtos_rsys.chaves_alteradas', return_value={table: keys.get(table, []) for table in KEYS}):
            docs = documentos_alterados(cursor, Projecao('', 'FROM dbo.NotasFiscais nf', ''), 1, 5, 6,
                                       lambda movements: [(2, 5)] if movements == [10, 11, 12] else [])
        self.assertEqual(docs, {(1, 20), (2, 5), (2, 7), (2, 8), (2, 32), (2, 40)})
        self.assertIn('K.CodPedido=M.CodPedido', cursor.calls[1][0])
        self.assertIn('K.Codigo=ISNULL(pd.CodVendInterno, nf.CodVendInterno)', cursor.calls[2][0])
