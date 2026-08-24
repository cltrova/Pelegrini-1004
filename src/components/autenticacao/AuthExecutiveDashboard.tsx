import { useMemo } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, AlertTriangle, XCircle, Timer, DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ResultadoComparacao } from '@/utils/autenticacaoComparator';
import { formatCurrency } from '@/utils/formatters';

interface Props {
  resultados: ResultadoComparacao[];
  durationMs?: number | null;
  historicoAccuracy?: number[];
}

function formatDuration(ms?: number | null): string {
  if (!ms || ms <= 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rs = Math.round(s % 60);
  return `${m}m ${rs}s`;
}

function classifyDivergencia(d: string): string {
  if (d.startsWith('Valor') || d.startsWith('Líquido')) return 'Valor';
  if (d.startsWith('Cliente')) return 'Cliente';
  if (d.startsWith('Venda')) return 'Venda';
  if (d.startsWith('Devolução')) return 'Devolução';
  return 'Outros';
}

const COLORS: Record<string, string> = {
  Valor: 'hsl(var(--warning))',
  Cliente: 'hsl(var(--primary))',
  Venda: 'hsl(var(--success))',
  Devolução: 'hsl(var(--destructive))',
  Outros: 'hsl(var(--muted-foreground))',
};

export function AuthExecutiveDashboard({ resultados, durationMs, historicoAccuracy = [] }: Props) {
  const metrics = useMemo(() => {
    const total = resultados.length;
    const counts: Record<string, number> = { autenticado: 0, divergente: 0, nao_encontrado: 0, extra_sistema: 0 };
    let valorValidado = 0;
    let valorDivergente = 0;
    let valorNaoEncontrado = 0;
    let valorPlanilhaTotal = 0;
    const divMap = new Map<string, { count: number; valor: number }>();

    for (const r of resultados) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
      const vp = r.valor_planilha ?? 0;
      const vs = r.valor_sistema ?? 0;
      valorPlanilhaTotal += vp || vs;
      if (r.status === 'autenticado') valorValidado += vs || vp;
      else if (r.status === 'divergente') {
        valorDivergente += Math.abs((vs || 0) - (vp || 0));
        for (const d of r.divergencias) {
          const tipo = classifyDivergencia(d);
          const e = divMap.get(tipo) ?? { count: 0, valor: 0 };
          e.count++;
          e.valor += Math.abs((vs || 0) - (vp || 0));
          divMap.set(tipo, e);
        }
      } else if (r.status === 'nao_encontrado') {
        valorNaoEncontrado += vp;
      }
    }

    const acuracia = total > 0 ? (counts.autenticado / total) * 100 : 0;
    const ranking = Array.from(divMap.entries())
      .map(([name, v]) => ({ name, count: v.count, valor: v.valor }))
      .sort((a, b) => b.valor - a.valor || b.count - a.count);

    const prevAccuracy = historicoAccuracy.length >= 2 ? historicoAccuracy[historicoAccuracy.length - 2] : null;
    const deltaAccuracy = prevAccuracy !== null ? acuracia - prevAccuracy : null;

    return {
      total,
      counts,
      acuracia,
      deltaAccuracy,
      valorValidado,
      valorDivergente,
      valorNaoEncontrado,
      valorPlanilhaTotal,
      ranking,
    };
  }, [resultados, historicoAccuracy]);

  if (!resultados.length) return null;

  const kpis = [
    {
      label: 'Acurácia',
      value: `${metrics.acuracia.toFixed(1)}%`,
      sub: `${metrics.counts.autenticado.toLocaleString('pt-BR')} de ${metrics.total.toLocaleString('pt-BR')} pedidos`,
      Icon: CheckCircle2,
      tone: 'success' as const,
      delta: metrics.deltaAccuracy,
      deltaSuffix: 'pp vs. anterior',
    },
    {
      label: 'Valor validado',
      value: formatCurrency(metrics.valorValidado),
      sub: 'Pedidos conferidos sem divergência',
      Icon: DollarSign,
      tone: 'success' as const,
    },
    {
      label: 'Valor divergente',
      value: formatCurrency(metrics.valorDivergente),
      sub: `${metrics.counts.divergente.toLocaleString('pt-BR')} pedidos com diferença`,
      Icon: AlertTriangle,
      tone: 'warning' as const,
    },
    {
      label: 'Não encontrados',
      value: formatCurrency(metrics.valorNaoEncontrado),
      sub: `${metrics.counts.nao_encontrado.toLocaleString('pt-BR')} pedidos sem match no sistema`,
      Icon: XCircle,
      tone: 'destructive' as const,
    },
    {
      label: 'Tempo médio',
      value: formatDuration(durationMs),
      sub: 'Validação da auditoria atual',
      Icon: Timer,
      tone: 'primary' as const,
    },
  ];

  const TONE: Record<string, { bg: string; fg: string; ring: string }> = {
    success: { bg: 'bg-success/10', fg: 'text-success', ring: 'ring-success/20' },
    warning: { bg: 'bg-warning/10', fg: 'text-warning', ring: 'ring-warning/20' },
    destructive: { bg: 'bg-destructive/10', fg: 'text-destructive', ring: 'ring-destructive/20' },
    primary: { bg: 'bg-primary/10', fg: 'text-primary', ring: 'ring-primary/20' },
  };

  const maxRanking = metrics.ranking[0]?.valor || 1;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Executive header */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/20 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Resumo executivo</p>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl md:text-6xl font-bold tabular-nums text-foreground">
                {metrics.acuracia.toFixed(1)}
                <span className="text-3xl text-muted-foreground">%</span>
              </span>
              {metrics.deltaAccuracy !== null && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-sm font-semibold',
                    metrics.deltaAccuracy >= 0 ? 'text-success' : 'text-destructive',
                  )}
                >
                  {metrics.deltaAccuracy >= 0 ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  {Math.abs(metrics.deltaAccuracy).toFixed(1)}pp
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Acurácia de auditoria sobre {metrics.total.toLocaleString('pt-BR')} pedidos analisados.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-8">
            <div>
              <p className="text-xs text-muted-foreground">Validado</p>
              <p className="text-lg font-semibold text-foreground tabular-nums">{formatCurrency(metrics.valorValidado)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Em divergência</p>
              <p className="text-lg font-semibold text-warning tabular-nums">{formatCurrency(metrics.valorDivergente)}</p>
            </div>
            <div className="col-span-2 lg:col-span-1">
              <p className="text-xs text-muted-foreground">Duração</p>
              <p className="text-lg font-semibold text-foreground tabular-nums">{formatDuration(durationMs)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((k, idx) => {
          const tone = TONE[k.tone];
          return (
            <div
              key={k.label}
              className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md transition-all animate-fade-in"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{k.label}</p>
                <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', tone.bg, tone.fg)}>
                  <k.Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums text-foreground leading-tight">{k.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>
              {'delta' in k && k.delta !== null && k.delta !== undefined && (
                <p
                  className={cn(
                    'text-xs font-medium mt-2 inline-flex items-center gap-1',
                    k.delta >= 0 ? 'text-success' : 'text-destructive',
                  )}
                >
                  {k.delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(k.delta).toFixed(1)} {k.deltaSuffix}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Ranking */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border/60 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Ranking de divergências
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Categorias com maior impacto financeiro
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {metrics.ranking.reduce((a, b) => a + b.count, 0)} ocorrências
          </span>
        </div>

        {metrics.ranking.length === 0 ? (
          <div className="py-16 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto text-success/60 mb-2" />
            <p className="text-sm font-medium text-foreground">Nenhuma divergência identificada</p>
            <p className="text-xs text-muted-foreground">Todos os pedidos estão conformes.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-6 space-y-3 border-b lg:border-b-0 lg:border-r border-border/60">
              {metrics.ranking.map((r, idx) => (
                <div key={r.name} className="group">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-6 w-6 rounded-md bg-muted text-xs font-bold flex items-center justify-center tabular-nums text-muted-foreground">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-semibold text-foreground truncate">{r.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {r.count} {r.count === 1 ? 'caso' : 'casos'}
                      </span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-foreground ml-3">
                      {formatCurrency(r.valor)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(r.valor / maxRanking) * 100}%`,
                        background: COLORS[r.name] ?? 'hsl(var(--primary))',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.ranking} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis
                      type="number"
                      tickFormatter={(v) => formatCurrency(v as number).replace('R$', '').trim()}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={80}
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => formatCurrency(v)}
                    />
                    <Bar dataKey="valor" radius={[0, 8, 8, 0]}>
                      {metrics.ranking.map((r) => (
                        <Cell key={r.name} fill={COLORS[r.name] ?? 'hsl(var(--primary))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
