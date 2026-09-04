import { useMemo } from 'react';
import { AlertTriangle, ArrowRight, CircleAlert, Info } from 'lucide-react';
import type { EstoqueRecord, GiroRecord } from '@/types/estoque';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { buildStockActionInsights, type StockActionInsight } from './estoque/assistantInsights';

interface Props {
  data: EstoqueRecord[];
  giroData?: GiroRecord[];
  now?: Date;
  onProductAction?: (productCode: string) => void;
}

const TITLES: Record<StockActionInsight['kind'], string> = {
  'rupture-risk': 'Risco de ruptura',
  'excess-low-sales': 'Excesso com baixa venda',
  'no-sale-90-days': 'Sem venda ha mais de 90 dias',
  'purchase-without-later-movement': 'Compra sem movimento posterior',
};

const ICONS = { critical: CircleAlert, warning: AlertTriangle, info: Info };
const STYLES = {
  critical: 'border-red-500/35 bg-red-500/[0.04]',
  warning: 'border-amber-500/35 bg-amber-500/[0.04]',
  info: 'border-sky-500/35 bg-sky-500/[0.04]',
};

export function EstoqueInsights({ data, giroData = [], now, onProductAction }: Props) {
  const insights = useMemo(() => buildStockActionInsights(data, giroData, now), [data, giroData, now]);

  if (insights.length === 0) {
    return (
      <p className="py-3 text-sm text-muted-foreground" data-testid="stock-insights-empty">
        Nenhuma acao deterministica identificada para os dados atuais.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border border-y border-border" aria-label="Insights locais de estoque" role="list">
      {insights.map((insight, index) => {
        const Icon = ICONS[insight.severity];
        return (
          <article className={cn('grid min-w-0 gap-3 border-l-2 px-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]', STYLES[insight.severity])}
            role="listitem"
            key={`${insight.kind}:${insight.productCode}:${index}`}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 space-y-1.5">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                <h3 className="text-sm font-semibold">{TITLES[insight.kind]}</h3>
                <span className="truncate text-xs text-muted-foreground">{insight.productCode} · {insight.productName}</span>
              </div>
              <p className="text-sm text-foreground/90">{insight.reason}</p>
              <p className="text-xs font-medium text-primary">{insight.recommendedAction}</p>
              <p className="text-[11px] text-muted-foreground">Fonte: {insight.sourceLabel} · Periodo: {insight.periodLabel}</p>
            </div>
            {onProductAction && (
              <Button className="h-8 self-center gap-1.5 text-xs" onClick={() => onProductAction(insight.productCode)} size="sm" type="button" variant="outline">
                Abrir produto <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </article>
        );
      })}
    </div>
  );
}
