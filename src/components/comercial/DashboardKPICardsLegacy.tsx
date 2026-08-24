import { Card, CardContent } from '@/components/ui/card';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { useEffect, useRef, useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  Package,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ComercialKPIs } from '@/types/comercial';

interface DashboardKPIsProps {
  kpis: ComercialKPIs;
}

interface KPICardProps {
  title: string;
  value: number;
  formatter: (v: number) => string;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'primary' | 'success' | 'warning' | 'destructive' | 'accent';
  index: number;
  sparkData?: number[];
  onClick?: () => void;
}

function useCountAnimation(target: number, duration = 1200) {
  const [current, setCurrent] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target === prevTarget.current) return;
    const start = prevTarget.current;
    prevTarget.current = target;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(start + (target - start) * eased);
      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }, [target, duration]);

  return current;
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 64;
  const h = 24;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });

  const areaPoints = [...points, `${w},${h}`, `0,${h}`].join(' ');
  const linePoints = points.join(' ');

  return (
    <svg width={w} height={h} className="opacity-70 group-hover:opacity-100 transition-opacity duration-300">
      <polygon points={areaPoints} fill={color} opacity="0.15" />
      <polyline
        points={linePoints}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={(data.length - 1) / (data.length - 1) * w}
        cy={h - ((data[data.length - 1] - min) / range) * (h - 4) - 2}
        r="2.5"
        fill={color}
      />
    </svg>
  );
}

const borderColors: Record<string, string> = {
  primary: 'hsl(var(--primary))',
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  destructive: 'hsl(var(--destructive))',
  accent: 'hsl(var(--accent))',
};

