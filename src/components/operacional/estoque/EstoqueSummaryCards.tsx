import {
  CircleDollarSign,
  CircleOff,
  Package,
  PauseCircle,
  Siren,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import { PelegriniResponsiveValue } from '@/components/pelegrini';
import { cn } from '@/lib/utils';

import type { StockProductInsight, StockQuickFilter } from './estoqueIntelligence';

interface EstoqueSummaryCardsProps {
  products: StockProductInsight[];
  activeFilter: StockQuickFilter;
  onFilterChange: (filter: StockQuickFilter) => void;
}

type SummaryKey = StockQuickFilter | 'value';

interface SummaryItem {
  key: SummaryKey;
  label: string;
  value: string;
  icon: LucideIcon;
  tone: 'neutral' | 'information' | 'attention' | 'danger';
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
});

export function EstoqueSummaryCards({
  products,
  activeFilter,
  onFilterChange,
}: EstoqueSummaryCardsProps) {
  const summaries: SummaryItem[] = [
    {
      key: 'all',
      label: 'Produtos',
      value: products.length.toLocaleString('pt-BR'),
      icon: Package,
      tone: 'information',
    },
    {
      key: 'value',
      label: 'Valor estimado',
      value: currencyFormatter.format(products.reduce((total, item) => total + item.valor_estoque, 0)),
      icon: CircleDollarSign,
      tone: 'neutral',
    },
    {
      key: 'critical',
      label: 'Criticos',
      value: products.filter((item) => item.status === 'critical').length.toLocaleString('pt-BR'),
      icon: Siren,
      tone: 'danger',
    },
    {
      key: 'low',
      label: 'Estoque baixo',
      value: products.filter((item) => item.status === 'low').length.toLocaleString('pt-BR'),
      icon: TriangleAlert,
      tone: 'attention',
    },
    {
      key: 'out',
      label: 'Sem estoque',
      value: products.filter((item) => item.status === 'out').length.toLocaleString('pt-BR'),
      icon: CircleOff,
      tone: 'danger',
    },
    {
      key: 'stagnant',
      label: 'Parados',
      value: products.filter((item) => item.stagnantDays > 90).length.toLocaleString('pt-BR'),
      icon: PauseCircle,
      tone: 'attention',
    },
  ];

  return (
    <section
      aria-label="Resumo do estoque"
      className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6"
    >
      {summaries.map((summary) => {
        const Icon = summary.icon;
        const active = summary.key !== 'value' && activeFilter === summary.key;
        const content = (
          <>
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-current/20 bg-background/70"
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block break-words text-[11px] font-semibold uppercase text-muted-foreground">
                {summary.label}
              </span>
              <PelegriniResponsiveValue
                className="mt-1 block min-w-0 break-words font-semibold tabular-nums text-foreground"
                size="sm"
              >
                {summary.value}
              </PelegriniResponsiveValue>
              {active && (
                <span className="mt-1 block text-[10px] font-semibold uppercase text-foreground">
                  Filtro ativo
                </span>
              )}
            </span>
            <span
              aria-hidden="true"
              className={cn('absolute inset-y-0 left-0 w-1', active ? 'bg-current' : 'bg-transparent')}
            />
          </>
        );
        const className = cn(
          'relative flex min-h-24 min-w-0 max-w-full items-start gap-3 overflow-hidden rounded-lg border bg-card p-3 text-left',
          'transition-[border-color,background-color] duration-150',
          active
            ? 'border-[color:var(--pelegrini-accent,hsl(var(--primary)))] bg-muted/40 ring-1 ring-[color:var(--pelegrini-accent,hsl(var(--primary)))]'
            : 'border-border',
        );

        if (summary.key === 'value') {
          return (
            <article className={className} data-stock-summary data-tone={summary.tone} key={summary.key}>
              {content}
            </article>
          );
        }

        return (
          <button
            aria-label={`${summary.label}: ${summary.value}`}
            aria-pressed={active}
            className={cn(
              className,
              'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            )}
            data-stock-summary
            data-tone={summary.tone}
            key={summary.key}
            onClick={() => onFilterChange(active ? 'all' : summary.key as StockQuickFilter)}
            type="button"
          >
            {content}
          </button>
        );
      })}
    </section>
  );
}
