import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Line, ComposedChart,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, Sparkles, Trophy, Info,
  CalendarRange, ArrowUpRight, MousePointerClick, Activity,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';
import { formatCurrency, formatCompactNumber, formatInteger, formatPercent } from '@/utils/formatters';

interface MesData {
  mesKey: string;
  mes: string;
  vendas: number;
  devolucoes: number;
  pedidos: number;
  ticketMedio: number;
  qtdClientes: number;
}

interface Props {
  dadosEvolucaoMensal: MesData[];
  acumuladoMensal: boolean;
  setAcumuladoMensal: (v: boolean) => void;
  onSelectMonth: (mesKey: string) => void;
  hoveredMonth: any | null;
  setHoveredMonth: (m: any | null) => void;
}

// ─────────────────────────────────────────
// CountUp hook (animação de números)
// ─────────────────────────────────────────
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>();
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const startVal = from.current;
    const delta = target - startVal;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(startVal + delta * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);
  return value;
}

// ─────────────────────────────────────────
// Tooltip premium
// ─────────────────────────────────────────
function RichTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as MesData & { tendencia?: number };
  return (
    <div className="rounded-lg border border-border bg-popover px-3.5 py-2.5 min-w-[200px] animate-in fade-in-0 zoom-in-95 duration-150">
      <div className="flex items-center justify-between gap-3 mb-2 pb-2 border-b border-border/50">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <CalendarRange className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Faturamento</span>
          <span className="font-bold tabular-nums text-foreground">{formatCurrency(d.vendas)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Pedidos</span>
          <span className="font-semibold tabular-nums">{formatInteger(d.pedidos)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Ticket médio</span>
          <span className="font-semibold tabular-nums">{formatCurrency(d.ticketMedio)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Clientes ativos</span>
          <span className="font-semibold tabular-nums">{formatInteger(d.qtdClientes)}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// KPI compact tile
// ─────────────────────────────────────────
function KpiTile({
  label, value, hint, trend, accent = 'primary', icon: Icon, isCurrency = true, prefix,
}: {
  label: string;
  value: number | string;
  hint?: React.ReactNode;
  trend?: { pct: number; label?: string } | null;
  accent?: 'primary' | 'success' | 'destructive' | 'chart-3' | 'chart-4';
  icon?: any;
  isCurrency?: boolean;
  prefix?: string;
}) {
  const numeric = typeof value === 'number' ? value : 0;
  const animated = useCountUp(numeric);
  const display = typeof value === 'string'
    ? value
    : isCurrency ? formatCurrency(animated) : formatInteger(Math.round(animated));
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border/60 bg-card p-4 transition-colors duration-300 hover:border-primary/40">
      <div className="relative flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        {Icon && (
          <div className={cn(
            'h-7 w-7 rounded-lg flex items-center justify-center ring-1',
            accent === 'primary' && 'bg-primary/15 ring-primary/30 text-primary',
            accent === 'success' && 'bg-success/15 ring-success/30 text-success',
            accent === 'destructive' && 'bg-destructive/15 ring-destructive/30 text-destructive',
            accent === 'chart-3' && 'bg-chart-3/15 ring-chart-3/30 text-chart-3',
            accent === 'chart-4' && 'bg-chart-4/15 ring-chart-4/30 text-chart-4',
          )}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
      <div className="relative">
        <p className="text-2xl font-black tabular-nums tracking-tight leading-none">
          {prefix}{display}
        </p>
        <div className="mt-2 flex items-center gap-2 min-h-[18px]">
          {trend ? (
            <Badge className={cn(
              'h-5 px-1.5 gap-0.5 text-[10px] font-bold border-0',
              trend.pct > 0 ? 'bg-success/15 text-success' : trend.pct < 0 ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground',
            )}>
              {trend.pct > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : trend.pct < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
              {trend.pct > 0 ? '+' : ''}{formatPercent(trend.pct)}
            </Badge>
          ) : null}
          {hint && <span className="text-[10px] text-muted-foreground truncate">{hint}</span>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────
export function FaturamentoMensalHero({
  dadosEvolucaoMensal, acumuladoMensal, setAcumuladoMensal,
  onSelectMonth, hoveredMonth, setHoveredMonth,
}: Props) {
  const data = dadosEvolucaoMensal;
  const singlePoint = data.length <= 1;

  // ── Cálculos derivados ───────────────────────
  const stats = useMemo(() => {
    if (!data.length) return null;
    const total = data.reduce((a, m) => a + m.vendas, 0);
    const pedidos = data.reduce((a, m) => a + m.pedidos, 0);
    const ticketMedio = pedidos > 0 ? total / pedidos : 0;
    const media = total / data.length;
    const last = data[data.length - 1];
    const prev = data.length > 1 ? data[data.length - 2] : null;
    const mom = prev && prev.vendas > 0 ? ((last.vendas - prev.vendas) / prev.vendas) * 100 : 0;

    // Best/worst
    const melhor = [...data].sort((a, b) => b.vendas - a.vendas)[0];
    const pior = [...data].sort((a, b) => a.vendas - b.vendas)[0];

    // Regressão linear simples (tendência)
    let slope = 0;
    if (data.length >= 2) {
      const n = data.length;
      const xs = data.map((_, i) => i);
      const ys = data.map(d => d.vendas);
      const mx = xs.reduce((a, b) => a + b, 0) / n;
      const my = ys.reduce((a, b) => a + b, 0) / n;
      const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
      const den = xs.reduce((a, x) => a + Math.pow(x - mx, 2), 0) || 1;
      slope = num / den;
    }
    const projecao = data.length >= 2 ? last.vendas + slope : null;

    // Série com linha de tendência
    const chartData = data.map((m, i) => ({
      ...m,
      trend: data.length >= 2 ? (data[0].vendas + slope * i) : m.vendas,
    }));

    return { total, pedidos, ticketMedio, media, last, prev, mom, melhor, pior, slope, projecao, chartData };
  }, [data]);

  // ── Empty state absoluto ─────────────────────
  if (!stats) {
    return (
      <Card className="border-dashed border-border/60 bg-card">
        <CardContent className="py-12 flex flex-col items-center justify-center gap-3 text-center">
          <div className="h-12 w-12 rounded-lg bg-muted/40 flex items-center justify-center">
            <Activity className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold">Sem dados de faturamento no período</p>
          <p className="text-xs text-muted-foreground max-w-sm">Ajuste os filtros ou aguarde o processamento dos próximos pedidos.</p>
        </CardContent>
      </Card>
    );
  }

  const growing = stats.slope > 0;

  return (
    <Card className="relative overflow-hidden border-border/60 bg-card">
      <CardContent className="relative p-5 sm:p-6 space-y-6">
        {/* ═══════════════ 1) CABEÇALHO EXECUTIVO ═══════════════ */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 ring-1 ring-primary/30 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                Faturamento Mensal
                {acumuladoMensal && <Badge variant="outline" className="text-[10px]">Acumulado</Badge>}
              </h2>
              <p className="text-xs text-muted-foreground">
                {singlePoint
                  ? 'Primeiro mês disponível · aguardando mais períodos'
                  : `${data.length} meses analisados · atualizado agora`}
              </p>
            </div>
          </div>
          <Toggle
            size="sm"
            pressed={acumuladoMensal}
            onPressedChange={setAcumuladoMensal}
            className="h-8 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {acumuladoMensal ? 'Acumulado' : 'Mensal'}
          </Toggle>
        </div>

        {/* KPIs adaptativos */}
        <div className={cn(
          'grid gap-3',
          singlePoint ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4',
        )}>
          <KpiTile
            label="Faturamento Total"
            value={stats.total}
            icon={TrendingUp}
            accent="primary"
            trend={singlePoint ? null : { pct: stats.mom }}
            hint={singlePoint ? 'Base inicial' : `vs ${stats.prev?.mes ?? '—'}`}
          />
          <KpiTile
            label="Ticket Médio"
            value={stats.ticketMedio}
            icon={Trophy}
            accent="chart-3"
            hint={`${formatInteger(stats.pedidos)} pedidos no total`}
          />
          <KpiTile
            label="Pedidos"
            value={stats.pedidos}
            isCurrency={false}
            icon={Activity}
            accent="chart-4"
            hint={singlePoint ? '1º período coletado' : `${data.length} meses`}
          />
          {!singlePoint && (
            <KpiTile
              label="Tendência"
              value={growing ? 'Em alta' : stats.slope < 0 ? 'Em queda' : 'Estável'}
              icon={growing ? ArrowUpRight : stats.slope < 0 ? TrendingDown : Minus}
              accent={growing ? 'success' : stats.slope < 0 ? 'destructive' : 'primary'}
              hint={stats.projecao ? `Projeção: ${formatCurrency(stats.projecao, true)}` : undefined}
            />
          )}
        </div>

        {/* ═══════════════ 2) ÁREA DO GRÁFICO ═══════════════ */}
        {singlePoint ? (
          <SinglePointHero mes={data[0]} />
        ) : (
          <div className="space-y-3">
            <div className={cn(
              'relative rounded-lg border transition-colors duration-300 overflow-hidden',
              hoveredMonth
                ? 'border-primary/40 bg-primary/8'
                : 'border-dashed border-border/40 bg-muted/20',
            )}>
              <div className="px-3.5 py-2 flex items-center justify-between gap-3 min-h-[44px]">
                {hoveredMonth ? (
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center ring-1 ring-primary/30 shrink-0">
                        <CalendarRange className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold capitalize">{hoveredMonth.mes}</p>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                          <span>Faturamento: <strong className="text-foreground tabular-nums">{formatCurrency(hoveredMonth.vendas, true)}</strong></span>
                          <span className="hidden sm:inline">{hoveredMonth.pedidos} pedidos</span>
                        </div>
                      </div>
                    </div>
                    <Button size="sm" className="h-7 text-xs gap-1.5 shrink-0" onClick={() => onSelectMonth(hoveredMonth.mesKey)}>
                      <MousePointerClick className="h-3 w-3" />
                      Abrir mês
                    </Button>
                  </>
                ) : (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <MousePointerClick className="h-3.5 w-3.5 opacity-60" />
                    Passe o mouse sobre o gráfico · clique para abrir o mês
                  </p>
                )}
              </div>
            </div>

            <div className="h-[320px] cursor-pointer">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={stats.chartData}
                  margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                  onMouseMove={(e: any) => e?.activePayload?.[0]?.payload && setHoveredMonth(e.activePayload[0].payload)}
                  onMouseLeave={() => setHoveredMonth(null)}
                  onClick={(e: any) => e?.activePayload?.[0]?.payload?.mesKey && onSelectMonth(e.activePayload[0].payload.mesKey)}
                >
                  <defs>
                    <linearGradient id="fmhArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.55} />
                      <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => formatCompactNumber(v)} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} width={55} />
                  <Tooltip content={<RichTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1.5, strokeDasharray: '4 4', strokeOpacity: 0.5 }} />
                  <ReferenceLine y={stats.media} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: `média ${formatCompactNumber(stats.media)}`, fontSize: 9, fill: 'hsl(var(--muted-foreground))', position: 'insideTopRight' }} />
                  <Area
                    type="monotone"
                    dataKey="vendas"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    fill="url(#fmhArea)"
                    activeDot={{ r: 6, strokeWidth: 2, stroke: 'hsl(var(--background))', fill: 'hsl(var(--primary))', cursor: 'pointer' }}
                    animationDuration={900}
                  />
                  <Line
                    type="monotone"
                    dataKey="trend"
                    stroke="hsl(var(--chart-3))"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={false}
                    animationDuration={1200}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ═══════════════ 3) RODAPÉ INTELIGENTE ═══════════════ */}
        <SmartFooter stats={stats} singlePoint={singlePoint} onSelectMonth={onSelectMonth} />
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────
// Single-point hero: substitui gráfico vazio
// ─────────────────────────────────────────
function SinglePointHero({ mes }: { mes: MesData }) {
  const anim = useCountUp(mes.vendas);
  return (
    <div className="relative overflow-hidden rounded-lg border border-primary/30 bg-card p-6 sm:p-8">
      <div className="relative grid gap-6 md:grid-cols-[auto,1fr] items-center">
        <div className="flex flex-col items-center md:items-start gap-2">
          <Badge className="bg-primary/20 text-primary border-0 gap-1 uppercase tracking-widest text-[10px] font-bold">
            <Sparkles className="h-3 w-3" /> Início da série
          </Badge>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">{mes.mes}</p>
          <p className="text-4xl sm:text-5xl font-black tabular-nums tracking-tight">
            {formatCurrency(anim)}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span><strong className="text-foreground tabular-nums">{formatInteger(mes.pedidos)}</strong> pedidos</span>
            <span className="h-3 w-px bg-border" />
            <span>Ticket <strong className="text-foreground tabular-nums">{formatCurrency(mes.ticketMedio, true)}</strong></span>
            <span className="h-3 w-px bg-border" />
            <span><strong className="text-foreground tabular-nums">{formatInteger(mes.qtdClientes)}</strong> clientes</span>
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4 flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-chart-3/15 ring-1 ring-chart-3/30 flex items-center justify-center shrink-0">
            <Info className="h-4 w-4 text-chart-3" />
          </div>
          <div className="text-xs leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">Aguardando mais períodos para comparação</p>
            <p>Assim que o próximo mês for consolidado, este bloco passará a exibir a evolução, tendência e projeções automaticamente.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Smart footer: insights baseados nos dados
// ─────────────────────────────────────────
function SmartFooter({
  stats, singlePoint, onSelectMonth,
}: { stats: any; singlePoint: boolean; onSelectMonth: (k: string) => void }) {
  const insights: { icon: any; tone: 'success' | 'destructive' | 'primary' | 'muted'; title: string; desc: string; action?: () => void }[] = [];

  if (singlePoint) {
    insights.push({
      icon: Sparkles, tone: 'primary',
      title: 'Primeiro período coletado',
      desc: `${stats.last.mes} é a base inicial da sua série histórica.`,
    });
    insights.push({
      icon: Info, tone: 'muted',
      title: 'Tendência indisponível',
      desc: 'É necessário ao menos 2 meses consolidados para calcular crescimento.',
    });
    insights.push({
      icon: Trophy, tone: 'primary',
      title: 'Referência de ticket médio',
      desc: `${formatCurrency(stats.ticketMedio, true)} distribuídos em ${formatInteger(stats.pedidos)} pedidos.`,
    });
  } else {
    insights.push({
      icon: Trophy, tone: 'success',
      title: `Melhor mês: ${stats.melhor.mes}`,
      desc: `${formatCurrency(stats.melhor.vendas, true)} em ${formatInteger(stats.melhor.pedidos)} pedidos.`,
      action: () => onSelectMonth(stats.melhor.mesKey),
    });
    if (stats.pior && stats.pior.mesKey !== stats.melhor.mesKey) {
      insights.push({
        icon: TrendingDown, tone: 'destructive',
        title: `Menor volume: ${stats.pior.mes}`,
        desc: `${formatCurrency(stats.pior.vendas, true)} · ${formatPercent((1 - stats.pior.vendas / stats.melhor.vendas) * 100)} abaixo do topo.`,
        action: () => onSelectMonth(stats.pior.mesKey),
      });
    }
    insights.push({
      icon: stats.slope > 0 ? TrendingUp : stats.slope < 0 ? TrendingDown : Minus,
      tone: stats.slope > 0 ? 'success' : stats.slope < 0 ? 'destructive' : 'muted',
      title: stats.slope > 0 ? 'Crescimento consistente' : stats.slope < 0 ? 'Retração detectada' : 'Faturamento estável',
      desc: stats.projecao
        ? `Projeção próximo mês: ${formatCurrency(stats.projecao, true)}`
        : 'Sem projeção disponível.',
    });
  }

  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 pt-1">
      {insights.map((ins, i) => {
        const Icon = ins.icon;
        const clickable = !!ins.action;
        return (
          <button
            key={i}
            type="button"
            onClick={ins.action}
            disabled={!clickable}
            className={cn(
              'group text-left flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3 transition-colors duration-200',
              clickable && 'hover:border-primary/40 cursor-pointer',
              !clickable && 'opacity-95 cursor-default',
            )}
          >
            <div className={cn(
              'h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ring-1',
              ins.tone === 'success' && 'bg-success/15 ring-success/30 text-success',
              ins.tone === 'destructive' && 'bg-destructive/15 ring-destructive/30 text-destructive',
              ins.tone === 'primary' && 'bg-primary/15 ring-primary/30 text-primary',
              ins.tone === 'muted' && 'bg-muted ring-border text-muted-foreground',
            )}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">{ins.title}</p>
              <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{ins.desc}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
