import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, Sparkles, Trophy, Info, Activity,
  CalendarRange, ArrowUpRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCurrency, formatInteger, formatPercent, formatCompactNumber } from '@/utils/formatters';

interface Props {
  data: { mes: string; vendas: number }[]; // mes: 'YYYY-MM'
  diaria?: { dia: string; vendas: number }[]; // dia: 'YYYY-MM-DD'
}

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const formatMes = (m: string) => {
  const [y, mo] = m.split('-');
  return `${MESES_LABEL[parseInt(mo, 10) - 1]}/${y.slice(2)}`;
};
const formatMesLongo = (m: string) => {
  const [y, mo] = m.split('-');
  return `${MESES_LONGOS[parseInt(mo, 10) - 1]} de ${y}`;
};

// ─── CountUp ────────────────────────────
function useCountUp(target: number, duration = 900) {
  const [v, setV] = useState(0);
  const raf = useRef<number>();
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const startVal = from.current;
    const delta = target - startVal;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(startVal + delta * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);
  return v;
}

// ─── Regressão linear ───────────────────
function linreg(values: number[]) {
  const n = values.length;
  if (n < 2) return { a: values[0] ?? 0, b: 0 };
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sx += i; sy += values[i]; sxy += i * values[i]; sxx += i * i; }
  const b = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  const a = (sy - b * sx) / n;
  return { a, b };
}

