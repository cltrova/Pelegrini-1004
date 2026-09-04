import { CircleDollarSign, CircleOff, Gauge, Package, PackageMinus, TriangleAlert } from 'lucide-react';

import { EstoqueMetricStrip, type EstoqueMetric } from './EstoqueMetricStrip';
import { isStockExcess, type StockProductInsight, type StockQuickFilter } from './estoqueIntelligence';

interface EstoqueSummaryCardsProps {
  products: StockProductInsight[];
  activeFilter: StockQuickFilter;
  movementAvailable?: boolean;
  onFilterChange: (filter: StockQuickFilter) => void;
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
  const summaries: EstoqueMetric[] = [
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

  const handleMetricClick = (key: string) => {
    const filter = key as StockQuickFilter;
    onFilterChange(activeFilter === filter ? 'all' : filter);
  };

  return (
    <section aria-label="Resumo do estoque" className="min-w-0 shrink-0">
      <EstoqueMetricStrip
        activeKey={activeFilter}
        metrics={summaries}
        onMetricClick={handleMetricClick}
      />
    </section>
  );
}
