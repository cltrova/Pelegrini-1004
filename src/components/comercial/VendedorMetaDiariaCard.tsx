import { User, TrendingUp, TrendingDown, Minus, Target, DollarSign, BarChart3, Calculator, Crown, Medal, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import type { VendedorMetaDiaria } from '@/types/comercial';
import { getVendedorAvatar } from '@/config/vendedorAvatars';

interface VendedorMetaDiariaCardProps {
  vendedor: VendedorMetaDiaria;
  className?: string;
  compact1004?: boolean;
}

const STATUS = {
  acima: {
    label: 'Acima',
    icon: TrendingUp,
    text: 'text-success',
    ring: 'hsl(var(--success))',
    glow: 'hsl(var(--success) / 0.35)',
    chipBg: 'bg-success/10 border-success/30',
    barFrom: 'hsl(var(--success) / 0.6)',
    barTo: 'hsl(var(--success))',
  },
  proximo: {
    label: 'Próximo',
    icon: Minus,
    text: 'text-warning',
    ring: 'hsl(var(--warning))',
    glow: 'hsl(var(--warning) / 0.35)',
    chipBg: 'bg-warning/10 border-warning/30',
    barFrom: 'hsl(var(--warning) / 0.6)',
    barTo: 'hsl(var(--warning))',
  },
  abaixo: {
    label: 'Abaixo',
    icon: TrendingDown,
    text: 'text-destructive',
    ring: 'hsl(var(--destructive))',
    glow: 'hsl(var(--destructive) / 0.35)',
    chipBg: 'bg-destructive/10 border-destructive/30',
    barFrom: 'hsl(var(--destructive) / 0.6)',
    barTo: 'hsl(var(--destructive))',
  },
} as const;

const RANK_BADGES: Record<number, { Icon: typeof Crown; bg: string; glow: string; label: string }> = {
  1: { Icon: Crown, bg: 'linear-gradient(135deg, hsl(45 95% 65%), hsl(38 95% 50%))', glow: 'hsl(45 95% 55% / 0.6)', label: 'Ouro' },
  2: { Icon: Medal, bg: 'linear-gradient(135deg, hsl(220 12% 85%), hsl(220 8% 65%))', glow: 'hsl(220 10% 75% / 0.5)', label: 'Prata' },
  3: { Icon: Award, bg: 'linear-gradient(135deg, hsl(25 80% 60%), hsl(20 70% 42%))', glow: 'hsl(25 75% 50% / 0.55)', label: 'Bronze' },
};

interface MetricProps {
  icon: typeof Target;
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'negative';
  accent: string;
}

function Metric({ icon: Icon, label, value, tone = 'default', accent }: MetricProps) {
  const valueColor =
    tone === 'positive' ? 'text-success' : tone === 'negative' ? 'text-destructive' : 'text-foreground';
  return (
    <div
      className="group/m relative overflow-hidden rounded-xl border border-border/40 bg-card/40 backdrop-blur-md px-3 py-2.5 transition-all duration-300 hover:border-border hover:-translate-y-0.5"
      style={{ boxShadow: `inset 0 1px 0 0 hsl(var(--foreground) / 0.04)` }}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover/m:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle at 30% 0%, ${accent}26, transparent 70%)` }}
      />
      <div className="relative flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1">
        <Icon className="h-3 w-3" style={{ color: accent }} />
        <span className="font-semibold">{label}</span>
      </div>
      <p className={cn('relative font-bold text-sm mono-value tabular-nums truncate', valueColor)}>{value}</p>
    </div>
  );
}

export function VendedorMetaDiariaCard({ vendedor, className, compact1004 = false }: VendedorMetaDiariaCardProps) {
  const cfg = STATUS[vendedor.status];
  const StatusIcon = cfg.icon;
  const avatarUrl = vendedor.foto || getVendedorAvatar(vendedor.nome);
  const rankBadge = RANK_BADGES[vendedor.ranking];
  const pct = Math.max(0, Math.min(vendedor.percentualAtingimento, 100));
  // Ring math
  const RADIUS = 30;
  const CIRC = 2 * Math.PI * RADIUS;
  const dash = (pct / 100) * CIRC;

  if (compact1004) {
    const statusText =
      vendedor.status === 'acima'
        ? 'No ritmo'
        : vendedor.status === 'proximo'
          ? 'Próximo'
          : 'Atenção';
    const statusClasses =
      vendedor.status === 'acima'
        ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
        : vendedor.status === 'proximo'
          ? 'border-amber-400/25 bg-amber-400/10 text-amber-300'
          : 'border-red-400/25 bg-red-400/10 text-red-300';
    const barClass =
      vendedor.status === 'acima'
        ? 'from-emerald-500 to-sky-400'
        : vendedor.status === 'proximo'
          ? 'from-amber-500 to-sky-400'
          : 'from-red-500 to-sky-400';

    const metricasPrincipais = [
      { label: 'Realizado', value: formatCurrency(vendedor.metaReal), tone: 'text-foreground' },
      { label: 'Meta até hoje', value: formatCurrency(vendedor.metaEsperada), tone: 'text-sky-200' },
      {
        label: 'Diferença',
        value: formatCurrency(vendedor.diferenca, true),
        tone: vendedor.diferenca >= 0 ? 'text-emerald-300' : 'text-red-300',
      },
      { label: 'Atingimento', value: formatPercent(vendedor.percentualAtingimento), tone: cfg.text },
    ];

    const metricasSecundarias = [
      { label: 'Meta mensal', value: formatCurrency(vendedor.metaMensal || 0) },
      { label: 'Meta diária', value: formatCurrency(vendedor.metaDiaria) },
      { label: 'Média/dia', value: formatCurrency(vendedor.mediaDiaria) },
    ];

    return (
      <div
        className={cn(
          'group rounded-2xl border border-border/55 bg-card/55 p-4 shadow-sm transition-all duration-300',
          'hover:-translate-y-0.5 hover:border-sky-400/35 hover:bg-card/70 hover:shadow-md',
          className,
        )}
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(220px,0.85fr)_minmax(520px,2fr)_minmax(210px,0.85fr)] xl:items-center">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="h-12 w-12 overflow-hidden rounded-2xl border border-border/60 bg-background/60">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={vendedor.nome} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>
              {rankBadge ? (
                <div
                  className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full"
                  style={{ background: rankBadge.bg, boxShadow: `0 0 10px ${rankBadge.glow}` }}
                  title={rankBadge.label}
                >
                  <rankBadge.Icon className="h-3 w-3 text-background" strokeWidth={2.5} />
                </div>
              ) : (
                <div className="absolute -bottom-1.5 -right-1.5 flex h-6 min-w-6 items-center justify-center rounded-full border border-border bg-background px-1.5 text-[10px] font-bold text-muted-foreground">
                  {vendedor.ranking}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-bold uppercase tracking-tight text-foreground">{vendedor.nome}</h3>
                <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]', statusClasses)}>
                  {statusText}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                #{vendedor.ranking} no ranking de ritmo diário
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {metricasPrincipais.map((metrica) => (
              <div key={metrica.label} className="rounded-xl border border-border/45 bg-background/35 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{metrica.label}</p>
                <p className={cn('mono-value mt-1 truncate text-sm font-bold tabular-nums', metrica.tone)}>
                  {metrica.value}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Progresso</span>
              <span className={cn('mono-value text-sm font-bold tabular-nums', cfg.text)}>
                {formatPercent(vendedor.percentualAtingimento)}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-background/70">
              <div
                className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', barClass)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {metricasSecundarias.map((metrica) => (
                <div key={metrica.label} className="min-w-0">
                  <p className="truncate text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{metrica.label}</p>
                  <p className="mono-value truncate text-xs font-semibold tabular-nums text-foreground">{metrica.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl overflow-hidden',
        'transition-all duration-500 hover:border-border hover:-translate-y-0.5',
        'animate-fade-in',
        className,
      )}
      style={{
        boxShadow: `inset 0 1px 0 0 hsl(var(--foreground) / 0.06), 0 8px 30px -12px ${cfg.glow}`,
      }}
    >
      {/* Status accent bar (left edge) */}
      <div
        className="absolute inset-y-0 left-0 w-[3px] transition-all duration-500 group-hover:w-[5px]"
        style={{ background: `linear-gradient(180deg, ${cfg.barFrom}, ${cfg.barTo})`, boxShadow: `0 0 12px ${cfg.glow}` }}
      />

      {/* Hover spotlight */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
        style={{ background: `radial-gradient(600px circle at 20% 0%, ${cfg.glow}, transparent 50%)` }}
      />

      <div className="relative p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* IDENTIFICAÇÃO */}
          <div className="flex items-center gap-3 md:w-56 flex-shrink-0">
            <div className="relative shrink-0">
              <div
                className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-border/60 transition-all duration-500 group-hover:ring-primary/60"
                style={{ boxShadow: `0 0 0 4px hsl(var(--background)), 0 6px 18px -6px ${cfg.glow}` }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={vendedor.nome} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <User className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              {/* Rank badge */}
              {rankBadge ? (
                <div
                  className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg]"
                  style={{ background: rankBadge.bg, boxShadow: `0 0 12px ${rankBadge.glow}, inset 0 1px 0 hsl(0 0% 100% / 0.4)` }}
                  title={rankBadge.label}
                >
                  <rankBadge.Icon className="w-3.5 h-3.5 text-background" strokeWidth={2.5} />
                </div>
              ) : (
                <div className="absolute -bottom-1.5 -right-1.5 min-w-7 h-7 px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold border-2 border-background bg-muted text-muted-foreground tabular-nums">
                  {vendedor.ranking}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-base uppercase tracking-tight truncate leading-tight">{vendedor.nome}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Meta mensal
              </p>
              <p className="text-sm font-semibold mono-value tabular-nums" style={{ color: cfg.ring }}>
                {formatCurrency(vendedor.metaMensal || 0)}
              </p>
            </div>
          </div>

          {/* MÉTRICAS */}
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-2.5">
            <Metric icon={Target} label="M.Diária" value={formatCurrency(vendedor.metaDiaria)} accent="hsl(217 91% 60%)" />
            <Metric icon={DollarSign} label="M.Real" value={formatCurrency(vendedor.metaReal)} accent="hsl(173 80% 40%)" />
            <Metric
              icon={BarChart3}
              label="Dif."
              value={`${vendedor.diferenca >= 0 ? '+' : ''}${formatCurrency(vendedor.diferenca)}`}
              tone={vendedor.diferenca >= 0 ? 'positive' : 'negative'}
              accent={vendedor.diferenca >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
            />
            <Metric icon={Calculator} label="Méd/Dia" value={formatCurrency(vendedor.mediaDiaria)} accent="hsl(280 65% 60%)" />
          </div>

          {/* STATUS RING (desktop) */}
          <div
            className={cn(
              'hidden md:flex relative items-center justify-center w-24 h-24 rounded-2xl border backdrop-blur-md transition-all duration-500 group-hover:scale-105',
              cfg.chipBg,
            )}
            style={{ boxShadow: `inset 0 1px 0 hsl(var(--foreground) / 0.05), 0 0 24px -8px ${cfg.glow}` }}
          >
            <svg width="80" height="80" viewBox="0 0 80 80" className="absolute inset-0 m-auto -rotate-90">
              <circle cx="40" cy="40" r={RADIUS} stroke="hsl(var(--muted) / 0.35)" strokeWidth="5" fill="none" />
              <circle
                cx="40"
                cy="40"
                r={RADIUS}
                stroke={cfg.ring}
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${dash} ${CIRC}`}
                style={{ filter: `drop-shadow(0 0 4px ${cfg.glow})`, transition: 'stroke-dasharray 900ms cubic-bezier(0.22, 0.9, 0.32, 1)' }}
              />
            </svg>
            <div className="relative flex flex-col items-center justify-center">
              <StatusIcon className={cn('w-3.5 h-3.5 mb-0.5', cfg.text)} />
              <span className={cn('text-lg font-extrabold mono-value tabular-nums leading-none', cfg.text)}>
                {formatPercent(vendedor.percentualAtingimento)}
              </span>
              <span className={cn('text-[9px] uppercase tracking-widest font-bold mt-0.5', cfg.text)}>{cfg.label}</span>
            </div>
          </div>

          {/* Status chip mobile */}
          <div className={cn('md:hidden self-start flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold', cfg.chipBg, cfg.text)}>
            <StatusIcon className="w-3 h-3" />
            <span className="mono-value tabular-nums">{formatPercent(vendedor.percentualAtingimento)}</span>
            <span className="opacity-70">· {cfg.label}</span>
          </div>
        </div>

        {/* PROGRESSO */}
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-muted-foreground/80">
            <span className="font-semibold">Progresso da Meta</span>
            <span className={cn('mono-value tabular-nums font-bold', cfg.text)}>{formatPercent(vendedor.percentualAtingimento)}</span>
          </div>
          <div className="relative h-2 w-full rounded-full bg-muted/40 overflow-hidden">
            <div
              className="vmd-bar relative h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${cfg.barFrom}, ${cfg.barTo})`,
                boxShadow: `0 0 12px ${cfg.glow}`,
              }}
            >
              <span className="vmd-shine absolute inset-y-0 -left-1/3 w-1/3" />
            </div>
            {/* 100% marker */}
            {pct < 100 && (
              <div className="absolute inset-y-0 right-0 w-px bg-foreground/20" title="Meta 100%" />
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes vmdFill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes vmdShine {
          0% { transform: translateX(-120%); opacity: 0; }
          30% { opacity: 0.45; }
          70% { opacity: 0.25; }
          100% { transform: translateX(420%); opacity: 0; }
        }
        .vmd-bar { transform-origin: left center; animation: vmdFill 800ms cubic-bezier(0.22, 0.9, 0.32, 1) backwards; }
        .vmd-shine {
          background: linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.4), transparent);
          animation: vmdShine 3.6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
