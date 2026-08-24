import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import {
  Activity, TrendingUp, TrendingDown, Calendar, Users,
  BarChart3, LineChart as LineChartIcon, Target, Sparkles,
  ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, Trophy,
  Clock, Zap, DollarSign, CalendarDays, CalendarRange, MousePointerClick
} from 'lucide-react';
import { formatCurrency, formatPercent, formatCompactNumber, formatInteger } from '@/utils/formatters';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ComposedChart, Cell, Brush, ReferenceLine
} from 'recharts';
import { cn } from '@/lib/utils';
import type { Pedido, Devolucao, VendedorPerformance, EvolucaoDiaria } from '@/types/comercial';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { FaturamentoMensalHero } from './FaturamentoMensalHero';

interface EvolucaoTabProps {
  pedidos: Pedido[];
  devolucoes: Devolucao[];
  vendedoresPerformance: VendedorPerformance[];
  evolucaoDiaria: EvolucaoDiaria[];
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

// ============================================================
// Sparkline minimalista (SVG nativo)
// ============================================================
function Sparkline({ values, color = 'hsl(var(--primary))', height = 28 }: { values: number[]; color?: string; height?: number }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const width = 100;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values
    .map((v, i) => `${i * step},${height - ((v - min) / range) * height}`)
    .join(' ');
  const areaPath = `M0,${height} L${points.split(' ').join(' L')} L${width},${height} Z`;
  const linePath = `M${points.split(' ').join(' L')}`;
  const gradId = `spark-grad-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ============================================================
// Tooltip premium
// ============================================================
function PremiumTooltip({ active, payload, label, isCurrency = true }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl px-3 py-2.5 shadow-2xl shadow-primary/10 animate-in fade-in-0 zoom-in-95 duration-150">
      <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">{label}</p>
      <div className="space-y-1">
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full ring-2 ring-offset-1 ring-offset-card" style={{ backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}` }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-bold tabular-nums">
              {isCurrency && typeof entry.value === 'number' ? formatCurrency(entry.value) : formatInteger(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EvolucaoTabLegacy({ pedidos, devolucoes, vendedoresPerformance, evolucaoDiaria }: EvolucaoTabProps) {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const isEmpresa1001 = codEmpresaAtiva === '1001';
  const [subTab, setSubTab] = useState<'diaria' | 'mensal' | 'vendedor' | 'comparativo'>('diaria');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [drillDate, setDrillDate] = useState<string | null>(null);
  const [filterDayOfWeek, setFilterDayOfWeek] = useState<number | null>(null);
  const [hiddenSellers, setHiddenSellers] = useState<Set<string>>(new Set());
  const [acumuladoMensal, setAcumuladoMensal] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ data: string; vendas: number; devolucoes: number; pedidos: number; dataFormatada: string; diaSemana: string } | null>(null);
  // Mensal
  const [monthDrill, setMonthDrill] = useState<string | null>(null);
  const [hoveredMonth, setHoveredMonth] = useState<any | null>(null);
  // Vendedor
  const [sellerDrill, setSellerDrill] = useState<string | null>(null);
  const [hoveredSeller, setHoveredSeller] = useState<{ nome: string; mes: string; valor: number } | null>(null);
  // Comparativo
  const [weekdayDrill, setWeekdayDrill] = useState<number | null>(null);
  const [halfFocus, setHalfFocus] = useState<'p1' | 'p2' | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  // ----------------- Dados base -----------------
  const dadosEvolucaoDiaria = useMemo(() => {
    return evolucaoDiaria.map(d => {
      const date = new Date(d.data);
      return {
        ...d,
        dataFormatada: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        diaSemana: date.toLocaleDateString('pt-BR', { weekday: 'short' }),
        diaSemanaIdx: date.getDay(),
      };
    });
  }, [evolucaoDiaria]);

  const dadosEvolucaoDiariaFiltrada = useMemo(() => {
    if (filterDayOfWeek === null) return dadosEvolucaoDiaria;
    return dadosEvolucaoDiaria.map(d => ({
      ...d,
      vendas: d.diaSemanaIdx === filterDayOfWeek ? d.vendas : 0,
      devolucoes: d.diaSemanaIdx === filterDayOfWeek ? d.devolucoes : 0,
    }));
  }, [dadosEvolucaoDiaria, filterDayOfWeek]);

  const dadosEvolucaoMensal = useMemo(() => {
    const porMes: Record<string, {
      mesKey: string; mes: string; vendas: number; devolucoes: number;
      pedidos: number; ticketMedio: number; clientes: Set<string | number>;
    }> = {};
    pedidos.forEach(p => {
      const data = new Date(p.data_pedido || p.data_faturamento || '');
      if (isNaN(data.getTime())) return;
      const mesKey = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      const mesLabel = data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      if (!porMes[mesKey]) {
        porMes[mesKey] = { mesKey, mes: mesLabel, vendas: 0, devolucoes: 0, pedidos: 0, ticketMedio: 0, clientes: new Set() };
      }
      if (p.tipo === 'DEVOLUCAO') {
        porMes[mesKey].devolucoes += Math.abs(p.valor_real ?? p.valor_liquido ?? 0);
      } else {
        porMes[mesKey].vendas += Math.abs(p.valor_liquido || 0);
        porMes[mesKey].pedidos += 1;
        porMes[mesKey].clientes.add(p.cliente_codigo);
      }
    });
    devolucoes.forEach(d => {
      const data = new Date(d.data);
      if (isNaN(data.getTime())) return;
      const mesKey = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      if (porMes[mesKey] && porMes[mesKey].devolucoes === 0) {
        porMes[mesKey].devolucoes += Math.abs(d.valor_liquido || 0);
      }
    });
    const ordenados = Object.values(porMes)
      .map(m => ({ ...m, ticketMedio: m.pedidos > 0 ? m.vendas / m.pedidos : 0, qtdClientes: m.clientes.size }))
      .sort((a, b) => a.mesKey.localeCompare(b.mesKey));

    if (acumuladoMensal) {
      let acc = 0; let accDev = 0;
      return ordenados.map(m => {
        acc += m.vendas; accDev += m.devolucoes;
        return { ...m, vendas: acc, devolucoes: accDev };
      });
    }
    return ordenados;
  }, [pedidos, devolucoes, acumuladoMensal]);

  const evolucaoPorVendedor = useMemo(() => {
    const vendedoresMap: Record<string | number, Record<string, number>> = {};
    const todosOsMeses: Set<string> = new Set();
    pedidos.forEach(p => {
      const data = new Date(p.data_pedido || p.data_faturamento || '');
      if (isNaN(data.getTime())) return;
      const mesKey = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      const vendedor = p.vendedor_codigo;
      todosOsMeses.add(mesKey);
      if (!vendedoresMap[vendedor]) vendedoresMap[vendedor] = {};
      if (!vendedoresMap[vendedor][mesKey]) vendedoresMap[vendedor][mesKey] = 0;
      vendedoresMap[vendedor][mesKey] += p.valor_liquido || 0;
    });
    const mesesOrdenados = Array.from(todosOsMeses).sort();
    return vendedoresPerformance.slice(0, 5).map(v => {
      const dadosMensais = mesesOrdenados.map(mesKey => {
        const data = new Date(mesKey + '-01');
        return { mes: data.toLocaleDateString('pt-BR', { month: 'short' }), valor: vendedoresMap[v.codigo]?.[mesKey] || 0 };
      });
      return {
        codigo: v.codigo,
        nome: v.nome.split(' ').slice(0, 2).join(' '),
        dados: dadosMensais,
        totalPeriodo: dadosMensais.reduce((acc, d) => acc + d.valor, 0),
      };
    });
  }, [pedidos, vendedoresPerformance]);

  const dadosGraficoVendedores = useMemo(() => {
    if (evolucaoPorVendedor.length === 0) return [];
    const meses = evolucaoPorVendedor[0]?.dados.map(d => d.mes) || [];
    return meses.map((mes, index) => {
      const ponto: Record<string, string | number> = { mes };
      evolucaoPorVendedor.forEach(v => { ponto[v.nome] = v.dados[index]?.valor || 0; });
      return ponto;
    });
  }, [evolucaoPorVendedor]);

  const analiseDiaSemana = useMemo(() => {
    const diasMap: Record<number, { dia: string; idx: number; vendas: number; devolucoes: number; pedidos: number }> = {
      0: { dia: 'Dom', idx: 0, vendas: 0, devolucoes: 0, pedidos: 0 },
      1: { dia: 'Seg', idx: 1, vendas: 0, devolucoes: 0, pedidos: 0 },
      2: { dia: 'Ter', idx: 2, vendas: 0, devolucoes: 0, pedidos: 0 },
      3: { dia: 'Qua', idx: 3, vendas: 0, devolucoes: 0, pedidos: 0 },
      4: { dia: 'Qui', idx: 4, vendas: 0, devolucoes: 0, pedidos: 0 },
      5: { dia: 'Sex', idx: 5, vendas: 0, devolucoes: 0, pedidos: 0 },
      6: { dia: 'Sáb', idx: 6, vendas: 0, devolucoes: 0, pedidos: 0 },
    };
    pedidos.forEach(p => {
      const data = new Date(p.data_pedido || p.data_faturamento || '');
      if (isNaN(data.getTime())) return;
      const idx = data.getDay();
      if (p.tipo === 'DEVOLUCAO') {
        diasMap[idx].devolucoes += Math.abs(p.valor_real ?? p.valor_liquido ?? 0);
      } else {
        diasMap[idx].vendas += p.valor_liquido || 0;
        diasMap[idx].pedidos += 1;
      }
    });
    const total = Object.values(diasMap).reduce((acc, d) => acc + d.vendas, 0);
    return Object.values(diasMap).map(d => ({
      ...d,
      devolucoesNeg: -d.devolucoes,
      percentual: total > 0 ? (d.vendas / total) * 100 : 0,
    }));
  }, [pedidos]);

  const comparativoPeriodos = useMemo(() => {
    const sorted = [...dadosEvolucaoDiaria].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
    const metade = Math.floor(sorted.length / 2);
    const p1 = sorted.slice(0, metade);
    const p2 = sorted.slice(metade);
    const t1 = p1.reduce((acc, d) => acc + d.vendas, 0);
    const t2 = p2.reduce((acc, d) => acc + d.vendas, 0);
    const variacao = t1 > 0 ? ((t2 - t1) / t1) * 100 : 0;
    return {
      primeiroPeriodo: { total: t1, dias: p1.length, media: p1.length > 0 ? t1 / p1.length : 0 },
      segundoPeriodo: { total: t2, dias: p2.length, media: p2.length > 0 ? t2 / p2.length : 0 },
      variacao,
    };
  }, [dadosEvolucaoDiaria]);

  const kpisEvolucao = useMemo(() => {
    const totalVendas = dadosEvolucaoDiaria.reduce((acc, d) => acc + d.vendas, 0);
    const totalDevolucoes = dadosEvolucaoDiaria.reduce((acc, d) => acc + d.devolucoes, 0);
    const totalPedidos = dadosEvolucaoDiaria.reduce((acc, d) => acc + d.pedidos, 0);
    const mediaDiaria = dadosEvolucaoDiaria.length > 0 ? totalVendas / dadosEvolucaoDiaria.length : 0;
    const melhorDia = Math.max(...dadosEvolucaoDiaria.map(d => d.vendas), 0);
    const piorDia = dadosEvolucaoDiaria.length > 0 ? Math.min(...dadosEvolucaoDiaria.map(d => d.vendas)) : 0;
    const diaComMaiorVenda = dadosEvolucaoDiaria.find(d => d.vendas === melhorDia);
    const diaComMenorVenda = dadosEvolucaoDiaria.find(d => d.vendas === piorDia);
    const ultimos7 = dadosEvolucaoDiaria.slice(-7);
    const anteriores7 = dadosEvolucaoDiaria.slice(-14, -7);
    const mediaUlt = ultimos7.length > 0 ? ultimos7.reduce((a, d) => a + d.vendas, 0) / ultimos7.length : 0;
    const mediaAnt = anteriores7.length > 0 ? anteriores7.reduce((a, d) => a + d.vendas, 0) / anteriores7.length : 0;
    const tendencia = mediaAnt > 0 ? ((mediaUlt - mediaAnt) / mediaAnt) * 100 : 0;
    return {
      totalVendas, totalDevolucoes, totalPedidos, mediaDiaria, melhorDia, piorDia,
      diaComMaiorVenda: diaComMaiorVenda?.data, diaComMenorVenda: diaComMenorVenda?.data,
      diasAnalisados: dadosEvolucaoDiaria.length, tendencia,
      sparkline: dadosEvolucaoDiaria.slice(-14).map(d => d.vendas),
      sparklineDev: dadosEvolucaoDiaria.slice(-14).map(d => d.devolucoes),
      sparklinePed: dadosEvolucaoDiaria.slice(-14).map(d => d.pedidos),
    };
  }, [dadosEvolucaoDiaria]);

  const insights = useMemo(() => {
    const lista: { tipo: 'positivo' | 'negativo' | 'neutro'; titulo: string; descricao: string; action?: () => void }[] = [];
    if (kpisEvolucao.tendencia > 10) {
      lista.push({ tipo: 'positivo', titulo: 'Tendência de Alta', descricao: `Vendas cresceram ${formatPercent(kpisEvolucao.tendencia)} nos últimos 7 dias.` });
    } else if (kpisEvolucao.tendencia < -10) {
      lista.push({ tipo: 'negativo', titulo: 'Tendência de Queda', descricao: `Vendas caíram ${formatPercent(Math.abs(kpisEvolucao.tendencia))} nos últimos 7 dias.` });
    }
    const melhorDS = [...analiseDiaSemana].sort((a, b) => b.vendas - a.vendas)[0];
    if (melhorDS) {
      lista.push({
        tipo: 'neutro',
        titulo: 'Dia Mais Forte',
        descricao: `${melhorDS.dia} concentra ${formatPercent(melhorDS.percentual)} das vendas. Clique para filtrar.`,
        action: () => setFilterDayOfWeek(melhorDS.idx),
      });
    }
    const piorDS = [...analiseDiaSemana].filter(d => d.vendas > 0).sort((a, b) => a.vendas - b.vendas)[0];
    if (piorDS && melhorDS && piorDS.vendas < melhorDS.vendas * 0.5) {
      lista.push({ tipo: 'negativo', titulo: 'Oportunidade', descricao: `${piorDS.dia} vende ${formatPercent(100 - (piorDS.vendas / melhorDS.vendas) * 100)} a menos que ${melhorDS.dia}.` });
    }
    if (comparativoPeriodos.variacao > 15) {
      lista.push({ tipo: 'positivo', titulo: 'Crescimento no Período', descricao: `2ª metade cresceu ${formatPercent(comparativoPeriodos.variacao)} vs 1ª.` });
    }
    if (evolucaoPorVendedor.length > 0) {
      const top = evolucaoPorVendedor[0];
      const ult = top.dados[top.dados.length - 1]?.valor || 0;
      const pri = top.dados[0]?.valor || 0;
      if (ult > pri * 1.2) {
        lista.push({ tipo: 'positivo', titulo: 'Vendedor em Ascensão', descricao: `${top.nome} em forte trajetória de crescimento.` });
      }
    }
    return lista.slice(0, 4);
  }, [kpisEvolucao, analiseDiaSemana, comparativoPeriodos, evolucaoPorVendedor]);

  // ----------------- Handlers -----------------
  const handleSelectDate = useCallback((data: string | undefined) => {
    if (!data) return;
    setSelectedDate(data);
    setTimeout(() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  }, []);

  const handleChartClick = useCallback((e: any) => {
    const point = e?.activePayload?.[0]?.payload;
    if (point?.data) {
      setDrillDate(point.data);
    } else if (hoveredPoint?.data) {
      setDrillDate(hoveredPoint.data);
    }
  }, [hoveredPoint]);

  const handleChartMouseMove = useCallback((e: any) => {
    const point = e?.activePayload?.[0]?.payload;
    if (point?.data) {
      setHoveredPoint(point);
    }
  }, []);

  // Não limpamos no mouseleave: mantemos o último ponto para o usuário
  // poder mover o cursor até o botão "Ver detalhes" sem o botão sumir.
  const handleChartMouseLeave = useCallback(() => {}, []);

  const handleDayOfWeekClick = useCallback((e: any) => {
    const point = e?.activePayload?.[0]?.payload;
    if (point?.idx !== undefined) {
      setFilterDayOfWeek(prev => prev === point.idx ? null : point.idx);
    }
  }, []);

  const toggleSeller = useCallback((nome: string) => {
    setHiddenSellers(prev => {
      const n = new Set(prev);
      n.has(nome) ? n.delete(nome) : n.add(nome);
      return n;
    });
  }, []);

  // Drill data
  const drillData = useMemo(() => {
    if (!drillDate) return null;
    const dia = dadosEvolucaoDiaria.find(d => d.data === drillDate);
    if (!dia) return null;
    const pedidosDia = pedidos.filter(p => {
      const dt = new Date(p.data_pedido || p.data_faturamento || '');
      return !isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === drillDate.slice(0, 10);
    });
    const porVendedor: Record<string, { nome: string; valor: number; pedidos: number }> = {};
    pedidosDia.forEach(p => {
      const k = String(p.vendedor_codigo);
      if (!porVendedor[k]) porVendedor[k] = { nome: p.vendedor_nome || k, valor: 0, pedidos: 0 };
      if (p.tipo !== 'DEVOLUCAO') {
        porVendedor[k].valor += p.valor_liquido || 0;
        porVendedor[k].pedidos += 1;
      }
    });
    const topVend = Object.values(porVendedor).sort((a, b) => b.valor - a.valor).slice(0, 5);
    const ticketMedio = dia.pedidos > 0 ? dia.vendas / dia.pedidos : 0;
    return { dia, topVend, ticketMedio };
  }, [drillDate, dadosEvolucaoDiaria, pedidos]);

  // Drill mensal
  const monthDrillData = useMemo(() => {
    if (!monthDrill) return null;
    const mes = dadosEvolucaoMensal.find(m => m.mesKey === monthDrill);
    if (!mes) return null;
    const idx = dadosEvolucaoMensal.findIndex(m => m.mesKey === monthDrill);
    const prev = idx > 0 ? dadosEvolucaoMensal[idx - 1] : null;
    const mom = prev && prev.vendas > 0 ? ((mes.vendas - prev.vendas) / prev.vendas) * 100 : 0;
    const pedidosMes = pedidos.filter(p => {
      const dt = new Date(p.data_pedido || p.data_faturamento || '');
      if (isNaN(dt.getTime())) return false;
      const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      return k === monthDrill;
    });
    const porVendedor: Record<string, { nome: string; valor: number; pedidos: number }> = {};
    pedidosMes.forEach(p => {
      const k = String(p.vendedor_codigo);
      if (!porVendedor[k]) porVendedor[k] = { nome: p.vendedor_nome || k, valor: 0, pedidos: 0 };
      if (p.tipo !== 'DEVOLUCAO') {
        porVendedor[k].valor += p.valor_liquido || 0;
        porVendedor[k].pedidos += 1;
      }
    });
    const topVend = Object.values(porVendedor).sort((a, b) => b.valor - a.valor).slice(0, 5);
    return { mes, mom, topVend, prev };
  }, [monthDrill, dadosEvolucaoMensal, pedidos]);

  // Drill vendedor
  const sellerDrillData = useMemo(() => {
    if (!sellerDrill) return null;
    const v = evolucaoPorVendedor.find(x => x.nome === sellerDrill);
    if (!v) return null;
    const valores = v.dados.map(d => d.valor);
    const max = Math.max(...valores, 0);
    const min = Math.min(...valores.filter(x => x > 0), 0);
    const melhorMes = v.dados.find(d => d.valor === max);
    const piorMes = v.dados.find(d => d.valor === min);
    const ult = valores[valores.length - 1] || 0;
    const pri = valores[0] || 0;
    const crescimento = pri > 0 ? ((ult - pri) / pri) * 100 : 0;
    const media = valores.length > 0 ? v.totalPeriodo / valores.length : 0;
    return { v, melhorMes, piorMes, crescimento, media, max };
  }, [sellerDrill, evolucaoPorVendedor]);

  // Drill dia da semana
  const weekdayDrillData = useMemo(() => {
    if (weekdayDrill === null) return null;
    const dia = analiseDiaSemana[weekdayDrill];
    if (!dia) return null;
    const ocorrencias = dadosEvolucaoDiaria.filter(d => d.diaSemanaIdx === weekdayDrill);
    const melhor = [...ocorrencias].sort((a, b) => b.vendas - a.vendas)[0];
    const media = ocorrencias.length > 0 ? dia.vendas / ocorrencias.length : 0;
    return { dia, ocorrencias, melhor, media };
  }, [weekdayDrill, analiseDiaSemana, dadosEvolucaoDiaria]);

  // Handlers de chart
  const handleMonthChartClick = useCallback((e: any) => {
    const point = e?.activePayload?.[0]?.payload;
    if (point?.mesKey) setMonthDrill(point.mesKey);
    else if (hoveredMonth?.mesKey) setMonthDrill(hoveredMonth.mesKey);
  }, [hoveredMonth]);
  const handleMonthChartMouseMove = useCallback((e: any) => {
    const point = e?.activePayload?.[0]?.payload;
    if (point?.mesKey) setHoveredMonth(point);
  }, []);

  const handleSellerChartMouseMove = useCallback((e: any) => {
    const payload = e?.activePayload;
    const label = e?.activeLabel;
    if (!payload?.length || !label) return;
    const visible = payload.filter((p: any) => !hiddenSellers.has(p.name) && p.value > 0).sort((a: any, b: any) => b.value - a.value)[0];
    if (visible) setHoveredSeller({ nome: visible.name, mes: label, valor: visible.value });
  }, [hiddenSellers]);

  const soloOnly = useCallback((nome: string) => {
    setHiddenSellers(() => new Set(evolucaoPorVendedor.filter(v => v.nome !== nome).map(v => v.nome)));
  }, [evolucaoPorVendedor]);
  const showAllSellers = useCallback(() => setHiddenSellers(new Set()), []);

  const mediaParaLine = kpisEvolucao.mediaDiaria;
  const totalDayOfWeekMax = useMemo(() => Math.max(...analiseDiaSemana.map(d => d.vendas), 1), [analiseDiaSemana]);
  const todayIdx = new Date().getDay();

  return (
    <div className="space-y-6">
      {/* ============== KPIs Premium ============== */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total */}
        <Card className="group relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20 cursor-default animate-in fade-in-0 slide-in-from-bottom-2">
          <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl group-hover:bg-primary/20 transition-colors" />
          <CardContent className="relative p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center ring-1 ring-primary/20">
                <DollarSign className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Total Período</span>
            </div>
            <p className="text-xl font-bold tabular-nums">{formatCurrency(kpisEvolucao.totalVendas)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{kpisEvolucao.diasAnalisados} dias analisados</p>
            <div className="mt-2 -mx-1">
              <Sparkline values={kpisEvolucao.sparkline} color="hsl(var(--primary))" />
            </div>
          </CardContent>
        </Card>

        {/* Média */}
        <Card className="group relative overflow-hidden border-border/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-chart-2/40 cursor-default animate-in fade-in-0 slide-in-from-bottom-2 [animation-delay:60ms]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-chart-2/15 flex items-center justify-center ring-1 ring-chart-2/20">
                <Clock className="h-3.5 w-3.5 text-chart-2" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Média Diária</span>
            </div>
            <p className="text-xl font-bold tabular-nums">{formatCurrency(kpisEvolucao.mediaDiaria)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{formatInteger(kpisEvolucao.totalPedidos)} pedidos</p>
            <div className="mt-2 -mx-1">
              <Sparkline values={kpisEvolucao.sparklinePed} color="hsl(var(--chart-2))" />
            </div>
          </CardContent>
        </Card>

        {/* Melhor */}
        <button
          type="button"
          onClick={() => handleSelectDate(kpisEvolucao.diaComMaiorVenda)}
          className="text-left"
          aria-label="Selecionar melhor dia"
        >
          <Card className="group relative overflow-hidden border-success/30 bg-gradient-to-br from-success/10 via-success/5 to-transparent backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-success/20 cursor-pointer animate-in fade-in-0 slide-in-from-bottom-2 [animation-delay:120ms]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-success/15 flex items-center justify-center ring-1 ring-success/20">
                    <Trophy className="h-3.5 w-3.5 text-success" />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">Melhor Dia</span>
                </div>
                <MousePointerClick className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-xl font-bold text-success tabular-nums">{formatCurrency(kpisEvolucao.melhorDia)}</p>
              {kpisEvolucao.diaComMaiorVenda && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(kpisEvolucao.diaComMaiorVenda).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </p>
              )}
              <div className="mt-2 -mx-1">
                <Sparkline values={kpisEvolucao.sparkline} color="hsl(var(--success))" />
              </div>
            </CardContent>
          </Card>
        </button>

        {/* Pior */}
        <button
          type="button"
          onClick={() => handleSelectDate(kpisEvolucao.diaComMenorVenda)}
          className="text-left"
          aria-label="Selecionar pior dia"
        >
          <Card className="group relative overflow-hidden border-destructive/30 bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-destructive/20 cursor-pointer animate-in fade-in-0 slide-in-from-bottom-2 [animation-delay:180ms]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-destructive/15 flex items-center justify-center ring-1 ring-destructive/20">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">Pior Dia</span>
                </div>
                <MousePointerClick className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-xl font-bold text-destructive tabular-nums">{formatCurrency(kpisEvolucao.piorDia)}</p>
              {kpisEvolucao.diaComMenorVenda && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(kpisEvolucao.diaComMenorVenda).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </p>
              )}
              <div className="mt-2 -mx-1">
                <Sparkline values={kpisEvolucao.sparklineDev} color="hsl(var(--destructive))" />
              </div>
            </CardContent>
          </Card>
        </button>

        {/* Tendência */}
        <Card className={cn(
          "group relative overflow-hidden backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-default animate-in fade-in-0 slide-in-from-bottom-2 [animation-delay:240ms]",
          kpisEvolucao.tendencia > 0 && "border-success/30 bg-gradient-to-br from-success/10 to-transparent hover:shadow-success/20",
          kpisEvolucao.tendencia < 0 && "border-destructive/30 bg-gradient-to-br from-destructive/10 to-transparent hover:shadow-destructive/20",
          kpisEvolucao.tendencia === 0 && "border-border/50",
        )}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                "h-7 w-7 rounded-lg flex items-center justify-center ring-1",
                kpisEvolucao.tendencia > 0 && "bg-success/15 ring-success/20",
                kpisEvolucao.tendencia < 0 && "bg-destructive/15 ring-destructive/20",
                kpisEvolucao.tendencia === 0 && "bg-muted/30 ring-border/30",
              )}>
                {kpisEvolucao.tendencia > 0 ? <TrendingUp className="h-3.5 w-3.5 text-success animate-pulse" />
                  : kpisEvolucao.tendencia < 0 ? <TrendingDown className="h-3.5 w-3.5 text-destructive animate-pulse" />
                  : <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
              <span className="text-xs text-muted-foreground font-medium">Tendência 7d</span>
            </div>
            <p className={cn(
              "text-xl font-bold tabular-nums",
              kpisEvolucao.tendencia > 0 && "text-success",
              kpisEvolucao.tendencia < 0 && "text-destructive",
            )}>
              {kpisEvolucao.tendencia > 0 ? '+' : ''}{formatPercent(kpisEvolucao.tendencia)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">vs 7 dias anteriores</p>
            <div className="mt-2 -mx-1">
              <Sparkline values={kpisEvolucao.sparkline.slice(-7)} color={kpisEvolucao.tendencia >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============== Insights interativos ============== */}
      {insights.length > 0 && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/8 via-primary/3 to-transparent backdrop-blur-sm overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.08),transparent_50%)] pointer-events-none" />
          <CardHeader className="pb-3 relative">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              Insights Automáticos
              {filterDayOfWeek !== null && (
                <Badge variant="outline" className="ml-2 cursor-pointer border-primary/40 text-primary" onClick={() => setFilterDayOfWeek(null)}>
                  Filtro: {analiseDiaSemana[filterDayOfWeek].dia} ✕
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {insights.map((insight, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={insight.action}
                  disabled={!insight.action}
                  className={cn(
                    "text-left p-3 rounded-xl border transition-all duration-300 group",
                    insight.action ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg" : "cursor-default",
                    insight.tipo === 'positivo' && "bg-success/8 border-success/30 hover:bg-success/12 hover:border-success/50 hover:shadow-success/20",
                    insight.tipo === 'negativo' && "bg-destructive/8 border-destructive/30 hover:bg-destructive/12 hover:border-destructive/50 hover:shadow-destructive/20",
                    insight.tipo === 'neutro' && "bg-primary/8 border-primary/30 hover:bg-primary/12 hover:border-primary/50 hover:shadow-primary/20",
                    "animate-in fade-in-0 slide-in-from-left-2",
                  )}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="flex items-start gap-2">
                    <div className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                      insight.tipo === 'positivo' && "bg-success/15",
                      insight.tipo === 'negativo' && "bg-destructive/15",
                      insight.tipo === 'neutro' && "bg-primary/15",
                    )}>
                      {insight.tipo === 'positivo' && <ArrowUpRight className="h-4 w-4 text-success" />}
                      {insight.tipo === 'negativo' && <ArrowDownRight className="h-4 w-4 text-destructive" />}
                      {insight.tipo === 'neutro' && <Zap className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-xs">{insight.titulo}</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{insight.descricao}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============== Sub-tabs ============== */}
      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as typeof subTab)}>
        <TabsList className="grid w-full grid-cols-4 bg-muted/40 backdrop-blur-sm border border-border/50 p-1 h-auto">
          <TabsTrigger value="diaria" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:shadow-primary/10 transition-all">
            <CalendarDays className="h-3.5 w-3.5 hidden sm:inline" /> Diária
          </TabsTrigger>
          <TabsTrigger value="mensal" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:shadow-primary/10 transition-all">
            <CalendarRange className="h-3.5 w-3.5 hidden sm:inline" /> Mensal
          </TabsTrigger>
          <TabsTrigger value="vendedor" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:shadow-primary/10 transition-all">
            <Users className="h-3.5 w-3.5 hidden sm:inline" /> Por Vendedor
          </TabsTrigger>
          <TabsTrigger value="comparativo" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:shadow-primary/10 transition-all">
            <BarChart3 className="h-3.5 w-3.5 hidden sm:inline" /> Comparativo
          </TabsTrigger>
        </TabsList>

        {/* ============== DIÁRIA ============== */}
        <TabsContent value="diaria" className="mt-6 space-y-6 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico principal */}
            <Card className="lg:col-span-2 border-border/50 backdrop-blur-sm overflow-hidden">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Vendas x Devoluções por Dia
                  </CardTitle>
                  <CardDescription className="text-[11px] mt-0.5 flex items-center gap-1.5">
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    Passe o mouse para ver detalhes · clique em qualquer dia para drill-down
                  </CardDescription>
                </div>
                {filterDayOfWeek !== null && (
                  <Badge variant="outline" className="cursor-pointer border-primary/40 text-primary" onClick={() => setFilterDayOfWeek(null)}>
                    {analiseDiaSemana[filterDayOfWeek].dia} ✕
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                {/* Barra de ação flutuante (hover live) */}
                <div className={cn(
                  "relative mb-3 rounded-xl border transition-all duration-200 overflow-hidden",
                  hoveredPoint
                    ? "border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-md shadow-primary/10"
                    : "border-dashed border-border/40 bg-muted/20"
                )}>
                  <div className="px-3 py-2 flex items-center justify-between gap-3">
                    {hoveredPoint ? (
                      <>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center ring-1 ring-primary/30 shrink-0">
                            <CalendarDays className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold capitalize">
                              {hoveredPoint.diaSemana}, {hoveredPoint.dataFormatada}
                            </p>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                Vendas: <strong className="text-foreground tabular-nums">{formatCurrency(hoveredPoint.vendas, true)}</strong>
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                                Devol.: <strong className="text-foreground tabular-nums">{formatCurrency(hoveredPoint.devolucoes, true)}</strong>
                              </span>
                              <span className="hidden sm:inline">{hoveredPoint.pedidos} ped.</span>
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1.5 shrink-0 shadow-md shadow-primary/20"
                          onClick={() => setDrillDate(hoveredPoint.data)}
                        >
                          <MousePointerClick className="h-3 w-3" />
                          Ver detalhes
                        </Button>
                      </>
                    ) : (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-2 py-1">
                        <MousePointerClick className="h-3.5 w-3.5 opacity-60" />
                        Passe o mouse sobre o gráfico para ver os valores · clique para abrir os detalhes do dia
                      </p>
                    )}
                  </div>
                </div>
                <div className="h-[320px] cursor-pointer">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={dadosEvolucaoDiariaFiltrada}
                      onClick={handleChartClick}
                      onMouseMove={handleChartMouseMove}
                      onMouseLeave={handleChartMouseLeave}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="evolVendasGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="evolDevGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                      <XAxis dataKey="dataFormatada" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tickFormatter={(v) => formatCompactNumber(v)} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        content={<PremiumTooltip />}
                        cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '4 4', strokeOpacity: 0.7 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <ReferenceLine y={mediaParaLine} stroke="hsl(var(--primary))" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: 'Média', fontSize: 9, fill: 'hsl(var(--primary))', position: 'right' }} />
                      <Area type="monotone" dataKey="vendas" name="Vendas" stroke="hsl(var(--primary))" fill="url(#evolVendasGrad)" strokeWidth={2.5} activeDot={{ r: 7, strokeWidth: 2, stroke: 'hsl(var(--background))', cursor: 'pointer', onClick: () => hoveredPoint && setDrillDate(hoveredPoint.data) }} />
                      <Area type="monotone" dataKey="devolucoes" name="Devoluções" stroke="hsl(var(--destructive))" fill="url(#evolDevGrad)" strokeWidth={2} activeDot={{ r: 6, strokeWidth: 2, stroke: 'hsl(var(--background))', cursor: 'pointer', onClick: () => hoveredPoint && setDrillDate(hoveredPoint.data) }} />
                      {dadosEvolucaoDiaria.length > 14 && (
                        <Brush dataKey="dataFormatada" height={22} stroke="hsl(var(--primary))" fill="hsl(var(--muted)/0.3)" travellerWidth={8} />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Dia da semana - diverging interativo */}
            <Card className="border-border/50 backdrop-blur-sm overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-chart-2" />
                  Por Dia da Semana
                </CardTitle>
                <CardDescription className="text-[11px] mt-0.5">Clique para filtrar o gráfico ao lado</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {analiseDiaSemana.map((dia) => {
                    const isToday = dia.idx === todayIdx;
                    const isSelected = filterDayOfWeek === dia.idx;
                    const isDimmed = filterDayOfWeek !== null && !isSelected;
                    const isMax = dia.vendas === totalDayOfWeekMax && dia.vendas > 0;
                    const widthPct = (dia.vendas / totalDayOfWeekMax) * 100;
                    return (
                      <button
                        key={dia.idx}
                        type="button"
                        onClick={() => setFilterDayOfWeek(prev => prev === dia.idx ? null : dia.idx)}
                        className={cn(
                          "w-full text-left transition-all duration-300 rounded-lg p-2 -mx-2 group",
                          isSelected && "bg-primary/10 ring-1 ring-primary/40",
                          isDimmed && "opacity-40",
                          !isDimmed && !isSelected && "hover:bg-muted/40",
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-xs font-semibold w-8", isMax && "text-primary", isToday && "text-amber-500")}>
                              {dia.dia}
                            </span>
                            {isToday && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse ring-2 ring-amber-500/30" />}
                            {isMax && <Trophy className="h-3 w-3 text-amber-500" />}
                          </div>
                          <span className="text-[11px] font-bold tabular-nums">{formatCurrency(dia.vendas, true)}</span>
                        </div>
                        <div className="relative h-2 rounded-full bg-muted/40 overflow-hidden">
                          <div
                            className={cn(
                              "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                              isMax ? "bg-gradient-to-r from-primary to-primary/70" : "bg-gradient-to-r from-chart-2 to-chart-2/60",
                              isSelected && "shadow-[0_0_12px] shadow-primary/40",
                            )}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                          <span>{dia.pedidos} ped.</span>
                          <span>{formatPercent(dia.percentual)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detalhamento Diário interativo */}
          <Card ref={detailsRef} className="border-border/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Detalhamento Diário</CardTitle>
                <CardDescription className="text-[11px] mt-0.5">Últimos 14 dias · clique para detalhes</CardDescription>
              </div>
              {selectedDate && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedDate(null)}>
                  Limpar seleção
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {dadosEvolucaoDiaria.slice(-14).map((dia, i) => {
                  const isTop = dia.vendas === kpisEvolucao.melhorDia && dia.vendas > 0;
                  const isLow = dia.vendas === kpisEvolucao.piorDia;
                  const isSelected = selectedDate === dia.data;
                  const ratio = kpisEvolucao.melhorDia > 0 ? (dia.vendas / kpisEvolucao.melhorDia) * 100 : 0;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setSelectedDate(dia.data); setDrillDate(dia.data); }}
                      className={cn(
                        "relative p-3 rounded-xl border text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer group overflow-hidden",
                        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-xl shadow-primary/30 scale-[1.02]",
                        isTop && !isSelected && "border-success/40 bg-success/5 hover:shadow-success/30",
                        isLow && !isSelected && "border-destructive/40 bg-destructive/5 hover:shadow-destructive/30",
                        !isTop && !isLow && !isSelected && "border-border/50 bg-card hover:border-primary/30 hover:shadow-primary/20",
                        "animate-in fade-in-0 zoom-in-95",
                      )}
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      <p className="text-[10px] text-muted-foreground capitalize">{dia.diaSemana}</p>
                      <p className="text-xs font-semibold">{dia.dataFormatada}</p>
                      <p className={cn(
                        "text-sm font-bold mt-1 tabular-nums",
                        isTop && "text-success",
                        isLow && dia.vendas <= 0 && "text-destructive",
                      )}>
                        {dia.vendas > 0 ? '+' : ''}{formatCurrency(dia.vendas, true)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{dia.pedidos} ped.</p>
                      {/* Sparkbar embaixo */}
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/30">
                        <div
                          className={cn(
                            "h-full transition-all duration-700",
                            isTop ? "bg-success" : isLow ? "bg-destructive" : "bg-primary",
                          )}
                          style={{ width: `${Math.max(0, Math.min(100, ratio))}%` }}
                        />
                      </div>
                      {isTop && (
                        <div className="absolute top-1 right-1">
                          <Trophy className="h-3 w-3 text-amber-500" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============== MENSAL ============== */}
        <TabsContent value="mensal" className="mt-6 space-y-6 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
          {isEmpresa1001 && (
            <FaturamentoMensalHero
              dadosEvolucaoMensal={dadosEvolucaoMensal}
              acumuladoMensal={acumuladoMensal}
              setAcumuladoMensal={setAcumuladoMensal}
              onSelectMonth={(k) => setMonthDrill(k)}
              hoveredMonth={hoveredMonth}
              setHoveredMonth={setHoveredMonth}
            />
          )}
          {!isEmpresa1001 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-border/50 backdrop-blur-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Faturamento Mensal {acumuladoMensal && <Badge variant="outline" className="ml-1 text-[10px]">Acumulado</Badge>}
                </CardTitle>
                <Toggle
                  size="sm"
                  pressed={acumuladoMensal}
                  onPressedChange={setAcumuladoMensal}
                  className="h-7 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {acumuladoMensal ? 'Acumulado' : 'Mensal'}
                </Toggle>
              </CardHeader>
              <CardContent>
                <div className={cn(
                  "relative mb-3 rounded-xl border transition-all duration-200 overflow-hidden",
                  hoveredMonth
                    ? "border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-md shadow-primary/10"
                    : "border-dashed border-border/40 bg-muted/20"
                )}>
                  <div className="px-3 py-2 flex items-center justify-between gap-3">
                    {hoveredMonth ? (
                      <>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center ring-1 ring-primary/30 shrink-0">
                            <CalendarRange className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold capitalize">{hoveredMonth.mes}</p>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Vendas: <strong className="text-foreground tabular-nums">{formatCurrency(hoveredMonth.vendas, true)}</strong></span>
                              <span className="hidden sm:flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-destructive" /> Devol.: <strong className="text-foreground tabular-nums">{formatCurrency(hoveredMonth.devolucoes, true)}</strong></span>
                              <span className="hidden md:inline">{hoveredMonth.pedidos} pedidos · {hoveredMonth.qtdClientes} clientes</span>
                            </div>
                          </div>
                        </div>
                        <Button size="sm" className="h-7 text-xs gap-1.5 shrink-0 shadow-md shadow-primary/20" onClick={() => setMonthDrill(hoveredMonth.mesKey)}>
                          <MousePointerClick className="h-3 w-3" />
                          Ver mês
                        </Button>
                      </>
                    ) : (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-2 py-1">
                        <MousePointerClick className="h-3.5 w-3.5 opacity-60" />
                        Passe o mouse sobre as barras · clique para abrir o detalhamento mensal
                      </p>
                    )}
                  </div>
                </div>
                <div className="h-[360px] cursor-pointer">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={dadosEvolucaoMensal}
                      onClick={handleMonthChartClick}
                      onMouseMove={handleMonthChartMouseMove}
                    >
                      <defs>
                        <linearGradient id="mensalGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        </linearGradient>
                        <linearGradient id="mensalGradActive" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tickFormatter={(v) => formatCompactNumber(v)} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip content={<PremiumTooltip />} cursor={{ fill: 'hsl(var(--primary)/0.08)' }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="vendas" name="Vendas" radius={[6, 6, 0, 0]} onClick={(d: any) => d?.mesKey && setMonthDrill(d.mesKey)}>
                        {dadosEvolucaoMensal.map((m, i) => (
                          <Cell key={i} fill={hoveredMonth?.mesKey === m.mesKey ? 'url(#mensalGradActive)' : 'url(#mensalGrad)'} style={{ filter: hoveredMonth?.mesKey === m.mesKey ? 'drop-shadow(0 0 8px hsl(var(--primary)/0.5))' : undefined }} />
                        ))}
                      </Bar>
                      <Bar dataKey="devolucoes" name="Devoluções" fill="hsl(var(--destructive))" fillOpacity={0.7} radius={[6, 6, 0, 0]} onClick={(d: any) => d?.mesKey && setMonthDrill(d.mesKey)} />
                      <Line type="monotone" dataKey="ticketMedio" name="Ticket Médio" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6, cursor: 'pointer' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarRange className="h-4 w-4 text-primary" />
                  Resumo por Mês
                </CardTitle>
                <CardDescription className="text-[10px]">Clique para abrir o mês</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {dadosEvolucaoMensal.slice(-6).reverse().map((mes, i) => {
                  const maxVendas = Math.max(...dadosEvolucaoMensal.map(m => m.vendas), 1);
                  const progresso = (mes.vendas / maxVendas) * 100;
                  const idxOriginal = dadosEvolucaoMensal.findIndex(m => m.mesKey === mes.mesKey);
                  const prev = idxOriginal > 0 ? dadosEvolucaoMensal[idxOriginal - 1] : null;
                  const mom = prev && prev.vendas > 0 ? ((mes.vendas - prev.vendas) / prev.vendas) * 100 : 0;
                  const isActive = monthDrill === mes.mesKey || hoveredMonth?.mesKey === mes.mesKey;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setMonthDrill(mes.mesKey)}
                      onMouseEnter={() => setHoveredMonth(mes)}
                      className={cn(
                        "w-full text-left space-y-1 rounded-lg p-2 transition-all duration-200",
                        isActive ? "bg-primary/10 ring-1 ring-primary/40 shadow-md shadow-primary/10" : "hover:bg-muted/40",
                      )}
                    >
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-semibold capitalize flex items-center gap-1.5">
                          {mes.mes}
                          {prev && (
                            <Badge variant="outline" className={cn(
                              "h-4 px-1 text-[9px] gap-0.5 border-0",
                              mom > 0 ? "bg-success/15 text-success" : mom < 0 ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground",
                            )}>
                              {mom > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : mom < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
                              {mom > 0 ? '+' : ''}{formatPercent(mom)}
                            </Badge>
                          )}
                        </span>
                        <span className="text-foreground font-bold tabular-nums text-xs">{formatCurrency(mes.vendas, true)}</span>
                      </div>
                      <div className="relative h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <div className={cn(
                          "absolute inset-y-0 left-0 rounded-full transition-all duration-700",
                          isActive ? "bg-gradient-to-r from-primary via-primary/80 to-primary/60 shadow-[0_0_10px] shadow-primary/50" : "bg-gradient-to-r from-primary to-primary/60",
                        )} style={{ width: `${progresso}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{mes.pedidos} pedidos</span>
                        <span>{mes.qtdClientes} clientes</span>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-chart-3" />
                  Evolução do Ticket Médio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] cursor-pointer">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dadosEvolucaoMensal} onClick={handleMonthChartClick} onMouseMove={handleMonthChartMouseMove}>
                      <defs>
                        <linearGradient id="ticketGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tickFormatter={(v) => formatCompactNumber(v)} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip content={<PremiumTooltip />} cursor={{ stroke: 'hsl(var(--chart-3))', strokeWidth: 2, strokeDasharray: '4 4', strokeOpacity: 0.6 }} />
                      <Area type="monotone" dataKey="ticketMedio" name="Ticket Médio" stroke="hsl(var(--chart-3))" fill="url(#ticketGrad)" strokeWidth={2.5} activeDot={{ r: 6, cursor: 'pointer', onClick: () => hoveredMonth?.mesKey && setMonthDrill(hoveredMonth.mesKey) }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-chart-4" />
                  Clientes Ativos por Mês
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] cursor-pointer">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dadosEvolucaoMensal} onClick={handleMonthChartClick} onMouseMove={handleMonthChartMouseMove}>
                      <defs>
                        <linearGradient id="clientesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--chart-4))" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="hsl(var(--chart-4))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip content={<PremiumTooltip isCurrency={false} />} cursor={{ stroke: 'hsl(var(--chart-4))', strokeWidth: 2, strokeDasharray: '4 4', strokeOpacity: 0.6 }} />
                      <Area type="monotone" dataKey="qtdClientes" name="Clientes" stroke="hsl(var(--chart-4))" fill="url(#clientesGrad)" strokeWidth={2.5} activeDot={{ r: 6, cursor: 'pointer', onClick: () => hoveredMonth?.mesKey && setMonthDrill(hoveredMonth.mesKey) }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============== POR VENDEDOR ============== */}
        <TabsContent value="vendedor" className="mt-6 space-y-6 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
          <Card className="border-border/50 backdrop-blur-sm">
            <CardHeader className="pb-2 flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Top 5 Vendedores - Evolução Mensal
                </CardTitle>
                <CardDescription>Clique no card para ocultar · botão "Solo" isola · clique no nome para ver detalhes</CardDescription>
              </div>
              {hiddenSellers.size > 0 && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={showAllSellers}>
                  <Sparkles className="h-3 w-3" /> Mostrar todos
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className={cn(
                "relative mb-3 rounded-xl border transition-all duration-200 overflow-hidden",
                hoveredSeller
                  ? "border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-md shadow-primary/10"
                  : "border-dashed border-border/40 bg-muted/20",
              )}>
                <div className="px-3 py-2 flex items-center justify-between gap-3">
                  {hoveredSeller ? (
                    <>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center ring-1 ring-primary/30 shrink-0">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold capitalize truncate">{hoveredSeller.nome}</p>
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                            <span>{hoveredSeller.mes}</span>
                            <span>Vendas: <strong className="text-foreground tabular-nums">{formatCurrency(hoveredSeller.valor, true)}</strong></span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => soloOnly(hoveredSeller.nome)}>
                          <Zap className="h-3 w-3" /> Solo
                        </Button>
                        <Button size="sm" className="h-7 text-xs gap-1.5 shadow-md shadow-primary/20" onClick={() => setSellerDrill(hoveredSeller.nome)}>
                          <MousePointerClick className="h-3 w-3" /> Detalhes
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-2 py-1">
                      <MousePointerClick className="h-3.5 w-3.5 opacity-60" />
                      Passe o mouse no gráfico para focar um vendedor · use Solo para isolar
                    </p>
                  )}
                </div>
              </div>
              <div className="h-[400px] cursor-pointer">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dadosGraficoVendedores} onMouseMove={handleSellerChartMouseMove}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tickFormatter={(v) => formatCompactNumber(v)} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip content={<PremiumTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '4 4', strokeOpacity: 0.6 }} />
                    <Legend wrapperStyle={{ fontSize: 11, cursor: 'pointer' }} onClick={(e: any) => e?.value && toggleSeller(e.value)} />
                    {evolucaoPorVendedor.map((v, i) => {
                      const isHidden = hiddenSellers.has(v.nome);
                      const isFocused = hoveredSeller?.nome === v.nome;
                      return (
                        <Line
                          key={v.codigo}
                          type="monotone"
                          dataKey={v.nome}
                          stroke={CHART_COLORS[i % CHART_COLORS.length]}
                          strokeWidth={isHidden ? 0 : isFocused ? 4 : 2.5}
                          strokeOpacity={isHidden ? 0 : (hoveredSeller && !isFocused ? 0.25 : 1)}
                          dot={{ r: isFocused ? 4 : 3 }}
                          activeDot={{ r: 7, cursor: 'pointer', onClick: () => setSellerDrill(v.nome) }}
                          style={isFocused ? { filter: `drop-shadow(0 0 8px ${CHART_COLORS[i % CHART_COLORS.length]})` } : undefined}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {evolucaoPorVendedor.map((v, i) => {
              const ultimoValor = v.dados[v.dados.length - 1]?.valor || 0;
              const primeiroValor = v.dados[0]?.valor || 0;
              const crescimento = primeiroValor > 0 ? ((ultimoValor - primeiroValor) / primeiroValor) * 100 : 0;
              const isHidden = hiddenSellers.has(v.nome);
              const isFocused = hoveredSeller?.nome === v.nome;
              const color = CHART_COLORS[i % CHART_COLORS.length];
              return (
                <div
                  key={v.codigo}
                  onMouseEnter={() => setHoveredSeller({ nome: v.nome, mes: v.dados[v.dados.length - 1]?.mes || '', valor: ultimoValor })}
                  className={cn("transition-all duration-300", isHidden && "opacity-40")}
                >
                  <Card className={cn(
                    "relative overflow-hidden border-border/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
                    !isHidden && "hover:shadow-primary/20",
                    isFocused && "ring-2 ring-primary/50 shadow-xl",
                  )}>
                    <div
                      className="absolute top-0 left-0 h-full transition-all"
                      style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}`, width: isFocused ? 3 : 4 }}
                    />
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => setSellerDrill(v.nome)}
                          className="flex items-center gap-2 min-w-0 hover:text-primary transition-colors text-left"
                        >
                          <Badge variant="secondary" className="text-xs shrink-0">#{i + 1}</Badge>
                          <span className="text-sm font-semibold truncate">{v.nome}</span>
                        </button>
                      </div>
                      <p className="text-lg font-bold tabular-nums">{formatCurrency(v.totalPeriodo)}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {crescimento > 0 ? <TrendingUp className="h-3 w-3 text-success" /> : crescimento < 0 ? <TrendingDown className="h-3 w-3 text-destructive" /> : <Minus className="h-3 w-3 text-muted-foreground" />}
                        <span className={cn("text-xs font-medium", crescimento > 0 ? "text-success" : crescimento < 0 ? "text-destructive" : "text-muted-foreground")}>
                          {crescimento > 0 ? '+' : ''}{formatPercent(crescimento)}
                        </span>
                      </div>
                      <div className="mt-2 -mx-1">
                        <Sparkline values={v.dados.map(d => d.valor)} color={color} height={24} />
                      </div>
                      <div className="mt-3 flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant={isHidden ? "outline" : "secondary"}
                          className="h-6 px-2 text-[10px] flex-1"
                          onClick={(e) => { e.stopPropagation(); toggleSeller(v.nome); }}
                        >
                          {isHidden ? 'Mostrar' : 'Ocultar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px] gap-1"
                          onClick={(e) => { e.stopPropagation(); soloOnly(v.nome); }}
                        >
                          <Zap className="h-2.5 w-2.5" /> Solo
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ============== COMPARATIVO ============== */}
        <TabsContent value="comparativo" className="mt-6 space-y-6 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Primeira Metade vs Segunda Metade
                </CardTitle>
                <CardDescription>Clique em uma metade para destacar · clique no medidor para detalhes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  {(['p1', 'p2'] as const).map((key) => {
                    const periodo = key === 'p1' ? comparativoPeriodos.primeiroPeriodo : comparativoPeriodos.segundoPeriodo;
                    const isActive = halfFocus === key;
                    const isP2 = key === 'p2';
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setHalfFocus(prev => prev === key ? null : key)}
                        className={cn(
                          "relative p-4 rounded-xl text-center border transition-all duration-300 hover:-translate-y-0.5",
                          isP2 ? "bg-gradient-to-br from-primary/15 to-primary/5 border-primary/30" : "bg-gradient-to-br from-muted/50 to-muted/20 border-border/40",
                          isActive && "ring-2 ring-primary/60 shadow-xl shadow-primary/20 -translate-y-0.5",
                        )}
                      >
                        <p className="text-xs text-muted-foreground mb-1 font-medium">{key === 'p1' ? '1ª Metade' : '2ª Metade'}</p>
                        <p className={cn("text-xl font-bold tabular-nums", isP2 && "text-primary")}>{formatCurrency(periodo.total)}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {periodo.dias} dias · {formatCurrency(periodo.media, true)}/dia
                        </p>
                        {isActive && (
                          <div className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full bg-primary ring-2 ring-background animate-pulse" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* Medidor radial */}
                <div className={cn(
                  "p-5 rounded-xl text-center border backdrop-blur-sm relative overflow-hidden transition-all",
                  comparativoPeriodos.variacao > 0 ? "bg-gradient-to-br from-success/15 to-success/5 border-success/30" :
                  comparativoPeriodos.variacao < 0 ? "bg-gradient-to-br from-destructive/15 to-destructive/5 border-destructive/30" :
                  "bg-muted/30 border-border/40",
                )}>
                  <div className="flex items-center justify-center gap-4">
                    {/* Donut SVG */}
                    {(() => {
                      const v = Math.max(-100, Math.min(100, comparativoPeriodos.variacao));
                      const pct = Math.min(100, Math.abs(v));
                      const r = 32;
                      const c = 2 * Math.PI * r;
                      const dash = (pct / 100) * c;
                      const stroke = v > 0 ? 'hsl(var(--success))' : v < 0 ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))';
                      return (
                        <svg width="80" height="80" viewBox="0 0 80 80" className="shrink-0">
                          <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--muted)/0.3)" strokeWidth="6" />
                          <circle
                            cx="40" cy="40" r={r}
                            fill="none"
                            stroke={stroke}
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={`${dash} ${c}`}
                            transform="rotate(-90 40 40)"
                            style={{ transition: 'stroke-dasharray 800ms cubic-bezier(.2,.8,.2,1)', filter: `drop-shadow(0 0 6px ${stroke})` }}
                          />
                          <text x="40" y="44" textAnchor="middle" className="fill-foreground" style={{ fontSize: '13px', fontWeight: 700 }}>
                            {Math.round(pct)}%
                          </text>
                        </svg>
                      );
                    })()}
                    <div className="text-left">
                      <div className="flex items-center gap-2 mb-0.5">
                        {comparativoPeriodos.variacao > 0 ? <TrendingUp className="h-5 w-5 text-success" /> :
                         comparativoPeriodos.variacao < 0 ? <TrendingDown className="h-5 w-5 text-destructive" /> :
                         <Minus className="h-5 w-5 text-muted-foreground" />}
                        <span className={cn(
                          "text-2xl font-bold tabular-nums",
                          comparativoPeriodos.variacao > 0 ? "text-success" : comparativoPeriodos.variacao < 0 ? "text-destructive" : "",
                        )}>
                          {comparativoPeriodos.variacao > 0 ? '+' : ''}{formatPercent(comparativoPeriodos.variacao)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {comparativoPeriodos.variacao > 0 ? 'Crescimento' : comparativoPeriodos.variacao < 0 ? 'Queda' : 'Estável'} entre metades
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                        Δ {formatCurrency(comparativoPeriodos.segundoPeriodo.total - comparativoPeriodos.primeiroPeriodo.total, true)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-chart-2" />
                  Distribuição Semanal
                </CardTitle>
                <CardDescription>Clique em um dia para abrir o detalhamento</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analiseDiaSemana.map((dia, i) => {
                    const max = Math.max(...analiseDiaSemana.map(d => d.vendas), 1);
                    const isMax = dia.vendas === max && dia.vendas > 0;
                    const isToday = i === todayIdx;
                    const isActive = filterDayOfWeek === i;
                    const noData = dia.vendas === 0;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={noData}
                        onClick={() => setWeekdayDrill(i)}
                        className={cn(
                          "w-full text-left rounded-lg p-2 transition-all duration-200 group",
                          noData ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/40",
                          isActive && "bg-primary/10 ring-1 ring-primary/40",
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-sm font-semibold w-10", isMax && "text-primary", isToday && !isMax && "text-chart-3")}>{dia.dia}</span>
                            {isMax && <Trophy className="h-3 w-3 text-amber-500" />}
                            {isToday && <Badge variant="outline" className="h-4 px-1 text-[9px] border-chart-3/40 text-chart-3">hoje</Badge>}
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-medium tabular-nums">{formatCurrency(dia.vendas, true)}</span>
                            <span className="text-xs text-muted-foreground ml-2">({formatPercent(dia.percentual)})</span>
                          </div>
                        </div>
                        <div className="relative h-2 rounded-full bg-muted/40 overflow-hidden mt-1">
                          <div className={cn(
                            "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                            isMax ? "bg-gradient-to-r from-primary to-primary/70 group-hover:shadow-[0_0_8px] group-hover:shadow-primary/50" : "bg-gradient-to-r from-chart-2 to-chart-2/60 group-hover:shadow-[0_0_6px] group-hover:shadow-chart-2/40",
                          )} style={{ width: `${dia.percentual}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <LineChartIcon className="h-4 w-4 text-chart-3" />
                Vendas e Pedidos (últimos 30 dias)
              </CardTitle>
              <CardDescription>Clique em uma barra para abrir o dia</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] cursor-pointer">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={dadosEvolucaoDiaria.slice(-30)}
                    onClick={handleChartClick}
                    onMouseMove={handleChartMouseMove}
                  >
                    <defs>
                      <linearGradient id="cmpVendasGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      </linearGradient>
                      <linearGradient id="cmpVendasGradActive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.7} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                    <XAxis dataKey="dataFormatada" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis yAxisId="left" tickFormatter={(v) => formatCompactNumber(v)} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip content={<PremiumTooltip />} cursor={{ fill: 'hsl(var(--primary)/0.08)' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="left" dataKey="vendas" name="Vendas" radius={[4, 4, 0, 0]} onClick={(d: any) => d?.data && setDrillDate(d.data)}>
                      {dadosEvolucaoDiaria.slice(-30).map((d, i) => (
                        <Cell key={i} fill={hoveredPoint?.data === d.data ? 'url(#cmpVendasGradActive)' : 'url(#cmpVendasGrad)'} style={{ filter: hoveredPoint?.data === d.data ? 'drop-shadow(0 0 6px hsl(var(--primary)/0.5))' : undefined }} />
                      ))}
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="pedidos" name="Pedidos" stroke="hsl(var(--chart-3))" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 6, cursor: 'pointer', onClick: () => hoveredPoint?.data && setDrillDate(hoveredPoint.data) }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============== Drill-down Dialog ============== */}
      <Dialog open={!!drillDate} onOpenChange={(o) => !o && setDrillDate(null)}>
        <DialogContent className="max-w-2xl">
          {drillData && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  {new Date(drillData.dia.data).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </DialogTitle>
                <DialogDescription>Detalhes do dia selecionado</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Card destaque faturamento */}
                <div className="relative p-5 rounded-xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/30 overflow-hidden">
                  <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-primary/15 blur-3xl" />
                  <p className="text-xs text-muted-foreground mb-1">Faturamento do dia</p>
                  <p className="text-3xl font-bold tabular-nums">{formatCurrency(drillData.dia.vendas)}</p>
                  {drillData.dia.devolucoes > 0 && (
                    <p className="text-xs text-destructive mt-1">- {formatCurrency(drillData.dia.devolucoes)} em devoluções</p>
                  )}
                </div>
                {/* Métricas */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pedidos</p>
                    <p className="text-lg font-bold tabular-nums">{formatInteger(drillData.dia.pedidos)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ticket Médio</p>
                    <p className="text-lg font-bold tabular-nums">{formatCurrency(drillData.ticketMedio, true)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">vs Média</p>
                    <p className={cn(
                      "text-lg font-bold tabular-nums",
                      drillData.dia.vendas >= mediaParaLine ? "text-success" : "text-destructive",
                    )}>
                      {drillData.dia.vendas >= mediaParaLine ? '+' : ''}
                      {mediaParaLine > 0 ? formatPercent(((drillData.dia.vendas - mediaParaLine) / mediaParaLine) * 100) : '—'}
                    </p>
                  </div>
                </div>
                {/* Top vendedores */}
                {drillData.topVend.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                      <Trophy className="h-3.5 w-3.5 text-amber-500" /> Top Vendedores do Dia
                    </p>
                    <div className="space-y-1.5">
                      {drillData.topVend.map((v, i) => {
                        const maxVend = drillData.topVend[0].valor;
                        const pct = maxVend > 0 ? (v.valor / maxVend) * 100 : 0;
                        return (
                          <div key={i} className="relative p-2 rounded-lg border border-border/40 bg-card overflow-hidden">
                            <div className="absolute inset-y-0 left-0 bg-primary/8 transition-all" style={{ width: `${pct}%` }} />
                            <div className="relative flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <Badge variant="secondary" className="text-[10px] h-5">#{i + 1}</Badge>
                                <span className="text-xs font-medium truncate">{v.nome}</span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-xs font-bold tabular-nums">{formatCurrency(v.valor)}</span>
                                <span className="text-[10px] text-muted-foreground ml-2">{v.pedidos} ped.</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
