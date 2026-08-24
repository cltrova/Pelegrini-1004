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

export function DashboardChartsLegacy({ vendedores, clientes, evolucao, distribuicaoUF }: DashboardChartsProps) {
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* ===================== Evolução ===================== */}
      <Card className="md:col-span-2 premium-card chart-premium chart-header-accent chart-header-accent-primary stagger-1">
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
        <CardContent>
          {evolucaoStats && (
            <div className="flex items-end justify-between mb-2 px-1">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  {hoverMes !== null ? `${evolucaoStats.focus.mes} (selecionado)` : `${evolucaoStats.focus.mes} (atual)`}
                </p>
                <p className="text-xl font-extrabold mono-value tracking-tight">
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
          <div className="h-[200px]">
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
        </CardContent>
      </Card>

      {/* ===================== Top 5 Vendedores ===================== */}
      <Card className="premium-card chart-premium chart-header-accent chart-header-accent-warning stagger-2">
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
        <CardContent>
          <div className="space-y-1.5">
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
                        className="text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${v.fill}25`, color: v.fill }}
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
                  {isActive && (
                    <div className="grid grid-cols-3 gap-1 mt-2 pt-2 border-t border-border/60 animate-fade-in">
                      <div>
                        <p className="text-[9px] text-muted-foreground">Pedidos</p>
                        <p className="text-[11px] font-bold mono-value">{v.pedidos}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground">Ticket</p>
                        <p className="text-[11px] font-bold mono-value">{formatCurrency(v.ticket, true)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground">Particip.</p>
                        <p className="text-[11px] font-bold mono-value">{formatPercent(v.participacao)}</p>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ===================== Top 5 Clientes ===================== */}
      <Card className="premium-card chart-premium chart-header-accent chart-header-accent-accent stagger-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-chart-2 icon-hover-glow" />
              Top 5 Clientes
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {formatPercent(top5Clientes.percentual)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 h-[210px]">
            <div className="flex-1 h-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={top5Clientes.data}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                    activeIndex={pieIdx}
                    activeShape={renderActiveSlice}
                    onMouseEnter={(_, idx) => !piePinned && setPieIdx(idx)}
                    onClick={(_, idx) => {
                      setPieIdx(idx);
                      setPiePinned(p => !(pieIdx === idx && p));
                    }}
                    animationDuration={800}
                  >
                    {top5Clientes.data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} style={{ cursor: 'pointer' }} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {clienteAtivo && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[8px] uppercase tracking-wider text-muted-foreground">
                    {piePinned ? '📌 fixado' : 'em destaque'}
                  </p>
                  <p className="text-[10px] font-semibold truncate max-w-[110px] text-center">
                    {clienteAtivo.fullName}
                  </p>
                  <p className="text-xs font-extrabold mono-value mt-0.5" style={{ color: clienteAtivo.fill }}>
                    {formatCurrency(clienteAtivo.value, true)}
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 min-w-0 w-[100px]">
              {top5Clientes.data.map((c, i) => {
                const isActive = pieIdx === i;
                return (
                  <button
                    key={i}
                    onMouseEnter={() => !piePinned && setPieIdx(i)}
                    onClick={() => {
                      setPieIdx(i);
                      setPiePinned(p => !(pieIdx === i && p));
                    }}
                    className={cn(
                      'flex items-center gap-1.5 text-[9px] truncate text-left px-1 py-0.5 rounded transition-all',
                      isActive ? 'bg-muted/60 scale-[1.02]' : 'hover:bg-muted/30 opacity-70'
                    )}
                  >
                    <span
                      className="w-2 h-2 rounded-sm shrink-0 transition-all"
                      style={{
                        backgroundColor: c.fill,
                        boxShadow: isActive ? `0 0 6px ${c.fill}` : undefined,
                      }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-muted-foreground leading-tight">{c.name}</p>
                      <p className="mono-value text-[8px] font-medium">{formatCurrency(c.value, true)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===================== Top 5 Estados ===================== */}
      <Card className="md:col-span-2 premium-card chart-premium chart-header-accent chart-header-accent-success stagger-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-accent icon-hover-glow" />
              Top 5 Estados
            </span>
            {ufAtivo && (
              <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                <Maximize2 className="h-3 w-3" />
                {ufAtivo.uf} · {formatCurrency(ufAtivo.valor, true)} · {formatPercent(ufAtivo.participacao)}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top5UF} onMouseLeave={() => setUfIdx(null)}>
                <defs>
                  {COLORS.map((color, i) => (
                    <linearGradient key={i} id={`ufGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={1} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.55} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                <XAxis dataKey="uf" tick={{ fontSize: 11, fontWeight: 600 }} />
                <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 10 }} width={40} />
                <Tooltip
                  content={<PremiumChartTooltip labelMap={{ valor: 'Faturamento' }} />}
                  cursor={{ fill: 'hsl(var(--primary) / 0.06)' }}
                />
                <Bar
                  dataKey="valor"
                  radius={[10, 10, 0, 0]}
                  onMouseEnter={(_, idx) => setUfIdx(idx)}
                  onClick={(_, idx) => setUfIdx(idx === ufIdx ? null : idx)}
                  animationDuration={900}
                >
                  {top5UF.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={`url(#ufGrad${index})`}
                      opacity={ufIdx === null || ufIdx === index ? 1 : 0.35}
                      style={{ cursor: 'pointer', transition: 'opacity 200ms' }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ===================== Resumo Rápido ===================== */}
      <Card className="md:col-span-2 bg-gradient-to-br from-muted/30 to-muted/10 premium-card chart-premium chart-header-accent chart-header-accent-primary stagger-5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary icon-hover-glow" />
            Highlights Interativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <HighlightCard
              icon={<Trophy className="h-4 w-4 text-warning" />}
              label={vendedorAtivo ? 'Vendedor selecionado' : 'Líder de Vendas'}
              value={vendedorAtivo?.fullName || vendedores[0]?.nome || '-'}
              sub={formatCurrency(vendedorAtivo?.valor ?? vendedores[0]?.faturamentoLiquido ?? 0, true)}
              accent="hsl(var(--warning))"
              colorClass="text-warning"
            />
            <HighlightCard
              icon={<Users className="h-4 w-4 text-chart-2" />}
              label={piePinned ? 'Cliente fixado' : 'Maior Cliente'}
              value={clienteAtivo?.fullName || clientes[0]?.fantasia || clientes[0]?.razao || '-'}
              sub={formatCurrency(clienteAtivo?.value ?? clientes[0]?.faturamentoLiquido ?? 0, true)}
              accent="hsl(var(--chart-2))"
              colorClass="text-chart-2"
            />
            <HighlightCard
              icon={<MapPin className="h-4 w-4 text-accent" />}
              label={ufAtivo ? 'Estado em foco' : 'Melhor Estado'}
              value={ufAtivo?.uf || distribuicaoUF[0]?.uf || '-'}
              sub={formatCurrency(ufAtivo?.valor ?? distribuicaoUF[0]?.valor ?? 0, true)}
              accent="hsl(var(--accent))"
              colorClass="text-accent"
            />
            <HighlightCard
              icon={<PieChartIcon className="h-4 w-4 text-muted-foreground" />}
              label="Concentração Top 5"
              value={formatPercent(top5Clientes.percentual)}
              sub="do faturamento total"
              accent="hsl(var(--muted-foreground))"
              colorClass="text-muted-foreground"
            />
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
