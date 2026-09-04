import { describe, expect, it } from 'vitest';
import { estoqueFixture, giroFixture, NOW } from './estoqueFixtures';
import { buildStockActionInsights } from './assistantInsights';

const stock = estoqueFixture[0];
const sale = giroFixture[0];

describe('buildStockActionInsights', () => {
  it('identifica saldo zerado com venda recente', () => {
    const insights = buildStockActionInsights(
      [{ ...stock, quantidade_estoque: 0, valor_estoque: 0 }],
      [{ ...sale, data_movimento: '2026-08-25', saida_venda: 3 }],
      NOW,
    );

    expect(insights).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'rupture-risk', severity: 'critical', productCode: '101' }),
    ]));
  });

  it('identifica excesso com vendas baixas pela cobertura observada', () => {
    const insights = buildStockActionInsights(
      [{ ...stock, quantidade_estoque: 100, valor_estoque: 50_000 }],
      [{ ...sale, data_movimento: '2026-06-03', saida_venda: 10 }],
      NOW,
    );

    expect(insights).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'excess-low-sales', severity: 'warning', productCode: '101' }),
    ]));
  });

  it('identifica produto com mais de 90 dias sem venda', () => {
    const insights = buildStockActionInsights(
      [{ ...stock, data_ultima_venda: '2026-05-01' }],
      [],
      NOW,
    );

    expect(insights).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'no-sale-90-days', productCode: '101' }),
    ]));
  });

  it('identifica compra sem movimentacao posterior', () => {
    const insights = buildStockActionInsights(
      [{ ...stock, data_ultima_compra: '2026-08-20', data_ultima_venda: '2026-08-10' }],
      [{ ...sale, data_movimento: '2026-08-10', saida_venda: 2 }],
      NOW,
    );

    expect(insights).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'purchase-without-later-movement', productCode: '101' }),
    ]));
  });

  it('nao cria falso insight para datas ausentes, invalidas ou futuras', () => {
    const invalid = [
      { ...stock, cod_produto: 1, data_ultima_venda: null, data_ultima_compra: null },
      { ...stock, cod_produto: 2, data_ultima_venda: '2026-02-30', data_ultima_compra: 'invalida' },
      { ...stock, cod_produto: 3, data_ultima_venda: '2026-10-01', data_ultima_compra: '2026-10-01' },
      { ...stock, cod_produto: 4, data_ultima_venda: '2026-05-01-invalid', data_ultima_compra: '2026-08-20-extra' },
    ];

    expect(buildStockActionInsights(invalid, [], NOW)).toEqual([]);
  });

  it('retorna lista vazia sem dados', () => {
    expect(buildStockActionInsights([], [], NOW)).toEqual([]);
  });

  it('aceita somente datas civis ou timestamps ISO completos e validos', () => {
    const insights = buildStockActionInsights(
      [{ ...stock, data_ultima_venda: '2026-05-01T10:30:00-03:00' }],
      [],
      NOW,
    );

    expect(insights).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'no-sale-90-days', productCode: '101' }),
    ]));
  });

  it('isola vendas pelo par empresa e produto', () => {
    const insights = buildStockActionInsights(
      [
        { ...stock, cod_empresa: 1, produto: 'PRODUTO EMPRESA A', quantidade_estoque: 0, data_ultima_venda: null, data_ultima_compra: null, tipo_relatorio: 'FILIAL SEPARADA' },
        { ...stock, cod_empresa: 2, produto: 'PRODUTO EMPRESA B', quantidade_estoque: 0, data_ultima_venda: null, data_ultima_compra: null, tipo_relatorio: 'FILIAL SEPARADA' },
      ],
      [{ ...sale, cod_empresa: 1, data_movimento: '2026-08-25', saida_venda: 3 }],
      NOW,
    );

    expect(insights.filter(({ kind }) => kind === 'rupture-risk')).toEqual([
      expect.objectContaining({ productName: 'PRODUTO EMPRESA A' }),
    ]);
  });

  it('nao usa movimento posterior de outra empresa para uma compra', () => {
    const insights = buildStockActionInsights(
      [{ ...stock, cod_empresa: 2, produto: 'PRODUTO EMPRESA B', data_ultima_compra: '2026-08-20', data_ultima_venda: null, tipo_relatorio: 'FILIAL SEPARADA' }],
      [{ ...sale, cod_empresa: 1, data_movimento: '2026-08-25', saida_venda: 3 }],
      NOW,
    );

    expect(insights).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'purchase-without-later-movement', productName: 'PRODUTO EMPRESA B' }),
    ]));
  });

  it('une movimentos de empresas irmas para estoque consolidado', () => {
    const insights = buildStockActionInsights(
      [{ ...stock, cod_empresa_bi: 1004, cod_empresa: 1, quantidade_estoque: 0, data_ultima_venda: null, data_ultima_compra: null, tipo_relatorio: 'FILIAL CONSOLIDADA' }],
      [{ ...sale, cod_empresa_bi: 1004, cod_empresa: 2, data_movimento: '2026-08-25', saida_venda: 3 }],
      NOW,
    );

    expect(insights).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'rupture-risk', productCode: '101' }),
    ]));
  });

  it('nunca une movimentos de outro cod_empresa_bi', () => {
    const insights = buildStockActionInsights(
      [{ ...stock, cod_empresa_bi: 1004, cod_empresa: 1, quantidade_estoque: 0, data_ultima_venda: null, data_ultima_compra: null, tipo_relatorio: 'FILIAL CONSOLIDADA' }],
      [{ ...sale, cod_empresa_bi: 10041, cod_empresa: 1, data_movimento: '2026-08-25', saida_venda: 3 }],
      NOW,
    );

    expect(insights.filter(({ kind }) => kind === 'rupture-risk')).toEqual([]);
  });
});
