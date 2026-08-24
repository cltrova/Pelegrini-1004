import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Trophy,
  Crown,
  Medal,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Users,
  Building2,
  MapPin,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Search,
  Star,
  MoreHorizontal,
  Calendar,
  Clock,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { cn } from '@/lib/utils';

/* ---------- Types ---------- */

export interface LeaderboardEntry {
  id: string;
  rank: number;
  title: string;
  subtitle?: string;
  avatarUrl?: string;
  initials: string;
  primaryValue: number;
  primaryFormat: 'currency' | 'integer';
  share: number;
  delta?: number | null;
  sparkline: { mes: string; valor: number }[];
  meta?: { icon?: 'map' | 'building' | 'user'; text: string }[];
  extraStats?: { label: string; value: string; icon?: 'money' | 'orders' | 'calendar' | 'clock' }[];
}

export interface LeaderboardTab {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  entries: LeaderboardEntry[];
  primaryLabel: string;
  emptyMsg?: string;
  seeAllLabel?: string;
  onSeeAll?: () => void;
}

interface Props {
  title?: string;
  subtitle?: string;
  tabs: LeaderboardTab[];
  headerAction?: React.ReactNode;
}

/* ---------- Hooks ---------- */

function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    fromRef.current = value;
    startRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const t = Math.min(1, (ts - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(fromRef.current + (target - fromRef.current) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);
  return value;
}

/* ---------- Avatar color palette (deterministic by initials) ---------- */

const AVATAR_PALETTE = [
  { bg: 'bg-amber-500/15 text-amber-400 ring-amber-500/25' },
  { bg: 'bg-sky-500/15 text-sky-400 ring-sky-500/25' },
  { bg: 'bg-rose-500/15 text-rose-400 ring-rose-500/25' },
  { bg: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25' },
  { bg: 'bg-violet-500/15 text-violet-400 ring-violet-500/25' },
  { bg: 'bg-cyan-500/15 text-cyan-400 ring-cyan-500/25' },
  { bg: 'bg-fuchsia-500/15 text-fuchsia-400 ring-fuchsia-500/25' },
  { bg: 'bg-orange-500/15 text-orange-400 ring-orange-500/25' },
  { bg: 'bg-teal-500/15 text-teal-400 ring-teal-500/25' },
  { bg: 'bg-indigo-500/15 text-indigo-400 ring-indigo-500/25' },
];
function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

/* ---------- Rank tiers ---------- */

const RANK_TIER: Record<number, { tile: string; label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  1: { tile: 'bg-gradient-to-br from-amber-400/85 to-amber-600/70 text-amber-50 ring-amber-500/50 shadow-[0_4px_16px_-4px_hsl(38_92%_50%/0.55)]', label: 'Ouro',   Icon: Crown },
  2: { tile: 'bg-gradient-to-br from-slate-300/70 to-slate-500/60 text-slate-50 ring-slate-400/40 shadow-[0_4px_14px_-4px_hsl(220_15%_60%/0.45)]', label: 'Prata',  Icon: Medal },
  3: { tile: 'bg-gradient-to-br from-orange-400/85 to-orange-600/60 text-orange-50 ring-orange-500/45 shadow-[0_4px_14px_-4px_hsl(20_90%_50%/0.5)]', label: 'Bronze', Icon: Award },
};

/* ---------- Delta chip ---------- */

function DeltaChip({ pct, size = 'sm' }: { pct: number | null | undefined; size?: 'sm' | 'md' }) {
  if (pct === null || pct === undefined || !isFinite(pct)) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        <Minus className="h-3 w-3" />—
      </span>
    );
  }
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold tabular-nums ring-1 transition-all',
        size === 'md' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-[1px] text-[10.5px]',
        up ? 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/25' : 'bg-rose-500/10 text-rose-500 ring-rose-500/25',
      )}
    >
      <Icon className={cn(size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3')} />
      {formatPercent(Math.abs(pct))}
    </span>
  );
}

