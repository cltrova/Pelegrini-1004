import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import {
  Crown, Trophy, Users, TrendingUp, Flame, Sparkles, Target,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer,
  ReferenceLine, Tooltip as RTooltip,
} from 'recharts';
import {
  type PeriodoFiltroRanking,
  resolveMetaReferenciaRankingVendedor,
} from '@/utils/rankingVendedoresMeta';

interface VendedorRow {
  codigo: any;
  nome: string;
  mes: number;
  meta: number;
  metaDiaria?: number;
  status?: 'acima' | 'proximo' | 'abaixo' | string;
  _row: any;
}

interface Props {
  data: VendedorRow[];
  periodo?: PeriodoFiltroRanking;
  onClick?: (row: any) => void;
  variant?: 'default' | 'pelegriniBlue';
}

type Modo = 'faturamento' | 'meta';

const STATUS_COLORS: Record<string, { grad: string; solid: string; text: string; ring: string; glow: string }> = {
  acima:   { grad: 'from-emerald-400 via-emerald-500 to-teal-600',   solid: 'hsl(142 71% 45%)', text: 'text-emerald-400', ring: 'ring-emerald-500/40', glow: 'shadow-[0_0_30px_-8px_hsl(142_71%_45%/0.6)]' },
  proximo: { grad: 'from-amber-300 via-amber-500 to-orange-600',     solid: 'hsl(38 92% 50%)',  text: 'text-amber-400',   ring: 'ring-amber-500/40',   glow: 'shadow-[0_0_30px_-8px_hsl(38_92%_50%/0.6)]' },
  abaixo:  { grad: 'from-emerald-400 via-green-500 to-emerald-700', solid: 'hsl(142 71% 45%)', text: 'text-emerald-400', ring: 'ring-emerald-500/40', glow: 'shadow-[0_0_30px_-8px_hsl(142_71%_45%/0.6)]' },
  default: { grad: 'from-primary/70 via-primary to-primary/60',      solid: 'hsl(var(--primary))', text: 'text-primary',   ring: 'ring-primary/40',     glow: 'shadow-[0_0_30px_-8px_hsl(var(--primary)/0.6)]' },
};

function getStatusPalette(row: any, modo: Modo) {
  if (modo === 'meta') {
    if (row.pctMeta >= 100) return STATUS_COLORS.acima;
    if (row.pctMeta >= 90)  return STATUS_COLORS.proximo;
    if (row.pctMeta > 0)    return STATUS_COLORS.abaixo;
    return STATUS_COLORS.default;
  }
  return STATUS_COLORS[row.status as string] || STATUS_COLORS.default;
}

function getIniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();
}

