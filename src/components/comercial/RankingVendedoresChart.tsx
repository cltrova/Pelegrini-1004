import { useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import {
  Trophy, TrendingUp, Flame, Target, ChevronLeft, ChevronRight,
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
import { PELEGRINI_RANKING_PLOT } from './rankingVendedoresChartLayout';

interface VendedorRow<T> {
  codigo: string | number;
  nome: string;
  mes: number;
  meta: number;
  metaDiaria?: number;
  status?: 'acima' | 'proximo' | 'abaixo' | string;
  _row: T;
}

type RankingVariant = 'default' | 'pelegriniBlue';

interface Props<T> {
  data: VendedorRow<T>[];
  periodo?: PeriodoFiltroRanking;
  onClick?: (row: T) => void;
  variant?: RankingVariant;
}

type Modo = 'faturamento' | 'meta';
type StatusKey = 'acima' | 'proximo' | 'abaixo' | 'default';
type EnrichedVendedorRow<T = unknown> = VendedorRow<T> & {
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
const axisNumberFormat = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

export function RankingVendedoresChart<T>({ data, periodo, onClick, variant = 'default' }: Props<T>) {
  const [modo, setModo] = useState<Modo>('faturamento');
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [firstVisibleIndex, setFirstVisibleIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const isBlue = variant === 'pelegriniBlue';
  const narrowChart = isBlue && chartWidth > 0 && chartWidth < 500;

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

  const minColumnWidth = useMemo(() => {
    if (modo === 'meta') return 84;
    // Reserva espaço para cada caractere do valor em fonte monoespaçada e uma margem entre os rótulos.
    return enriched.reduce((width, row) => Math.max(width, 8 * formatCurrency(row.mes || 0).length + 12), 84);
  }, [enriched, modo]);

  const pageSize = isBlue && chartWidth > 0
    ? Math.max(1, Math.floor((chartWidth - PELEGRINI_RANKING_PLOT.left - PELEGRINI_RANKING_PLOT.right) / minColumnWidth))
    : Math.max(1, enriched.length);
  const lastPage = Math.max(0, Math.ceil(enriched.length / pageSize) - 1);
  const page = Math.min(Math.floor(firstVisibleIndex / pageSize), lastPage);
  const pageStart = page * pageSize;
  const visibleRows = useMemo(() => enriched.slice(pageStart, pageStart + pageSize), [enriched, pageStart, pageSize]);
  const dataKey = modo === 'faturamento' ? 'mes' : 'pctMeta';
  const highlightedVendor = isBlue && hoverKey ? visibleRows.find((row) => String(row.codigo) === hoverKey) : undefined;
  const domain = useMemo(() => enriched.reduce<[number, number]>(([min, max], row) => [
    Math.min(min, row[dataKey]), Math.max(max, row[dataKey]),
  ], [0, modo === 'meta' ? 100 : 1]), [enriched, dataKey, modo]);

  const updateMode = (nextMode: Modo) => {
    if (nextMode === modo) return;
    setModo(nextMode);
    setFirstVisibleIndex(0);
    setHoverKey(null);
  };

  const navigatePage = (nextPage: number) => {
    setFirstVisibleIndex(nextPage * pageSize);
    setHoverKey(null);
  };

  const totalGeral = enriched.reduce((s, v) => s + v.mes, 0);
  const media = enriched.length ? totalGeral / enriched.length : 0;
  const lider = enriched[0];
  const acima = enriched.filter(e => e.pctMeta >= 100).length;

  return (
    <Card className={cn(
      'overflow-hidden relative transition-shadow duration-300',
      isBlue
        ? 'dashboard-overview-ranking pelegrini-ranking-card flex min-h-0 min-w-0 flex-col border-border/70 bg-card text-foreground shadow-none'
        : 'border-border/60 bg-card',
    )}>
      <CardHeader className={cn(isBlue ? 'shrink-0 space-y-0 p-2.5 pb-1.5' : 'pb-3 relative')}>
        <div className={cn('flex flex-wrap items-center justify-between', isBlue ? 'gap-1.5' : 'gap-3')}>
          {isBlue ? <CardTitle className="text-sm font-semibold">Ranking de vendedores</CardTitle> : <div />}

          <div role="group" aria-label="Ordenar ranking por" className={cn(
            'flex items-center gap-1 rounded-lg p-1 ring-1',
            isBlue ? 'dashboard-ranking-order bg-background/45 p-0.5 ring-border/50' : 'bg-muted/40 ring-border/50',
          )}>
            <Button
              size="sm"
              variant={modo === 'faturamento' ? 'default' : 'ghost'}
              className={cn(
                'h-7 px-3 text-xs gap-1.5',
                isBlue && modo === 'faturamento' && 'bg-primary text-primary-foreground hover:bg-primary/90',
                isBlue && modo !== 'faturamento' && 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
              )}
              aria-pressed={modo === 'faturamento'}
              onClick={() => updateMode('faturamento')}
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
              aria-pressed={modo === 'meta'}
              onClick={() => updateMode('meta')}
            >
              <Target className="h-3 w-3" /> % Meta
            </Button>
          </div>
        </div>

        {!isBlue && (
          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
            <StatChip
              icon={<Trophy className="size-3.5 text-amber-400" />}
              label="Líder"
              value={lider?.nome || '—'}
              hint={lider ? formatCurrency(lider.mes) : ''}
              accent="bg-amber-500/10"
            />
            <StatChip
              icon={<TrendingUp className="size-3.5 text-violet-400" />}
              label="Média por vendedor"
              value={formatCurrency(media)}
              hint={`${enriched.length} vendedor(es)`}
              accent="bg-violet-500/10"
            />
            <StatChip
              icon={<Flame className="size-3.5 text-emerald-400" />}
              label="Bateram meta"
              value={`${acima}/${enriched.length}`}
              hint={enriched.length ? `${((acima / enriched.length) * 100).toFixed(0)}%` : ''}
              accent="bg-emerald-500/10"
            />
          </div>
        )}
      </CardHeader>

      <CardContent className={cn('relative', isBlue && 'flex min-h-0 flex-1 flex-col p-0 px-2.5 pb-2')}>
        {enriched.length === 0 ? (
          <div className={cn('text-center text-sm text-muted-foreground', isBlue ? 'grid flex-1 place-items-center' : 'py-16')}>
            Sem dados no período selecionado
          </div>
        ) : (
          <div
            className={cn('w-full min-w-0', isBlue ? 'flex min-h-0 flex-1 flex-col' : 'overflow-x-auto pb-2')}
            tabIndex={isBlue ? undefined : 0}
            aria-label={isBlue ? undefined : 'Ranking de vendedores; deslize para ver todos'}
          >
            <div className={cn(isBlue && 'flex min-h-0 flex-1 flex-col')} style={isBlue ? undefined : { minWidth: Math.max(300, enriched.length * minColumnWidth + 84) }}>
              <div className={isBlue ? 'min-h-0 flex-1' : 'h-[280px] sm:h-[320px]'}>
                <ResponsiveContainer width="100%" height="100%" onResize={isBlue ? setChartWidth : undefined}>
                  <BarChart
                    data={visibleRows}
                    margin={isBlue ? { top: 10, right: PELEGRINI_RANKING_PLOT.right, left: 0, bottom: 3 } : { top: 24, right: 16, left: 8, bottom: 12 }}
                    accessibilityLayer={isBlue}
                    onMouseMove={isBlue ? ({ activeTooltipIndex, isTooltipActive }) => {
                      const vendor = isTooltipActive && activeTooltipIndex !== undefined ? visibleRows[activeTooltipIndex] : undefined;
                      setHoverKey(vendor ? String(vendor.codigo) : null);
                    } : undefined}
                    onMouseLeave={() => setHoverKey(null)}
                    barCategoryGap={isBlue ? '22%' : undefined}
                  >
                    <CartesianGrid
                      strokeDasharray={isBlue ? '2 4' : '3 3'}
                      stroke={isBlue ? 'hsl(var(--muted-foreground) / 0.32)' : 'hsl(var(--border))'}
                      vertical={false}
                      opacity={isBlue ? 1 : 0.4}
                    />
                    <XAxis
                      dataKey="nome"
                      tick={false}
                      interval={0}
                      height={narrowChart ? 6 : 12}
                      stroke="hsl(var(--border))"
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      width={isBlue ? PELEGRINI_RANKING_PLOT.left : undefined}
                      axisLine={isBlue ? false : undefined}
                      tickLine={isBlue ? { stroke: 'hsl(var(--muted-foreground) / 0.7)' } : undefined}
                      tickSize={isBlue ? 4 : undefined}
                      tickMargin={isBlue ? 7 : undefined}
                      domain={isBlue && lastPage > 0 ? domain : undefined}
                      tickCount={narrowChart ? 3 : isBlue ? 4 : undefined}
                      tick={{ fontSize: isBlue ? 11 : 15, fill: isBlue ? 'hsl(var(--muted-foreground))' : 'currentColor' }}
                      tickFormatter={(v: number) => modo === 'faturamento' ? (isBlue ? axisNumberFormat.format(v) : compactCurrency(v)) : formatPercent(v)}
                    />
                    <RTooltip
                      cursor={{ fill: isBlue ? 'hsl(var(--primary) / 0.08)' : 'hsl(var(--muted) / 0.35)', radius: 4 }}
                      content={<CustomTooltip modo={modo} variant={variant} />}
                      isAnimationActive={!reduceMotion}
                    />

                    {modo === 'meta' && (
                      <ReferenceLine
                        y={100}
                        stroke="hsl(var(--foreground))"
                        strokeDasharray="4 4"
                        strokeOpacity={0.5}
                        label={{ value: 'Meta 100%', position: 'insideTopRight', fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      />
                    )}
                    {modo === 'faturamento' && media > 0 && (
                      <ReferenceLine
                        y={media}
                        stroke="hsl(var(--primary))"
                        strokeDasharray="4 4"
                        strokeOpacity={0.55}
                        label={{ value: isBlue ? 'Média' : `Média ${compactCurrency(media)}`, position: 'insideTopRight', fill: 'hsl(var(--primary))', fontSize: 12 }}
                      />
                    )}

                    <Bar
                      dataKey={dataKey}
                      radius={isBlue ? [4, 4, 0, 0] : [10, 10, 4, 4]}
                      maxBarSize={isBlue ? 80 : undefined}
                      onMouseOver={isBlue ? undefined : (d: EnrichedVendedorRow) => setHoverKey(String(d.codigo))}
                      onClick={(d: EnrichedVendedorRow<T>) => onClick?.(d._row)}
                      animationDuration={220}
                      isAnimationActive={!reduceMotion}
                      cursor={onClick ? 'pointer' : undefined}
                    >
                      {visibleRows.map((v) => {
                        const key = paletteKey(v, modo);
                        const isHover = hoverKey === String(v.codigo);
                        const dim = hoverKey && !isHover;
                        return (
                          <Cell
                            key={String(v.codigo)}
                            className={isBlue ? 'dashboard-ranking-bar' : undefined}
                            fill={isBlue ? 'hsl(var(--primary))' : STATUS_COLORS[key].solid}
                            opacity={dim ? 0.35 : 1}
                            stroke={isHover ? 'hsl(var(--foreground))' : 'transparent'}
                            strokeWidth={isHover ? 1.5 : 0}
                          />
                        );
                      })}
                    </Bar>
                    {highlightedVendor && (
                      <ReferenceLine
                        className="dashboard-ranking-guide"
                        y={highlightedVendor[dataKey]}
                        stroke="hsl(var(--primary))"
                        strokeWidth={1.25}
                        pointerEvents="none"
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <RankingVendedoresLabels
                data={visibleRows}
                modo={modo}
                variant={variant}
                onSelect={isBlue && onClick ? (index) => onClick(visibleRows[index]._row) : undefined}
                onHighlight={isBlue ? setHoverKey : undefined}
              />
            </div>
            {lastPage > 0 && (
              <nav className="mt-0.5 flex shrink-0 items-center justify-center gap-2" aria-label="Paginação de vendedores">
                <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Vendedores anteriores" disabled={page === 0} onClick={() => navigatePage(page - 1)}>
                  <ChevronLeft aria-hidden="true" className="size-4" />
                </Button>
                <span role="status" className="min-w-16 text-center text-xs tabular-nums text-muted-foreground">
                  {pageStart + 1}–{pageStart + visibleRows.length} de {enriched.length}
                </span>
                <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Próximos vendedores" disabled={page === lastPage} onClick={() => navigatePage(page + 1)}>
                  <ChevronRight aria-hidden="true" className="size-4" />
                </Button>
              </nav>
            )}
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
  variant?: RankingVariant;
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
      'dashboard-ranking-stat relative rounded-lg border border-border/50 px-3 py-2 overflow-hidden',
      accent
    )}>
      <div className="dashboard-ranking-stat-heading flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium" title={label}>
        {icon}
        <span>{label}</span>
      </div>
      <div className="dashboard-ranking-stat-value mt-0.5 truncate font-mono text-sm font-bold" title={value}>{value}</div>
      {hint && <div className="dashboard-ranking-stat-hint truncate text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
