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
  Sparkles,
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
const POSITIVE_SOFT = 'rgba(16,185,129,0.35)';
const NEGATIVE_SOFT = 'rgba(239,68,68,0.35)';

function PremiumTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const fullName = item?.payload?.fullName ?? label;
  const val = item.value as number;
  const positive = val >= 0;
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/95 backdrop-blur-md shadow-2xl px-3 py-2 min-w-[180px]">
      <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">{fullName}</p>
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
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Saldo Inicial */}
        <Card className="group relative overflow-hidden border-white/5 bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur transition-all hover:border-white/10 hover:shadow-[0_0_40px_-15px_rgba(59,130,246,0.35)]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-500/30 to-transparent" />
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Saldo Inicial
                </p>
                <p
                  className={cn(
                    'text-2xl font-bold font-mono tracking-tight',
                    totais.saldoInicial >= 0 ? 'text-slate-100' : 'text-red-400',
                  )}
                >
                  {formatCurrency(totais.saldoInicial)}
                </p>
                <p className="text-[11px] text-slate-500">Início do período {ano}</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-slate-800/70 ring-1 ring-white/5 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-slate-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Saldo Final */}
        <Card className="group relative overflow-hidden border-white/5 bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur transition-all hover:border-white/10 hover:shadow-[0_0_40px_-15px_rgba(59,130,246,0.4)]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Saldo Final
                </p>
                <p
                  className={cn(
                    'text-2xl font-bold font-mono tracking-tight',
                    totais.saldoFinal >= 0 ? 'text-slate-100' : 'text-red-400',
                  )}
                >
                  {formatCurrency(totais.saldoFinal)}
                </p>
                <p className="text-[11px] text-slate-500">Encerramento {ano}</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-blue-500/10 ring-1 ring-blue-400/20 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Variação Total — destaque */}
        <Card
          className={cn(
            'group relative overflow-hidden border transition-all md:col-span-2 xl:col-span-1',
            isPositiveTotal
              ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-950/50 via-slate-900/80 to-slate-900/40 shadow-[0_0_40px_-15px_rgba(16,185,129,0.5)]'
              : 'border-red-500/30 bg-gradient-to-br from-red-950/50 via-slate-900/80 to-slate-900/40 shadow-[0_0_40px_-15px_rgba(239,68,68,0.5)]',
          )}
        >
          <div
            className={cn(
              'absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent',
              isPositiveTotal ? 'via-emerald-400/60' : 'via-red-400/60',
            )}
          />
          <div
            className={cn(
              'absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl opacity-30',
              isPositiveTotal ? 'bg-emerald-500' : 'bg-red-500',
            )}
          />
          <CardContent className="pt-6 relative">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-amber-400" />
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-300">
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
                <p className="text-[11px] text-slate-400">
                  {isPositiveTotal ? 'Fluxo positivo no período' : 'Fluxo negativo no período'}
                </p>
              </div>
              <div
                className={cn(
                  'h-11 w-11 rounded-xl ring-1 flex items-center justify-center',
                  isPositiveTotal
                    ? 'bg-emerald-500/15 ring-emerald-400/30'
                    : 'bg-red-500/15 ring-red-400/30',
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
        <Card className="group relative overflow-hidden border-white/5 bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur transition-all hover:border-white/10">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Grupos Analisados
                </p>
                <p className="text-2xl font-bold font-mono tracking-tight text-slate-100">
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
              <div className="h-11 w-11 rounded-xl bg-violet-500/10 ring-1 ring-violet-400/20 flex items-center justify-center">
                <Layers className="h-5 w-5 text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos superiores */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Top Variações — 3/5 */}
        <Card className="lg:col-span-3 border-white/5 bg-gradient-to-br from-slate-900/70 to-slate-900/30 backdrop-blur">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-200">
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
                <defs>
                  <linearGradient id="barPos" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={POSITIVE} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={POSITIVE} stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="barNeg" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={NEGATIVE} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={NEGATIVE} stopOpacity={1} />
                  </linearGradient>
                </defs>
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
                      fill={entry.valor >= 0 ? 'url(#barPos)' : 'url(#barNeg)'}
                      opacity={index === 0 ? 1 : 0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição Entradas vs Saídas — 2/5 */}
        <Card className="lg:col-span-2 border-white/5 bg-gradient-to-br from-slate-900/70 to-slate-900/30 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-200">
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
                  <defs>
                    <linearGradient id="pieEntrada" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                    <linearGradient id="pieSaida" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#f87171" />
                      <stop offset="100%" stopColor="#dc2626" />
                    </linearGradient>
                  </defs>
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
                    <Cell fill="url(#pieEntrada)" />
                    <Cell fill="url(#pieSaida)" />
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
                <p className="text-lg font-bold font-mono text-slate-100 mt-0.5">
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
                <p className="text-xs font-mono font-semibold text-slate-100">
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
                <p className="text-xs font-mono font-semibold text-slate-100">
                  {formatCurrency(totalSaidas)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Composição */}
      <Card className="border-white/5 bg-gradient-to-br from-slate-900/70 to-slate-900/30 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-200">
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
              <defs>
                <linearGradient id="compPos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={POSITIVE} stopOpacity={1} />
                  <stop offset="100%" stopColor={POSITIVE} stopOpacity={0.5} />
                </linearGradient>
                <linearGradient id="compNeg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={NEGATIVE} stopOpacity={1} />
                  <stop offset="100%" stopColor={NEGATIVE} stopOpacity={0.5} />
                </linearGradient>
              </defs>
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
                    fill={entry.isPositive ? 'url(#compPos)' : 'url(#compNeg)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela premium */}
      <Card className="border-white/5 bg-gradient-to-br from-slate-900/70 to-slate-900/30 backdrop-blur">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-200">
                Resumo por Grupo
              </CardTitle>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Top {Math.min(15, grupos.length)} grupos · {ano}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ArrowUpDown className="h-3 w-3" />
              Ordenado por variação
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="overflow-x-auto rounded-lg border border-white/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-slate-800/40">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Grupo
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Saldo Inicial
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Saldo Final
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
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
                        isTop && 'bg-gradient-to-r from-amber-500/[0.04] to-transparent',
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
                          <span className="text-slate-200 font-medium">
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
                          grupo.saldoInicial >= 0 ? 'text-slate-300' : 'text-red-400',
                        )}
                      >
                        {formatCurrency(grupo.saldoInicial)}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-mono tabular-nums',
                          grupo.saldoFinal >= 0 ? 'text-slate-100' : 'text-red-400',
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
