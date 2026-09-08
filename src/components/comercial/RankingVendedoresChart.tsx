import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import {
  Trophy, TrendingUp, Flame, Target,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer,
  ReferenceLine, Tooltip as RTooltip,
} from 'recharts';
import {
  type PeriodoFiltroRanking,
  resolveMetaReferenciaRankingVendedor,
} from '@/utils/rankingVendedoresMeta';
import { RankingVendedoresLabels } from './RankingVendedoresLabels';

interface VendedorRow {
  codigo: string | number;
  nome: string;
  mes: number;
  meta: number;
  metaDiaria?: number;
  status?: 'acima' | 'proximo' | 'abaixo' | string;
  _row: unknown;
}

interface Props {
  data: VendedorRow[];
  periodo?: PeriodoFiltroRanking;
  onClick?: (row: unknown) => void;
  variant?: 'default' | 'pelegriniBlue';
}

type Modo = 'faturamento' | 'meta';
type StatusKey = 'acima' | 'proximo' | 'abaixo' | 'default';
type EnrichedVendedorRow = VendedorRow & {
  pct: number;
  metaReferencia: number;
  metaLabel: string;
  pctMeta: number;
  gap: number;
  rank: number;
};

const STATUS_COLORS: Record<StatusKey, { solid: string }> = {
  acima: { solid: 'hsl(142 71% 45%)' },
  proximo: { solid: 'hsl(38 92% 50%)' },
  abaixo: { solid: 'hsl(142 71% 45%)' },
  default: { solid: 'hsl(var(--primary))' },
};

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
        : 'border-border/60 bg-card',
    )}>
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
            accent={isBlue ? 'pelegrini-led-card bg-background/35 text-foreground border-border/50' : 'bg-amber-500/10'}
          />
          <StatChip
            icon={<TrendingUp className={cn('h-3.5 w-3.5', isBlue ? 'text-primary' : 'text-violet-400')} />}
            label="Média por vendedor"
            value={formatCurrency(media)}
            hint={`${enriched.length} vendedor(es)`}
            accent={isBlue ? 'pelegrini-led-card bg-primary/5 text-foreground border-border/50' : 'bg-violet-500/10'}
          />
          <StatChip
            icon={<Flame className={cn('h-3.5 w-3.5', isBlue ? 'text-primary' : 'text-emerald-400')} />}
            label="Bateram meta"
            value={`${acima}/${enriched.length}`}
            hint={enriched.length ? `${((acima / enriched.length) * 100).toFixed(0)}%` : ''}
            accent={isBlue ? 'pelegrini-led-card bg-primary/5 text-foreground border-border/50' : 'bg-emerald-500/10'}
          />
        </div>
      </CardHeader>

      <CardContent className="relative">
        {enriched.length === 0 ? (
          <div className={cn('text-center text-sm py-16', isBlue ? 'text-muted-foreground' : 'text-muted-foreground')}>
            Sem dados no período selecionado
          </div>
        ) : (
          <div className="w-full min-w-0 pb-2">
            <div className="min-w-0">
              <div className="h-[280px] sm:h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={enriched}
                    margin={{ top: 24, right: 16, left: 8, bottom: 12 }}
                    onMouseLeave={() => setHoverKey(null)}
                  >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={isBlue ? 0.42 : 0.4} />
                <XAxis
                  dataKey="nome"
                  tick={false}
                  interval={0}
                  height={12}
                  stroke="hsl(var(--border))"
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 15, fill: isBlue ? 'hsl(var(--muted-foreground))' : 'currentColor' }}
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
                    label={{ value: 'Meta 100%', position: 'right', fill: 'hsl(var(--muted-foreground))', fontSize: 14 }}
                  />
                )}
                {modo === 'faturamento' && media > 0 && (
                  <ReferenceLine
                    y={media}
                    stroke={isBlue ? '#2563eb' : 'hsl(var(--primary))'}
                    strokeDasharray="4 4"
                    strokeOpacity={0.55}
                    label={{ value: `Média ${compactCurrency(media)}`, position: 'right', fill: 'hsl(var(--primary))', fontSize: 14 }}
                  />
                )}

                <Bar
                  dataKey={modo === 'faturamento' ? 'mes' : 'pctMeta'}
                  radius={[10, 10, 4, 4]}
                  onMouseOver={(d: EnrichedVendedorRow) => setHoverKey(String(d.codigo))}
                  onClick={(d: EnrichedVendedorRow) => onClick?.(d._row)}
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
                        fill={isBlue ? 'hsl(var(--primary))' : STATUS_COLORS[key].solid}
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
              <RankingVendedoresLabels data={enriched} modo={modo} variant={variant} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function paletteKey(row: EnrichedVendedorRow, modo: Modo): StatusKey {
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

function CustomTooltip({
  active,
  payload,
  variant = 'default',
}: {
  active?: boolean;
  payload?: Array<{ payload: EnrichedVendedorRow }>;
  modo: Modo;
  variant?: Props['variant'];
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0].payload;
  const medal = v.rank === 1 ? '🥇' : v.rank === 2 ? '🥈' : v.rank === 3 ? '🥉' : `#${v.rank}`;
  return (
    <div className={cn(
      'rounded-lg border p-3 min-w-[220px]',
      variant === 'pelegriniBlue' ? 'border-border/70 bg-popover text-popover-foreground' : 'border-border/70 bg-popover',
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
