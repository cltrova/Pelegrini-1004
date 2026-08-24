import { useMemo } from 'react';
import {
  ComposedChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Calendar, Target, Trophy, ArrowDown, ShoppingCart, Users, Receipt, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';

interface EvolucaoData {
  mes: string;
  vendas: number;
}

interface SingleMonthKpis {
  ticketMedio: number;
  qtdPedidos: number;
  qtdClientes: number;
  faturamentoBruto: number;
}

interface Props {
  data: EvolucaoData[];
  formatMes: (m: string) => string;
  tooltipStyle: React.CSSProperties;
  singleMonthKpis?: SingleMonthKpis;
}

export function EvolucaoVendasChart({ data, formatMes, tooltipStyle, singleMonthKpis }: Props) {
  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const total = data.reduce((acc, d) => acc + d.vendas, 0);
    const media = total / data.length;
    const maior = data.reduce((a, b) => (a.vendas > b.vendas ? a : b));
    const menor = data.reduce((a, b) => (a.vendas < b.vendas ? a : b));
    const last = data[data.length - 1];
    const prev = data.length > 1 ? data[data.length - 2] : null;
    const variacao = prev && prev.vendas > 0
      ? ((last.vendas - prev.vendas) / prev.vendas) * 100
      : null;
    return { total, media, maior, menor, last, variacao };
  }, [data]);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Sem dados de evolução para o período
      </div>
    );
  }

  const isSinglePoint = data.length === 1;

  if (isSinglePoint) {
    return (
      <SingleMonthGauge
        valor={stats.last.vendas}
        bruto={singleMonthKpis?.faturamentoBruto ?? stats.last.vendas}
        mesLabel={formatMes(stats.last.mes)}
        kpis={singleMonthKpis}
      />
    );
  }

  // Múltiplos pontos: composed chart + KPI strip
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="grad-vendas-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="grad-vendas-bar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" vertical={false} />
            <XAxis
              dataKey="mes"
              tickFormatter={formatMes}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}K`}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              width={45}
            />
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), 'Vendas']}
              labelFormatter={formatMes}
              contentStyle={tooltipStyle}
              cursor={{ fill: 'hsl(var(--primary) / 0.05)' }}
            />
            <Bar dataKey="vendas" fill="url(#grad-vendas-bar)" radius={[6, 6, 0, 0]} barSize={28} />
            <Area type="monotone" dataKey="vendas" stroke="none" fill="url(#grad-vendas-area)" />
            <Line
              type="monotone"
              dataKey="vendas"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={{ r: 4, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-3">
        <KpiMini label="Total" value={formatCurrency(stats.total)} icon={Target} />
        <KpiMini label="Média/mês" value={formatCurrency(stats.media)} icon={Calendar} />
        <KpiMini label="Maior" value={formatCurrency(stats.maior.vendas)} sub={formatMes(stats.maior.mes)} icon={Trophy} accent="success" />
        {stats.variacao !== null ? (
          <KpiMini
            label="Variação"
            value={`${stats.variacao >= 0 ? '+' : ''}${stats.variacao.toFixed(1)}%`}
            sub="vs mês anterior"
            icon={stats.variacao >= 0 ? TrendingUp : TrendingDown}
            accent={stats.variacao >= 0 ? 'success' : 'destructive'}
          />
        ) : (
          <KpiMini label="Menor" value={formatCurrency(stats.menor.vendas)} sub={formatMes(stats.menor.mes)} icon={ArrowDown} accent="muted" />
        )}
      </div>
    </div>
  );
}

function KpiMini({
  label, value, sub, icon: Icon, accent = 'primary',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'primary' | 'success' | 'destructive' | 'muted';
}) {
  const colorMap = {
    primary: 'text-primary border-primary/20 bg-primary/5',
    success: 'text-success border-success/20 bg-success/5',
    destructive: 'text-destructive border-destructive/20 bg-destructive/5',
    muted: 'text-muted-foreground border-border bg-muted/20',
  };
  return (
    <div className={cn('rounded-lg border p-2 transition-colors', colorMap[accent])}>
      <div className="flex items-center gap-1 mb-1">
        <Icon className="h-3 w-3" />
        <span className="text-[9px] uppercase tracking-wider opacity-80 truncate">{label}</span>
      </div>
      <p className="text-xs font-bold mono-value text-foreground truncate">{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground truncate mt-0.5">{sub}</p>}
    </div>
  );
}

interface GaugeProps {
  valor: number;
  bruto: number;
  mesLabel: string;
  kpis?: SingleMonthKpis;
}

function SingleMonthGauge({ valor, bruto, mesLabel, kpis }: GaugeProps) {
  const ticket = kpis?.ticketMedio ?? 0;
  const pedidos = kpis?.qtdPedidos ?? 0;
  const clientes = kpis?.qtdClientes ?? 0;

  return (
    <div className="flex-1 rounded-[28px] border border-border/60 bg-gradient-to-b from-card to-background p-5 shadow-2xl shadow-primary/5 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground/90 tracking-tight">
            Vendas do Mês
          </h3>
        </div>
        <span className="px-2.5 py-1 bg-foreground/[0.04] border border-border/60 rounded-full text-[10px] font-bold text-primary uppercase tracking-widest">
          {mesLabel}
        </span>
      </div>

      {/* Hero */}
      <div className="relative flex flex-col items-center justify-center py-4 mb-5 flex-1">
        <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2 relative z-10">
          Vendas Líquidas
        </p>
        <h2 className="text-4xl font-bold text-foreground tracking-tighter relative z-10 mono-value">
          {formatCurrency(valor)}
        </h2>
        <div className="mt-3 flex items-center gap-2 text-muted-foreground relative z-10">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
          <p className="text-[11px] font-medium">
            {bruto > valor
              ? `${((valor / bruto) * 100).toFixed(1)}% do bruto · ${formatCurrency(bruto)}`
              : 'Aguardando novos meses para evolução'}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2">
        <GlassStat icon={Sparkles} label="Bruto" value={formatCurrency(kpis?.faturamentoBruto ?? bruto)} />
        <GlassStat icon={Receipt} label="Ticket" value={formatCurrency(ticket)} accent="success" highlight />
        <GlassStat icon={ShoppingCart} label="Pedidos" value={pedidos.toLocaleString('pt-BR')} />
        <GlassStat icon={Users} label="Clientes" value={clientes.toLocaleString('pt-BR')} />
      </div>
    </div>
  );
}

function GlassStat({
  icon: Icon, label, value, accent = 'muted', highlight = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: 'muted' | 'success';
  highlight?: boolean;
}) {
  const isSuccess = accent === 'success';
  return (
    <div className={cn(
      'rounded-2xl border p-3 flex flex-col items-center justify-center text-center transition-all',
      highlight && isSuccess
        ? 'bg-success/5 border-success/15'
        : 'bg-foreground/[0.03] border-border/50',
    )}>
      <div className="flex items-center gap-1 mb-1.5">
        <Icon className={cn('h-2.5 w-2.5', isSuccess && highlight ? 'text-success' : 'text-muted-foreground')} />
        <p className={cn(
          'text-[9px] font-bold uppercase tracking-wider',
          isSuccess && highlight ? 'text-success' : 'text-muted-foreground',
        )}>
          {label}
        </p>
      </div>
      <p className="text-xs text-foreground font-bold mono-value truncate w-full">{value}</p>
    </div>
  );
}
