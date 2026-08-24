export function resolverContagemTotalizadorPelegrini(params: {
  produtosQuantidade: number;
  produtosClientes: number;
  produtosPedidosDistintos: number;
  fallbackClientes?: number;
  fallbackPedidos?: number;
  fallbackLinhas?: number;
  vendasOficiais?: number;
  preferirBasePedidos?: boolean;
}): { clientes: number; vendas: number } {
  const clientesFallback = Number(params.fallbackClientes ?? 0);
  const pedidosFallback = Number(params.fallbackPedidos ?? 0);
  const linhasFallback = Number(params.fallbackLinhas ?? 0);
  const vendasOficiais = Number(params.vendasOficiais ?? 0);
  const vendasFallback = vendasOficiais || pedidosFallback || linhasFallback;

  if (params.preferirBasePedidos) {
    return {
      clientes: clientesFallback,
      vendas: vendasFallback,
    };
  }

  return {
    clientes: params.produtosQuantidade > 0
      ? params.produtosClientes
      : clientesFallback,
    vendas: params.produtosQuantidade > 0
      ? params.produtosPedidosDistintos
      : vendasFallback,
  };
}

export function resolverQuantidadeVendasPelegrini(params: {
  isChevrolet10041: boolean;
  movimentosVenda: number;
  pedidosDistintos: number;
}): number {
  return params.isChevrolet10041
    ? Number(params.movimentosVenda || 0)
    : Number(params.pedidosDistintos || 0);
}