function KPICard({ title, value, formatter, subtitle, icon, color, index, sparkData, onClick }: KPICardProps) {
  const animatedValue = useCountAnimation(value);

  const colorClasses = {
    primary: 'from-primary/20 to-primary/5 border-primary/30',
    success: 'from-success/20 to-success/5 border-success/30',
    warning: 'from-warning/20 to-warning/5 border-warning/30',
    destructive: 'from-destructive/20 to-destructive/5 border-destructive/30',
    accent: 'from-accent/20 to-accent/5 border-accent/30',
  };

  const iconColors = {
    primary: 'bg-primary/25 text-primary shadow-primary/20',
    success: 'bg-success/25 text-success shadow-success/20',
    warning: 'bg-warning/25 text-warning shadow-warning/20',
    destructive: 'bg-destructive/25 text-destructive shadow-destructive/20',
    accent: 'bg-accent/25 text-accent shadow-accent/20',
  };

  const trend = (() => {
    if (!sparkData || sparkData.length < 4) return null;
    const half = Math.floor(sparkData.length / 2);
    const a = sparkData.slice(0, half).reduce((s, v) => s + v, 0) / half;
    const b = sparkData.slice(half).reduce((s, v) => s + v, 0) / (sparkData.length - half);
    if (a <= 0) return null;
    const delta = ((b - a) / a) * 100;
    if (Math.abs(delta) < 0.5) return { delta: 0, dir: 'flat' as const };
    return { delta, dir: delta > 0 ? ('up' as const) : ('down' as const) };
  })();

  return (
    <Card
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={cn(
        'bg-gradient-to-br premium-card kpi-premium glow-border-hover group overflow-hidden relative',
        onClick ? 'cursor-pointer hover:ring-2 hover:ring-primary/40 transition' : 'cursor-default',
        colorClasses[color],
        `stagger-${index + 1}`
      )}
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: borderColors[color],
      }}
    >

      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            'rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-12 h-11 w-11 shadow-lg',
            iconColors[color]
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-extrabold text-xl mono-value truncate tracking-tight">
              {formatter(animatedValue)}
            </p>
            {sparkData && <MiniSparkline data={sparkData} color={borderColors[color]} />}
          </div>
          <p className="text-[11px] text-muted-foreground truncate font-medium flex items-center gap-1.5">
            {title}
            {trend && (
              <span className={cn('trend-badge', trend.dir)}>
                {trend.dir === 'up' && '▲'}
                {trend.dir === 'down' && '▼'}
                {trend.dir === 'flat' && '—'}
                {trend.dir !== 'flat' && `${Math.abs(trend.delta).toFixed(1)}%`}
              </span>
            )}
          </p>
          {subtitle && (
            <p className="text-[10px] text-muted-foreground/70 truncate flex items-center gap-1">
              <TrendingUp className="h-2.5 w-2.5" />
              {subtitle}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function generateSparkData(value: number): number[] {
  const points = 8;
  const result: number[] = [];
  for (let i = 0; i < points; i++) {
    const ratio = 0.4 + (i / (points - 1)) * 0.6;
    const jitter = 1 + (Math.sin(i * 2.5 + value * 0.0001) * 0.18);
    result.push(value * ratio * jitter);
  }
  return result;
}

const fmtCurrency = (v: number) => formatCurrency(v, true);
const fmtNumber = (v: number) => formatNumber(Math.round(v));

export function DashboardKPICardsLegacy({ kpis, onReceitaClick }: DashboardKPIsProps & { onReceitaClick?: () => void }) {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const showDevolucoes = String(codEmpresaAtiva ?? '') === '1001' || String(codEmpresaAtiva ?? '') === '1004' || String(codEmpresaAtiva ?? '') === '10041';
  return (
    <div className={cn(
      'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3',
      showDevolucoes ? '2xl:grid-cols-8' : '2xl:grid-cols-7'
    )}>
      <KPICard
        title="Valor Total Pedido"
        value={kpis.totalValorPedido}
        formatter={fmtCurrency}
        subtitle="Σ valor_total_pedido"
        icon={<DollarSign className="h-5 w-5" />}
        color="primary"
        index={0}
        sparkData={generateSparkData(kpis.totalValorPedido)}
      />
      <KPICard
        title="Faturamento Real"
        value={kpis.faturamentoLiquido}
        formatter={fmtCurrency}
        subtitle={onReceitaClick ? 'Clique para ver detalhes' : 'Σ Valor_Real'}
        icon={<TrendingUp className="h-5 w-5" />}
        color="success"
        index={1}
        sparkData={generateSparkData(kpis.faturamentoLiquido)}
        onClick={onReceitaClick}
      />

      {showDevolucoes && (
        <KPICard
          title="Devoluções"
          value={kpis.totalDevolucoes}
          formatter={fmtCurrency}
          subtitle="Σ Valor_Devolucao"
          icon={<TrendingDown className="h-5 w-5" />}
          color="destructive"
          index={2}
          sparkData={generateSparkData(kpis.totalDevolucoes)}
        />
      )}
      <KPICard
        title="Valor Custo"
        value={kpis.totalValorCusto}
        formatter={fmtCurrency}
        subtitle="Σ valor_custo"
        icon={<Package className="h-5 w-5" />}
        color="warning"
        index={2}
        sparkData={generateSparkData(kpis.totalValorCusto)}
      />
      <KPICard
        title="Descontos"
        value={kpis.totalValorDesconto}
        formatter={fmtCurrency}
        subtitle="Σ valor_desconto"
        icon={<TrendingDown className="h-5 w-5" />}
        color="destructive"
        index={3}
        sparkData={generateSparkData(kpis.totalValorDesconto)}
      />
      <KPICard
        title="Pedidos"
        value={kpis.qtdPedidos}
        formatter={fmtNumber}
        subtitle="Registros filtrados"
        icon={<ShoppingCart className="h-5 w-5" />}
        color="accent"
        index={4}
      />
      <KPICard
        title="Clientes"
        value={kpis.qtdClientes}
        formatter={fmtNumber}
        subtitle="Únicos no período"
        icon={<Users className="h-5 w-5" />}
        color="primary"
        index={5}
      />
      <KPICard
        title="Vendedores"
        value={kpis.qtdVendedores}
        formatter={fmtNumber}
        subtitle="Ativos no período"
        icon={<Sparkles className="h-5 w-5" />}
        color="success"
        index={6}
      />
    </div>
  );
}
