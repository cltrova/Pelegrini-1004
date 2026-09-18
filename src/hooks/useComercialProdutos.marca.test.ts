import { describe, expect, it } from 'vitest';

import { aggregateProdutosPorMarca } from './useComercialProdutos';
import type { ProdutoItem } from '@/types/comercialProdutos';

function item(overrides: Partial<ProdutoItem>): ProdutoItem {
  return {
    id: String(Math.random()),
    cod_produto: 'P-1',
    descricao: 'Produto de teste',
    tipo: 'PEDIDO',
    quantidade: 1,
    valor_unitario: 100,
    valor_total: 100,
    valor_custo: 60,
    marca: 'EATON',
    ...overrides,
  };
}

describe('aggregateProdutosPorMarca', () => {
  it('mantém devoluções isoladas no fim, sem margem ou share', () => {
    const marcas = aggregateProdutosPorMarca([
      item({ marca: 'EATON', valor_total: 100, valor_custo: 60 }),
      item({ marca: 'ZF', tipo: 'PEDIDO', valor_total: 50, valor_custo: 30 }),
      item({ marca: 'ZF', tipo: 'DEVOLUCAO', valor_total: -10, valor_custo: 5 }),
      item({ marca: 'MWM', tipo: 'DEVOLUCAO', valor_total: -40, valor_custo: 20 }),
    ]);

    expect(marcas.map((marca) => marca.marca)).toEqual(['EATON', 'ZF', 'MWM']);
    expect(marcas[2]).toMatchObject({
      somenteDevolucao: true,
      faturamento: -40,
      custo: -20,
      lucro: -20,
      margem: null,
      participacao: 0,
    });
    expect(marcas[1].somenteDevolucao).toBe(false);
    expect(marcas[1].margem).toBeCloseTo(40);
    expect(marcas[1].participacao).toBeGreaterThan(0);
  });

  it('mantém a receita da marca alinhada às notas fiscais quando há venda e devolução', () => {
    const [marca] = aggregateProdutosPorMarca([
      item({ marca: 'ORLI', valor_total: 130, valor_custo: 74.59 }),
      item({ marca: 'ORLI', tipo: 'DEVOLUCAO', quantidade: -1, valor_total: -130, valor_custo: 74.59 }),
    ]);

    expect(marca.faturamento).toBe(130);
    expect(marca.custo).toBe(74.59);
    expect(marca.lucro).toBeCloseTo(55.41, 2);
    expect(marca.quantidade).toBe(1);
    expect(marca.margem).toBeCloseTo(42.623, 2);
    expect(marca.somenteDevolucao).toBe(false);
  });
});
