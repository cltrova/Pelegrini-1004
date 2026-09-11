import { AlertTriangle, CircleDollarSign, Gauge, PackageCheck, PackageX, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';

import type { GiroProductSummary, GiroStatus } from '@/types/estoque';

import { EstoqueMetricStrip, type EstoqueMetric } from './EstoqueMetricStrip';
import { buildGiroManagementSummary, GIRO_STATUS_RULES } from './giroIntelligence';

interface Props {
  products: GiroProductSummary[];
  activeStatuses: GiroStatus[];
  onStatusFilterChange: (statuses: GiroStatus[]) => void;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function GiroManagementPanel({ products, activeStatuses, onStatusFilterChange }: Props) {
  const summary = useMemo(() => buildGiroManagementSummary(products), [products]);
  const metrics: EstoqueMetric[] = [
    { key: 'atendendo', label: 'Atendendo', value: String(summary.counts.atendendo), icon: PackageCheck, tone: 'neutral', interactive: true, description: GIRO_STATUS_RULES.atendendo },
    { key: 'alerta', label: 'Alerta', value: String(summary.counts.alerta), icon: AlertTriangle, tone: 'attention', interactive: true, description: GIRO_STATUS_RULES.alerta },
    { key: 'faltando', label: 'Ruptura', value: String(summary.counts.faltando), icon: PackageX, tone: 'danger', interactive: true, description: GIRO_STATUS_RULES.faltando },
    { key: 'excesso', label: 'Excesso', value: String(summary.counts.excesso), icon: TrendingUp, tone: 'information', interactive: true, description: GIRO_STATUS_RULES.excesso },
    { key: 'idle', label: 'Capital parado', value: currency.format(summary.idleCapital), icon: CircleDollarSign, tone: 'attention', interactive: false, description: 'Estimativa: soma do valor de produtos em excesso ou com estoque e sem venda ha mais de 90 dias.' },
    { key: 'coverage', label: 'Cobertura media', value: summary.knownCoverageCount ? `${summary.averageKnownCoverageMonths.toFixed(1)} meses` : 'Dados insuficientes', icon: Gauge, tone: 'neutral', interactive: false, description: 'Media da cobertura calculada somente para produtos com baseline de vendas conhecido no periodo selecionado.' },
  ];

  return (
    <EstoqueMetricStrip
      activeKeys={activeStatuses}
      className="operational-panel"
      metrics={metrics}
      onMetricClick={(key) => {
        if (!['atendendo', 'alerta', 'faltando', 'excesso'].includes(key)) return;
        const status = key as GiroStatus;
        onStatusFilterChange(
          activeStatuses.includes(status)
            ? activeStatuses.filter((activeStatus) => activeStatus !== status)
            : [...activeStatuses, status],
        );
      }}
    />
  );
}
