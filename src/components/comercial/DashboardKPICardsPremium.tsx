import { Card, CardContent } from '@/components/ui/card';
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
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ComercialKPIs } from '@/types/comercial';

interface DashboardKPIsProps {
  kpis: ComercialKPIs;
}

function useCountAnimation(target: number, duration = 1400) {
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

function Sparkline({ data, color, height = 36 }: { data: number[]; color: string; height?: number }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 120;
  const h = height;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const areaPoints = [...points, `${w},${h}`, `0,${h}`].join(' ');
  const linePoints = points.join(' ');
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.45} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#spark-${color})`} />
      <polyline points={linePoints} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}

function generateSparkData(value: number, seed = 1): number[] {
  const points = 12;
  const result: number[] = [];
  for (let i = 0; i < points; i++) {
    const ratio = 0.45 + (i / (points - 1)) * 0.55;
    const jitter = 1 + (Math.sin(i * 1.7 + value * 0.0001 * seed) * 0.22);
    result.push(value * ratio * jitter);
  }
  return result;
}

const fmtCurrency = (v: number) => formatCurrency(v, true);
const fmtNumber = (v: number) => formatNumber(Math.round(v));

interface MiniProps {
  title: string;
  value: number;
  formatter: (v: number) => string;
  icon: React.ReactNode;
  color: string;
  index: number;
}

function MiniKpiCard({ title, value, formatter, icon, color, index }: MiniProps) {
  const animated = useCountAnimation(value);
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border/50 bg-card/40 backdrop-blur-md p-3',
        'transition-all duration-300 hover:scale-[1.03] hover:-translate-y-0.5 cursor-default',
        'hover:border-border hover:shadow-2xl',
        `stagger-${index + 2}`
      )}
      style={{
        boxShadow: `inset 0 1px 0 0 hsl(var(--foreground) / 0.05), 0 4px 20px -8px ${color}40`,
      }}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle at 30% 0%, ${color}25, transparent 70%)` }}
      />
      <div className="relative flex items-start gap-2.5">
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110"
          style={{
            background: `linear-gradient(135deg, ${color}30, ${color}10)`,
            color,
            boxShadow: `0 0 15px ${color}30, inset 0 1px 0 ${color}40`,
          }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] uppercase tracking-[0.12em] font-semibold text-muted-foreground/80 mb-0.5">
            {title}
          </p>
          <p
            className="text-base font-extrabold mono-value tracking-tight truncate"
            style={{ color }}
          >
            {formatter(animated)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function DashboardKPICardsPremium({ kpis, onReceitaClick }: DashboardKPIsProps & { onReceitaClick?: () => void }) {
  const heroValue = useCountAnimation(kpis.faturamentoLiquido);
  const heroSpark = generateSparkData(kpis.faturamentoLiquido, 1);

  // Margem aproximada
  const margem = kpis.totalValorPedido > 0
    ? ((kpis.faturamentoLiquido - kpis.totalValorCusto) / kpis.faturamentoLiquido) * 100
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* HERO CARD */}
      <Card
        role={onReceitaClick ? 'button' : undefined}
        tabIndex={onReceitaClick ? 0 : undefined}
        onClick={onReceitaClick}
        onKeyDown={onReceitaClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onReceitaClick(); } } : undefined}
        title={onReceitaClick ? 'Clique para ver o detalhamento da Receita' : undefined}
        className={cn(
          'lg:col-span-1 relative overflow-hidden border-0 stagger-1 group',
          onReceitaClick ? 'cursor-pointer hover:ring-2 hover:ring-white/50 transition' : 'cursor-default'
        )}
      >

        <div
          className="absolute inset-0 opacity-95"
          style={{
            background:
              'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(217 91% 50%) 50%, hsl(173 80% 35%) 100%)',
          }}
        />
        <div className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{
            background:
              'radial-gradient(circle at 80% 20%, hsl(var(--success) / 0.6), transparent 50%), radial-gradient(circle at 20% 80%, hsl(var(--warning) / 0.5), transparent 60%)',
          }}
        />
        <div className="absolute inset-0 backdrop-blur-[1px]" />
        {/* Animated glow orb */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-40 blur-3xl pointer-events-none animate-pulse"
          style={{ background: 'hsl(var(--success))' }} />

        <CardContent className="relative p-5 text-primary-foreground">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center ring-1 ring-white/30 shadow-lg">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-semibold opacity-90">Faturamento Real</p>
                <p className="text-[10px] opacity-70">Período aplicado</p>
              </div>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/15 backdrop-blur ring-1 ring-white/20">
              <ArrowUpRight className="h-3 w-3" />
              <span className="text-[10px] font-bold">LIVE</span>
            </div>
          </div>

          <p className="text-4xl xl:text-5xl font-black mono-value tracking-tighter mb-1 drop-shadow-lg">
            {fmtCurrency(heroValue)}
          </p>
          <p className="text-xs opacity-80 mb-3">Σ Valor Real do período</p>

          <div className="-mx-1">
            <Sparkline data={heroSpark} color="hsl(0 0% 100%)" height={40} />
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/20">
            <div>
              <p className="text-[9px] uppercase opacity-75 tracking-wider">Margem</p>
              <p className="text-sm font-bold mono-value">{margem.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-[9px] uppercase opacity-75 tracking-wider">Pedidos</p>
              <p className="text-sm font-bold mono-value">{fmtNumber(kpis.qtdPedidos)}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase opacity-75 tracking-wider">Ticket</p>
              <p className="text-sm font-bold mono-value">
                {fmtCurrency(kpis.qtdPedidos > 0 ? kpis.faturamentoLiquido / kpis.qtdPedidos : 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MINI GRID */}
      <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3">
        <MiniKpiCard
          title="Valor Pedido"
          value={kpis.totalValorPedido}
          formatter={fmtCurrency}
          icon={<DollarSign className="h-4 w-4" />}
          color="hsl(217 91% 60%)"
          index={0}
        />
        <MiniKpiCard
          title="Custo"
          value={kpis.totalValorCusto}
          formatter={fmtCurrency}
          icon={<Package className="h-4 w-4" />}
          color="hsl(38 92% 50%)"
          index={1}
        />
        <MiniKpiCard
          title="Descontos"
          value={kpis.totalValorDesconto}
          formatter={fmtCurrency}
          icon={<TrendingDown className="h-4 w-4" />}
          color="hsl(0 72% 51%)"
          index={2}
        />
        <MiniKpiCard
          title="Pedidos"
          value={kpis.qtdPedidos}
          formatter={fmtNumber}
          icon={<ShoppingCart className="h-4 w-4" />}
          color="hsl(280 65% 60%)"
          index={3}
        />
        <MiniKpiCard
          title="Clientes"
          value={kpis.qtdClientes}
          formatter={fmtNumber}
          icon={<Users className="h-4 w-4" />}
          color="hsl(173 80% 40%)"
          index={4}
        />
        <MiniKpiCard
          title="Vendedores"
          value={kpis.qtdVendedores}
          formatter={fmtNumber}
          icon={<TrendingUp className="h-4 w-4" />}
          color="hsl(142 71% 45%)"
          index={5}
        />
      </div>
    </div>
  );
}
