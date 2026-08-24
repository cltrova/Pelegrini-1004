import { TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';
import { DreIndicator } from '@/types/dre';
import { formatCurrency, formatPercent } from '@/utils/formatters';

type StatCardColor = 'default' | 'positive' | 'negative' | 'primary' | 'accent';

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

  const mapColor = (color?: string): StatCardColor => {
    if (color === 'positive' || color === 'negative' || color === 'primary' || color === 'accent') {
      return color;
    }
    return 'default';
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {indicators.map((indicator, index) => (
        <StatCard
          key={index}
          title={indicator.label}
          value={formatValue(indicator)}
          color={mapColor(indicator.color)}
          trend={indicator.trend}
          trendValue={indicator.trend === 'up' ? 'Positivo' : indicator.trend === 'down' ? 'Negativo' : undefined}
          icon={getIcon(indicator.label)}
        />
      ))}
    </div>
  );
}
