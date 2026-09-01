import { Minus, Shuffle, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import {
  classifyStockTrend,
  type StockEvolutionPoint,
  type StockMovementTrend,
} from './estoqueIntelligence';

interface EstoqueEvolutionChartProps {
  points: StockEvolutionPoint[];
  movementDataAvailable: boolean;
}

function formatDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}` : value;
}

function formatQuantity(value: number): string {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)} unidades`;
}

const trendConfig: Record<StockMovementTrend, { icon: LucideIcon; label: string }> = {
  increasing: { icon: TrendingUp, label: 'Tendencia crescente' },
  decreasing: { icon: TrendingDown, label: 'Tendencia decrescente' },
  stagnant: { icon: Minus, label: 'Tendencia parada' },
  irregular: { icon: Shuffle, label: 'Tendencia irregular' },
};

export function EstoqueEvolutionChart({ points, movementDataAvailable }: EstoqueEvolutionChartProps) {
  const hasEnoughData = movementDataAvailable && points.length >= 2;
  const trend = hasEnoughData ? trendConfig[classifyStockTrend(points)] : null;
  const TrendIcon = trend?.icon;

  return (
    <section aria-labelledby="stock-evolution-title" className="min-w-0 border-t border-border pt-5">
      <h3 className="text-sm font-semibold text-foreground" id="stock-evolution-title">
        Evolucao estimada do saldo
      </h3>

      {trend && TrendIcon ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
          <TrendIcon aria-hidden="true" className="h-3.5 w-3.5" />
          {trend.label}
        </p>
      ) : null}

      {!hasEnoughData ? (
        <p className="mt-3 text-sm text-muted-foreground">Dados insuficientes para estimar a evolucao.</p>
      ) : (
        <div className="mt-3 h-56 min-w-0" role="img" aria-label="Grafico da evolucao estimada do saldo">
          <ResponsiveContainer height="100%" width="100%">
            <AreaChart data={points} margin={{ bottom: 0, left: 0, right: 12, top: 8 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="date"
                minTickGap={24}
                tickFormatter={formatDate}
                tickLine={false}
              />
              <YAxis axisLine={false} tickLine={false} width={44} />
              <Tooltip
                formatter={(value: number) => [formatQuantity(value), 'Saldo estimado']}
                labelFormatter={(value) => formatDate(String(value))}
              />
              <Area
                dataKey="quantity"
                fill="var(--pelegrini-primary)"
                fillOpacity={0.12}
                isAnimationActive={false}
                name="Saldo estimado"
                stroke="var(--pelegrini-primary)"
                strokeWidth={2}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
