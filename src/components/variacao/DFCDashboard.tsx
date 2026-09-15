import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { FluxoCaixaGrupo } from '@/types/variacao';
import { formatCurrency } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpDown,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DFCDashboardProps {
  grupos: FluxoCaixaGrupo[];
  totais: {
    saldoInicial: number;
    saldoFinal: number;
    valorVariacao: number;
  };
  ano: string;
}

const POSITIVE = '#10b981';
const NEGATIVE = '#ef4444';
function PremiumTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const fullName = item?.payload?.fullName ?? label;
  const val = item.value as number;
  const positive = val >= 0;
  return (
    <div className="financial-overlay min-w-[180px] border border-border bg-popover px-3 py-2">
      <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{fullName}</p>
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: positive ? POSITIVE : NEGATIVE }}
        />
        <span
          className={cn(
            'font-mono text-sm font-semibold',
            positive ? 'text-emerald-400' : 'text-red-400',
          )}
        >
          {formatCurrency(val, true)}
        </span>
      </div>
    </div>
  );
}

export function DFCDashboard({ grupos, totais, ano }: DFCDashboardProps) {
  const topGrupos = [...grupos]
    .sort((a, b) => Math.abs(b.valorVariacao) - Math.abs(a.valorVariacao))
    .slice(0, 8)
    .map((g) => ({
      name: g.grupo.length > 28 ? g.grupo.substring(0, 28) + '…' : g.grupo,
      fullName: g.grupo,
      valor: g.valorVariacao,
      absValor: Math.abs(g.valorVariacao),
      fill: g.valorVariacao >= 0 ? POSITIVE : NEGATIVE,
    }));

  const maiorGrupo = topGrupos[0];

  const positivos = grupos.filter((g) => g.valorVariacao >= 0);
  const negativos = grupos.filter((g) => g.valorVariacao < 0);
  const totalEntradas = Math.abs(positivos.reduce((s, g) => s + g.valorVariacao, 0));
  const totalSaidas = Math.abs(negativos.reduce((s, g) => s + g.valorVariacao, 0));
  const pieData = [
    { name: 'Entradas', value: totalEntradas, fill: POSITIVE },
    { name: 'Saídas', value: totalSaidas, fill: NEGATIVE },
  ];
  const totalFluxo = totalEntradas + totalSaidas;
  const pctEntradas = totalFluxo ? (totalEntradas / totalFluxo) * 100 : 0;
  const pctSaidas = totalFluxo ? (totalSaidas / totalFluxo) * 100 : 0;

  const composicaoData = grupos.slice(0, 12).map((g) => ({
    name: g.grupo.length > 18 ? g.grupo.substring(0, 18) + '…' : g.grupo,
    fullName: g.grupo,
    variacao: g.valorVariacao,
    isPositive: g.valorVariacao >= 0,
  }));

  const isPositiveTotal = totais.valorVariacao >= 0;
  const topGrupoTabela = [...grupos].sort(
    (a, b) => Math.abs(b.valorVariacao) - Math.abs(a.valorVariacao),
  )[0]?.grupo;

  return (
    <div className="financial-data-viewport min-w-0 max-w-full space-y-4 overflow-x-hidden">
      {/* KPI Cards */}
      <div className="financial-metric-strip grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
        {/* Saldo Inicial */}
        <Card className="relative overflow-hidden border-border bg-card shadow-none">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Saldo Inicial
                </p>
                <p
                  className={cn(
                    'text-2xl font-bold font-mono tracking-tight',
                    totais.saldoInicial >= 0 ? 'text-foreground' : 'text-red-500 dark:text-red-400',
                  )}
                >
                  {formatCurrency(totais.saldoInicial)}
                </p>
                <p className="text-[11px] text-slate-500">Início do período {ano}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center border border-border bg-muted">
                <Wallet className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Saldo Final */}
        <Card className="relative overflow-hidden border-border bg-card shadow-none">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Saldo Final
                </p>
                <p
                  className={cn(
                    'text-2xl font-bold font-mono tracking-tight',
                    totais.saldoFinal >= 0 ? 'text-foreground' : 'text-red-500 dark:text-red-400',
                  )}
                >
                  {formatCurrency(totais.saldoFinal)}
                </p>
                <p className="text-[11px] text-slate-500">Encerramento {ano}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center border border-blue-400/20 bg-blue-500/10">
                <Wallet className="h-5 w-5 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Variação Total — destaque */}
        <Card
          className={cn(
            'relative overflow-hidden border shadow-none md:col-span-2 xl:col-span-1',
            isPositiveTotal
              ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
              : 'border-red-500/30 bg-red-500/[0.06]',
          )}
        >
          <CardContent className="relative p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Variação Total
                  </p>
                </div>
                <p
                  className={cn(
                    'text-3xl font-bold font-mono tracking-tight',
                    isPositiveTotal ? 'text-emerald-400' : 'text-red-400',
                  )}
                >
                  {formatCurrency(totais.valorVariacao, true)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isPositiveTotal ? 'Fluxo positivo no período' : 'Fluxo negativo no período'}
                </p>
              </div>
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center border',
                  isPositiveTotal
                    ? 'border-emerald-400/30 bg-emerald-500/15'
                    : 'border-red-400/30 bg-red-500/15',
                )}
              >
                {isPositiveTotal ? (
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-400" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grupos Analisados */}
        <Card className="relative overflow-hidden border-border bg-card shadow-none">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Grupos Analisados
                </p>
                <p className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  {grupos.length}
                </p>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <ArrowUpRight className="h-3 w-3" />
                    {positivos.length} pos.
                  </span>
                  <span className="flex items-center gap-1 text-red-400">
                    <ArrowDownRight className="h-3 w-3" />
                    {negativos.length} neg.
                  </span>
                </div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center border border-violet-400/20 bg-violet-500/10">
                <Layers className="h-5 w-5 text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos superiores */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* Top Variações — 3/5 */}
        <Card className="border-border bg-card shadow-none lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">
                  Top Variações por Grupo
                </CardTitle>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Ranking absoluto · {ano}
                </p>
              </div>
              {maiorGrupo && (
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">
                    Maior impacto
                  </p>
                  <p
                    className={cn(
                      'text-xs font-mono font-semibold',
                      maiorGrupo.valor >= 0 ? 'text-emerald-400' : 'text-red-400',
                    )}
                  >
                    {formatCurrency(maiorGrupo.valor, true)}
                  </p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart
                data={topGrupos}
                layout="vertical"
                margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
                barCategoryGap={10}
              >
                <CartesianGrid
                  horizontal={false}
                  strokeDasharray="2 4"
                  stroke="rgba(148,163,184,0.1)"
                />
                <XAxis
                  type="number"
                  tickFormatter={(v) =>
                    formatCurrency(v, false).replace('R$', '').trim()
                  }
                  tick={{ fill: 'rgb(148,163,184)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  tick={{ fill: 'rgb(203,213,225)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,0.05)' }}
                  content={<PremiumTooltip />}
                />
                <Bar dataKey="valor" radius={[0, 6, 6, 0]}>
                  {topGrupos.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.valor >= 0 ? POSITIVE : NEGATIVE}
                      opacity={index === 0 ? 1 : 0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição Entradas vs Saídas — 2/5 */}
        <Card className="border-border bg-card shadow-none lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">
              Entradas vs Saídas
            </CardTitle>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Distribuição do fluxo · {ano}
            </p>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={72}
                    outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="rgba(15,23,42,0.9)"
                    strokeWidth={2}
                  >
                    <Cell fill={POSITIVE} />
                    <Cell fill={NEGATIVE} />
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: 'rgba(2,6,23,0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: 'rgb(203,213,225)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Centro */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Fluxo bruto
                </p>
                <p className="text-lg font-bold font-mono text-foreground mt-0.5">
                  {formatCurrency(totalFluxo)}
                </p>
              </div>
            </div>
            {/* Legenda customizada */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                  <p className="text-[11px] font-medium text-emerald-300">Entradas</p>
                  <span className="ml-auto text-[11px] font-mono text-emerald-400">
                    {pctEntradas.toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs font-mono font-semibold text-foreground">
                  {formatCurrency(totalEntradas)}
                </p>
              </div>
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
                  <p className="text-[11px] font-medium text-red-300">Saídas</p>
                  <span className="ml-auto text-[11px] font-mono text-red-400">
                    {pctSaidas.toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs font-mono font-semibold text-foreground">
                  {formatCurrency(totalSaidas)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Composição */}
      <Card className="border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">
            Composição das Variações por Grupo
          </CardTitle>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Peso individual de cada grupo · {ano}
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={composicaoData}
              margin={{ top: 10, right: 20, left: 10, bottom: 70 }}
              barCategoryGap={8}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="2 4"
                stroke="rgba(148,163,184,0.1)"
              />
              <XAxis
                dataKey="name"
                angle={-35}
                textAnchor="end"
                interval={0}
                height={70}
                tick={{ fill: 'rgb(148,163,184)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) =>
                  formatCurrency(v, false).replace('R$', '').trim()
                }
                tick={{ fill: 'rgb(148,163,184)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(148,163,184,0.05)' }}
                content={<PremiumTooltip />}
              />
              <Bar dataKey="variacao" radius={[6, 6, 0, 0]}>
                {composicaoData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isPositive ? POSITIVE : NEGATIVE}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela premium */}
      <Card className="border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                Resumo por Grupo
              </CardTitle>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Top {Math.min(15, grupos.length)} grupos · {ano}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ArrowUpDown className="h-3 w-3" />
              Ordenado por variação
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="financial-data-viewport max-w-full overflow-x-auto border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-slate-800/40">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Grupo
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Saldo Inicial
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Saldo Final
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Variação
                  </th>
                </tr>
              </thead>
              <tbody>
                {grupos.slice(0, 15).map((grupo) => {
                  const isTop = grupo.grupo === topGrupoTabela;
                  const positive = grupo.valorVariacao >= 0;
                  return (
                    <tr
                      key={grupo.grupo}
                      className={cn(
                        'group border-b border-white/5 last:border-0 transition-colors hover:bg-white/[0.03]',
                        isTop && 'bg-amber-500/[0.04]',
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              positive ? 'bg-emerald-400' : 'bg-red-400',
                            )}
                          />
                          <span className="text-foreground font-medium">
                            {grupo.grupo}
                          </span>
                          {isTop && (
                            <span className="ml-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300">
                              Top
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-mono tabular-nums',
                          grupo.saldoInicial >= 0 ? 'text-muted-foreground' : 'text-red-500 dark:text-red-400',
                        )}
                      >
                        {formatCurrency(grupo.saldoInicial)}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-mono tabular-nums',
                          grupo.saldoFinal >= 0 ? 'text-foreground' : 'text-red-500 dark:text-red-400',
                        )}
                      >
                        {formatCurrency(grupo.saldoFinal)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-xs font-semibold tabular-nums',
                            positive
                              ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20',
                          )}
                        >
                          {positive ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {formatCurrency(grupo.valorVariacao, true)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