function formatByFormat(v: number, format: 'currency' | 'integer') {
  return format === 'currency' ? formatCurrency(v) : Math.round(v).toLocaleString('pt-BR');
}

/* ---------- Row ---------- */

function LeaderboardRow({
  entry,
  active,
  onSelect,
  index,
}: {
  entry: LeaderboardEntry;
  active: boolean;
  onSelect: () => void;
  index: number;
}) {
  const tier = RANK_TIER[entry.rank];
  const color = avatarColor(entry.initials || entry.title);

  return (
    <li
      onClick={onSelect}
      className={cn(
        'group/row relative flex cursor-pointer items-center gap-3 px-3.5 py-3 outline-none',
        'transition-[background,opacity,border-color] duration-200 ease-out',
        'border border-transparent',
        active
          ? 'bg-primary/[0.06] border-primary/25 shadow-[0_0_0_1px_hsl(var(--primary)/0.2)_inset,0_8px_20px_-14px_hsl(var(--primary)/0.6)]'
          : 'hover:bg-muted/40 [ul:hover>&:not(:hover)]:opacity-45',
        'animate-fade-in rounded-xl',
      )}
      style={{ animationDelay: `${index * 25}ms`, animationFillMode: 'both' }}
      role="button"
      aria-pressed={active}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
      }}
    >
      {/* Rank tile */}
      <div className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold tabular-nums ring-1 transition-transform duration-300 group-hover/row:scale-[1.06]',
        tier ? tier.tile : 'bg-muted/50 text-muted-foreground ring-border/60',
      )}>
        {tier ? <tier.Icon className="h-4 w-4" /> : entry.rank}
      </div>

      {/* Colored avatar tile */}
      <div className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-[11px] font-bold ring-1 transition-transform duration-300 group-hover/row:scale-[1.06]',
        color.bg,
      )}>
        {entry.avatarUrl ? (
          <img src={entry.avatarUrl} alt={entry.title} className="h-full w-full object-cover" />
        ) : (
          entry.initials
        )}
      </div>

      {/* Name + subtitle */}
      <div className="min-w-0 flex-[1.4]">
        <p className={cn(
          'truncate text-[13px] font-semibold uppercase tracking-tight',
          active ? 'text-foreground' : 'text-foreground/90 group-hover/row:text-foreground',
        )}>
          {entry.title}
        </p>
        {entry.subtitle && (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{entry.subtitle}</p>
        )}
      </div>

      {/* Share + bar */}
      <div className="hidden min-w-0 flex-1 flex-col items-end gap-1.5 md:flex">
        <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
          {formatPercent(entry.share)} share
        </span>
        <div className="relative h-1 w-full max-w-[130px] overflow-hidden rounded-full bg-muted/40">
          <div
            className={cn(
              'absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out',
              active
                ? 'bg-gradient-to-r from-primary to-primary/60 shadow-[0_0_10px_hsl(var(--primary)/0.55)]'
                : entry.rank === 1
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500/70'
                  : entry.rank === 2
                    ? 'bg-gradient-to-r from-slate-300 to-slate-400/70'
                    : entry.rank === 3
                      ? 'bg-gradient-to-r from-orange-400 to-orange-500/70'
                      : 'bg-foreground/30 group-hover/row:bg-primary/70',
            )}
            style={{ width: `${Math.max(3, Math.min(100, entry.share))}%` }}
          />
        </div>
      </div>

      {/* Value + delta */}
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="mono-value text-[13px] font-bold tabular-nums text-foreground">
          {formatByFormat(entry.primaryValue, entry.primaryFormat)}
        </span>
        <DeltaChip pct={entry.delta} />
      </div>

      {/* Chevron */}
      <ChevronRight className={cn(
        'h-4 w-4 shrink-0 transition-all duration-300',
        active ? 'text-primary translate-x-0.5' : 'text-muted-foreground/50 group-hover/row:text-foreground/70 group-hover/row:translate-x-0.5',
      )} />
    </li>
  );
}

/* ---------- Detail Panel ---------- */

