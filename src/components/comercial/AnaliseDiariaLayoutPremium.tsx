import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  TrendingUp, TrendingDown, Users, ShoppingCart, AlertTriangle,
  Clock, Target, UserX, Calendar, ArrowUpRight, ArrowDownRight,
  Minus, Sparkles, Zap, Trophy, Search, DollarSign, Activity, Flame
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatCurrency, formatInteger, formatPercent } from '@/utils/formatters';
import { useComercialData } from '@/hooks/useComercialData';
import { LoadingState } from '@/components/common/LoadingState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  RadialBarChart, RadialBar, PolarAngleAxis, Cell, ReferenceLine, LabelList
} from 'recharts';
import { cn } from '@/lib/utils';

// =============== Sparkline ===============
function Sparkline({ values, color = 'hsl(var(--primary))', height = 28 }: { values: number[]; color?: string; height?: number }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const width = 100;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(' ');
  const areaPath = `M0,${height} L${points.split(' ').join(' L')} L${width},${height} Z`;
  const linePath = `M${points.split(' ').join(' L')}`;
  const id = `spark-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.45} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${id})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// =============== Premium Tooltip ===============
type PremiumTooltipEntry = {
  color?: string;
  fill?: string;
  value?: number | string;
};

function PremiumTooltip({
  active,
  payload,
  label,
  isCurrency = true,
}: {
  active?: boolean;
  payload?: PremiumTooltipEntry[];
  label?: string;
  isCurrency?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-card/95 px-3 py-2">
      <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">{label}</p>
      {payload.map((e, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: e.color || e.fill }} />
          <span className="tabular-nums font-semibold">
            {isCurrency ? formatCurrency(Number(e.value ?? 0)) : formatInteger(Number(e.value ?? 0))}
          </span>
        </div>
      ))}
    </div>
  );
}

// =============== Premium KPI Card ===============
function PremiumKPI({
  icon: Icon, label, value, sub, trend, sparkValues, color = 'hsl(var(--primary))'
}: {
  icon: LucideIcon; label: string; value: string; sub?: string; trend?: number;
  sparkValues?: number[]; color?: string;
}) {
  const trendIcon = trend === undefined ? null
    : trend > 0 ? <ArrowUpRight className="h-3.5 w-3.5" />
    : trend < 0 ? <ArrowDownRight className="h-3.5 w-3.5" />
    : <Minus className="h-3.5 w-3.5" />;
  const trendColor = trend === undefined ? '' : trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-muted-foreground';

  return (
    <div className="relative overflow-hidden rounded-lg border border-border/50 bg-card/40 transition-colors hover:border-primary/40">
      <div className="relative p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
          <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-background/60 border border-border/60">
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
        </div>
        <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
        <div className="flex items-center justify-between mt-2 min-h-[1.25rem]">
          {sub && (
            <span className={cn("text-[11px] font-medium flex items-center gap-1", trendColor || 'text-muted-foreground')}>
              {trendIcon}
              {sub}
            </span>
          )}
        </div>
        {sparkValues && sparkValues.length > 1 && (
          <div className="mt-2 -mx-1">
            <Sparkline values={sparkValues} color={color} height={24} />
          </div>
        )}
      </div>
    </div>
  );
}

export function AnaliseDiariaLayoutPremium() {
  const { pedidos, isLoading } = useComercialData({});
  const [activeTab, setActiveTab] = useState('resumo');
  const [searchVendedor, setSearchVendedor] = useState('');

  // "Hoje" = data mais recente encontrada no JSON (fallback: hoje do sistema).
  // Garante que análises diárias funcionem mesmo quando o JSON está defasado.
  const hojeStr = useMemo(() => {
    if (!pedidos.length) return new Date().toISOString().split('T')[0];
    let max = '';
    for (const p of pedidos) {
      const d = ((p.data_pedido || p.data_faturamento || '') as string).slice(0, 10);
      if (d && d > max) max = d;
    }
    return max || new Date().toISOString().split('T')[0];
  }, [pedidos]);
  const hoje = useMemo(() => new Date(hojeStr + 'T12:00:00'), [hojeStr]);
  const ontemStr = useMemo(() => {
    const d = new Date(hoje); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, [hoje]);


  // ---- Análise do dia ----
  const analiseHoje = useMemo(() => {
    const pedidosHoje = pedidos.filter(p => p.data_pedido?.startsWith(hojeStr) || p.data_faturamento?.startsWith(hojeStr));
    const pedidosOntem = pedidos.filter(p => p.data_pedido?.startsWith(ontemStr) || p.data_faturamento?.startsWith(ontemStr));
    const fatHoje = pedidosHoje.filter(p => p.status === 'faturado').reduce((a, p) => a + (p.valor_liquido || 0), 0);
    const fatOntem = pedidosOntem.filter(p => p.status === 'faturado').reduce((a, p) => a + (p.valor_liquido || 0), 0);
    const pedHoje = pedidosHoje.length;
    const pedOntem = pedidosOntem.length;
    const cliHoje = new Set(pedidosHoje.map(p => p.cliente_codigo)).size;
    const cliOntem = new Set(pedidosOntem.map(p => p.cliente_codigo)).size;
    const vendHoje = new Set(pedidosHoje.map(p => p.vendedor_codigo)).size;
    return {
      faturamentoHoje: fatHoje,
      faturamentoOntem: fatOntem,
      variacaoFaturamento: fatOntem > 0 ? ((fatHoje - fatOntem) / fatOntem) * 100 : 0,
      pedidosHoje: pedHoje,
      pedidosOntem: pedOntem,
      variacaoPedidos: pedOntem > 0 ? ((pedHoje - pedOntem) / pedOntem) * 100 : 0,
      clientesHoje: cliHoje,
      clientesOntem: cliOntem,
      vendedoresAtivosHoje: vendHoje,
      ticketMedioHoje: pedHoje > 0 ? fatHoje / pedHoje : 0,
    };
  }, [pedidos, hojeStr, ontemStr]);

  // ---- Sparklines: últimos 14 dias ----
  const sparklines = useMemo(() => {
    const dias: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(hoje); d.setDate(d.getDate() - i);
      dias.push(d.toISOString().split('T')[0]);
    }
    const fat: number[] = []; const ped: number[] = []; const cli: number[] = []; const tic: number[] = [];
    dias.forEach(dia => {
      const ps = pedidos.filter(p => p.data_pedido?.startsWith(dia) || p.data_faturamento?.startsWith(dia));
      const f = ps.filter(p => p.status === 'faturado').reduce((a, p) => a + (p.valor_liquido || 0), 0);
      fat.push(f);
      ped.push(ps.length);
      cli.push(new Set(ps.map(p => p.cliente_codigo)).size);
      tic.push(ps.length > 0 ? f / ps.length : 0);
    });
    return { fat, ped, cli, tic };
  }, [pedidos, hoje]);

  // ---- Faturamento dos últimos 14 dias ----
  const faturamento14Dias = useMemo(() => {
    const out: { label: string; valor: number; isHoje: boolean }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(hoje); d.setDate(d.getDate() - i);
      const diaStr = d.toISOString().split('T')[0];
      const ps = pedidos.filter(p =>
        p.status === 'faturado' &&
        (p.data_faturamento?.startsWith(diaStr) || p.data_pedido?.startsWith(diaStr))
      );
      const valor = ps.reduce((a, p) => a + (p.valor_liquido || 0), 0);
      out.push({
        label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        valor,
        isHoje: i === 0,
      });
    }
    return out;
  }, [pedidos, hoje]);

  // ---- Média diária do mês ----
  const mediaDiaria = useMemo(() => {
    const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const ps = pedidos.filter(p => p.status === 'faturado' && (p.data_faturamento?.startsWith(mes) || p.data_pedido?.startsWith(mes)));
    const porDia: Record<string, number> = {};
    ps.forEach(p => {
      const dia = (p.data_faturamento || p.data_pedido || '').split('T')[0];
      if (dia) porDia[dia] = (porDia[dia] || 0) + (p.valor_liquido || 0);
    });
    const dias = Object.keys(porDia).length;
    const total = Object.values(porDia).reduce((a, b) => a + b, 0);
    return { media: dias > 0 ? total / dias : 0, diasComVenda: dias, totalMes: total };
  }, [pedidos, hoje]);

  // ---- Performance de vendedores ----
  const performanceVendedores = useMemo(() => {
    const ph = pedidos.filter(p => p.data_pedido?.startsWith(hojeStr) || p.data_faturamento?.startsWith(hojeStr));
    const por: Record<string, { codigo: string | number | null | undefined; nome: string; faturamento: number; pedidos: number; clientes: Set<string | number | null | undefined> }> = {};
    ph.forEach(p => {
      const c = String(p.vendedor_codigo);
      if (!por[c]) por[c] = { codigo: p.vendedor_codigo, nome: p.vendedor_nome || `Vendedor ${c}`, faturamento: 0, pedidos: 0, clientes: new Set() };
      if (p.status === 'faturado') por[c].faturamento += p.valor_liquido || 0;
      por[c].pedidos += 1;
      por[c].clientes.add(p.cliente_codigo);
    });
    const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const medias: Record<string, number> = {};
    pedidos
      .filter(p => p.status === 'faturado' && (p.data_faturamento?.startsWith(mes) || p.data_pedido?.startsWith(mes)))
      .forEach(p => { const c = String(p.vendedor_codigo); medias[c] = (medias[c] || 0) + (p.valor_liquido || 0); });
    const dec = hoje.getDate();
    Object.keys(medias).forEach(k => { medias[k] = medias[k] / dec; });
    return Object.values(por)
      .map(v => ({
        ...v,
        clientes: v.clientes.size,
        mediaDiaria: medias[String(v.codigo)] || 0,
        status: v.faturamento >= (medias[String(v.codigo)] || 0) ? 'acima' : 'abaixo',
        atingimento: medias[String(v.codigo)] > 0 ? (v.faturamento / medias[String(v.codigo)]) * 100 : 0,
      }))
      .sort((a, b) => b.faturamento - a.faturamento);
  }, [pedidos, hojeStr, hoje]);

  const performanceVendedoresFiltrada = useMemo(() => {
    const q = searchVendedor.trim().toLowerCase();
    if (!q) return performanceVendedores;
    return performanceVendedores.filter(v => v.nome.toLowerCase().includes(q));
  }, [performanceVendedores, searchVendedor]);

  const topVendedor = performanceVendedores[0];
  const totalFatVendedores = performanceVendedores.reduce((a, v) => a + v.faturamento, 0);

  // ---- Vendedores sem venda ----
  const vendedoresSemVendaHoje = useMemo(() => {
    const ph = pedidos.filter(p => p.data_pedido?.startsWith(hojeStr) || p.data_faturamento?.startsWith(hojeStr));
    const ativosHoje = new Set(ph.map(p => String(p.vendedor_codigo)));
    const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const agg = new Map<string, { codigo: string; nome: string; fatMes: number; pedidosMes: number; ultimaVenda: string }>();
    pedidos.forEach(p => {
      const c = String(p.vendedor_codigo);
      const dataRef = p.data_faturamento || p.data_pedido || '';
      if (!agg.has(c)) {
        agg.set(c, { codigo: c, nome: p.vendedor_nome || `Vendedor ${c}`, fatMes: 0, pedidosMes: 0, ultimaVenda: '' });
      }
      const r = agg.get(c)!;
      if (p.status === 'faturado' && dataRef.startsWith(mes)) {
        r.fatMes += p.valor_liquido || 0;
        r.pedidosMes += 1;
      }
      if (p.status === 'faturado' && dataRef && dataRef > r.ultimaVenda) r.ultimaVenda = dataRef;
    });
    const hojeMs = new Date(hojeStr).getTime();
    return Array.from(agg.values())
      .filter(v => !ativosHoje.has(v.codigo) && v.pedidosMes > 0)
      .map(v => {
        const ult = v.ultimaVenda ? v.ultimaVenda.split('T')[0] : '';
        const diasParado = ult ? Math.max(0, Math.round((hojeMs - new Date(ult).getTime()) / 86400000)) : 999;
        return { ...v, diasParado, ultimaVendaFmt: ult ? new Date(ult).toLocaleDateString('pt-BR') : '—' };
      })
      .sort((a, b) => b.fatMes - a.fatMes);
  }, [pedidos, hojeStr, hoje]);

  // ---- Clientes inativos hoje ----
  const clientesInativosHoje = useMemo(() => {
    const ph = pedidos.filter(p => p.data_pedido?.startsWith(hojeStr) || p.data_faturamento?.startsWith(hojeStr));
    const ch = new Set(ph.map(p => String(p.cliente_codigo)));
    const ta = new Date(hoje); ta.setDate(ta.getDate() - 30);
    const taStr = ta.toISOString().split('T')[0];
    const freq: Record<string, { codigo: string; nome: string; compras: number; ultimaCompra: string; valorTotal: number }> = {};
    pedidos
      .filter(p => (p.data_pedido || '') >= taStr)
      .forEach(p => {
        const c = String(p.cliente_codigo);
        if (!freq[c]) freq[c] = { codigo: c, nome: p.cliente_fantasia || p.cliente_razao || `Cliente ${c}`, compras: 0, ultimaCompra: p.data_pedido || '', valorTotal: 0 };
        freq[c].compras += 1;
        freq[c].valorTotal += p.valor_liquido || 0;
        if ((p.data_pedido || '') > freq[c].ultimaCompra) freq[c].ultimaCompra = p.data_pedido || '';
      });
    return Object.values(freq).filter(c => c.compras >= 3 && !ch.has(c.codigo)).sort((a, b) => b.compras - a.compras).slice(0, 10);
  }, [pedidos, hojeStr, hoje]);

  if (isLoading) return <LoadingState message="Carregando análise diária..." />;

  const progresso = mediaDiaria.media > 0 ? Math.min(100, (analiseHoje.faturamentoHoje / mediaDiaria.media) * 100) : 0;
  const acimaMedia = analiseHoje.faturamentoHoje >= mediaDiaria.media;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header Premium */}
      <div className="relative overflow-hidden rounded-lg border border-border/60 bg-card p-6">
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 tracking-tight">
              <div className="h-11 w-11 rounded-lg flex items-center justify-center bg-primary/15 border border-primary/30">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              Análise Diária Premium
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 ml-14">
              Performance ao vivo de {hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs px-3 py-1.5 bg-background/40 border-emerald-500/30 text-emerald-400">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Ao vivo
            </Badge>
            <Badge variant="outline" className="text-xs px-3 py-1.5 bg-background/40">
              <Clock className="h-3 w-3 mr-1.5" />
              {hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Badge>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-12 p-1 bg-muted/40 rounded-lg border border-border/40">
          <TabsTrigger value="resumo" className="data-[state=active]:bg-card gap-2 rounded-lg">
            <Sparkles className="h-4 w-4" /> Resumo do Dia
          </TabsTrigger>
          <TabsTrigger value="vendedores" className="data-[state=active]:bg-card gap-2 rounded-lg">
            <Users className="h-4 w-4" /> Vendedores
          </TabsTrigger>
          <TabsTrigger value="alertas" className="data-[state=active]:bg-card gap-2 rounded-lg">
            <AlertTriangle className="h-4 w-4" /> Alertas
          </TabsTrigger>
        </TabsList>

        {/* ============= RESUMO ============= */}
        <TabsContent value="resumo" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <PremiumKPI
              icon={DollarSign}
              label="Faturamento Hoje"
              value={formatCurrency(analiseHoje.faturamentoHoje)}
              sub={`${formatPercent(analiseHoje.variacaoFaturamento, true)} vs ontem`}
              trend={analiseHoje.variacaoFaturamento}
              sparkValues={sparklines.fat}
              color="hsl(var(--primary))"
            />
            <PremiumKPI
              icon={ShoppingCart}
              label="Pedidos Hoje"
              value={formatInteger(analiseHoje.pedidosHoje)}
              sub={`${analiseHoje.pedidosOntem} ontem`}
              trend={analiseHoje.variacaoPedidos}
              sparkValues={sparklines.ped}
              color="hsl(160 70% 50%)"
            />
            <PremiumKPI
              icon={Users}
              label="Clientes Atendidos"
              value={formatInteger(analiseHoje.clientesHoje)}
              sub={`${analiseHoje.clientesOntem} ontem`}
              trend={analiseHoje.clientesHoje - analiseHoje.clientesOntem}
              sparkValues={sparklines.cli}
              color="hsl(210 90% 60%)"
            />
            <PremiumKPI
              icon={Target}
              label="Ticket Médio"
              value={formatCurrency(analiseHoje.ticketMedioHoje)}
              sub="média por pedido"
              sparkValues={sparklines.tic}
              color="hsl(38 92% 55%)"
            />
          </div>

          {/* Comparativo + Radial */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 relative overflow-hidden border-border/50 bg-card/60">
              <CardHeader className="relative pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Comparativo com Média Diária do Mês
                </CardTitle>
              </CardHeader>
              <CardContent className="relative space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border/40 bg-background/40 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Média (mês)</p>
                    <p className="text-lg font-bold tabular-nums">{formatCurrency(mediaDiaria.media)}</p>
                  </div>
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Hoje</p>
                    <p className="text-lg font-bold tabular-nums text-primary">{formatCurrency(analiseHoje.faturamentoHoje)}</p>
                  </div>
                  <div className={cn(
                    "rounded-lg border p-3 text-center",
                    acimaMedia ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"
                  )}>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Diferença</p>
                    <p className={cn("text-lg font-bold tabular-nums", acimaMedia ? "text-emerald-400" : "text-amber-400")}>
                      {acimaMedia ? '+' : ''}{formatCurrency(analiseHoje.faturamentoHoje - mediaDiaria.media)}
                    </p>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-muted-foreground mb-2">
                    <span className="font-medium">Progresso em relação à média</span>
                    <span className="tabular-nums font-semibold">{progresso.toFixed(0)}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-muted/60 overflow-hidden border border-border/40">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        acimaMedia ? "bg-emerald-500" : "bg-amber-500"
                      )}
                      style={{ width: `${progresso}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {(() => {
              const CAP = 130;
              const fillPct = Math.max(0, Math.min(CAP, progresso));
              const fillHeight = (fillPct / CAP) * 100;
              const zona = progresso >= 110
                ? { label: 'Excelente', text: 'text-cyan-300', bg: 'bg-cyan-500/15', border: 'border-cyan-400/40', dot: 'bg-cyan-400', bar: 'bg-cyan-500' }
                : progresso >= 80
                ? { label: 'Bom', text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-400/40', dot: 'bg-emerald-400', bar: 'bg-emerald-500' }
                : progresso >= 50
                ? { label: 'Atenção', text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-400/40', dot: 'bg-amber-400', bar: 'bg-amber-500' }
                : { label: 'Crítico', text: 'text-red-300', bg: 'bg-red-500/15', border: 'border-red-400/40', dot: 'bg-red-400', bar: 'bg-red-500' };
              const delta = analiseHoje.faturamentoHoje - mediaDiaria.media;
              const marks = [110, 100, 80, 50];
              return (
                <Card className="relative overflow-hidden border-border/50 bg-card/60">
                  <CardHeader className="relative pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="h-5 w-5 text-purple-400" />
                        Atingimento da Média
                      </CardTitle>
                      <span className={cn(
                        'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                        zona.bg, zona.border, zona.text
                      )}>
                        {zona.label}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="flex items-center gap-6 h-[200px]">
                      {/* Termômetro + marcadores (alinhados) */}
                      <div className="relative h-full flex items-stretch gap-2 flex-shrink-0">
                        {/* Coluna do termômetro */}
                        <div className="relative w-10 h-full rounded-full border border-border/50 bg-background/60 overflow-hidden">
                          {/* Zonas de fundo (tênues) — proporcionais ao CAP=130 */}
                          <div className="absolute inset-x-0 bottom-0 h-[38.46%] bg-red-500/10" />
                          <div className="absolute inset-x-0 bottom-[38.46%] h-[23.08%] bg-amber-500/10" />
                          <div className="absolute inset-x-0 bottom-[61.54%] h-[23.08%] bg-emerald-500/10" />
                          <div className="absolute inset-x-0 bottom-[84.62%] h-[15.38%] bg-cyan-500/10" />
                          {/* Preenchimento */}
                          <div
                            className={cn(
                              'absolute inset-x-0 bottom-0 rounded-full transition-[height] duration-1000 ease-out',
                              zona.bar
                            )}
                            style={{ height: `${fillHeight}%` }}
                          />
                          {/* Indicador pulsante */}
                          {fillHeight > 2 && (
                            <div
                              className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
                              style={{ bottom: `${fillHeight}%` }}
                            >
                              <span className="relative flex h-3 w-3">
                                <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', zona.dot)} />
                                <span className={cn('relative inline-flex rounded-full h-3 w-3 border-2 border-background', zona.dot)} />
                              </span>
                            </div>
                          )}
                        </div>
                        {/* Coluna de marcadores — mesma altura da barra */}
                        <div className="relative h-full w-10">
                          {marks.map((m) => (
                            <div
                              key={m}
                              className="absolute left-0 right-0 flex items-center gap-1 -translate-y-1/2"
                              style={{ bottom: `${(m / CAP) * 100}%` }}
                            >
                              <span className="h-px w-2 bg-border/70" />
                              <span className="text-[9px] font-medium text-muted-foreground tabular-nums leading-none">{m}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Leitura */}
                      <div className="flex-1 flex flex-col justify-center min-w-0">
                        <p className={cn('text-4xl font-bold tabular-nums leading-none', zona.text)}>
                          {progresso >= 100 ? '+' : ''}{(progresso - 100).toFixed(0)}%
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5">
                          vs. média diária
                        </p>
                        <div className="mt-4 flex items-center gap-2">
                          <span className={cn('h-2 w-2 rounded-full flex-shrink-0', zona.dot)} />
                          <p className="text-xs text-muted-foreground truncate">
                            {acimaMedia ? 'Acima' : 'Abaixo'}{' '}
                            <span className={cn('font-semibold tabular-nums', acimaMedia ? 'text-emerald-300' : 'text-amber-300')}>
                              {formatCurrency(Math.abs(delta))}
                            </span>
                          </p>
                        </div>
                        <div className="mt-3 pt-3 border-t border-border/40">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Atingido</p>
                          <p className="text-sm font-semibold tabular-nums mt-0.5">{progresso.toFixed(0)}% da média</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>

          {/* Faturamento últimos 14 dias + Vendedores stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="premium-hover-card lg:col-span-2 relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Faturamento · Últimos 14 dias
                </CardTitle>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-primary" /> Dia
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-amber-400" /> Hoje
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-[2px] w-3 bg-emerald-400" /> Média
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {faturamento14Dias.every(d => d.valor === 0) ? (
                  <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                    Sem vendas nos últimos 14 dias
                  </div>
                ) : (
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={faturamento14Dias} margin={{ top: 12, right: 8, left: 8, bottom: 4 }}>
                        <defs>
                          <linearGradient id="grad-14d" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                          </linearGradient>
                          <linearGradient id="grad-14d-hoje" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#fbbf24" stopOpacity={1} />
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.6} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} interval={0} />
                        <YAxis hide />
                        <Tooltip content={<PremiumTooltip />} cursor={{ fill: 'hsl(var(--primary)/0.05)' }} />
                        {mediaDiaria.media > 0 && (
                          <ReferenceLine
                            y={mediaDiaria.media}
                            stroke="hsl(160 84% 50%)"
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                          />
                        )}
                        <Bar dataKey="valor" radius={[8, 8, 0, 0]} maxBarSize={28}>
                          {faturamento14Dias.map((d, i) => (
                            <Cell key={i} fill={d.isHoje ? 'url(#grad-14d-hoje)' : 'url(#grad-14d)'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-lg border border-emerald-500/30 bg-card p-5">
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-5 w-5 text-emerald-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Vendedores Ativos</span>
                  </div>
                  <p className="text-4xl font-bold tabular-nums text-emerald-400">{analiseHoje.vendedoresAtivosHoje}</p>
                  <p className="text-xs text-muted-foreground mt-1">realizaram ao menos 1 venda</p>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-lg border border-amber-500/30 bg-card p-5">
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <UserX className="h-5 w-5 text-amber-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Sem Venda Hoje</span>
                  </div>
                  <p className="text-4xl font-bold tabular-nums text-amber-400">{vendedoresSemVendaHoje.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">ativos no mês, mas sem venda hoje</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ============= VENDEDORES ============= */}
        <TabsContent value="vendedores" className="space-y-6">
          {/* Top vendedor destaque */}
          {topVendedor && (
            <div className="relative overflow-hidden rounded-lg border border-amber-500/30 bg-card p-5">
              <div className="relative flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-lg flex items-center justify-center bg-amber-500/20 border border-amber-500/40">
                    <Trophy className="h-7 w-7 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">🏆 Vendedor do dia</p>
                    <p className="text-xl font-bold tracking-tight">{topVendedor.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {topVendedor.pedidos} pedidos · {topVendedor.clientes} clientes
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold tabular-nums">{formatCurrency(topVendedor.faturamento)}</p>
                  <p className="text-xs text-muted-foreground">
                    {totalFatVendedores > 0 ? ((topVendedor.faturamento / totalFatVendedores) * 100).toFixed(1) : 0}% do total
                  </p>
                </div>
              </div>
            </div>
          )}

          <Card className="border-border/50 bg-card/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Performance Individual Hoje
                </CardTitle>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar vendedor..."
                    className="pl-9 h-9 bg-background/40"
                    value={searchVendedor}
                    onChange={e => setSearchVendedor(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {performanceVendedoresFiltrada.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{searchVendedor ? 'Nenhum vendedor encontrado' : 'Nenhuma venda registrada hoje'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {performanceVendedoresFiltrada.map((v, i) => {
                    const ating = Math.min(150, v.atingimento);
                    const cor = v.atingimento >= 100 ? 'emerald' : v.atingimento >= 70 ? 'amber' : 'red';
                    return (
                      <div
                        key={String(v.codigo)}
                        className="relative overflow-hidden rounded-lg border border-border/40 bg-background/30 transition-colors hover:border-primary/40 hover:bg-background/60"
                      >
                        <div className="p-3 grid grid-cols-12 gap-3 items-center">
                          <div className="col-span-12 md:col-span-4 flex items-center gap-3">
                            <div className={cn(
                              "h-9 w-9 rounded-lg flex items-center justify-center font-bold text-sm tabular-nums shrink-0",
                              i === 0 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                              i === 1 ? "bg-zinc-400/20 text-zinc-300 border border-zinc-400/30" :
                              i === 2 ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                              "bg-muted/40 text-muted-foreground border border-border/40"
                            )}>
                              {i + 1}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{v.nome}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {v.pedidos} pedidos · {v.clientes} clientes
                              </p>
                            </div>
                          </div>
                          <div className="col-span-6 md:col-span-2 text-right">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Faturamento</p>
                            <p className="font-bold tabular-nums">{formatCurrency(v.faturamento)}</p>
                          </div>
                          <div className="col-span-6 md:col-span-2 text-right">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Média diária</p>
                            <p className="text-sm font-medium tabular-nums text-muted-foreground">{formatCurrency(v.mediaDiaria)}</p>
                          </div>
                          <div className="col-span-12 md:col-span-4">
                            <div className="flex items-center justify-between text-[10px] mb-1">
                              <span className="uppercase tracking-wider text-muted-foreground">Atingimento</span>
                              <span className={cn(
                                "font-bold tabular-nums",
                                cor === 'emerald' && "text-emerald-400",
                                cor === 'amber' && "text-amber-400",
                                cor === 'red' && "text-red-400"
                              )}>
                                {v.atingimento.toFixed(0)}%
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-700",
                                  cor === 'emerald' && "bg-emerald-500",
                                  cor === 'amber' && "bg-amber-500",
                                  cor === 'red' && "bg-red-500"
                                )}
                                style={{ width: `${(ating / 150) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {vendedoresSemVendaHoje.length > 0 && (() => {
            const criticos = vendedoresSemVendaHoje.filter(v => v.diasParado >= 7);
            const atencao = vendedoresSemVendaHoje.filter(v => v.diasParado >= 3 && v.diasParado < 7);
            const recentes = vendedoresSemVendaHoje.filter(v => v.diasParado < 3);
            const fatPerdido = vendedoresSemVendaHoje.reduce((a, v) => a + v.fatMes, 0);
            const colunas = [
              { key: 'critico', label: 'Crítico', sub: '7+ dias parado', items: criticos, dot: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-500/5' },
              { key: 'atencao', label: 'Atenção', sub: '3 a 6 dias', items: atencao, dot: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/5' },
              { key: 'recente', label: 'Recente', sub: 'até 2 dias', items: recentes, dot: 'bg-sky-500', text: 'text-sky-400', border: 'border-sky-500/30', bg: 'bg-sky-500/5' },
            ];
            return (
              <Card className="relative overflow-hidden border-border/60 bg-card/40">
                <CardHeader className="pb-4 border-b border-border/40">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <UserX className="h-5 w-5 text-amber-400" />
                        Vendedores parados hoje
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {vendedoresSemVendaHoje.length} vendedores ativos no mês ainda não venderam · {formatCurrency(fatPerdido)} faturados nos últimos dias
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {colunas.map(c => (
                        <div key={c.key} className="flex items-center gap-1.5">
                          <span className={cn("h-2 w-2 rounded-full", c.dot)} />
                          <span className="text-muted-foreground">{c.label}</span>
                          <span className={cn("font-semibold tabular-nums", c.text)}>{c.items.length}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {colunas.map(col => (
                      <div key={col.key} className={cn("rounded-lg border p-3 space-y-2", col.border, col.bg)}>
                        <div className="flex items-center justify-between mb-1 px-1">
                          <div className="flex items-center gap-2">
                            <span className={cn("h-2 w-2 rounded-full", col.dot)} />
                            <span className="text-xs font-semibold uppercase tracking-wider">{col.label}</span>
                          </div>
                          <span className={cn("text-[10px] uppercase tracking-wider", col.text)}>{col.sub}</span>
                        </div>
                        {col.items.length === 0 ? (
                          <div className="text-center text-xs text-muted-foreground py-6 opacity-60">Nenhum</div>
                        ) : (
                          <div className="space-y-1.5 overflow-y-auto pr-1" style={{ maxHeight: '520px', height: col.items.length > 10 ? '520px' : 'auto' }}>
                            {col.items.map(v => {
                              const initials = v.nome.split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
                              return (
                                <div
                                  key={v.codigo}
                                  className="flex items-center gap-2.5 rounded-lg bg-background/40 hover:bg-background/70 border border-border/30 px-2.5 py-2 transition-colors"
                                >
                                  <span className={cn("h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold border", col.border, col.text, "bg-background/60")}>
                                    {initials || '?'}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium truncate leading-tight">{v.nome}</p>
                                    <p className="text-[10px] text-muted-foreground tabular-nums">
                                      {formatCurrency(v.fatMes)} · {v.pedidosMes} ped.
                                    </p>
                                  </div>
                                  <span className={cn("text-[11px] font-bold tabular-nums shrink-0", col.text)}>
                                    {v.diasParado === 999 ? '—' : `${v.diasParado}d`}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>

        {/* ============= ALERTAS ============= */}
        <TabsContent value="alertas" className="space-y-6">
          {/* Banner de status geral */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={cn(
              "relative overflow-hidden rounded-lg border p-5 transition-colors",
              acimaMedia
                ? "border-emerald-500/30 bg-card"
                : "border-red-500/30 bg-card"
            )}>
              <div className="relative flex items-start gap-4">
                <div className={cn(
                  "h-12 w-12 rounded-lg flex items-center justify-center border shrink-0",
                  acimaMedia ? "bg-emerald-500/20 border-emerald-500/40" : "bg-red-500/20 border-red-500/40"
                )}>
                  {acimaMedia ? <TrendingUp className="h-6 w-6 text-emerald-400" /> : <TrendingDown className="h-6 w-6 text-red-400" />}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">
                    {acimaMedia ? 'Faturamento acima da média' : 'Faturamento abaixo da média'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {acimaMedia
                      ? `Superou a média em ${formatCurrency(analiseHoje.faturamentoHoje - mediaDiaria.media)}`
                      : `Faltam ${formatCurrency(mediaDiaria.media - analiseHoje.faturamentoHoje)} para a média diária`}
                  </p>
                </div>
              </div>
            </div>

            <div className={cn(
              "relative overflow-hidden rounded-lg border p-5 transition-colors",
              vendedoresSemVendaHoje.length > 0
                ? "border-amber-500/30 bg-card"
                : "border-emerald-500/30 bg-card"
            )}>
              <div className="relative flex items-start gap-4">
                <div className={cn(
                  "h-12 w-12 rounded-lg flex items-center justify-center border shrink-0",
                  vendedoresSemVendaHoje.length > 0 ? "bg-amber-500/20 border-amber-500/40" : "bg-emerald-500/20 border-emerald-500/40"
                )}>
                  <UserX className={cn("h-6 w-6", vendedoresSemVendaHoje.length > 0 ? "text-amber-400" : "text-emerald-400")} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">
                    {vendedoresSemVendaHoje.length > 0
                      ? `${vendedoresSemVendaHoje.length} vendedor(es) sem venda`
                      : 'Toda equipe vendendo hoje'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {vendedoresSemVendaHoje.length > 0
                      ? 'Considere acionar e dar suporte a estes vendedores'
                      : 'Excelente! Todos estão produzindo'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Card className="relative overflow-hidden border-orange-500/30 bg-card">
            <CardHeader className="relative">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
                Clientes Frequentes Sem Compra Hoje
                {clientesInativosHoje.length > 0 && (
                  <Badge variant="outline" className="ml-auto border-orange-500/40 text-orange-400">
                    {clientesInativosHoje.length}
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Clientes com 3+ compras nos últimos 30 dias que ainda não compraram hoje
              </p>
            </CardHeader>
            <CardContent className="relative">
              {clientesInativosHoje.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-3 text-emerald-400/60" />
                  <p className="font-medium">Todos os clientes frequentes já compraram hoje! 🎯</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {clientesInativosHoje.map((c, i) => (
                    <div
                      key={c.codigo}
                      className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/30 p-3 transition-colors hover:border-orange-500/30 hover:bg-background/60"
                    >
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-orange-500/15 border border-orange-500/30 text-orange-400 font-bold text-xs tabular-nums shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{c.nome}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {c.compras} compras · última em {c.ultimaCompra ? new Date(c.ultimaCompra).toLocaleDateString('pt-BR') : '—'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold tabular-nums text-sm">{formatCurrency(c.valorTotal)}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">30 dias</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
