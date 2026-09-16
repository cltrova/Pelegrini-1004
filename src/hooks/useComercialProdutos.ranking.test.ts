import { describe, expect, it } from 'vitest';
import { aggregateTopProdutos } from './useComercialProdutos';
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
