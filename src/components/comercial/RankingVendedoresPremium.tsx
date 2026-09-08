import { useMemo, useState, useEffect, useRef } from 'react';
import { Crown, Medal, Award, TrendingUp, TrendingDown, Minus, Target, Receipt, Activity, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import type { VendedorPerformance, Pedido } from '@/types/comercial';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  vendedores: VendedorPerformance[];
  pedidos: Pedido[];
  limit?: number;
}

function useCountUp(value: number, duration = 900) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    startRef.current = null;
    fromRef.current = display;
    let raf = 0;
    const step = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(fromRef.current + (value - fromRef.current) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
}

const MEDAL_CONFIG: Record<number, { icon: typeof Crown; bg: string; text: string; border: string; ring: string; label: string }> = {
  1: {
    icon: Crown,
    bg: 'bg-amber-500/12',
    text: 'text-amber-500',
    border: 'border-amber-500/25',
    ring: 'hsl(45 95% 55%)',
    label: 'Líder',
  },
  2: {
    icon: Medal,
    bg: 'bg-slate-500/12',
    text: 'text-slate-300',
    border: 'border-slate-400/25',
    ring: 'hsl(220 10% 75%)',
    label: '2º Lugar',
  },
  3: {
    icon: Award,
    bg: 'bg-orange-500/12',
    text: 'text-orange-400',
    border: 'border-orange-500/25',
    ring: 'hsl(25 75% 50%)',
    label: '3º Lugar',
  },
};

