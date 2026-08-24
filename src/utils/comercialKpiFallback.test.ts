import { describe, expect, it } from 'vitest';
import {
  resolverContagemTotalizadorPelegrini,
  resolverQuantidadeVendasPelegrini,
} from './comercialKpiFallback';

describe('resolverContagemTotalizadorPelegrini', () => {
  it('usa a fonte de produtos quando ela tem dados', () => {
    expect(resolverContagemTotalizadorPelegrini({
      produtosQuantidade: 10,
      produtosClientes: 7,
      produtosPedidosDistintos: 5,
      fallbackClientes: 99,
      fallbackPedidos: 88,
    })).toEqual({ clientes: 7, vendas: 5 });
  });

  it('evita zero falso usando fallback quando produtos ainda esta vazio', () => {
    expect(resolverContagemTotalizadorPelegrini({
      produtosQuantidade: 0,
      produtosClientes: 0,
      produtosPedidosDistintos: 0,
      fallbackClientes: 1_398,
      fallbackPedidos: 5_665,
      fallbackLinhas: 9_940,
    })).toEqual({ clientes: 1_398, vendas: 5_665 });
  });

  it('usa a base de pedidos quando ela e a fonte validada do cliente 10041', () => {
    expect(resolverContagemTotalizadorPelegrini({
      produtosQuantidade: 9_940,
      produtosClientes: 2_569,
      produtosPedidosDistintos: 5_532,
      fallbackClientes: 1_394,
      fallbackPedidos: 2_380,
      preferirBasePedidos: true,
    })).toEqual({ clientes: 1_394, vendas: 2_380 });
  });

  it('prioriza a quantidade oficial do totalizador quando disponivel', () => {
    expect(resolverContagemTotalizadorPelegrini({
      produtosQuantidade: 9_940,
      produtosClientes: 2_569,
      produtosPedidosDistintos: 5_532,
      fallbackClientes: 2_310,
      fallbackPedidos: 4_730,
      vendasOficiais: 5_665,
      preferirBasePedidos: true,
    })).toEqual({ clientes: 2_310, vendas: 5_665 });
  });

  it('no cliente 10041 usa quantidade de movimentos em vez de pedidos distintos', () => {
    expect(resolverQuantidadeVendasPelegrini({
      isChevrolet10041: true,
      movimentosVenda: 5_665,
      pedidosDistintos: 4_730,
    })).toBe(5_665);

    expect(resolverQuantidadeVendasPelegrini({
      isChevrolet10041: false,
      movimentosVenda: 5_665,
      pedidosDistintos: 4_730,
    })).toBe(4_730);
  });
});
