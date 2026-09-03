import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { DreGroupSummary } from '@/types/dre';
import { formatCurrency, formatCompactNumber } from '@/utils/formatters';

interface DreGroupChartProps {
  data: DreGroupSummary[];
}

type GroupChartTooltipPayload = {
  payload?: {
    total?: number;
  };
};

export function DreGroupChart({ data }: DreGroupChartProps) {
  const chartData = useMemo(() => {
    return data.slice(0, 8).map((item) => ({
      ...item,
      absTotal: Math.abs(item.total),
    }));
  }, [data]);

  const getBarColor = (value: number) => {
    if (value > 0) return 'hsl(142, 71%, 45%)'; // success
    if (value < 0) return 'hsl(0, 72%, 51%)'; // destructive
    return 'hsl(220, 9%, 46%)'; // neutral
  };

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <h3 className="font-semibold text-foreground mb-4">Distribuição por Grupo</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              tickFormatter={(value) => formatCompactNumber(value)}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis
              type="category"
              dataKey="grupo"
              width={120}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickFormatter={(value) =>
                value.length > 15 ? `${value.slice(0, 15)}...` : value
              }
            />
            <Tooltip
              formatter={(_value: number, _name: string, props: GroupChartTooltipPayload) => [
                formatCurrency(props.payload?.total ?? 0),
                'Valor',
              ]}
              labelFormatter={(label) => label}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Bar dataKey="absTotal" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.total)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
