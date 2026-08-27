import { CircleAlert, Clock3, FileText, Landmark } from 'lucide-react';
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
      { label: 'Cotacoes abertas', value: formatInteger(kpis.quantidade), icon: FileText },
      { label: 'Valor em aberto', value: formatCurrency(kpis.valorTotal), icon: Landmark },
      { label: 'Tempo medio em aberto', value: `${formatNumber(kpis.tempoMedioEmAberto ?? 0, 1)} dias`, icon: Clock3 },
      { label: 'Cotacoes vencidas', value: formatInteger(kpis.cotacoesVencidas ?? 0), icon: CircleAlert },
    ]
    : [
      { label: 'Vendas perdidas', value: formatInteger(kpis.quantidade), icon: FileText },
      { label: 'Valor perdido', value: formatCurrency(kpis.valorTotal), icon: Landmark },
      { label: 'Ticket medio perdido', value: formatCurrency(kpis.ticketMedio), icon: Landmark },
      { label: 'Motivo mais frequente', value: kpis.motivoMaisFrequente || 'Nao informado', icon: CircleAlert },
    ];

  return (
    <section aria-label="Indicadores de cotacoes" className="grid grid-cols-2 border border-border sm:grid-cols-4">
      {cells.map(({ label, value, icon: Icon }) => (
        <div key={label} className="min-w-0 border-b border-r border-border px-3 py-3 last:border-r-0 sm:border-b-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </div>
          <p className="mt-1 truncate text-sm font-semibold tabular-nums" title={value}>{value}</p>
        </div>
      ))}
    </section>
  );
}