const STAT_ICONS = {
  money: Building2,
  orders: Copy,
  calendar: Calendar,
  clock: Clock,
} as const;

function DetailPanel({ entry, primaryLabel }: { entry: LeaderboardEntry | null; primaryLabel: string }) {
  const value = useCountUp(entry?.primaryValue ?? 0);
  const share = useCountUp(entry?.share ?? 0);
  const [starred, setStarred] = useState(false);

  if (!entry) {
    return (
      <div className="flex h-full min-h-[520px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/10 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <p className="text-sm font-medium">Selecione um item do ranking</p>
        <p className="max-w-[220px] text-xs text-muted-foreground">
          Passe o mouse ou use as setas ↑ ↓ para explorar os detalhes.
        </p>
      </div>
    );
  }

  const tier = RANK_TIER[entry.rank];
  const color = avatarColor(entry.initials || entry.title);
  const fallbackBars = [0.34, 0.58, 0.42, 0.76, 0.64, 0.9].map((base, index) => {
    const shareBoost = Math.min(0.35, Math.max(0.08, entry.share / 180));
    return Math.max(18, Math.min(92, Math.round((base + shareBoost + index * 0.015) * 100)));
  });

  return (
    <div
      key={entry.id}
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-card/60 shadow-[0_10px_40px_-20px_hsl(var(--foreground)/0.35)] animate-fade-in"
    >
      <div aria-hidden className="pointer-events-none absolute -top-28 left-1/2 h-56 w-[70%] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      {/* Header */}
      <div className="relative flex items-start justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn(
            'flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl text-[13px] font-bold ring-1',
            color.bg,
          )}>
            {entry.avatarUrl ? <img src={entry.avatarUrl} alt={entry.title} className="h-full w-full object-cover" /> : entry.initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-[15px] font-bold text-foreground">{entry.title}</p>
              {tier && (
                <Badge variant="outline" className={cn('shrink-0 border-transparent px-1.5 py-0 text-[9.5px] font-semibold uppercase tracking-wider', tier.tile)}>
                  {tier.label}
                </Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Trophy className="h-3 w-3" /> #{entry.rank} no ranking
              </span>
              {entry.meta?.map((m, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  {m.icon === 'map' && <MapPin className="h-3 w-3" />}
                  {m.icon === 'building' && <Building2 className="h-3 w-3" />}
                  {m.icon === 'user' && <Users className="h-3 w-3" />}
                  {m.text}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Mais opções">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          <button
            onClick={() => setStarred(v => !v)}
            className={cn('rounded-md p-1.5 transition-all hover:bg-muted', starred ? 'text-amber-400' : 'text-muted-foreground hover:text-foreground')}
            aria-label="Favoritar"
          >
            <Star className={cn('h-4 w-4 transition-transform', starred && 'fill-current scale-110')} />
          </button>
        </div>
      </div>

      {/* Hero number */}
      <div className="relative px-5 pb-4">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-muted-foreground">{primaryLabel}</p>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <p className="mono-value text-[32px] font-bold leading-none tracking-tight tabular-nums text-foreground">
            {formatByFormat(value, entry.primaryFormat)}
          </p>
          <DeltaChip pct={entry.delta} size="md" />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted/40">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-primary to-primary/60 shadow-[0_0_14px_hsl(var(--primary)/0.55)] transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(3, Math.min(100, share))}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-semibold tabular-nums text-foreground/80">
            {formatPercent(share)} do total
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-[180px] px-1">
        {entry.sparkline.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={entry.sparkline} margin={{ top: 8, right: 12, left: 8, bottom: 4 }}>
              <defs>
                <linearGradient id="detailArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" vertical={false} className="stroke-border/40" />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 9.5, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(mes: string) => {
                  const [y, m] = mes.split('-');
                  if (!y || !m) return mes;
                  return `${m}/${y.slice(2)}`;
                }}
              />
              <YAxis
                tick={{ fontSize: 9.5, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                width={38}
                tickFormatter={(v: number) => {
                  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
                  return String(Math.round(v));
                }}
              />
              <ReTooltip
                cursor={{ stroke: 'hsl(var(--primary))', strokeOpacity: 0.35, strokeWidth: 1 }}
                formatter={(v: number) => [formatByFormat(v, entry.primaryFormat), primaryLabel]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 10,
                  fontSize: 11,
                  boxShadow: '0 10px 28px hsl(var(--foreground) / 0.18)',
                }}
              />
              <Area type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#detailArea)" animationDuration={700} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full flex-col justify-end gap-3 px-5 pb-5">
            <div className="flex items-end gap-2.5">
              {fallbackBars.map((height, index) => (
                <div
                  key={index}
                  className="relative flex-1 overflow-hidden rounded-t-xl border border-primary/10 bg-primary/5"
                  style={{ height: `${height}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/75 via-primary/35 to-cyan-300/20" />
                  <div className="absolute inset-x-0 top-0 h-5 bg-white/10 blur-sm" />
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-primary/15 bg-primary/[0.06] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/80">Compra no periodo</p>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span className="text-sm font-bold tabular-nums text-foreground">
                  {formatByFormat(entry.primaryValue, entry.primaryFormat)}
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {formatPercent(entry.share)} do total
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      {entry.extraStats && entry.extraStats.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 border-t border-border/50 bg-muted/[0.03] p-3.5">
          {entry.extraStats.map((s, i) => {
            const StatIcon = s.icon ? STAT_ICONS[s.icon] : null;
            return (
              <div
                key={i}
                className="group/stat rounded-xl border border-border/50 bg-card/60 p-3 transition-all hover:border-primary/30 hover:bg-primary/[0.04]"
              >
                <div className="flex items-center gap-1.5">
                  {StatIcon && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/60 text-muted-foreground transition-colors group-hover/stat:bg-primary/10 group-hover/stat:text-primary">
                      <StatIcon className="h-3 w-3" />
                    </div>
                  )}
                  <p className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                </div>
                <p className="mt-1.5 text-[15px] font-bold tabular-nums text-foreground">{s.value}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Main ---------- */

export function LeaderboardCommand({ title = 'Ranking Comercial', subtitle, tabs, headerAction }: Props) {
  const [tabKey, setTabKey] = useState(tabs[0]?.key);
  const [selectedId, setSelectedId] = useState<Record<string, string | null>>({});
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'primary' | 'share' | 'delta' | 'name'>('primary');

  const activeTab = tabs.find(t => t.key === tabKey) ?? tabs[0];

  const filteredEntries = useMemo(() => {
    if (!activeTab) return [];
    const s = search.trim().toLowerCase();
    let list = s
      ? activeTab.entries.filter(e => e.title.toLowerCase().includes(s) || e.subtitle?.toLowerCase().includes(s))
      : activeTab.entries.slice();
    if (sortKey !== 'primary') {
      list = list.slice().sort((a, b) => {
        if (sortKey === 'share') return b.share - a.share;
        if (sortKey === 'delta') return (b.delta ?? -Infinity) - (a.delta ?? -Infinity);
        return a.title.localeCompare(b.title);
      });
    }
    return list;
  }, [activeTab, search, sortKey]);

  const currentSelectedId =
    (activeTab && selectedId[activeTab.key]) ??
    filteredEntries[0]?.id ??
    activeTab?.entries[0]?.id ??
    null;
  const selectedEntry =
    activeTab?.entries.find(e => e.id === currentSelectedId) ??
    filteredEntries[0] ??
    null;

  const handleSelect = useCallback((id: string) => {
    if (!activeTab) return;
    setSelectedId(prev => ({ ...prev, [activeTab.key]: id }));
  }, [activeTab]);

  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (!el || !activeTab) return;
    const handler = (e: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown'].includes(e.key)) return;
      const entries = filteredEntries;
      const idx = Math.max(0, entries.findIndex(x => x.id === currentSelectedId));
      const next = e.key === 'ArrowDown' ? Math.min(entries.length - 1, idx + 1) : Math.max(0, idx - 1);
      if (entries[next]) handleSelect(entries[next].id);
      e.preventDefault();
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [activeTab, currentSelectedId, filteredEntries, handleSelect]);

  const sortLabel = sortKey === 'primary' ? 'Faturamento' : sortKey === 'share' ? 'Participação' : sortKey === 'delta' ? 'Variação' : 'Nome';

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-background/50 shadow-[0_10px_50px_-24px_hsl(var(--foreground)/0.35)]">
      <div aria-hidden className="pointer-events-none absolute -top-40 right-0 h-72 w-[55%] rounded-full bg-primary/10 blur-3xl" />

      {/* Global header (tabs + subtitle) */}
      <header className="relative flex flex-col gap-3 border-b border-border/60 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 ring-1 ring-primary/25">
            <Trophy className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-foreground">{title}</h3>
            <p className="text-[11.5px] text-muted-foreground">
              {subtitle ?? 'Explore, compare e navegue pelas principais posições'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {headerAction}
          <div className="inline-flex items-center rounded-xl border border-border/60 bg-muted/40 p-0.5 shadow-inner">
            {tabs.map(t => {
              const active = t.key === tabKey;
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => { setTabKey(t.key); setSearch(''); }}
                  className={cn(
                    'relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all',
                    active
                      ? 'bg-gradient-to-b from-primary/25 to-primary/10 text-primary ring-1 ring-primary/40 shadow-[0_2px_10px_-2px_hsl(var(--primary)/0.35)]'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="relative grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]">
        {/* List column */}
        <div className="flex flex-col border-b border-border/60 md:border-b-0 md:border-r">
          {/* List header: title + search + sort */}
          <div className="flex flex-col gap-2.5 border-b border-border/60 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5 text-primary" />
              <h4 className="text-[13px] font-semibold text-foreground">
                Ranking de {activeTab?.label ?? ''}
              </h4>
              <Badge variant="secondary" className="ml-1 text-[10px] font-medium tabular-nums">
                {filteredEntries.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Buscar ${activeTab?.label.toLowerCase() ?? ''}...`}
                  className="h-8 w-full pl-8 text-[12px] md:w-56"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2.5 text-[11.5px] font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground">
                    {sortLabel}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-[12px]">
                  <DropdownMenuItem onClick={() => setSortKey('primary')}>Faturamento (ranking)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortKey('share')}>Participação</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortKey('delta')}>Variação</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortKey('name')}>Nome (A–Z)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Rows */}
          {filteredEntries.length > 0 ? (
            <ul
              ref={listRef}
              tabIndex={0}
              className="max-h-[560px] space-y-1 overflow-y-auto scroll-smooth p-2 outline-none focus:outline-none"
              aria-label={`Ranking de ${activeTab?.label ?? ''}`}
            >
              {filteredEntries.map((e, i) => (
                <LeaderboardRow
                  key={e.id}
                  entry={e}
                  active={e.id === currentSelectedId}
                  onSelect={() => handleSelect(e.id)}
                  index={i}
                />
              ))}
            </ul>
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {activeTab?.emptyMsg ?? 'Nenhum item disponível.'}
            </div>
          )}

          {/* Footer */}
          {activeTab?.onSeeAll && filteredEntries.length > 0 && (
            <div className="border-t border-border/60 p-2.5">
              <button
                onClick={activeTab.onSeeAll}
                className="group/see inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-semibold text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground"
              >
                {activeTab.seeAllLabel ?? `Ver todos os ${activeTab.label.toLowerCase()}`}
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover/see:translate-x-0.5" />
              </button>
            </div>
          )}
        </div>

        {/* Detail rail */}
        <div className="p-3 md:p-4">
          <DetailPanel entry={selectedEntry} primaryLabel={activeTab?.primaryLabel ?? ''} />
        </div>
      </div>
    </section>
  );
}
