import {
  CircleDollarSign,
  CircleOff,
  Package,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import { EnterpriseMetricCard, type EnterpriseTone } from '@/components/enterprise';

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
  tone: EnterpriseTone;
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
      tone: 'info',
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
      tone: 'negative',
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
      tone: 'warning',
    },
  ];

  return (
    <section
      aria-label="Resumo do estoque"
      className="enterprise-grid-metrics"
    >
      {summaries.map((summary) => {
        const Icon = summary.icon;
        const active = summary.key !== 'value' && activeFilter === summary.key;

        if (summary.key === 'value') {
          return (
            <EnterpriseMetricCard
              data-stock-summary
              data-tone={summary.tone}
              icon={<Icon className="h-4 w-4" />}
              key={summary.key}
              label={summary.label}
              tone={summary.tone}
              value={summary.value}
            />
          );
        }

        return (
          <EnterpriseMetricCard
            aria-label={`${summary.label}: ${summary.value}`}
            aria-pressed={active}
            className={active ? 'border-primary bg-primary/[0.07]' : undefined}
            data-stock-summary
            data-tone={summary.tone}
            icon={<Icon className="h-4 w-4" />}
            key={summary.key}
            label={summary.label}
            onClick={() => onFilterChange(active ? 'all' : summary.key as StockQuickFilter)}
            tone={active ? 'info' : summary.tone}
            value={summary.value}
          />
        );
      })}
    </section>
  );
}
