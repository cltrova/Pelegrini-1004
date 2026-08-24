import type { ComercialKPIs, VendedorPerformance, ClientePerformance, EvolucaoMensal, InsightData } from '@/types/comercial';

interface BuildArgs {
  kpis: ComercialKPIs;
  vendedores: VendedorPerformance[];
  clientes: ClientePerformance[];
  evolucao: EvolucaoMensal[];
  distribuicaoUF: { uf: string; valor: number }[];
  insights?: InsightData[];
  empresa?: string;
}

/**
 * Cria contexto compacto para envio à IA.
 * Reduz volume mantendo apenas top N de cada lista.
 */
export function buildComercialAIContext(args: BuildArgs) {
  const { kpis, vendedores, clientes, evolucao, distribuicaoUF, insights, empresa } = args;

  const margem = kpis.totalValorPedido > 0
    ? ((kpis.faturamentoLiquido - kpis.totalValorCusto) / kpis.faturamentoLiquido) * 100
    : 0;

  const taxaDevolucao = kpis.faturamentoBruto > 0
    ? (kpis.totalDevolucoes / kpis.faturamentoBruto) * 100
    : 0;

  return {
    empresa,
    kpis: {
      faturamento_liquido: Math.round(kpis.faturamentoLiquido),
      faturamento_bruto: Math.round(kpis.faturamentoBruto),
      devolucoes: Math.round(kpis.totalDevolucoes),
      taxa_devolucao_pct: +taxaDevolucao.toFixed(2),
      margem_pct: +margem.toFixed(2),
      ticket_medio: Math.round(kpis.ticketMedio),
      qtd_pedidos: kpis.qtdPedidos,
      qtd_clientes: kpis.qtdClientes,
      qtd_vendedores: kpis.qtdVendedores,
    },
    top_vendedores: vendedores.slice(0, 8).map(v => ({
      nome: v.nome,
      faturamento: Math.round(v.faturamentoLiquido),
      pedidos: v.pedidosFaturados,
      ticket_medio: Math.round(v.ticketMedio || 0),
      meta: v.meta ? Math.round(v.meta) : null,
      atingimento_pct: v.meta && v.meta > 0 ? +((v.faturamentoLiquido / v.meta) * 100).toFixed(1) : null,
    })),
    top_clientes: clientes.slice(0, 8).map(c => ({
      nome: c.fantasia || c.razao,
      uf: c.uf,
      faturamento: Math.round(c.faturamentoLiquido),
      pedidos: c.totalPedidos,
    })),
    evolucao_mensal: evolucao.slice(-6).map(e => ({
      mes: e.mes,
      faturamento: Math.round(e.liquido),
    })),
    top_estados: distribuicaoUF.slice(0, 5).map(d => ({
      uf: d.uf,
      valor: Math.round(d.valor),
    })),
    insights_locais: (insights || []).slice(0, 5).map(i => ({
      tipo: i.tipo,
      titulo: i.titulo,
      descricao: i.descricao,
    })),
  };
}

export type ComercialAIContext = ReturnType<typeof buildComercialAIContext>;
