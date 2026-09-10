import { ComercialMetricStrip } from '@/components/comercial/compact';
import { formatCurrency, formatInteger, formatNumber } from '@/utils/formatters';
import type { CotacaoOrigem, CotacoesKpis as CotacoesKpisBase } from '@/types/cotacoesComerciais';

export interface CotacoesKpisDisplay extends CotacoesKpisBase {
  tempoMedioEmAberto?: number;
  cotacoesVencidas?: number;
  motivoMaisFrequente?: string | null;
}

interface CotacoesKpisProps {
  mode: CotacaoOrigem;
  kpis: CotacoesKpisDisplay;
}

export function CotacoesKpis({ mode, kpis }: CotacoesKpisProps) {
  const cells = mode === 'abertas'
    ? [
      { label: 'Cotacoes abertas', value: formatInteger(kpis.quantidade) },
      { label: 'Valor em aberto', value: formatCurrency(kpis.valorTotal) },
      { label: 'Tempo medio em aberto', value: `${formatNumber(kpis.tempoMedioEmAberto ?? 0, 1)} dias` },
      { label: 'Cotacoes vencidas', value: formatInteger(kpis.cotacoesVencidas ?? 0), tone: 'danger' as const },
    ]
    : [
      { label: 'Vendas perdidas', value: formatInteger(kpis.quantidade) },
      { label: 'Valor perdido', value: formatCurrency(kpis.valorTotal), tone: 'danger' as const },
      { label: 'Ticket medio perdido', value: formatCurrency(kpis.ticketMedio) },
      { label: 'Motivo mais frequente', value: kpis.motivoMaisFrequente || 'Nao informado' },
    ];

  return <ComercialMetricStrip ariaLabel="Indicadores comerciais" mode={mode} metrics={cells} />;
}