// ─── Tooltip premium ────────────────────
function RichTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const r = payload[0]?.payload;
  if (!r) return null;
  const atual = r.vendas ?? 0;
  const anterior = r.anterior ?? null;
  const tendencia = r.tendencia ?? null;
  const delta = anterior !== null && anterior > 0 ? ((atual - anterior) / anterior) * 100 : null;
  const up = (delta ?? 0) >= 0;
  return (
    <div className="min-w-[240px] rounded-xl border border-border/70 bg-popover/95 backdrop-blur-xl p-3.5 shadow-2xl shadow-primary/20 animate-in fade-in-0 zoom-in-95 duration-150">
      <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-border/50">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {formatMesLongo(label)}
        </p>
        <CalendarRange className="h-3.5 w-3.5 text-primary" />
      </div>
      <p className="text-xl font-black tabular-nums leading-tight">{formatCurrency(atual)}</p>
      <div className="mt-3 space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Mês anterior</span>
          <span className="tabular-nums font-semibold">{anterior !== null ? formatCurrency(anterior) : '—'}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Variação</span>
          {delta === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className={cn(
              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-bold tabular-nums text-[11px]',
              up ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500',
            )}>
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {formatPercent(Math.abs(delta))}
            </span>
          )}
        </div>
        {tendencia !== null && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Tendência</span>
            <span className="tabular-nums text-foreground/60">{formatCurrency(tendencia)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── KPI Tile ───────────────────────────
function KpiTile({
  label, value, hint, trend, accent = 'primary', icon: Icon, isCurrency = true, textValue,
}: {
  label: string;
  value?: number;
  textValue?: string;
  hint?: React.ReactNode;
  trend?: { pct: number; label?: string } | null;
  accent?: 'primary' | 'success' | 'destructive' | 'chart-3' | 'chart-4';
  icon?: any;
  isCurrency?: boolean;
}) {
  const animated = useCountUp(value ?? 0);
  const display = textValue !== undefined
    ? textValue
    : isCurrency ? formatCurrency(animated) : formatInteger(Math.round(animated));
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-card/60 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/40">
      <div className={cn(
        'absolute -top-16 -right-16 h-32 w-32 rounded-full blur-3xl opacity-40 group-hover:opacity-70 transition-opacity duration-500',
        accent === 'primary' && 'bg-primary/40',
        accent === 'success' && 'bg-emerald-500/40',
        accent === 'destructive' && 'bg-rose-500/40',
        accent === 'chart-3' && 'bg-chart-3/40',
        accent === 'chart-4' && 'bg-chart-4/40',
      )} />
      <div className="relative flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        {Icon && (
          <div className={cn(
            'h-7 w-7 rounded-lg flex items-center justify-center ring-1',
            accent === 'primary' && 'bg-primary/15 ring-primary/30 text-primary',
            accent === 'success' && 'bg-emerald-500/15 ring-emerald-500/30 text-emerald-500',
            accent === 'destructive' && 'bg-rose-500/15 ring-rose-500/30 text-rose-500',
            accent === 'chart-3' && 'bg-chart-3/15 ring-chart-3/30 text-chart-3',
            accent === 'chart-4' && 'bg-chart-4/15 ring-chart-4/30 text-chart-4',
          )}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
      <div className="relative">
        <p className="text-2xl font-black tabular-nums tracking-tight leading-none">{display}</p>
        <div className="mt-2 flex items-center gap-2 min-h-[18px]">
          {trend ? (
            <Badge className={cn(
              'h-5 px-1.5 gap-0.5 text-[10px] font-bold border-0',
              trend.pct > 0 ? 'bg-emerald-500/15 text-emerald-500' : trend.pct < 0 ? 'bg-rose-500/15 text-rose-500' : 'bg-muted text-muted-foreground',
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

// ─── Single-point hero ──────────────────
// ─── Daily tooltip ──────────────────────
function DailyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value ?? 0;
  const [y, m, d] = String(label).split('-');
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  const diaSem = dt.toLocaleDateString('pt-BR', { weekday: 'long' });
  return (
    <div className="rounded-xl border border-border/70 bg-popover/95 backdrop-blur-xl px-3.5 py-2.5 shadow-2xl shadow-primary/20 min-w-[180px] animate-in fade-in-0 zoom-in-95 duration-150">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 capitalize">
        {diaSem} · {d}/{m}
      </p>
      <p className="text-lg font-black tabular-nums">{formatCurrency(v)}</p>
    </div>
  );
}

// ─── Daily gradient chart ───────────────
function DailyGradientChart({ diaria, mes }: { diaria: { dia: string; vendas: number }[]; mes: string }) {
  const total = diaria.reduce((s, d) => s + d.vendas, 0);
  const media = diaria.length ? total / diaria.length : 0;
  const melhor = diaria.reduce<{ dia: string; vendas: number } | null>(
    (b, d) => (b === null || d.vendas > b.vendas ? d : b), null);
  const enriched = diaria.map(d => ({ ...d, label: d.dia.slice(8, 10) }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center">
            <CalendarRange className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-bold capitalize">{formatMesLongo(mes)}</p>
            <p className="text-[10px] text-muted-foreground">
              {diaria.length} {diaria.length === 1 ? 'dia' : 'dias'} com movimento · média diária {formatCurrency(media, true)}
            </p>
          </div>
        </div>
        {melhor && (
          <Badge className="bg-emerald-500/15 text-emerald-500 border-0 gap-1 text-[10px] font-bold">
            <Trophy className="h-3 w-3" /> Melhor dia: {melhor.dia.slice(8, 10)} · {formatCurrency(melhor.vendas, true)}
          </Badge>
        )}
      </div>

      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={enriched} margin={{ top: 16, right: 16, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="dailyGradFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.7} />
                <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="dailyGradStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.9} />
                <stop offset="50%" stopColor="hsl(var(--chart-3))" stopOpacity={1} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.9} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={10}
              dy={6}
            />
            <YAxis
              tickFormatter={(v) => formatCompactNumber(v)}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip content={<DailyTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1.5, strokeDasharray: '4 4', strokeOpacity: 0.5 }} />
            <ReferenceLine y={media} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5}
              label={{ value: `média ${formatCompactNumber(media)}`, position: 'insideTopRight', fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
            <Area
              type="monotone"
              dataKey="vendas"
              stroke="url(#dailyGradStroke)"
              strokeWidth={3}
              fill="url(#dailyGradFill)"
              activeDot={{ r: 6, strokeWidth: 2, stroke: 'hsl(var(--background))', fill: 'hsl(var(--primary))' }}
              animationDuration={900}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


// ─── Smart footer ───────────────────────
function SmartFooter({ stats, singlePoint }: { stats: any; singlePoint: boolean }) {
  const insights: { icon: any; tone: 'success' | 'destructive' | 'primary' | 'muted'; title: string; desc: string }[] = [];

  if (singlePoint) {
    // No single-point não exibimos cards de rodapé — o gráfico diário já conta a história.
    return null;
  } else {
    insights.push({
      icon: Trophy, tone: 'success',
      title: `Melhor mês: ${formatMes(stats.melhor.mes)}`,
      desc: `${formatCurrency(stats.melhor.vendas, true)} — pico da série analisada.`,
    });
    if (stats.pior && stats.pior.mes !== stats.melhor.mes) {
      insights.push({
        icon: TrendingDown, tone: 'destructive',
        title: `Menor volume: ${formatMes(stats.pior.mes)}`,
        desc: `${formatCurrency(stats.pior.vendas, true)} · ${formatPercent((1 - stats.pior.vendas / stats.melhor.vendas) * 100)} abaixo do topo.`,
      });
    }
    insights.push({
      icon: stats.slope > 0 ? TrendingUp : stats.slope < 0 ? TrendingDown : Minus,
      tone: stats.slope > 0 ? 'success' : stats.slope < 0 ? 'destructive' : 'muted',
      title: stats.slope > 0 ? 'Crescimento consistente' : stats.slope < 0 ? 'Retração detectada' : 'Faturamento estável',
      desc: stats.projecao !== null
        ? `Projeção próximo mês: ${formatCurrency(stats.projecao, true)}`
        : 'Tendência calculada sobre a série disponível.',
    });
  }

  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {insights.map((ins, i) => {
        const Icon = ins.icon;
        return (
          <div
            key={i}
            className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card/60 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/30"
          >
            <div className={cn(
              'h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ring-1 transition-transform group-hover:scale-110',
              ins.tone === 'success' && 'bg-emerald-500/15 ring-emerald-500/30 text-emerald-500',
              ins.tone === 'destructive' && 'bg-rose-500/15 ring-rose-500/30 text-rose-500',
              ins.tone === 'primary' && 'bg-primary/15 ring-primary/30 text-primary',
              ins.tone === 'muted' && 'bg-muted ring-border text-muted-foreground',
            )}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">{ins.title}</p>
              <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{ins.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Componente principal ───────────────
export function FaturamentoMensalHeroVisaoGeral({ data, diaria = [] }: Props) {
  const stats = useMemo(() => {
    if (!data.length) return null;
    const total = data.reduce((s, d) => s + d.vendas, 0);
    const media = total / data.length;
    const last = data[data.length - 1];
    const prev = data.length > 1 ? data[data.length - 2] : null;
    const mom = prev && prev.vendas > 0 ? ((last.vendas - prev.vendas) / prev.vendas) * 100 : 0;

    const melhor = [...data].sort((a, b) => b.vendas - a.vendas)[0];
    const pior = [...data].sort((a, b) => a.vendas - b.vendas)[0];

    const values = data.map(d => d.vendas);
    const { a, b } = linreg(values);
    const projecao = data.length >= 2 ? a + b * data.length : null;
    const slopePct = a > 0 ? (b / a) * 100 : null;

    const enriched = data.map((d, i) => ({
      ...d,
      anterior: i > 0 ? data[i - 1].vendas : null,
      tendencia: a + b * i,
    }));

    return { total, media, last, prev, mom, melhor, pior, slope: b, slopePct, projecao, enriched };
  }, [data]);

  if (!stats) {
    return (
      <Card className="border-dashed border-border/60">
        <CardContent className="py-14 flex flex-col items-center justify-center gap-3 text-center">
          <div className="h-12 w-12 rounded-2xl bg-muted/40 flex items-center justify-center">
            <Activity className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold">Sem dados de faturamento no período</p>
          <p className="text-xs text-muted-foreground max-w-sm">Ajuste os filtros ou aguarde o processamento dos próximos pedidos.</p>
        </CardContent>
      </Card>
    );
  }

  const singlePoint = data.length <= 1;
  const growing = stats.slope > 0;

  return (
    <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.02] shadow-lg">
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-64 w-64 rounded-full bg-chart-3/10 blur-3xl" />

      <CardContent className="relative p-5 sm:p-6 space-y-6">
        {/* ═══ 1) Cabeçalho Executivo ═══ */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/30 flex items-center justify-center shadow-inner">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Evolução de Vendas</p>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Faturamento Mensal</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {singlePoint
                  ? 'Primeiro mês disponível · aguardando mais períodos'
                  : `${data.length} meses analisados · linha de tendência automática`}
              </p>
            </div>
          </div>
        </div>

        {/* KPIs adaptativos */}
        <div className={cn(
          'grid gap-3',
          singlePoint ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-4',
        )}>
          <KpiTile
            label="Faturamento Total"
            value={stats.total}
            icon={TrendingUp}
            accent="primary"
            trend={singlePoint ? null : { pct: stats.mom }}
            hint={singlePoint ? 'Base inicial' : `vs ${formatMes(stats.prev!.mes)}`}
          />
          {!singlePoint && (
            <KpiTile
              label="Média Mensal"
              value={stats.media}
              icon={Trophy}
              accent="chart-3"
              hint={`ao longo de ${data.length} meses`}
            />
          )}
          <KpiTile
            label={singlePoint ? 'Período' : 'Último mês'}
            textValue={singlePoint ? formatMesLongo(stats.last.mes) : formatCurrency(stats.last.vendas)}
            icon={CalendarRange}
            accent="chart-4"
            hint={singlePoint ? 'Início da série' : formatMes(stats.last.mes)}
          />
          {!singlePoint && (
            <KpiTile
              label="Tendência"
              textValue={growing ? 'Em alta' : stats.slope < 0 ? 'Em queda' : 'Estável'}
              icon={growing ? ArrowUpRight : stats.slope < 0 ? TrendingDown : Minus}
              accent={growing ? 'success' : stats.slope < 0 ? 'destructive' : 'primary'}
              hint={stats.slopePct !== null ? `${stats.slopePct >= 0 ? '+' : ''}${stats.slopePct.toFixed(1)}%/mês` : undefined}
            />
          )}
        </div>

        {/* ═══ 2) Área do gráfico ═══ */}
        {singlePoint ? (
          <DailyGradientChart diaria={diaria} mes={stats.last.mes} />
        ) : (
          <div className="h-[380px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats.enriched} margin={{ top: 16, right: 20, left: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id="fmhvgArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.55} />
                    <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                <XAxis
                  dataKey="mes"
                  tickFormatter={formatMes}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  dy={6}
                />
                <YAxis
                  tickFormatter={(v) => formatCompactNumber(v)}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip content={<RichTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1.5, strokeDasharray: '4 4', strokeOpacity: 0.5 }} />
                <ReferenceLine y={stats.media} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5}
                  label={{ value: `média ${formatCompactNumber(stats.media)}`, position: 'insideTopRight', fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <Area
                  type="monotone"
                  dataKey="vendas"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  fill="url(#fmhvgArea)"
                  activeDot={{ r: 6, strokeWidth: 2, stroke: 'hsl(var(--background))', fill: 'hsl(var(--primary))' }}
                  animationDuration={900}
                />
                <Line
                  type="linear"
                  dataKey="tendencia"
                  stroke="hsl(var(--chart-3))"
                  strokeWidth={1.75}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={false}
                  animationDuration={1200}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ═══ 3) Rodapé Inteligente ═══ */}
        <SmartFooter stats={stats} singlePoint={singlePoint} />
      </CardContent>
    </Card>
  );
}