export function RankingVendedoresChart({ data, periodo, onClick, variant = 'default' }: Props) {
  const [modo, setModo] = useState<Modo>('faturamento');
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const isBlue = variant === 'pelegriniBlue';

  const enriched = useMemo(() => {
    const total = data.reduce((s, v) => s + (v.mes || 0), 0) || 1;
    return [...data]
      .map(v => {
        const metaRef = resolveMetaReferenciaRankingVendedor(v, periodo);
        return {
          ...v,
          pct: (v.mes / total) * 100,
          metaReferencia: metaRef.meta,
          metaLabel: metaRef.label,
          pctMeta: metaRef.pctMeta,
          gap: metaRef.gap,
        };
      })
      .sort((a, b) => modo === 'faturamento' ? b.mes - a.mes : b.pctMeta - a.pctMeta)
      .map((v, i) => ({ ...v, rank: i + 1 }));
  }, [data, modo, periodo]);

  const maxVal = useMemo(() => {
    if (!enriched.length) return 1;
    return modo === 'faturamento'
      ? Math.max(...enriched.map(e => e.mes)) || 1
      : Math.max(100, ...enriched.map(e => e.pctMeta)) || 100;
  }, [enriched, modo]);

  const totalGeral = enriched.reduce((s, v) => s + v.mes, 0);
  const media = enriched.length ? totalGeral / enriched.length : 0;
  const lider = enriched[0];
  const acima = enriched.filter(e => e.pctMeta >= 100).length;

  return (
    <Card className={cn(
      'overflow-hidden relative transition-shadow duration-300',
      isBlue
        ? 'pelegrini-led-card border-border/60 bg-card text-foreground'
        : 'border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.03]',
    )}>
      {!isBlue && (
        <>
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-amber-500/5 blur-3xl" />
        </>
      )}

      <CardHeader className="pb-3 relative">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div />


          <div className={cn(
            'flex items-center gap-1 rounded-lg p-1 ring-1',
            isBlue ? 'bg-background/45 ring-border/50' : 'bg-muted/40 ring-border/50',
          )}>
            <Button
              size="sm"
              variant={modo === 'faturamento' ? 'default' : 'ghost'}
              className={cn(
                'h-7 px-3 text-xs gap-1.5',
                isBlue && modo === 'faturamento' && 'bg-primary text-primary-foreground hover:bg-primary/90',
                isBlue && modo !== 'faturamento' && 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
              )}
              onClick={() => setModo('faturamento')}
            >
              <TrendingUp className="h-3 w-3" /> Faturamento
            </Button>
            <Button
              size="sm"
              variant={modo === 'meta' ? 'default' : 'ghost'}
              className={cn(
                'h-7 px-3 text-xs gap-1.5',
                isBlue && modo === 'meta' && 'bg-primary text-primary-foreground hover:bg-primary/90',
                isBlue && modo !== 'meta' && 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
              )}
              onClick={() => setModo('meta')}
            >
              <Target className="h-3 w-3" /> % Meta
            </Button>
          </div>
        </div>

        {/* Mini stat strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-4">
          <StatChip
            icon={<Trophy className={cn('h-3.5 w-3.5', isBlue ? 'text-primary' : 'text-amber-400')} />}
            label="Líder"
            value={lider?.nome || '—'}
            hint={lider ? formatCurrency(lider.mes) : ''}
            accent={isBlue ? 'pelegrini-led-card bg-background/35 text-foreground border-border/50' : 'bg-gradient-to-br from-amber-500/15 to-transparent'}
          />
          <StatChip
            icon={<TrendingUp className={cn('h-3.5 w-3.5', isBlue ? 'text-primary' : 'text-violet-400')} />}
            label="Média por vendedor"
            value={formatCurrency(media)}
            hint={`${enriched.length} vendedor(es)`}
            accent={isBlue ? 'pelegrini-led-card bg-primary/5 text-foreground border-border/50' : 'bg-gradient-to-br from-violet-500/15 to-transparent'}
          />
          <StatChip
            icon={<Flame className={cn('h-3.5 w-3.5', isBlue ? 'text-primary' : 'text-emerald-400')} />}
            label="Bateram meta"
            value={`${acima}/${enriched.length}`}
            hint={enriched.length ? `${((acima / enriched.length) * 100).toFixed(0)}%` : ''}
            accent={isBlue ? 'pelegrini-led-card bg-primary/5 text-foreground border-border/50' : 'bg-gradient-to-br from-emerald-500/15 to-transparent'}
          />
        </div>
      </CardHeader>

      <CardContent className="relative">
        {enriched.length === 0 ? (
          <div className={cn('text-center text-sm py-16', isBlue ? 'text-muted-foreground' : 'text-muted-foreground')}>
            Sem dados no período selecionado
          </div>
        ) : (
          <div className="w-full h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={enriched}
                  margin={{ top: 24, right: 16, left: 8, bottom: 78 }}
                onMouseLeave={() => setHoverKey(null)}
              >
                <defs>
                  <linearGradient id="grad-acima" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isBlue ? '#2563eb' : 'hsl(160 84% 55%)'} stopOpacity={1} />
                    <stop offset="100%" stopColor={isBlue ? '#1e40af' : 'hsl(160 84% 35%)'} stopOpacity={0.9} />
                  </linearGradient>
                  <linearGradient id="grad-proximo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isBlue ? '#1d4ed8' : 'hsl(38 92% 60%)'} stopOpacity={1} />
                    <stop offset="100%" stopColor={isBlue ? '#1e3a8a' : 'hsl(28 92% 45%)'} stopOpacity={0.88} />
                  </linearGradient>
                  <linearGradient id="grad-abaixo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isBlue ? '#0ea5e9' : 'hsl(142 71% 55%)'} stopOpacity={1} />
                    <stop offset="100%" stopColor={isBlue ? '#075985' : 'hsl(150 71% 32%)'} stopOpacity={0.88} />
                  </linearGradient>
                  <linearGradient id="grad-default" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isBlue ? '#3b82f6' : 'hsl(var(--primary))'} stopOpacity={1} />
                    <stop offset="100%" stopColor={isBlue ? '#1d4ed8' : 'hsl(var(--primary))'} stopOpacity={0.75} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={isBlue ? 0.42 : 0.4} />
                <XAxis
                  dataKey="nome"
                  tick={(props) => <VendedorTick {...props} data={enriched} modo={modo} variant={variant} />}
                  interval={0}
                  height={64}
                  stroke="hsl(var(--border))"
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11, fill: isBlue ? 'hsl(var(--muted-foreground))' : 'currentColor' }}
                  tickFormatter={(v) => modo === 'faturamento' ? compactCurrency(v) : `${v}%`}
                />
                <RTooltip
                  cursor={{ fill: 'hsl(var(--muted) / 0.35)', radius: 8 }}
                  content={<CustomTooltip modo={modo} variant={variant} />}
                />

                {modo === 'meta' && (
                  <ReferenceLine
                    y={100}
                    stroke="hsl(var(--foreground))"
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                    label={{ value: 'Meta 100%', position: 'right', fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  />
                )}
                {modo === 'faturamento' && media > 0 && (
                  <ReferenceLine
                    y={media}
                    stroke={isBlue ? '#2563eb' : 'hsl(var(--primary))'}
                    strokeDasharray="4 4"
                    strokeOpacity={0.55}
                    label={{ value: `Média ${compactCurrency(media)}`, position: 'right', fill: 'hsl(var(--primary))', fontSize: 10 }}
                  />
                )}

                <Bar
                  dataKey={modo === 'faturamento' ? 'mes' : 'pctMeta'}
                  radius={[10, 10, 4, 4]}
                  onMouseOver={(d: any) => setHoverKey(String(d?.codigo))}
                  onClick={(d: any) => onClick?.(d?._row)}
                  animationDuration={700}
                  cursor="pointer"
                >
                  {enriched.map((v) => {
                    const key = paletteKey(v, modo);
                    const isHover = hoverKey === String(v.codigo);
                    const dim = hoverKey && !isHover;
                    return (
                      <Cell
                        key={String(v.codigo)}
                        fill={`url(#grad-${key})`}
                        opacity={dim ? 0.35 : 1}
                        stroke={isHover ? 'hsl(var(--foreground))' : 'transparent'}
                        strokeWidth={isHover ? 1.5 : 0}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function paletteKey(row: any, modo: Modo): 'acima' | 'proximo' | 'abaixo' | 'default' {
  if (modo === 'meta') {
    if (row.pctMeta >= 100) return 'acima';
    if (row.pctMeta >= 90) return 'proximo';
    if (row.pctMeta > 0) return 'abaixo';
    return 'default';
  }
  const s = row.status as string;
  if (s === 'acima' || s === 'proximo' || s === 'abaixo') return s;
  return 'default';
}

function compactCurrency(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${Math.round(v)}`;
}

function VendedorTick(props: any) {
  const { x, y, payload, index, data, modo, variant = 'default' } = props;
  const isBlue = variant === 'pelegriniBlue';
  const row = Array.isArray(data) ? data[index] : null;
  const nome: string = payload?.value || '';
  const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
  const short = nome.length > 10 ? nome.slice(0, 9) + '…' : nome;
  const valueLabel = row
    ? modo === 'meta'
      ? formatPercent(row.pctMeta || 0)
      : formatCurrency(row.mes || 0)
    : '';
  return (
    <g transform={`translate(${x},${y + 4})`}>
      <text
        textAnchor="middle"
        fontSize={11}
        fill={isBlue ? 'hsl(var(--muted-foreground))' : 'hsl(var(--muted-foreground))'}
        className="font-medium"
      >
        {medal ? `${medal} ` : ''}{short}
      </text>
      {valueLabel && (
        <text
          y={18}
          textAnchor="middle"
          fontSize={10}
          fill={isBlue ? 'hsl(var(--foreground))' : 'hsl(var(--foreground))'}
          className="font-mono font-semibold tabular-nums"
        >
          {valueLabel}
        </text>
      )}
    </g>
  );
}

function CustomTooltip({ active, payload, modo, variant = 'default' }: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0].payload;
  const medal = v.rank === 1 ? '🥇' : v.rank === 2 ? '🥈' : v.rank === 3 ? '🥉' : `#${v.rank}`;
  return (
    <div className={cn(
      'rounded-xl border backdrop-blur-md shadow-xl p-3 min-w-[220px]',
      variant === 'pelegriniBlue' ? 'border-border/70 bg-popover/95 text-popover-foreground shadow-xl' : 'border-border/70 bg-popover/95',
    )}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-xs font-bold uppercase tracking-wide">{v.nome}</span>
        <span className="text-xs font-mono text-muted-foreground">{medal}</span>
      </div>
      <div className="space-y-1 text-xs">
        <Row label="Faturado" value={formatCurrency(v.mes)} strong />
        <Row label={v.metaLabel || 'Meta'} value={formatCurrency(v.metaReferencia ?? v.meta)} />
        <Row label="% Meta" value={formatPercent(v.pctMeta)} accent={v.pctMeta >= 100 ? 'text-emerald-400' : v.pctMeta >= 90 ? 'text-amber-400' : 'text-emerald-400'} />
        <Row
          label={v.gap > 0 ? 'Faltam' : 'Excedente'}
          value={formatCurrency(Math.abs(v.gap))}
          accent="text-emerald-400"
        />
        <Row label="Participação" value={`${v.pct.toFixed(1)}%`} />
      </div>
      <div className="mt-2 pt-2 border-t border-border/60 text-[10px] text-muted-foreground">
        Clique na barra para detalhar
      </div>
    </div>
  );
}

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-mono tabular-nums', strong && 'font-bold', accent)}>{value}</span>
    </div>
  );
}

function StatChip({
  icon, label, value, hint, accent,
}: { icon: React.ReactNode; label: string; value: string; hint?: string; accent: string }) {
  return (
    <div className={cn(
      'relative rounded-lg border border-border/50 px-3 py-2 overflow-hidden',
      accent
    )}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
        {icon}{label}
      </div>
      <div className="text-sm font-bold font-mono truncate mt-0.5">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground truncate">{hint}</div>}
    </div>
  );
}
