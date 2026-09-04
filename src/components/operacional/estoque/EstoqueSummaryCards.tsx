import {
  CircleDollarSign,
  CircleOff,
  Gauge,
  Package,
  PackageMinus,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import { EnterpriseMetricCard, type EnterpriseTone } from '@/components/enterprise';

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
  tone: EnterpriseTone;
  detail?: string;
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
      tone: 'info',
      detail: 'Total retornado na consulta atual',
      interactive: true,
    },
    {
      key: 'value',
      label: 'Valor do estoque',
      value: currencyFormatter.format(products.reduce((total, item) => total + item.valor_estoque, 0)),
      icon: CircleDollarSign,
      tone: 'neutral',
      detail: 'Soma do valor em estoque',
      interactive: false,
    },
    {
      key: 'out',
      label: 'Sem estoque',
      value: products.filter((item) => item.status === 'out').length.toLocaleString('pt-BR'),
      icon: CircleOff,
      tone: 'negative',
      detail: 'Quantidade menor ou igual a zero',
      interactive: true,
    },
    {
      key: 'low',
      label: 'Estoque baixo',
      value: products.filter((item) => item.status === 'low').length.toLocaleString('pt-BR'),
      icon: PackageMinus,
      tone: 'warning',
      detail: 'Cobertura entre 15 e 30 dias',
      interactive: true,
    },
    {
      key: 'critical',
      label: 'Criticos',
      value: products.filter((item) => item.status === 'critical').length.toLocaleString('pt-BR'),
      icon: TriangleAlert,
      tone: 'negative',
      detail: 'Cobertura menor que 15 dias',
      interactive: true,
    },
    {
      key: 'excess',
      label: 'Capital em excesso',
      value: movementAvailable ? currencyFormatter.format(excessCapital) : 'Dados insuficientes',
      icon: Gauge,
      tone: 'warning',
      detail: 'Cobertura superior a 90 dias',
      interactive: movementAvailable,
    },
  ];

  return (
    <section aria-label="Resumo do estoque" className="enterprise-grid-metrics">
      {summaries.map((summary) => {
        const Icon = summary.icon;
        const active = summary.interactive && activeFilter === summary.key;

        return (
          <EnterpriseMetricCard
            aria-label={`${summary.label}: ${summary.value}`}
            aria-pressed={summary.interactive ? active : undefined}
            className={active ? 'border-primary bg-primary/[0.07]' : undefined}
            data-stock-summary
            data-tone={summary.tone}
            detail={summary.detail}
            icon={<Icon className="h-4 w-4" />}
            key={summary.key}
            label={summary.label}
            onClick={summary.interactive ? () => onFilterChange(active ? 'all' : summary.key as StockQuickFilter) : undefined}
            tone={active ? 'info' : summary.tone}
            value={summary.value}
          />
        );
      })}
    </section>
  );
}