export function RankingVendedoresPremium({ vendedores, pedidos, limit = 12 }: Props) {
  // Calcula sparkline mensal real por vendedor a partir de pedidos
  const sparklinesByVendedor = useMemo(() => {
    const map = new Map<string | number, { mes: string; valor: number }[]>();
    const grupo = new Map<string | number, Map<string, number>>();
    pedidos.forEach((p) => {
      const data = p.data_faturamento || (p as { data_emissao?: string }).data_emissao;
      if (!data) return;
      const ym = String(data).slice(0, 7);
      if (!grupo.has(p.vendedor_codigo)) grupo.set(p.vendedor_codigo, new Map());
      const m = grupo.get(p.vendedor_codigo)!;
      m.set(ym, (m.get(ym) || 0) + ((p as { valor_real?: number; valor?: number }).valor_real ?? (p as { valor?: number }).valor ?? 0));
    });
    grupo.forEach((m, key) => {
      const arr = Array.from(m.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-6)
        .map(([mes, valor]) => ({ mes, valor }));
      map.set(key, arr);
    });
    return map;
  }, [pedidos]);

  const data = useMemo(() => vendedores.slice(0, limit), [vendedores, limit]);
  const maxValor = useMemo(() => Math.max(...data.map((d) => d.faturamentoLiquido), 1), [data]);
  const totalGrupo = useMemo(() => data.reduce((s, v) => s + v.faturamentoLiquido, 0), [data]);

  // KPIs de insights (reais)
  const ticketMedio = useMemo(() => {
    const validos = data.filter((d) => d.ticketMedio > 0);
    if (!validos.length) return 0;
    return validos.reduce((s, v) => s + v.ticketMedio, 0) / validos.length;
  }, [data]);
  const totalPedidos = useMemo(() => data.reduce((s, v) => s + v.pedidosFaturados, 0), [data]);
  const metaMedia = useMemo(() => {
    const comMeta = data.filter((d) => typeof d.atingimentoMeta === 'number');
    if (!comMeta.length) return null;
    return comMeta.reduce((s, v) => s + (v.atingimentoMeta || 0), 0) / comMeta.length;
  }, [data]);
  const lider = data[0];

  // Paginação 10 em 10
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageStart = currentPage * PAGE_SIZE;
  const pageData = data.slice(pageStart, pageStart + PAGE_SIZE);

  const animatedTotal = useCountUp(totalGrupo);
  const animatedTicket = useCountUp(ticketMedio);

  return (
    <section className="relative space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <InsightCard
          icon={Activity}
          label="Faturamento Total"
          value={formatCurrency(animatedTotal)}
          accent="primary"
          delay={0}
        />
        <InsightCard
          icon={Receipt}
          label="Ticket Médio"
          value={formatCurrency(animatedTicket)}
          sub={`${totalPedidos.toLocaleString('pt-BR')} pedidos`}
          accent="accent"
          delay={60}
        />
        <InsightCard
          icon={Sparkles}
          label="Líder"
          value={lider?.nome ?? '—'}
          sub={lider ? formatCurrency(lider.faturamentoLiquido) : ''}
          accent="success"
          delay={120}
          truncate

        />
      </div>

      {data.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 0, 2].map((idx, displayPos) => {
            const v = data[idx];
            if (!v) return null;
            const rank = idx + 1;
            const config = MEDAL_CONFIG[rank];
            const Icon = config.icon;
            const sparkline = sparklinesByVendedor.get(v.codigo) || [];
            const isCenter = displayPos === 1; // posição central = #1
            return (
              <div
                key={String(v.codigo)}
                className={cn(
                  'group relative overflow-hidden rounded-lg border bg-card',
                  'transition-colors duration-300 hover:border-primary/30',
                  config.border,
                  isCenter && 'md:scale-105 md:-mt-2'
                )}
                style={{
                  animation: `slideUpFade 0.6s ${displayPos * 100}ms ease-out backwards`,
                }}
              >
                <div className="relative p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'relative h-12 w-12 rounded-full flex items-center justify-center border',
                          config.bg,
                          config.text,
                          config.border
                        )}
                      >
                        <Icon className="h-6 w-6" strokeWidth={2.5} fill="currentColor" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                          {config.label}
                        </div>
                        <div className="text-xs font-semibold text-foreground/80">#{rank}</div>
                      </div>
                    </div>
                    <RankTrend atingimento={v.atingimentoMeta} />
                  </div>

                  <div>
                    <h3 className="text-base font-semibold tracking-tight truncate" title={v.nome}>
                      {v.nome}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {v.pedidosFaturados.toLocaleString('pt-BR')} pedidos faturados
                    </p>
                  </div>

                  <div>
                    <div className={cn('text-2xl font-bold tabular-nums tracking-tight', config.text)}>
                      {formatCurrency(v.faturamentoLiquido)}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
                      <span>{formatPercent(v.participacao / 100)} do grupo</span>
                      <span className="text-foreground/30">•</span>
                      <span>Tk {formatCurrency(v.ticketMedio)}</span>
                    </div>
                  </div>

                  {sparkline.length > 1 && (
                    <div className="h-12 -mx-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sparkline} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                          <defs>
                            <linearGradient id={`spark-${rank}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={config.ring} stopOpacity={0.5} />
                              <stop offset="100%" stopColor={config.ring} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Tooltip
                            cursor={false}
                            contentStyle={tooltipStyle}
                            formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                            labelFormatter={(l) => `Mês ${l}`}
                          />
                          <Area type="monotone" dataKey="valor" stroke={config.ring} strokeWidth={2} fill={`url(#spark-${rank})`} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="relative overflow-hidden rounded-lg border border-border/60 bg-card transition-colors duration-300">
        <div className="relative px-6 pt-6 pb-2 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Ranking completo</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Faturamento líquido por vendedor</p>
          </div>
          <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
            {data.length} vendedores
          </div>
        </div>

        <div className="relative p-5 space-y-2.5">
          {pageData.map((v, idxInPage) => {
            const i = pageStart + idxInPage;
            const pct = (v.faturamentoLiquido / maxValor) * 100;
            const isTop3 = i < 3;
            const config = isTop3 ? MEDAL_CONFIG[i + 1] : null;
            const sparkline = sparklinesByVendedor.get(v.codigo) || [];
            return (
              <div
                key={String(v.codigo)}
                className="group relative rounded-lg px-3 py-2.5 transition-colors duration-200 hover:bg-muted/40"
                style={{ animation: `slideUpFade 0.5s ${idxInPage * 35}ms ease-out backwards` }}
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <div
                    className={cn(
                      'h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold tabular-nums flex-shrink-0',
                      isTop3 && config ? [config.bg, config.text, config.border, 'border'] : 'bg-muted/50 text-muted-foreground border border-border/60'
                    )}
                  >
                    {isTop3 && config ? <config.icon className="h-3.5 w-3.5" strokeWidth={2.5} fill="currentColor" /> : i + 1}
                  </div>

                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="font-medium text-sm truncate" title={v.nome}>{v.nome}</span>
                    <span className="text-[10px] text-muted-foreground hidden md:inline">
                      {v.pedidosFaturados} ped · {formatPercent(v.participacao / 100)}
                    </span>
                  </div>

                  {sparkline.length > 1 && (
                    <div className="hidden lg:block h-7 w-20 opacity-60 group-hover:opacity-100 transition-opacity">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sparkline} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id={`mini-${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={1.5} fill={`url(#mini-${i})`} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <RankTrend atingimento={v.atingimentoMeta} compact />

                  <div className="text-right tabular-nums">
                    <div className="font-bold text-sm text-foreground">
                      {formatCurrency(v.faturamentoLiquido)}
                    </div>
                  </div>
                </div>

                <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="relative h-full rounded-full bg-primary transition-all duration-1000 ease-out"
                    style={{
                      width: `${pct}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="relative flex items-center justify-between gap-3 px-6 py-4 border-t border-white/5">
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, data.length)} de {data.length}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="h-8 px-3 rounded-lg text-xs font-medium border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Anterior
              </button>
              {Array.from({ length: totalPages }).map((_, p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    'h-8 min-w-8 px-2 rounded-lg text-xs font-semibold tabular-nums border transition',
                    p === currentPage
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-muted-foreground'
                  )}
                >
                  {p + 1}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="h-8 px-3 rounded-lg text-xs font-medium border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}

interface InsightCardProps {
  icon: typeof Crown;
  label: string;
  value: string;
  sub?: string;
  accent: 'primary' | 'accent' | 'success' | 'warning' | 'destructive';
  trend?: 'up' | 'down' | 'flat';
  delay?: number;
  truncate?: boolean;
}

const ACCENT_MAP: Record<InsightCardProps['accent'], { ring: string; bg: string; text: string }> = {
  primary:     { ring: 'hsl(var(--primary))',     bg: 'hsl(var(--primary) / 0.10)',     text: 'hsl(var(--primary))' },
  accent:      { ring: 'hsl(var(--accent))',      bg: 'hsl(var(--accent) / 0.10)',      text: 'hsl(var(--accent))' },
  success:     { ring: 'hsl(var(--success))',     bg: 'hsl(var(--success) / 0.10)',     text: 'hsl(var(--success))' },
  warning:     { ring: 'hsl(var(--warning))',     bg: 'hsl(var(--warning) / 0.10)',     text: 'hsl(var(--warning))' },
  destructive: { ring: 'hsl(var(--destructive))', bg: 'hsl(var(--destructive) / 0.10)', text: 'hsl(var(--destructive))' },
};

function InsightCard({ icon: Icon, label, value, sub, accent, trend, delay = 0, truncate }: InsightCardProps) {
  const a = ACCENT_MAP[accent];
  return (
    <div
      className="group relative overflow-hidden rounded-lg border border-border/60 bg-card p-4 transition-colors duration-200 hover:border-primary/30"
      style={{
        animation: `slideUpFade 0.5s ${delay}ms ease-out backwards`,
      }}
    >
      <div className="relative flex items-start justify-between gap-2 mb-3">
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center"
          style={{ background: a.bg, boxShadow: `inset 0 0 0 1px ${a.ring}33` }}
        >
          <Icon className="h-4 w-4" style={{ color: a.text }} />
        </div>
        {trend && <TrendIcon trend={trend} />}
      </div>
      <div className="relative space-y-0.5">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className={cn('text-lg font-bold tabular-nums tracking-tight', truncate && 'truncate')} title={truncate ? value : undefined}>
          {value}
        </p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <TrendingUp className="h-3.5 w-3.5 text-success" />;
  if (trend === 'down') return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function RankTrend({ atingimento, compact = false }: { atingimento?: number; compact?: boolean }) {
  if (typeof atingimento !== 'number') return null;
  const up = atingimento >= 100;
  const flat = !up && atingimento >= 80;
  const Icon = up ? TrendingUp : flat ? Minus : TrendingDown;
  const color = up
    ? 'text-success bg-success/10 border-success/20'
    : flat
    ? 'text-warning bg-warning/10 border-warning/20'
    : 'text-destructive bg-destructive/10 border-destructive/20';
  return (
    <div className={cn('inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums', color, compact && 'px-1')}>
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {!compact && <span>{Math.round(atingimento)}%</span>}
    </div>
  );
}

const tooltipStyle: React.CSSProperties = {
  background: 'hsl(220 30% 8% / 0.95)',
  border: '1px solid hsl(0 0% 100% / 0.1)',
  borderRadius: 8,
  fontSize: 11,
  padding: '6px 10px',
  color: 'hsl(0 0% 95%)',
};
