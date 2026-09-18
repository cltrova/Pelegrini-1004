import { describe, expect, it } from 'vitest';
import { aggregateProdutosPorMarca, aggregateTopProdutos } from './useComercialProdutos';
import type { ProdutoItem } from '@/types/comercialProdutos';

function produto(overrides: Partial<ProdutoItem>): ProdutoItem {
  return {
    id: String(overrides.id ?? Math.random()),
    cod_produto: '1',
    descricao: 'Produto teste',
    tipo: 'PEDIDO',
    quantidade: 1,
    valor_unitario: 100,
    valor_total: 100,
    ...overrides,
  };
}

describe('aggregateTopProdutos', () => {
  const movimentos = [
    produto({ id: 'v1', cod_produto: '10', descricao: 'Venda A', tipo: 'PEDIDO', quantidade: 2, valor_total: 200 }),
    produto({ id: 'v2', cod_produto: '10', descricao: 'Venda A', tipo: 'PEDIDO', quantidade: 1, valor_total: 100 }),
    produto({ id: 'd1', cod_produto: '10', descricao: 'Venda A', tipo: 'DEVOLUCAO', quantidade: -1, valor_total: -80 }),
    produto({ id: 'd2', cod_produto: '20', descricao: 'Devolucao B', tipo: 'DEVOLUCAO', quantidade: -2, valor_total: -120 }),
  ];

  it('mantem devolucoes fora do ranking de receitas', () => {
    expect(aggregateTopProdutos(movimentos, 'receitas')).toEqual([
      expect.objectContaining({
        cod_produto: '10',
        quantidade: 3,
        faturamento: 300,
        pedidos: 2,
        participacao: 100,
      }),
    ]);
  });

  it('cria um ranking exclusivo de devolucoes com valores positivos', () => {
    expect(aggregateTopProdutos(movimentos, 'devolucoes')).toEqual([
      expect.objectContaining({ cod_produto: '20', quantidade: 2, faturamento: 120, participacao: 60 }),
      expect.objectContaining({ cod_produto: '10', quantidade: 1, faturamento: 80, participacao: 40 }),
    ]);
  });
});

describe('aggregateProdutosPorMarca', () => {
  it('estorna receita e custo das devolucoes ao calcular lucro e margem', () => {
    const movimentos = [
      produto({ id: 'v1', cod_produto: '10', marca: 'INDISA', quantidade: 1, valor_total: 1_200.41, valor_custo: 1_080.37 }),
      produto({ id: 'v2', cod_produto: '20', marca: 'INDISA', quantidade: 5, valor_total: 1_770.83, valor_custo: 1_096.07 }),
      produto({ id: 'd1', cod_produto: '10', marca: 'INDISA', tipo: 'DEVOLUCAO', quantidade: -1, valor_total: -1_200.41, valor_custo: 1_080.37 }),
      produto({ id: 'd2', cod_produto: '30', marca: 'RETROVEX', tipo: 'DEVOLUCAO', quantidade: -1, valor_total: -34, valor_custo: 15.92 }),
      produto({ id: 'd3', cod_produto: '31', marca: 'YMAX', tipo: 'DEVOLUCAO', quantidade: -2, valor_total: -68.40, valor_custo: 22.31 }),
      produto({ id: 'z1', cod_produto: '31', marca: 'YMAX', tipo: 'PEDIDO', quantidade: 0, valor_total: 0, valor_custo: 22.31 }),
      produto({ id: 'v3', cod_produto: '32', marca: 'NEGATIVA', tipo: 'PEDIDO', quantidade: 1, valor_total: 10, valor_custo: 4 }),
      produto({ id: 'd4', cod_produto: '32', marca: 'NEGATIVA', tipo: 'DEVOLUCAO', quantidade: -1, valor_total: -20, valor_custo: 12 }),
    ];

    const marcas = aggregateProdutosPorMarca(movimentos);
    expect(marcas).toEqual(expect.arrayContaining([
      expect.objectContaining({
        marca: 'INDISA',
        faturamento: expect.closeTo(1_770.83, 8),
        custo: expect.closeTo(1_096.07, 8),
        lucro: expect.closeTo(674.76, 8),
        margem: expect.closeTo(38.1041658431, 8),
        somenteDevolucao: false,
      }),
      expect.objectContaining({
        marca: 'RETROVEX', faturamento: -34, lucro: expect.closeTo(-18.08, 8), margem: null, somenteDevolucao: true,
      }),
      expect.objectContaining({
        marca: 'YMAX', faturamento: -68.4, margem: null, somenteDevolucao: true,
      }),
    ]));
    expect(marcas.find((marca) => marca.marca === 'NEGATIVA')).toEqual(expect.objectContaining({
      somenteDevolucao: false,
      faturamento: -10,
      margem: null,
    }));
    expect(marcas.find((marca) => marca.marca === 'YMAX')?.participacao).toBe(0);
  });
});
