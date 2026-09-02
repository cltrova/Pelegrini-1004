import {
  CircleDollarSign,
  CircleOff,
  Package,
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
      key: 'out',
      label: 'Sem estoque',
      value: products.filter((item) => item.status === 'out').length.toLocaleString('pt-BR'),
      icon: CircleOff,
      tone: 'danger',
    },
    {
      key: 'attention',
      label: 'Exigem atencao',
      value: products.filter((item) => (
        item.status === 'out' ||
        item.status === 'critical' ||
        item.status === 'low' ||
        item.stagnantDays > 90
      )).length.toLocaleString('pt-BR'),
      icon: TriangleAlert,
      tone: 'attention',
    },
  ];

  return (
    <section
      aria-label="Resumo do estoque"
      className="grid min-w-0 grid-cols-2 border-y border-border/70 bg-muted/10 lg:grid-cols-4"
    >
      {summaries.map((summary) => {
        const Icon = summary.icon;
        const active = summary.key !== 'value' && activeFilter === summary.key;
        const content = (
          <>
            <span aria-hidden="true" className="hidden h-8 w-8 shrink-0 items-center justify-center text-muted-foreground sm:flex">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] font-semibold uppercase text-muted-foreground">
                {summary.label}
              </span>
              <PelegriniResponsiveValue
                className="block min-w-0 whitespace-nowrap font-semibold tabular-nums text-foreground"
                size="sm"
              >
                {summary.value}
              </PelegriniResponsiveValue>
            </span>
            <span
              aria-hidden="true"
              className={cn('absolute inset-y-0 left-0 w-1', active ? 'bg-current' : 'bg-transparent')}
            />
          </>
        );
        const className = cn(
          'relative flex min-h-16 min-w-0 max-w-full items-center gap-2 overflow-hidden px-3 py-2 text-left',
          'transition-[border-color,background-color] duration-150',
          active
            ? 'bg-primary/[0.07] text-primary'
            : 'text-foreground',
          'border-r border-border/70 last:border-r-0 even:border-r-0 lg:even:border-r lg:last:border-r-0',
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
