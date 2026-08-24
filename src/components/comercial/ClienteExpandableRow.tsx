import { useState } from 'react';
import {
  ChevronDown,
  Crown,
  Medal,
  Award,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  Receipt,
  CalendarClock,
  Flame,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import type { ClientePerformance } from '@/types/comercial';

interface ClienteExpandableRowProps {
  cliente: ClientePerformance;
  ranking: number;
  evolucaoMensal?: { mes: string; valor: number }[];
  className?: string;
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const formatMes = (mes: string) => {
  const [year, month] = mes.split('-');
  return `${MONTHS[parseInt(month) - 1]}/${year.slice(2)}`;
};

const getInitials = (name?: string) => {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '—';
};

/** Tier visual baseado na participação do cliente no total */
function getTier(participacao: number) {
  if (participacao >= 5)
    return { label: 'Diamond', icon: Sparkles, color: 'hsl(200 95% 65%)', glow: 'hsl(200 95% 65% / 0.45)' };
  if (participacao >= 2)
    return { label: 'Gold', icon: Crown, color: 'hsl(45 95% 60%)', glow: 'hsl(45 95% 60% / 0.45)' };
  if (participacao >= 1)
    return { label: 'Silver', icon: Medal, color: 'hsl(220 10% 75%)', glow: 'hsl(220 10% 75% / 0.4)' };
  return { label: 'Bronze', icon: Award, color: 'hsl(25 70% 55%)', glow: 'hsl(25 70% 55% / 0.4)' };
}

/** Cor para o destaque do rank (Top 3) */
function getRankMedal(rank: number) {
  if (rank === 1)
    return {
      bg: 'linear-gradient(135deg, hsl(45 95% 65%), hsl(38 90% 50%))',
      ring: 'hsl(45 95% 60%)',
      text: 'hsl(40 95% 12%)',
    };
  if (rank === 2)
    return {
      bg: 'linear-gradient(135deg, hsl(220 15% 85%), hsl(220 10% 65%))',
      ring: 'hsl(220 10% 75%)',
      text: 'hsl(220 30% 15%)',
    };
  if (rank === 3)
    return {
      bg: 'linear-gradient(135deg, hsl(25 75% 60%), hsl(18 70% 42%))',
      ring: 'hsl(25 70% 55%)',
      text: 'hsl(20 80% 12%)',
    };
  return null;
}

export function ClienteExpandableRow({
  cliente,
  ranking,
  evolucaoMensal = [],
  className,
}: ClienteExpandableRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Derivados do histórico mensal (cálculo inline, barato)
  const mesesComVenda = evolucaoMensal.filter((e) => (e.valor || 0) > 0);
  const somaHist = evolucaoMensal.reduce((acc, e) => acc + (e.valor || 0), 0);
  const mediaCalc = mesesComVenda.length > 0 ? somaHist / mesesComVenda.length : 0;
  const maxCalc =
    evolucaoMensal.length > 0 ? Math.max(...evolucaoMensal.map((e) => e.valor || 0)) : 0;

  const n = evolucaoMensal.length;
  let trendPct = 0;
  if (n >= 2) {
    const half = Math.max(1, Math.floor(n / 2));
    const recent = evolucaoMensal.slice(-half).reduce((a, b) => a + (b.valor || 0), 0);
    const prior = evolucaoMensal.slice(0, n - half).reduce((a, b) => a + (b.valor || 0), 0);
    if (prior > 0) trendPct = ((recent - prior) / prior) * 100;
    else if (recent > 0) trendPct = 100;
  }

  const mesesAtivos =
    cliente.mesesAtivos && cliente.mesesAtivos > 0 ? cliente.mesesAtivos : mesesComVenda.length;
  const mediaMensal =
    cliente.mediaMensal && cliente.mediaMensal > 0 ? cliente.mediaMensal : mediaCalc;
  const maximoMes =
    cliente.maximoMes && cliente.maximoMes > 0 ? cliente.maximoMes : maxCalc;
  const sparkData = evolucaoMensal.map((e) => ({ v: e.valor || 0 }));

  const medal = getRankMedal(ranking);
  const tier = getTier(cliente.participacao || 0);
  const TierIcon = tier.icon;
  const isTop3 = ranking <= 3;

  const participacao = Math.max(0, Math.min(100, cliente.participacao || 0));
  const barWidth = Math.min(100, participacao * 4 + 8);

  const TrendIcon = trendPct > 2 ? TrendingUp : trendPct < -2 ? TrendingDown : Minus;
  const trendColor =
    trendPct > 2 ? 'text-success' : trendPct < -2 ? 'text-destructive' : 'text-muted-foreground';

  return (
    <div
      className={cn(
        'group relative transition-all duration-300',
        isExpanded ? 'bg-gradient-to-r from-primary/[0.04] via-card/40 to-transparent' : 'hover:bg-muted/30',
        className,
      )}
    >
      {/* Glow lateral nos top 3 */}
      {isTop3 && (
        <div
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-[3px] transition-all"
          style={{
            background: medal?.ring,
            boxShadow: `0 0 18px ${medal?.ring}, 0 0 4px ${medal?.ring}`,
            opacity: isExpanded ? 1 : 0.85,
          }}
        />
      )}

      {/* Linha principal */}
      <div
        className="px-5 py-3.5 flex items-center gap-4 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Medalha / Rank */}
        <div className="w-11 flex justify-center flex-shrink-0">
          {medal ? (
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center font-black tabular-nums shadow-lg ring-2 ring-background transition-transform group-hover:scale-105"
              style={{
                background: medal.bg,
                color: medal.text,
                boxShadow: `0 8px 22px -10px ${medal.ring}, inset 0 1px 0 hsl(0 0% 100% / 0.42)`,
              }}
            >
              {ranking === 1 ? (
                <Crown className="h-5 w-5" strokeWidth={2.5} fill="currentColor" />
              ) : (
                <span className="text-base leading-none">{ranking}</span>
              )}
            </div>
          ) : (
            <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-muted/40 border border-border/60 text-sm font-semibold italic tabular-nums text-muted-foreground">
              {String(ranking).padStart(2, '0')}
            </div>
          )}
        </div>

        {/* Avatar + Nome + Tier */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div
            className={cn(
              'w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border-2 transition-all',
              isTop3
                ? 'bg-gradient-to-br from-primary/25 to-primary/5 border-primary/50 text-primary shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.4)]'
                : 'bg-muted border-border text-foreground group-hover:border-primary/30',
            )}
          >
            {getInitials(cliente.razao)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold tracking-tight truncate text-foreground max-w-[280px]">
                {cliente.razao}
              </p>
              <Badge
                variant="outline"
                className="h-5 px-1.5 gap-1 text-[10px] font-semibold border-0"
                style={{
                  background: `${tier.color}18`,
                  color: tier.color,
                  boxShadow: `inset 0 0 0 1px ${tier.color}40`,
                }}
              >
                <TierIcon className="h-2.5 w-2.5" strokeWidth={2.5} />
                {tier.label}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
              <span className="truncate max-w-[180px]">
                {cliente.vendedor_nome ?? 'Sem vendedor'}
              </span>
              {cliente.uf && (
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground/50" />
                  {cliente.cidade ? `${cliente.cidade}/${cliente.uf}` : cliente.uf}
                </span>
              )}
              {cliente.totalPedidos > 0 && (
                <span className="hidden lg:flex items-center gap-1">
                  <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground/50" />
                  <Package className="h-3 w-3" /> {cliente.totalPedidos}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sparkline inline (sempre visível) */}
        {sparkData.length > 1 && (
          <div className="hidden lg:block w-24 h-9 flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
                <defs>
                  <linearGradient id={`spark-${cliente.codigo}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={`url(#spark-${cliente.codigo})`}
                  strokeWidth={1.8}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Barra participação */}
        <div className="hidden md:block w-36 flex-shrink-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Share</span>
            <span className="text-[11px] font-bold mono-value text-foreground">
              {formatPercent(participacao)}
            </span>
          </div>
          <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700 ease-out')}
              style={{
                width: `${barWidth}%`,
                background: isTop3 && medal
                  ? `linear-gradient(90deg, ${medal.ring.replace(')', ' / 0.45)')}, ${medal.ring})`
                  : 'linear-gradient(90deg, hsl(var(--primary)/0.5), hsl(var(--primary)))',
                boxShadow: isTop3 && medal ? `0 0 10px ${medal.ring.replace(')', ' / 0.45)')}` : '0 0 6px hsl(var(--primary)/0.4)',
              }}
            />
          </div>
        </div>

        {/* Valor + tendência */}
        <div className="text-right min-w-[130px] flex-shrink-0">
          <p className="text-sm font-bold text-foreground mono-value leading-tight">
            {formatCurrency(cliente.faturamentoLiquido)}
          </p>
          <div className="flex items-center justify-end gap-1.5 mt-0.5">
            {trendPct !== 0 && (
              <span className={cn('flex items-center gap-0.5 text-[10px] font-semibold mono-value', trendColor)}>
                <TrendIcon className="h-3 w-3" strokeWidth={2.5} />
                {trendPct > 0 ? '+' : ''}{trendPct.toFixed(0)}%
              </span>
            )}
            {cliente.diasSemCompra != null && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[9px] font-medium border-0 px-1.5 py-0 h-4',
                  cliente.diasSemCompra > 90
                    ? 'text-destructive bg-destructive/10'
                    : cliente.diasSemCompra > 30
                    ? 'text-warning bg-warning/10'
                    : 'text-success bg-success/10',
                )}
              >
                <CalendarClock className="h-2.5 w-2.5 mr-0.5" />
                {cliente.diasSemCompra}d
              </Badge>
            )}
          </div>
        </div>

        {/* Chevron */}
        <div
          className={cn(
            'h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300',
            isExpanded
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30 rotate-180'
              : 'bg-muted/40 text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary',
          )}
        >
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
        </div>
      </div>

      {/* Expandido com animação grid */}
      <div
        className={cn(
          'grid transition-all duration-500 ease-out',
          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-6 pt-1 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Mini KPIs premium */}
            <div className="col-span-1 grid grid-cols-1 gap-3">
              {[
                {
                  label: 'Meses Ativos',
                  value: `${mesesAtivos}`,
                  suffix: mesesAtivos === 1 ? 'mês' : 'meses',
                  icon: CalendarClock,
                  color: 'hsl(var(--primary))',
                },
                {
                  label: 'Média Mensal',
                  value: formatCurrency(mediaMensal),
                  icon: Receipt,
                  color: 'hsl(var(--accent))',
                },
                {
                  label: 'Melhor Mês',
                  value: formatCurrency(maximoMes),
                  icon: Flame,
                  color: 'hsl(var(--success, 142 70% 45%))',
                },
              ].map((kpi, i) => (
                <div
                  key={i}
                  className="relative p-4 rounded-xl bg-gradient-to-br from-card via-card/80 to-card/40 border border-border/60 overflow-hidden group/kpi hover:border-primary/40 transition-all"
                >
                  <div
                    className="absolute -top-6 -right-6 h-20 w-20 rounded-full opacity-10 blur-xl"
                    style={{ background: kpi.color }}
                  />
                  <div className="flex items-center gap-2 mb-1.5">
                    <kpi.icon className="h-3.5 w-3.5" style={{ color: kpi.color }} strokeWidth={2.5} />
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      {kpi.label}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-foreground mono-value">
                    {kpi.value}
                    {kpi.suffix && (
                      <span className="text-xs text-muted-foreground font-normal ml-1">{kpi.suffix}</span>
                    )}
                  </p>
                </div>
              ))}

              {/* Extra: Ticket Médio + Pedidos */}
              {(cliente.ticketMedio > 0 || cliente.totalPedidos > 0) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-card/60 border border-border/60">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
                      Pedidos
                    </p>
                    <p className="text-sm font-bold mono-value mt-0.5">{cliente.totalPedidos}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-card/60 border border-border/60">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
                      Ticket
                    </p>
                    <p className="text-sm font-bold mono-value mt-0.5">
                      {formatCurrency(cliente.ticketMedio)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Evolução premium */}
            <div className="col-span-1 md:col-span-2 p-5 rounded-xl bg-gradient-to-br from-card via-card/80 to-card/40 border border-border/60 flex flex-col relative overflow-hidden">
              <div
                className="absolute -top-10 -right-10 h-40 w-40 rounded-full opacity-10 blur-3xl"
                style={{ background: 'hsl(var(--primary))' }}
              />
              <div className="flex justify-between items-start mb-3 relative">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    Evolução Mensal
                  </p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    Histórico de faturamento
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {trendPct !== 0 && (
                    <Badge
                      className={cn(
                        'gap-1 border-0',
                        trendPct > 2
                          ? 'bg-success/15 text-success'
                          : trendPct < -2
                          ? 'bg-destructive/15 text-destructive'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <TrendIcon className="h-3 w-3" strokeWidth={2.5} />
                      {trendPct > 0 ? '+' : ''}{trendPct.toFixed(1)}%
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {evolucaoMensal.length} {evolucaoMensal.length === 1 ? 'mês' : 'meses'}
                  </span>
                </div>
              </div>
              {evolucaoMensal.length > 0 ? (
                <div className="flex-1 min-h-[160px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={
                        evolucaoMensal.length === 1
                          ? [{ mes: '', valor: 0 }, evolucaoMensal[0]]
                          : evolucaoMensal
                      }
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id={`areaCli-${cliente.codigo}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                          <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id={`strokeCli-${cliente.codigo}`} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="mes"
                        tickFormatter={(v) => (v ? formatMes(v) : '')}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        width={40}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                        labelFormatter={(v) => (v ? formatMes(v) : '')}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                          boxShadow: '0 8px 24px -8px hsl(var(--primary) / 0.3)',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="valor"
                        stroke={`url(#strokeCli-${cliente.codigo})`}
                        strokeWidth={3}
                        fill={`url(#areaCli-${cliente.codigo})`}
                        dot={{ r: 4, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground py-8">
                  Sem histórico mensal
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
