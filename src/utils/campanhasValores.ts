function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

export function valorReceitaCampanha(item: Record<string, unknown>, codEmpresaBi?: string | null): number {
  const codEmpresa = String(codEmpresaBi ?? item.cod_empresa_bi ?? item.CodEmpresa_bi ?? '').trim();
  const isPelegrini1004 = codEmpresa === '1004' || codEmpresa === '10041';

  if (isPelegrini1004 && hasValue(item.valor_total)) {
    return toNumber(item.valor_total);
  }

  const hasValorVenda = item.valor_venda_item !== undefined && item.valor_venda_item !== null;
  const hasValorDevolucao = item.valor_devolucao_item !== undefined && item.valor_devolucao_item !== null;

  if (hasValorVenda || hasValorDevolucao) {
    return toNumber(item.valor_venda_item) - toNumber(item.valor_devolucao_item);
  }

  if (item.tipo === 'DEVOLUCAO') {
    const devolucao = Math.abs(toNumber(item.valor_devolucao_item));
    if (devolucao > 0) return -devolucao;
    return -Math.abs(toNumber(item.valor_total));
  }

  return toNumber(item.valor_total);
}

export function valorFaturamentoCampanha(item: Record<string, unknown>, codEmpresaBi?: string | null): number {
  const codEmpresa = String(codEmpresaBi ?? item.cod_empresa_bi ?? item.CodEmpresa_bi ?? '').trim();
  const isPelegrini1004 = codEmpresa === '1004' || codEmpresa === '10041';

  if (isPelegrini1004) {
    // Campanhas 1004 precisam reproduzir o relatorio FAT por marca/vendedor.
    // Em devolucoes, o campo liquido final e a base assinada que fecha com a fonte.
    if (String(item.tipo ?? '').toUpperCase() === 'DEVOLUCAO' && hasValue(item.valor_liquido_final_item)) {
      return toNumber(item.valor_liquido_final_item);
    }

    // Para pedidos, a receita ja foi normalizada no fluxo comercial.
    if (hasValue(item.valor_total)) {
      return toNumber(item.valor_total);
    }

    const hasValorVenda = item.valor_venda_item !== undefined && item.valor_venda_item !== null;
    const hasValorDevolucao = item.valor_devolucao_item !== undefined && item.valor_devolucao_item !== null;

    if (hasValorVenda || hasValorDevolucao) {
      return toNumber(item.valor_venda_item) - toNumber(item.valor_devolucao_item);
    }

    return valorReceitaCampanha(item, codEmpresaBi);
  }

  return valorReceitaCampanha(item, codEmpresaBi);
}
