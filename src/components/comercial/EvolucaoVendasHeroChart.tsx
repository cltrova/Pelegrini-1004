import { useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, TrendingUp, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { cn } from '@/lib/utils';

interface Props {
  data: { mes: string; vendas: number }[];
}

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const formatMes = (mes: string) => {
  const [y, m] = mes.split('-');
  return `${MESES_LABEL[parseInt(m, 10) - 1]}/${y.slice(2)}`;
};
const formatMesLongo = (mes: string) => {
  const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const [y, m] = mes.split('-');
  return `${nomes[parseInt(m, 10) - 1]} de ${y}`;
};

/** Regressão linear simples y = a + b*x */
function linearRegression(values: number[]) {
  const n = values.length;
  if (n < 2) return { a: values[0] ?? 0, b: 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  const b = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const a = (sumY - b * sumX) / n;
  return { a, b };
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const atual: number = row.vendas ?? 0;
  const anterior: number | null = row.anterior ?? null;
  const tendencia: number | null = row.tendencia ?? null;
  const delta = anterior !== null && anterior > 0 ? ((atual - anterior) / anterior) * 100 : null;
  const up = (delta ?? 0) >= 0;

  return (
    <div className="min-w-[220px] rounded-xl border border-border/70 bg-popover/95 p-3 shadow-lg backdrop-blur">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {formatMesLongo(label)}
      </p>
      <p className="mono-value mt-1 text-lg font-semibold tabular-nums">{formatCurrency(atual)}</p>

      <div className="mt-3 space-y-1.5 border-t border-border/60 pt-2">
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="text-muted-foreground">Mês anterior</span>
          <span className="tabular-nums text-foreground/80">
            {anterior !== null ? formatCurrency(anterior) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="text-muted-foreground">Variação</span>
          {delta === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium tabular-nums',
                up ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              )}
            >
              {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {formatPercent(Math.abs(delta))}
            </span>
          )}
        </div>
        {tendencia !== null && (
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="text-muted-foreground">Tendência</span>
            <span className="tabular-nums text-foreground/60">{formatCurrency(tendencia)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function EvolucaoVendasHeroChart({ data }: Props) {
  const enriched = useMemo(() => {
    const values = data.map((d) => d.vendas);
    const { a, b } = linearRegression(values);
    return data.map((d, i) => ({
      ...d,
      anterior: i > 0 ? data[i - 1].vendas : null,
      tendencia: a + b * i,
    }));
  }, [data]);

  const { total, media, pico, deltaPct, slopePct } = useMemo(() => {
    const total = data.reduce((s, d) => s + d.vendas, 0);
    const media = data.length ? total / data.length : 0;
    const pico = data.reduce<{ mes: string; vendas: number } | null>(
      (best, d) => (best === null || d.vendas > best.vendas ? d : best),
      null
    );
    const n = data.length;
    const deltaPct = n >= 2 && data[n - 2].vendas > 0
      ? ((data[n - 1].vendas - data[n - 2].vendas) / data[n - 2].vendas) * 100
      : null;
    const values = data.map((d) => d.vendas);
    const { a, b } = linearRegression(values);
    const first = a;
    const slopePct = first > 0 ? (b / first) * 100 : null;
    return { total, media, pico, deltaPct, slopePct };
  }, [data]);

  const up = (deltaPct ?? 0) >= 0;

  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      <div className="flex flex-col gap-6 border-b border-border/60 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent p-6 md:flex-row md:items-end md:justify-between md:p-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Evolução de Vendas
            </p>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Faturamento mensal
          </h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Evolução do faturamento líquido com linha de tendência e comparativo mês a mês.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6 text-left md:text-right">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Total
            </p>
            <p className="mono-value mt-1 text-xl font-semibold tabular-nums md:text-2xl">
              {formatCurrency(total)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Média mensal
            </p>
            <p className="mono-value mt-1 text-xl font-semibold tabular-nums md:text-2xl">
              {formatCurrency(media)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Último vs. anterior
            </p>
            <div className="mt-1 flex items-center gap-1.5 md:justify-end">
              {deltaPct === null ? (
                <span className="inline-flex items-center gap-1 text-lg text-muted-foreground">
                  <Minus className="h-4 w-4" /> —
                </span>
              ) : (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-xl font-semibold tabular-nums md:text-2xl',
                    up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  )}
                >
                  {up ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                  {formatPercent(Math.abs(deltaPct))}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <CardContent className="p-4 md:p-6">
        <div className="h-[380px] w-full md:h-[440px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={enriched} margin={{ top: 20, right: 24, left: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="heroVendasFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="heroVendasStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={1} />
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
                tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: 'hsl(var(--primary))', strokeOpacity: 0.25, strokeWidth: 1 }}
              />

              <ReferenceLine
                y={media}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{
                  value: 'Média',
                  position: 'insideTopRight',
                  fill: 'hsl(var(--muted-foreground))',
                  fontSize: 10,
                }}
              />

              <Area
                type="monotone"
                dataKey="vendas"
                name="Faturamento"
                stroke="url(#heroVendasStroke)"
                strokeWidth={2.5}
                fill="url(#heroVendasFill)"
                activeDot={{ r: 6, strokeWidth: 2, stroke: 'hsl(var(--background))', fill: 'hsl(var(--primary))' }}
                animationDuration={900}
                animationEasing="ease-out"
              />

              <Line
                type="monotone"
                dataKey="anterior"
                name="Mês anterior"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1.5}
                strokeDasharray="3 4"
                strokeOpacity={0.55}
                dot={false}
                animationDuration={900}
              />

              <Line
                type="linear"
                dataKey="tendencia"
                name="Tendência"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                strokeOpacity={0.55}
                dot={false}
                animationDuration={900}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legenda + insights */}
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-4 rounded-sm bg-primary/80" /> Faturamento
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 border-t border-dashed border-primary" /> Tendência
            {slopePct !== null && (
              <span className={cn('ml-1 font-medium', slopePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                {slopePct >= 0 ? '+' : ''}{slopePct.toFixed(1)}%/mês
              </span>
            )}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 border-t border-dashed border-muted-foreground" /> Mês anterior
          </span>
          {pico && (
            <span className="ml-auto">
              Pico em <span className="font-medium text-foreground/80">{formatMes(pico.mes)}</span> — {formatCurrency(pico.vendas)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
