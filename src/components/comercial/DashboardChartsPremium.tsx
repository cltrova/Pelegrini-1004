import { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Sector,
  
} from 'recharts';
import {
  Trophy,
  TrendingUp,
  Users,
  MapPin,
  PieChart as PieChartIcon,
  Eye,
  EyeOff,
  Maximize2,
  Sparkles,
  AlertTriangle,
  Medal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PremiumChartTooltip } from './PremiumChartTooltip';
import type { VendedorPerformance, ClientePerformance, EvolucaoMensal } from '@/types/comercial';

interface DashboardChartsProps {
  vendedores: VendedorPerformance[];
  clientes: ClientePerformance[];
  evolucao: EvolucaoMensal[];
  distribuicaoUF: { uf: string; valor: number }[];
}

const COLORS = [
  'hsl(217, 91%, 60%)',
  'hsl(173, 80%, 40%)',
  'hsl(142, 71%, 45%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(280, 65%, 60%)',
];

export function DashboardChartsPremium({ vendedores, clientes, evolucao, distribuicaoUF }: DashboardChartsProps) {
  // ===== Estado interativo =====
  const [showBruto, setShowBruto] = useState(true);
  const [showLiquido, setShowLiquido] = useState(true);
  const [hoverMes, setHoverMes] = useState<number | null>(null);

  const [vendedorIdx, setVendedorIdx] = useState<number | null>(null);
  const [pieIdx, setPieIdx] = useState<number>(0);
  const [piePinned, setPiePinned] = useState(false);
  const [ufIdx, setUfIdx] = useState<number | null>(null);

  // ===== Datasets =====
  const top5Vendedores = useMemo(() => {
    return [...vendedores]
      .sort((a, b) => (b.valorFaturado ?? 0) - (a.valorFaturado ?? 0))
      .slice(0, 5)
      .map((v, i) => ({
        nome: v.nome.length > 14 ? v.nome.substring(0, 14) + '…' : v.nome,
        fullName: v.nome,
        valor: v.valorFaturado ?? v.faturamentoLiquido,
        pendente: v.valorPendente ?? 0,
        total: v.faturamentoLiquido,
        pedidos: v.pedidosFaturados,
        ticket: v.ticketMedio,
        participacao: v.participacao,
        fill: COLORS[i],
      }));
  }, [vendedores]);

  const top5Clientes = useMemo(() => {
    const top = clientes.slice(0, 5);
    const total = clientes.reduce((acc, c) => acc + c.faturamentoLiquido, 0);
    const topTotal = top.reduce((acc, c) => acc + c.faturamentoLiquido, 0);
    return {
      data: top.map((c, i) => ({
        name: (c.fantasia || c.razao).substring(0, 18),
        fullName: c.fantasia || c.razao,
        value: c.faturamentoLiquido,
        pedidos: c.totalPedidos,
        ticket: c.ticketMedio,
        uf: c.uf,
        fill: COLORS[i],
      })),
      total: topTotal,
      percentual: total > 0 ? (topTotal / total) * 100 : 0,
    };
  }, [clientes]);

  const evolucaoSimples = useMemo(() => {
    return evolucao.slice(-6).map(e => ({
      mes: formatMes(e.mes),
      vendas: e.vendas,
      liquido: e.liquido,
      pedidos: e.pedidos,
      meta: e.meta ?? 0,
    }));
  }, [evolucao]);
  const hasMeta = useMemo(() => evolucaoSimples.some(e => e.meta > 0), [evolucaoSimples]);

  const top5UF = useMemo(() => {
    const total = distribuicaoUF.reduce((acc, d) => acc + d.valor, 0);
    return distribuicaoUF.slice(0, 5).map((d, i) => ({
      ...d,
      participacao: total > 0 ? (d.valor / total) * 100 : 0,
      fill: COLORS[i],
    }));
  }, [distribuicaoUF]);

  // ===== Métricas derivadas para painéis interativos =====
  const evolucaoStats = useMemo(() => {
    if (!evolucaoSimples.length) return null;
    const focus = hoverMes !== null ? evolucaoSimples[hoverMes] : evolucaoSimples[evolucaoSimples.length - 1];
    const prev = hoverMes !== null && hoverMes > 0 ? evolucaoSimples[hoverMes - 1] : evolucaoSimples[evolucaoSimples.length - 2];
    const delta = prev && prev.vendas > 0 ? ((focus.vendas - prev.vendas) / prev.vendas) * 100 : 0;
    return { focus, delta };
  }, [hoverMes, evolucaoSimples]);

  const vendedorAtivo = vendedorIdx !== null ? top5Vendedores[vendedorIdx] : null;
  const clienteAtivo = top5Clientes.data[pieIdx];
  const ufAtivo = ufIdx !== null ? top5UF[ufIdx] : null;

  // ===== Pie active shape =====
  const renderActiveSlice = useCallback((props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 6}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          style={{ filter: `drop-shadow(0 0 8px ${fill})` }}
        />
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={outerRadius + 8}
          outerRadius={outerRadius + 10}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          opacity={0.45}
        />
      </g>
    );
  }, []);

  // ===== Métricas globais para footers =====
  const totalEvolucao = useMemo(() => evolucaoSimples.reduce((s, e) => s + e.vendas, 0), [evolucaoSimples]);
  const mediaEvolucao = evolucaoSimples.length ? totalEvolucao / evolucaoSimples.length : 0;
  const totalVendedores = useMemo(() => top5Vendedores.reduce((s, v) => s + v.valor, 0), [top5Vendedores]);
  const totalUF = useMemo(() => top5UF.reduce((s, u) => s + u.valor, 0), [top5UF]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr">
      {/* ===================== Evolução ===================== */}
      <Card className="md:col-span-2 premium-card chart-premium chart-header-accent chart-header-accent-primary stagger-1 flex flex-col h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary icon-hover-glow" />
              Evolução (últimos 6 meses)
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={showBruto ? 'default' : 'outline'}
                className="h-6 px-2 text-[10px] gap-1"
                onClick={() => setShowBruto(v => !v)}
              >
                {showBruto ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                Bruto
              </Button>
              <Button
                size="sm"
                variant={showLiquido ? 'default' : 'outline'}
                className={cn(
                  'h-6 px-2 text-[10px] gap-1',
                  showLiquido && 'bg-success hover:bg-success/90 text-success-foreground'
                )}
                onClick={() => setShowLiquido(v => !v)}
              >
                {showLiquido ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                Líquido
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {evolucaoStats && (
            <div className="flex items-end justify-between mb-2 px-1">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  {hoverMes !== null ? `${evolucaoStats.focus.mes} (selecionado)` : `${evolucaoStats.focus.mes} (atual)`}
                </p>
                <p className="text-2xl font-extrabold mono-value tracking-tight gradient-text-premium">
                  {formatCurrency(evolucaoStats.focus.vendas, true)}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={cn(
                    'text-[11px] font-bold px-2 py-0.5 rounded-md',
                    evolucaoStats.delta >= 0 ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                  )}
                >
                  {evolucaoStats.delta >= 0 ? '▲' : '▼'} {Math.abs(evolucaoStats.delta).toFixed(1)}%
                </span>
                <p className="text-[10px] text-muted-foreground mt-0.5">{evolucaoStats.focus.pedidos} pedidos</p>
              </div>
            </div>
          )}
          <div className="flex-1 min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={evolucaoSimples}
                onMouseMove={(state: any) => {
                  if (state?.activeTooltipIndex !== undefined) setHoverMes(state.activeTooltipIndex);
                }}
                onMouseLeave={() => setHoverMes(null)}
              >
                <defs>
                  <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorLiquido" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 10 }} width={40} />
                <Tooltip
                  content={<PremiumChartTooltip labelMap={{ vendas: 'Bruto', liquido: 'Líquido', meta: 'Meta' }} />}
                  cursor={{ stroke: 'hsl(var(--primary) / 0.5)', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                />
                {hasMeta && (
                  <Area
                    type="monotone"
                    dataKey="meta"
                    stroke="hsl(var(--chart-4))"
                    fill="transparent"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    name="meta"
                    dot={{ r: 3, fill: 'hsl(var(--chart-4))', strokeWidth: 0 }}
                    activeDot={{ r: 5, stroke: 'hsl(var(--chart-4))', strokeWidth: 2, fill: 'hsl(var(--card))' }}
                    animationDuration={900}
                  />
                )}
                {showBruto && (
                  <Area
                    type="monotone"
                    dataKey="vendas"
                    stroke="hsl(var(--primary))"
                    fill="url(#colorVendas)"
                    strokeWidth={2.5}
                    name="vendas"
                    dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                    activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2, fill: 'hsl(var(--card))' }}
                    animationDuration={900}
                  />
                )}
                {showLiquido && (
                  <Area
                    type="monotone"
                    dataKey="liquido"
                    stroke="hsl(var(--success))"
                    fill="url(#colorLiquido)"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    name="liquido"
                    dot={{ r: 2, fill: 'hsl(var(--success))', strokeWidth: 0 }}
                    activeDot={{ r: 5, stroke: 'hsl(var(--success))', strokeWidth: 2, fill: 'hsl(var(--card))' }}
                    animationDuration={900}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Footer mini-stats */}
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/40">
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Acum. 6m</p>
              <p className="text-sm font-bold mono-value text-primary">{formatCurrency(totalEvolucao, true)}</p>
            </div>
            <div className="text-center border-x border-border/40">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Média/mês</p>
              <p className="text-sm font-bold mono-value">{formatCurrency(mediaEvolucao, true)}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Pico</p>
              <p className="text-sm font-bold mono-value text-success">
                {formatCurrency(Math.max(...evolucaoSimples.map(e => e.vendas), 0), true)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===================== Top 5 Vendedores ===================== */}
      <Card className="premium-card chart-premium chart-header-accent chart-header-accent-warning stagger-2 flex flex-col h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-warning icon-hover-glow" />
              Top 5 Vendedores — Faturado
            </span>
            {vendedorAtivo && (
              <button
                onClick={() => setVendedorIdx(null)}
                className="text-[9px] text-muted-foreground hover:text-foreground transition"
              >
                limpar
              </button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="space-y-1.5 flex-1">
            {top5Vendedores.map((v, i) => {
              const max = top5Vendedores[0]?.valor || 1;
              const pct = (v.valor / max) * 100;
              const isActive = vendedorIdx === i;
              const dimmed = vendedorIdx !== null && !isActive;
              return (
                <button
                  key={i}
                  onClick={() => setVendedorIdx(isActive ? null : i)}
                  className={cn(
                    'w-full text-left group relative rounded-lg p-2 transition-all duration-300',
                    'hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/40',
                    isActive && 'bg-muted/60 ring-1 ring-primary/40 shadow-md',
                    dimmed && 'opacity-40'
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 ring-1"
                        style={{ backgroundColor: `${v.fill}25`, color: v.fill, borderColor: `${v.fill}40` }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-xs font-medium truncate">{v.fullName}</span>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[11px] font-bold mono-value text-success">
                        {formatCurrency(v.valor, true)}
                      </span>
                      {v.pendente > 0 && (
                        <span className="text-[9px] mono-value text-warning/90" title="Em aberto / carteira pendente">
                          + {formatCurrency(v.pendente, true)} aberto
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden relative">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${v.fill}aa, ${v.fill})`,
                        boxShadow: isActive ? `0 0 10px ${v.fill}` : undefined,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-[9px] text-muted-foreground">
                    <span>{v.pedidos} pedidos · ticket {formatCurrency(v.ticket, true)}</span>
                    <span className="font-semibold" style={{ color: v.fill }}>{formatPercent(v.participacao)}</span>
                  </div>
                </button>
              );
            })}
          </div>
          {/* Footer total */}
          <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Top 5</span>
            <span className="text-sm font-bold mono-value text-warning">{formatCurrency(totalVendedores, true)}</span>
          </div>
        </CardContent>
      </Card>

      {/* ===================== Top 5 Clientes — Executive Ranking ===================== */}
      {(() => {
        const GOLD = '#F4B233';
        const SILVER = '#C7CCD1';
        const BRONZE = '#CD7F32';
        const items = top5Clientes.data;
        const totalTop5 = top5Clientes.total;
        const top2Sum = (items[0]?.value || 0) + (items[1]?.value || 0);
        const top2Pct = totalTop5 > 0 ? (top2Sum / totalTop5) * 100 : 0;
        const highConcentration = top2Pct >= 60;

        // Tier styling per rank position
        const TIERS = [
          {
            color: GOLD,
            bg: 'linear-gradient(135deg, rgba(244,178,51,0.16) 0%, rgba(244,178,51,0.04) 100%)',
            border: 'rgba(244,178,51,0.35)',
            barFrom: GOLD,
            barTo: 'rgba(244,178,51,0.55)',
            chipBg: 'rgba(244,178,51,0.18)',
          },
          {
            color: SILVER,
            bg: 'linear-gradient(135deg, rgba(199,204,209,0.10) 0%, rgba(199,204,209,0.02) 100%)',
            border: 'rgba(199,204,209,0.22)',
            barFrom: SILVER,
            barTo: 'rgba(199,204,209,0.45)',
            chipBg: 'rgba(199,204,209,0.14)',
          },
          {
            color: BRONZE,
            bg: 'linear-gradient(135deg, rgba(205,127,50,0.12) 0%, rgba(205,127,50,0.03) 100%)',
            border: 'rgba(205,127,50,0.25)',
            barFrom: BRONZE,
            barTo: 'rgba(205,127,50,0.45)',
            chipBg: 'rgba(205,127,50,0.16)',
          },
          {
            color: 'rgba(255,255,255,0.55)',
            bg: 'transparent',
            border: 'rgba(255,255,255,0.06)',
            barFrom: 'rgba(255,255,255,0.35)',
            barTo: 'rgba(255,255,255,0.10)',
            chipBg: 'rgba(255,255,255,0.05)',
          },
          {
            color: 'rgba(255,255,255,0.45)',
            bg: 'transparent',
            border: 'rgba(255,255,255,0.05)',
            barFrom: 'rgba(255,255,255,0.28)',
            barTo: 'rgba(255,255,255,0.08)',
            chipBg: 'rgba(255,255,255,0.04)',
          },
        ];

        return (
          <Card
            className="top-clientes-system-blue premium-card chart-premium stagger-3 flex flex-col h-full"
            style={{
              fontFamily: 'Inter, "SF Pro Display", "Segoe UI", system-ui, sans-serif',
            }}
          >
            <CardHeader className="pb-3 pt-4 px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle
                    className="text-[15px] font-semibold tracking-tight flex items-center gap-2"
                    style={{ color: 'rgba(255,255,255,0.96)' }}
                  >
                    <span
                      className="inline-flex items-center justify-center h-6 w-6 rounded-md"
                      style={{
                        background: 'linear-gradient(135deg, rgba(244,178,51,0.25), rgba(244,178,51,0.08))',
                        border: '1px solid rgba(244,178,51,0.35)',
                      }}
                    >
                      <Trophy className="h-3.5 w-3.5" style={{ color: GOLD }} />
                    </span>
                    Top 5 Clientes
                  </CardTitle>
                  <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    Clientes com maior faturamento
                  </p>
                </div>
                {highConcentration && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold tracking-wide whitespace-nowrap"
                    style={{
                      background: 'rgba(244,178,51,0.12)',
                      color: GOLD,
                      border: '1px solid rgba(244,178,51,0.28)',
                    }}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Alta concentração
                  </span>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col px-5 pb-4 pt-0 gap-3">
              {/* Resumo executivo */}
              <div
                className="flex items-center justify-between rounded-lg px-3 py-2.5 border"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  borderColor: 'rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.40)' }}>
                    Faturamento Top 5
                  </span>
                  <span
                    className="mono-value text-[16px] font-bold tabular-nums tracking-tight"
                    style={{ color: 'rgba(255,255,255,0.96)' }}
                  >
                    {formatCurrency(totalTop5)}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.40)' }}>
                    Top 2
                  </span>
                  <span
                    className="mono-value text-[16px] font-bold tabular-nums tracking-tight"
                    style={{ color: GOLD }}
                  >
                    {top2Pct.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Lista ranking */}
              <div className="flex flex-col gap-1.5 flex-1">
                {items.map((c, i) => {
                  const tier = TIERS[i];
                  const pct = totalTop5 > 0 ? (c.value / totalTop5) * 100 : 0;
                  const isTop3 = i < 3;
                  return (
                    <div
                      key={i}
                      className="rounded-lg px-3 py-2 border transition-colors"
                      style={{
                        background: tier.bg,
                        borderColor: tier.border,
                      }}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="inline-flex items-center justify-center h-6 w-6 rounded-md flex-shrink-0"
                            style={{ background: tier.chipBg }}
                          >
                            {isTop3 ? (
                              <Medal className="h-3.5 w-3.5" style={{ color: tier.color }} />
                            ) : (
                              <span
                                className="text-[11px] font-semibold tabular-nums"
                                style={{ color: tier.color }}
                              >
                                {i + 1}
                              </span>
                            )}
                          </span>
                          <span
                            className={cn(
                              'truncate',
                              isTop3 ? 'text-[13px] font-semibold' : 'text-[12.5px] font-medium',
                            )}
                            style={{ color: isTop3 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.72)' }}
                            title={c.fullName}
                          >
                            {c.fullName}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2 whitespace-nowrap pl-2">
                          <span
                            className={cn(
                              'mono-value tabular-nums tracking-tight',
                              isTop3 ? 'text-[13.5px] font-bold' : 'text-[12.5px] font-semibold',
                            )}
                            style={{ color: isTop3 ? tier.color : 'rgba(255,255,255,0.80)' }}
                          >
                            {formatCurrency(c.value)}
                          </span>
                          <span
                            className="text-[10.5px] font-medium tabular-nums"
                            style={{ color: 'rgba(255,255,255,0.45)' }}
                          >
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      {/* Barra de participação */}
                      <div
                        className="relative h-1 w-full rounded-full overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.04)' }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.max(pct, 2)}%`,
                            background: `linear-gradient(90deg, ${tier.barTo}, ${tier.barFrom})`,
                            boxShadow: isTop3 ? `0 0 8px ${tier.barFrom}55` : 'none',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Insight inferior */}
              <div
                className="mt-auto flex items-center gap-2 rounded-lg px-3 py-2 border"
                style={{
                  background: highConcentration
                    ? 'rgba(244,178,51,0.06)'
                    : 'rgba(255,255,255,0.02)',
                  borderColor: highConcentration
                    ? 'rgba(244,178,51,0.18)'
                    : 'rgba(255,255,255,0.06)',
                }}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
                <p className="text-[11.5px] leading-snug" style={{ color: 'rgba(255,255,255,0.78)' }}>
                  Top 2 clientes representam{' '}
                  <span className="font-bold tabular-nums" style={{ color: GOLD }}>
                    {top2Pct.toFixed(1)}%
                  </span>{' '}
                  do faturamento dos Top 5
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })()}


      {/* ===================== Top 5 Estados (clean ranking) ===================== */}
      <Card className="md:col-span-2 premium-card stagger-4 flex flex-col h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Top 5 Estados
            </span>
            <span className="text-[10px] font-normal text-muted-foreground tabular-nums">
              Total {formatCurrency(totalUF, true)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center">
          <div className="flex flex-col gap-2.5">
            {top5UF.map((u, i) => {
              const isActive = ufIdx === i;
              const maxValor = top5UF[0]?.valor || 1;
              const widthPct = (u.valor / maxValor) * 100;
              return (
                <button
                  key={u.uf}
                  type="button"
                  onMouseEnter={() => setUfIdx(i)}
                  onMouseLeave={() => setUfIdx(null)}
                  onClick={() => setUfIdx(isActive ? null : i)}
                  className={cn(
                    'group w-full text-left rounded-lg px-3 py-2.5 transition-colors border',
                    isActive
                      ? 'bg-muted/60 border-border'
                      : 'bg-transparent border-transparent hover:bg-muted/30'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="text-sm font-bold tabular-nums w-8 text-center shrink-0"
                      style={{ color: u.fill }}
                    >
                      {u.uf}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {u.participacao.toFixed(1)}%
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatCurrency(u.valor, true)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${widthPct}%`, backgroundColor: u.fill }}
                        />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

function HighlightCard({
  icon,
  label,
  value,
  sub,
  accent,
  colorClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent: string;
  colorClass: string;
}) {
  return (
    <div
      className="p-3 bg-gradient-to-r from-muted/20 to-transparent rounded-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-default group"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">{icon}</span>
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
      </div>
      <p className="font-semibold truncate">{value}</p>
      <p className={cn('text-xs mono-value font-medium', colorClass)}>{sub}</p>
    </div>
  );
}

function formatMes(mes: string) {
  const [year, month] = mes.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(month) - 1]}/${year?.slice(2) || ''}`;
}
