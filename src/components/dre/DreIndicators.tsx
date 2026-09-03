import { TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react';
import { EnterpriseMetricCard } from '@/components/enterprise';
import { DreIndicator } from '@/types/dre';
import { formatCurrency, formatPercent } from '@/utils/formatters';

interface DreIndicatorsProps {
  indicators: DreIndicator[];
}

export function DreIndicators({ indicators }: DreIndicatorsProps) {
  const getIcon = (label: string) => {
    if (label.toLowerCase().includes('receita')) {
      return <TrendingUp className="h-5 w-5" />;
    }
    if (label.toLowerCase().includes('despesa')) {
      return <TrendingDown className="h-5 w-5" />;
    }
    if (label.toLowerCase().includes('margem')) {
      return <Percent className="h-5 w-5" />;
    }
    return <DollarSign className="h-5 w-5" />;
  };

  const formatValue = (indicator: DreIndicator) => {
    if (indicator.percentual !== undefined) {
      return formatPercent(indicator.percentual);
    }
    return formatCurrency(indicator.value);
  };

  const mapTone = (color?: string) => {
    if (color === 'positive') return 'positive';
    if (color === 'negative') return 'negative';
    return 'neutral';
  };

  return (
    <div className="enterprise-grid-metrics">
      {indicators.map((indicator, index) => (
        <EnterpriseMetricCard
          key={index}
          icon={getIcon(indicator.label)}
          label={indicator.label}
          context={indicator.trend === 'up' ? 'Positivo' : indicator.trend === 'down' ? 'Negativo' : undefined}
          tone={mapTone(indicator.color)}
          value={formatValue(indicator)}
        />
      ))}
    </div>
  );
}
