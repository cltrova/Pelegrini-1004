from contextlib import closing
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
import tempfile
from types import SimpleNamespace
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

    def test_painel_preserva_devolucoes_paginacao_busca_e_atualizacao_dos_totais(self):
        entrada = {'cod_pedido': '38', 'num_nf': '7740', 'cliente': 'Oficina União',
                   'vendedor': 'Pessoa de teste'}
        venda_a = registro(11, 1, liquido='30') | entrada
        venda_b = registro(12, 2, liquido='20') | entrada | {'cod_produto': '456', 'produto': 'Outra peça'}
        devolucao_a = registro(13, 3, tipo=1, liquido='-7') | entrada | {
            'num_cfop': '1.411', 'valordevolucao': Decimal('10'),
        }
        devolucao_b = registro(14, 4, tipo=1, liquido='-8.25') | entrada | {
            'num_cfop': '2.202', 'valordescontoitem': Decimal('2'),
            'cod_produto': '789', 'marca': 'Somente devolução',
        }
        self.base.publicar(self.snapshot(1), [venda_a, venda_b, devolucao_a, devolucao_b])
        self.base.preparar_painel()

        def ler(aba, offset=0, limit=50, **params):
            opcoes = dict(aba=aba, vendedores=[], busca='', marca='', tipo=2, codigo='')
            return self.base.consultar_painel(None, None, offset, limit, **(opcoes | params))

        overview = ler('marcas')
        self.assertEqual(overview['totalSkus'], 2)
        self.assertEqual(overview['semGiro'], 1)
        self.assertEqual(ler('sem-giro')['total'], overview['semGiro'])
        self.assertEqual(ler('marcas', movimento=1)['totalSkus'], 0)
        self.assertEqual(ler('resumo', tipo=1, movimento=2)['total'], 0)
        self.assertEqual(ler('categoria', movimento=2)['categorias'][0]['faturamento'], 50)
        self.assertEqual([(x['marca'], x['faturamento']) for x in overview['porMarca']],
                         [('MARCA', 50), ('SOMENTE DEVOLUÇÃO', -6.25)])
        ranking = ler('top', offset=1, limit=1, busca='uniao')
        self.assertEqual((ranking['total'], ranking['somaReceita']), (2, 50))
        self.assertEqual(ranking['produtos'][0]['cod_produto'], '456')
        devolucoes = ler('resumo', limit=1, tipo=1)
        self.assertEqual(devolucoes['total'], 2)
        self.assertEqual(devolucoes['linhas'][0]['receita'], -7)
        self.assertEqual(ler('resumo', offset=1, limit=1, tipo=1)['linhas'][0]['receita'], -6.25)
        self.assertEqual(ler('produto', codigo='123')['pedidos'], 1)
        self.assertEqual(ler('marcas', vendedores=['16'])['totalSkus'], 0)
        old = self.base.estado()
        self.base.publicar(self.snapshot(2), [], documentos={(2, 11)}, esperado=old)
        self.assertEqual(ler('top')['somaReceita'], 20)
        self.assertEqual(ler('marcas')['totalSkus'], 1)
        with self.assertRaises(VersaoTrocada):
            ler('resumo', versao=old[0])


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
        base = SimpleNamespace(documentos_anteriores=lambda movements: [(2, 5)] if movements == [10, 11, 12] else [])
        with patch('produtos_rsys.chaves_alteradas', return_value={table: keys.get(table, []) for table in KEYS}):
            docs = documentos_alterados(cursor, Projecao('', 'FROM dbo.NotasFiscais nf', ''), 1, 5, 6, base,
                                        confirmado=True)
        self.assertEqual(docs, {(1, 20), (2, 5), (2, 7), (2, 8), (2, 32), (2, 40)})
        self.assertIn('K.CodPedido=M.CodPedido', cursor.calls[1][0])
        self.assertIn('K.Codigo=ISNULL(pd.CodVendInterno, nf.CodVendInterno)', cursor.calls[2][0])

    def test_product_price_changes_do_not_reprocess_history(self):
        keys = {table: [(8,)] if table == 'Produtos' else [] for table in KEYS}
        cursor = Cursor([(8, 'Produto', 'Grupo', 'MAR', 'Marca')])
        base = SimpleNamespace(documentos_anteriores=lambda _: [],
                               descricoes_de_produtos=lambda _: [('8', 'Produto', 'Grupo', 'MAR', 'Marca')])
        with patch('produtos_rsys.chaves_alteradas', return_value=keys):
            docs = documentos_alterados(cursor, Projecao('', 'FROM dbo.NotasFiscais nf', ''), 1, 5, 6, base,
                                        confirmado=False)
        self.assertEqual(docs, set())
        self.assertEqual(len(cursor.calls), 1)

    def test_first_chevrolet_reconciliation_corrects_product_membership(self):
        keys = {table: [(8,)] if table == 'Produtos' else [] for table in KEYS}
        cursor = Cursor([(8, 'Produto', 'Grupo', 'MAR', 'Marca')], [(2, 1, 100), (2, 2, 200)])
        base = SimpleNamespace(documentos_anteriores=lambda _: [],
                               descricoes_de_produtos=lambda _: [('8', 'Produto', 'Grupo', 'MAR', 'Marca')],
                               movimentos_de_produtos=lambda _: [(2, 2, 200), (2, 3, 300)])
        with patch('produtos_rsys.chaves_alteradas', return_value=keys):
            docs = documentos_alterados(cursor, Projecao('', 'FROM dbo.NotasFiscais nf', ''), 2, 5, 6, base,
                                        confirmado=False)
        self.assertEqual(docs, {(2, 1), (2, 3)})
