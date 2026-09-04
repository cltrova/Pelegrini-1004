import {
  CircleDollarSign,
  CircleOff,
  Gauge,
  Info,
  Package,
  PackageMinus,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import { PelegriniResponsiveValue } from '@/components/pelegrini';
import { cn } from '@/lib/utils';

import { isStockExcess, type StockProductInsight, type StockQuickFilter } from './estoqueIntelligence';

interface EstoqueSummaryCardsProps {
  products: StockProductInsight[];
  activeFilter: StockQuickFilter;
  movementAvailable?: boolean;
  onFilterChange: (filter: StockQuickFilter) => void;
}

type SummaryKey = StockQuickFilter | 'value';

interface SummaryItem {
  key: SummaryKey;
  label: string;
  value: string;
  icon: LucideIcon;
  tone: 'neutral' | 'information' | 'attention' | 'danger';
  description: string;
  interactive: boolean;
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
});

export function EstoqueSummaryCards({
  products,
  activeFilter,
  movementAvailable = true,
  onFilterChange,
}: EstoqueSummaryCardsProps) {
  const excessCapital = products
    .filter(isStockExcess)
    .reduce((total, item) => total + item.valor_estoque, 0);
  const summaries: SummaryItem[] = [
    {
      key: 'all',
      label: 'Produtos',
      value: products.length.toLocaleString('pt-BR'),
      icon: Package,
      tone: 'information',
      description: 'Fonte: estoque. Periodo: consulta atual. Regra: quantidade de produtos retornados.',
      interactive: true,
    },
    {
      key: 'value',
      label: 'Valor do estoque',
      value: currencyFormatter.format(products.reduce((total, item) => total + item.valor_estoque, 0)),
      icon: CircleDollarSign,
      tone: 'neutral',
      description: 'Fonte: estoque. Periodo: consulta atual. Regra: soma do valor em estoque dos produtos retornados.',
      interactive: false,
    },
    {
      key: 'out',
      label: 'Sem estoque',
      value: products.filter((item) => item.status === 'out').length.toLocaleString('pt-BR'),
      icon: CircleOff,
      tone: 'danger',
      description: 'Fonte: estoque. Periodo: consulta atual. Regra: quantidade menor ou igual a zero.',
      interactive: true,
    },
    {
      key: 'low',
      label: 'Estoque baixo',
      value: products.filter((item) => item.status === 'low').length.toLocaleString('pt-BR'),
      icon: PackageMinus,
      tone: 'attention',
      description: 'Fontes: estoque e movimentacoes. Periodo: consulta atual e ultimos 90 dias. Regra: cobertura entre 15 e 30 dias.',
      interactive: true,
    },
    {
      key: 'critical',
      label: 'Criticos',
      value: products.filter((item) => item.status === 'critical').length.toLocaleString('pt-BR'),
      icon: TriangleAlert,
      tone: 'danger',
      description: 'Fontes: estoque e movimentacoes. Periodo: consulta atual e ultimos 90 dias. Regra: cobertura menor que 15 dias.',
      interactive: true,
    },
    {
      key: 'excess',
      label: 'Capital em excesso',
      value: movementAvailable ? currencyFormatter.format(excessCapital) : 'Dados insuficientes',
      icon: Gauge,
      tone: 'attention',
      description: 'Fontes: estoque e movimentacoes. Periodo: consulta atual e ultimos 90 dias. Regra: cobertura superior a 90 dias em produtos disponiveis com movimentacao.',
      interactive: movementAvailable,
    },
  ];

  return (
    <section
      aria-label="Resumo do estoque"
      className="grid min-w-0 grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    >
      {summaries.map((summary) => {
        const Icon = summary.icon;
        const active = summary.interactive && activeFilter === summary.key;
        const tooltipId = `estoque-summary-tooltip-${summary.key}`;
        const content = (
          <>
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/40 text-muted-foreground">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1">
                <span className="block break-words text-[9px] font-semibold uppercase leading-tight text-muted-foreground">
                  {summary.label}
                </span>
                <Info aria-hidden="true" className="h-3 w-3 shrink-0 text-muted-foreground" />
              </span>
              <PelegriniResponsiveValue
                className="mt-1 block min-w-0 max-w-full break-words font-semibold tabular-nums text-foreground"
                size="md"
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
          'pelegrini-metric-card relative flex min-h-16 min-w-0 max-w-full items-center gap-2 rounded-md border border-border/70 bg-card px-2.5 py-2 text-left shadow-sm',
          'transition-[border-color,background-color,box-shadow] duration-150',
          active
            ? 'border-primary/45 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.18)]'
            : 'text-foreground',
        );

        const card = summary.interactive ? (
          <button
            aria-describedby={tooltipId}
            aria-label={`${summary.label}: ${summary.value}`}
            aria-pressed={active}
            className={cn(
              className,
              'h-full w-full hover:border-primary/30 hover:bg-muted/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            )}
            data-stock-summary
            data-tone={summary.tone}
            onClick={() => onFilterChange(active ? 'all' : summary.key as StockQuickFilter)}
            type="button"
          >
            {content}
          </button>
        ) : (
          <article
            aria-describedby={tooltipId}
            aria-label={`${summary.label}: ${summary.value}`}
            className={cn(className, 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2')}
            data-stock-summary
            data-tone={summary.tone}
            tabIndex={0}
          >
            {content}
          </article>
        );

        return (
          <div key={summary.key} className="group relative h-full min-w-0 overflow-visible">
            {card}
            <span
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none absolute inset-x-2 top-full z-30 mt-1 hidden whitespace-normal break-words rounded-md border border-border bg-popover px-3 py-2 text-xs leading-5 text-popover-foreground shadow-md group-hover:block group-focus-within:block"
            >
              {summary.description}
            </span>
          </div>
        );
      })}
    </section>
  );
}
