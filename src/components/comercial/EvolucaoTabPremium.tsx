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
import { formatCurrency, formatCurrencyCompact, formatPercent, formatCompactNumber, formatInteger } from '@/utils/formatters';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ComposedChart, Cell, Brush, ReferenceLine, LabelList
} from 'recharts';
import { cn } from '@/lib/utils';
import type { Pedido, Devolucao, VendedorPerformance, EvolucaoDiaria } from '@/types/comercial';
import { ComparativoColaboradoresTable } from './ComparativoColaboradoresTable';

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
    <div className="rounded-lg border border-border/60 bg-card px-3 py-2.5 animate-in fade-in-0 zoom-in-95 duration-150">
      <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">{label}</p>
      <div className="space-y-1">
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full ring-2 ring-offset-1 ring-offset-card" style={{ backgroundColor: entry.color }} />
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

export function EvolucaoTabPremium({ pedidos, devolucoes, vendedoresPerformance, evolucaoDiaria }: EvolucaoTabProps) {
  const [subTab, setSubTab] = useState<'diaria' | 'mensal' | 'vendedor' | 'comparativo'>('diaria');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [drillDate, setDrillDate] = useState<string | null>(null);
  const [filterDayOfWeek, setFilterDayOfWeek] = useState<number | null>(null);
  const [hiddenSellers, setHiddenSellers] = useState<Set<string>>(new Set());
  const [acumuladoMensal, setAcumuladoMensal] = useState(false);
  const [mensalMetric, setMensalMetric] = useState<'vendas' | 'liquido' | 'devolucoes' | 'pedidos' | 'ticketMedio' | 'qtdClientes'>('vendas');
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
  // Marketplace chart
  const [mkViewMode, setMkViewMode] = useState<'valor' | 'percentual' | 'comparar'>('valor');
  const [mkHidden, setMkHidden] = useState<Set<string>>(new Set());
  const [mkFocus, setMkFocus] = useState<string | null>(null);
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

  // ============================================================
  // Evolução diária por Marketplace/Canal (stacked area)
  // Agrupa pedidos por dia e por vendedor_nome (= conta de marketplace).
  // Mostra Top 5 canais + "Outros".
  // ============================================================
  const evolucaoPorMarketplace = useMemo(() => {
    if (!pedidos.length) return { dados: [] as any[], canais: [] as { nome: string; total: number; color: string }[] };

    // 1) totais por canal para escolher top 5
    const totaisCanal = new Map<string, number>();
    pedidos.forEach(p => {
      if (p.tipo === 'DEVOLUCAO') return;
      const nome = (p.vendedor_nome || 'Sem canal').toString().trim().toUpperCase();
      totaisCanal.set(nome, (totaisCanal.get(nome) || 0) + (p.valor_liquido || 0));
    });
    const ordenados = [...totaisCanal.entries()].sort((a, b) => b[1] - a[1]);
    const top = ordenados.slice(0, 5).map(([n]) => n);
    const palette = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--muted-foreground))'];
    const canais = top.map((n, i) => ({ nome: n, total: totaisCanal.get(n) || 0, color: palette[i] }));
    const temOutros = ordenados.length > 5;
    if (temOutros) {
      const totalOutros = ordenados.slice(5).reduce((s, [, v]) => s + v, 0);
      canais.push({ nome: 'OUTROS', total: totalOutros, color: palette[5] });
    }

    // 2) agrega por dia
    const porDia = new Map<string, Record<string, number>>();
    pedidos.forEach(p => {
      if (p.tipo === 'DEVOLUCAO') return;
      const dataStr = (p.data_faturamento || p.data_pedido || '').toString().slice(0, 10);
      if (!dataStr) return;
      const nome = (p.vendedor_nome || 'Sem canal').toString().trim().toUpperCase();
      const chave = top.includes(nome) ? nome : (temOutros ? 'OUTROS' : nome);
      if (!porDia.has(dataStr)) porDia.set(dataStr, {});
      const reg = porDia.get(dataStr)!;
      reg[chave] = (reg[chave] || 0) + (p.valor_liquido || 0);
    });

    const dados = [...porDia.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, reg]) => {
        const [y, m, d] = data.split('-');
        const ponto: any = { data, dataFormatada: `${d}/${m}` };
        let total = 0;
        canais.forEach(c => { const v = reg[c.nome] || 0; ponto[c.nome] = v; total += v; });
        ponto.__total = total;
        // líder do dia
        let lider = canais[0]?.nome ?? ''; let melhor = -1;
        canais.forEach(c => { if ((ponto[c.nome] || 0) > melhor) { melhor = ponto[c.nome] || 0; lider = c.nome; } });
        ponto.__lider = lider;
        return ponto;
      });

    // Média diária total (linha de referência)
    const mediaDiaria = dados.length > 0 ? dados.reduce((s, p) => s + p.__total, 0) / dados.length : 0;

    // Insight: tendência de cada canal (1ª metade vs 2ª metade do período)
    const meio = Math.floor(dados.length / 2);
    const p1 = dados.slice(0, meio);
    const p2 = dados.slice(meio);
    const tendencias = canais.map(c => {
      const t1 = p1.reduce((s, p) => s + (p[c.nome] || 0), 0) / Math.max(p1.length, 1);
      const t2 = p2.reduce((s, p) => s + (p[c.nome] || 0), 0) / Math.max(p2.length, 1);
      const variacao = t1 > 0 ? ((t2 - t1) / t1) * 100 : (t2 > 0 ? 100 : 0);
      return { nome: c.nome, color: c.color, variacao, mediaAtual: t2 };
    });
    const maiorAlta = [...tendencias].sort((a, b) => b.variacao - a.variacao)[0];
    const maiorQueda = [...tendencias].sort((a, b) => a.variacao - b.variacao)[0];
    const totalGeral = canais.reduce((s, c) => s + c.total, 0);
    const lider = [...canais].sort((a, b) => b.total - a.total)[0];
    const concentracao = lider && totalGeral > 0 ? (lider.total / totalGeral) * 100 : 0;

    return { dados, canais, mediaDiaria, tendencias, maiorAlta, maiorQueda, lider, concentracao, totalGeral };
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

  // Média do período (últimos 14 dias com vendas > 0) — usada por cards e tooltip
  const mediaPeriodo14 = useMemo(() => {
    const validos = dadosEvolucaoDiaria.slice(-14).filter(d => d.vendas > 0);
    return validos.length ? validos.reduce((s, d) => s + d.vendas, 0) / validos.length : 0;
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
        <Card className="group relative overflow-hidden border-primary/30 bg-card transition-colors duration-200 hover:bg-muted/30 cursor-default animate-in fade-in-0 slide-in-from-bottom-2">
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
        <Card className="group relative overflow-hidden border-border/60 bg-card transition-colors duration-200 hover:border-chart-2/40 hover:bg-muted/30 cursor-default animate-in fade-in-0 slide-in-from-bottom-2 [animation-delay:60ms]">
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
          <Card className="group relative overflow-hidden border-success/30 bg-card transition-colors duration-200 hover:bg-muted/30 cursor-pointer animate-in fade-in-0 slide-in-from-bottom-2 [animation-delay:120ms]">
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
          <Card className="group relative overflow-hidden border-destructive/30 bg-card transition-colors duration-200 hover:bg-muted/30 cursor-pointer animate-in fade-in-0 slide-in-from-bottom-2 [animation-delay:180ms]">
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
          "group relative overflow-hidden bg-card transition-colors duration-200 hover:bg-muted/30 cursor-default animate-in fade-in-0 slide-in-from-bottom-2 [animation-delay:240ms]",
          kpisEvolucao.tendencia > 0 && "border-success/30",
          kpisEvolucao.tendencia < 0 && "border-destructive/30",
          kpisEvolucao.tendencia === 0 && "border-border/60",
        )}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                "h-7 w-7 rounded-lg flex items-center justify-center ring-1",
                kpisEvolucao.tendencia > 0 && "bg-success/15 ring-success/20",
                kpisEvolucao.tendencia < 0 && "bg-destructive/15 ring-destructive/20",
                kpisEvolucao.tendencia === 0 && "bg-muted/30 ring-border/30",
              )}>
                {kpisEvolucao.tendencia > 0 ? <TrendingUp className="h-3.5 w-3.5 text-success" />
                  : kpisEvolucao.tendencia < 0 ? <TrendingDown className="h-3.5 w-3.5 text-destructive" />
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
        <Card className="border-border/60 bg-card overflow-hidden relative">
          <CardHeader className="pb-3 relative">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
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
                    "text-left p-3 rounded-lg border transition-colors duration-200 group",
                    insight.action ? "cursor-pointer" : "cursor-default",
                    insight.tipo === 'positivo' && "bg-success/8 border-success/30 hover:bg-success/12 hover:border-success/50",
                    insight.tipo === 'negativo' && "bg-destructive/8 border-destructive/30 hover:bg-destructive/12 hover:border-destructive/50",
                    insight.tipo === 'neutro' && "bg-primary/8 border-primary/30 hover:bg-primary/12 hover:border-primary/50",
                    "animate-in fade-in-0 slide-in-from-left-2",
                  )}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="flex items-start gap-2">
                    <div className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
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
        <TabsList className="grid w-full grid-cols-4 bg-muted/40 border border-border/50 p-1 h-auto">
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
            {/* Coluna principal: gráfico + detalhamento */}
            <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Detalhamento Diário interativo (movido para baixo do gráfico) */}
            <Card ref={detailsRef} className="relative overflow-hidden rounded-lg border border-border/60 bg-card">
              <CardHeader className="relative pb-3 flex flex-row items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-chart-3/10 border border-chart-3/20 shrink-0">
                    <CalendarDays className="h-4 w-4 text-chart-3" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold tracking-tight">Detalhamento Diário</CardTitle>
                    <CardDescription className="text-[11px] mt-0.5">Últimos 14 dias · clique para detalhes</CardDescription>
                  </div>
                </div>
                {selectedDate && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedDate(null)}>
                    Limpar seleção
                  </Button>
                )}
              </CardHeader>
              <CardContent className="relative space-y-4">
                {/* Gráfico de barras dos últimos 14 dias - Premium */}
                {(() => {
                  const chartData = dadosEvolucaoDiaria.slice(-14).map(d => ({
                    label: d.dataFormatada,
                    diaSemana: d.diaSemana,
                    vendas: d.vendas,
                    pedidos: d.pedidos,
                    data: d.data,
                  }));
                  const totalPeriodo = chartData.reduce((s, d) => s + (d.vendas > 0 ? d.vendas : 0), 0);
                  const mediaPeriodo = chartData.length ? totalPeriodo / chartData.length : 0;
                  return (
                    <div className="relative h-[260px] w-full rounded-lg border border-border/60 bg-card p-3 overflow-hidden">
                      <div className="absolute top-3 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
                        <div className="flex items-center gap-3 text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-success" />
                            <span className="text-muted-foreground">Melhor</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-destructive" />
                            <span className="text-muted-foreground">Pior</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="h-0.5 w-3 bg-[hsl(var(--chart-2))]" />
                            <span className="text-muted-foreground">Média</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Total 14d</p>
                          <p className="text-xs font-bold tabular-nums text-foreground">{formatCurrency(totalPeriodo, true)}</p>
                        </div>
                      </div>

                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={chartData}
                          margin={{ top: 40, right: 8, left: 0, bottom: 0 }}
                          onClick={(e: any) => {
                            const p = e?.activePayload?.[0]?.payload;
                            if (p?.data) { setSelectedDate(p.data); setDrillDate(p.data); }
                          }}
                          onMouseMove={(e: any) => {
                            const p = e?.activePayload?.[0]?.payload;
                            setHoveredDate(p?.data ?? null);
                          }}
                          onMouseLeave={() => setHoveredDate(null)}
                        >
                          <defs>
                            <linearGradient id="grad-bar-default" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={0.95} />
                              <stop offset="100%" stopColor="hsl(var(--chart-3))" stopOpacity={0.35} />
                            </linearGradient>
                            <linearGradient id="grad-bar-top" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={1} />
                              <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.4} />
                            </linearGradient>
                            <linearGradient id="grad-bar-low" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={1} />
                              <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                            </linearGradient>
                            <linearGradient id="grad-bar-selected" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                            </linearGradient>
                            <linearGradient id="grad-bar-hover" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={1} />
                              <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0.45} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} opacity={0.4} />
                          <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                          <YAxis tickFormatter={(v) => formatCompactNumber(v)} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={50} />
                          <Tooltip
                            cursor={{ fill: 'hsl(var(--primary) / 0.06)' }}
                            content={({ active, payload }: any) => {
                              if (!active || !payload?.length) return null;
                              const p = payload[0].payload;
                              const vsMedia = mediaPeriodo > 0 ? ((p.vendas - mediaPeriodo) / mediaPeriodo) * 100 : 0;
                              const isPos = vsMedia >= 0;
                              return (
                                <div className="rounded-lg border border-border/60 bg-card px-3 py-2 text-xs animate-in fade-in-0 zoom-in-95 duration-150">
                                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground capitalize mb-1">{p.diaSemana} · {p.label}</p>
                                  <p className="text-base font-bold tabular-nums text-foreground">{formatCurrency(p.vendas)}</p>
                                  <div className="flex items-center justify-between gap-4 mt-1 pt-1 border-t border-border/40">
                                    <span className="text-[10px] text-muted-foreground">{p.pedidos} pedidos</span>
                                    <span className={cn("text-[10px] font-semibold tabular-nums", isPos ? "text-success" : "text-destructive")}>
                                      {isPos ? '▲' : '▼'} {Math.abs(vsMedia).toFixed(1)}% vs média
                                    </span>
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Bar dataKey="vendas" radius={[8, 8, 0, 0]} cursor="pointer" animationDuration={900} animationEasing="ease-out">
                            {chartData.map((dia, idx) => {
                              const isTop = dia.vendas === kpisEvolucao.melhorDia && dia.vendas > 0;
                              const isLow = dia.vendas === kpisEvolucao.piorDia;
                              const isSelected = selectedDate === dia.data;
                              const isHovered = hoveredDate === dia.data;
                              const fill = isSelected
                                ? 'url(#grad-bar-selected)'
                                : isHovered
                                  ? 'url(#grad-bar-hover)'
                                  : isTop
                                    ? 'url(#grad-bar-top)'
                                    : isLow
                                      ? 'url(#grad-bar-low)'
                                      : 'url(#grad-bar-default)';
                              const strokeColor = isSelected
                                ? 'hsl(var(--primary))'
                                : isTop
                                  ? 'hsl(var(--success))'
                                  : isLow
                                    ? 'hsl(var(--destructive))'
                                    : 'transparent';
                              return (
                                <Cell
                                  key={idx}
                                  fill={fill}
                                  stroke={strokeColor}
                                  strokeWidth={isSelected ? 2 : isTop || isLow ? 1 : 0}
                                  style={{
                                    transition: 'filter 200ms ease',
                                  }}
                                />
                              );
                            })}
                          </Bar>
                          {mediaPeriodo > 0 && (
                            <ReferenceLine
                              y={mediaPeriodo}
                              stroke="hsl(var(--chart-2))"
                              strokeOpacity={0.95}
                              strokeDasharray="2 6"
                              strokeWidth={1.5}
                              ifOverflow="extendDomain"
                              label={(props: any) => {
                                const { viewBox } = props;
                                if (!viewBox) return null;
                                const text = `Média ${formatCompactNumber(mediaPeriodo)}`;
                                const w = Math.max(72, text.length * 6.2 + 14);
                                const h = 18;
                                const x = viewBox.x + viewBox.width - w - 4;
                                const y = viewBox.y - h / 2;
                                return (
                                  <g style={{ filter: 'drop-shadow(0 2px 6px hsl(var(--chart-2) / 0.5))' }}>
                                    <rect x={x} y={y} width={w} height={h} rx={9} ry={9} fill="hsl(var(--chart-2))" />
                                    <text
                                      x={x + w / 2}
                                      y={y + h / 2 + 3.5}
                                      textAnchor="middle"
                                      fill="hsl(var(--background))"
                                      fontSize={10}
                                      fontWeight={700}
                                      style={{ letterSpacing: '0.02em' }}
                                    >
                                      {text}
                                    </text>
                                  </g>
                                );
                              }}
                            />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
                {(() => {
                  const ultimos = dadosEvolucaoDiaria.slice(-14);
                  const hojeStr = new Date().toISOString().split('T')[0];
                  const validos = ultimos.filter(d => d.vendas > 0);
                  const mediaPeriodo = mediaPeriodo14;
                  // ranking dos 14 dias (1 = melhor)
                  const ranking = [...ultimos]
                    .map((d, idx) => ({ idx, vendas: d.vendas }))
                    .sort((a, b) => b.vendas - a.vendas);
                  const rankMap = new Map<number, number>();
                  ranking.forEach((r, i) => rankMap.set(r.idx, i + 1));
                  return (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
                  {ultimos.map((dia, i) => {
                    const isTop = dia.vendas === kpisEvolucao.melhorDia && dia.vendas > 0;
                    const isLow = dia.vendas === kpisEvolucao.piorDia;
                    const isSelected = selectedDate === dia.data;
                    const isToday = dia.data === hojeStr;
                    const isEmpty = dia.vendas <= 0;
                    const ratio = kpisEvolucao.melhorDia > 0 ? (dia.vendas / kpisEvolucao.melhorDia) * 100 : 0;
                    const vsMedia = mediaPeriodo > 0 ? ((dia.vendas - mediaPeriodo) / mediaPeriodo) * 100 : 0;
                    const acima = vsMedia >= 0;
                    const rank = rankMap.get(i) || 0;
                    const ticket = dia.pedidos > 0 ? dia.vendas / dia.pedidos : 0;
                    // tier de cor segundo desempenho relativo
                    const tier = isEmpty ? 'empty' : ratio >= 80 ? 'top' : ratio >= 50 ? 'good' : ratio >= 25 ? 'mid' : 'low';
                    const tierColor = {
                      top: 'hsl(var(--success))',
                      good: 'hsl(var(--primary))',
                      mid: 'hsl(var(--chart-2))',
                      low: 'hsl(var(--destructive))',
                      empty: 'hsl(var(--muted-foreground))',
                    }[tier];
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { setSelectedDate(dia.data); setDrillDate(dia.data); }}
                        title={`${dia.diaSemana} ${dia.dataFormatada}\n${formatCurrency(dia.vendas)} · ${dia.pedidos} pedidos\nTicket médio: ${formatCurrency(ticket)}\n${acima ? '+' : ''}${vsMedia.toFixed(1)}% vs média`}
                        className={cn(
                          "relative p-2.5 rounded-lg border text-center transition-colors duration-200 cursor-pointer group overflow-hidden",
                          "hover:bg-muted/30 hover:z-10",
                          "animate-in fade-in-0 zoom-in-95",
                          isSelected
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary/60"
                            : isToday
                              ? "border-amber-500/50"
                              : "border-border/50",
                        )}
                        style={{
                          animationDelay: `${i * 30}ms`,
                          background: isEmpty ? 'hsl(var(--muted) / 0.15)' : 'hsl(var(--card))',
                          borderColor: isEmpty || isSelected || isToday ? undefined : tierColor,
                          containerType: 'inline-size',
                        }}
                      >
                        {/* badges canto */}
                        <div className="absolute top-1 left-1 flex items-center gap-1">
                          {isToday && (
                            <span className="flex items-center gap-1 px-1.5 py-[1px] rounded-full bg-amber-500/20 border border-amber-500/40 text-[8px] font-bold text-amber-500 uppercase tracking-wider">
                              <span className="h-1 w-1 rounded-full bg-amber-500 animate-pulse" />
                              hoje
                            </span>
                          )}
                        </div>
                        <div className="absolute top-1 right-1 flex items-center gap-1">
                          {isTop ? (
                            <Trophy className="h-3.5 w-3.5 text-amber-500" />
                          ) : rank > 0 && rank <= 3 && !isEmpty ? (
                            <span className="text-[8px] font-black text-muted-foreground/70 tabular-nums">#{rank}</span>
                          ) : null}
                        </div>

                        <p className="text-[10px] text-muted-foreground capitalize mt-2.5 font-medium">{dia.diaSemana}</p>
                        <p className="text-[11px] font-bold tracking-tight">{dia.dataFormatada}</p>
                        <p className={cn(
                          "font-black mt-1 tabular-nums tracking-tight transition-colors whitespace-nowrap text-center leading-tight",
                          tier === 'top' && "text-success",
                          tier === 'good' && "text-foreground",
                          tier === 'mid' && "text-foreground/90",
                          tier === 'low' && "text-destructive",
                          tier === 'empty' && "text-muted-foreground/60",
                        )}
                        style={{ fontSize: 'clamp(9px, 1.15cqi + 4px, 14px)' }}>
                          {formatCurrency(dia.vendas, true)}
                        </p>

                        {/* linha de pedidos / delta (swap no hover) */}
                        <div className="relative h-[14px] mt-0.5">
                          <p className="absolute inset-0 text-[10px] text-muted-foreground tabular-nums transition-opacity duration-200 group-hover:opacity-0">
                            {formatInteger(dia.pedidos)} ped.
                          </p>
                          {!isEmpty && mediaPeriodo > 0 && (
                            <p className={cn(
                              "absolute inset-0 text-[10px] font-bold tabular-nums opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 flex items-center justify-center gap-0.5",
                              acima ? "text-success" : "text-destructive",
                            )}>
                              {acima ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                              {acima ? '+' : ''}{vsMedia.toFixed(0)}%
                            </p>
                          )}
                        </div>

                        {/* barra inferior com gradiente e glow */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/30 overflow-hidden">
                          <div
                            className="h-full transition-all duration-700 ease-out"
                            style={{
                              width: `${Math.max(0, Math.min(100, ratio))}%`,
                              background: tierColor,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
                  );
                })()}
              </CardContent>
            </Card>
            </div>
            {/* fim coluna principal */}

            {/* Dia da semana - Neo-Glass */}
            <Card className="relative overflow-hidden rounded-lg border border-border/60 bg-card flex flex-col">
              <CardHeader className="relative pb-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-chart-2/10 border border-chart-2/20 shrink-0">
                    <Calendar className="h-4 w-4 text-chart-2" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold tracking-tight">Por Dia da Semana</CardTitle>
                    <CardDescription className="text-[11px] mt-0.5">Clique para filtrar o gráfico ao lado</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative flex-1 flex flex-col">
                <div className="space-y-3.5">
                  {analiseDiaSemana.map((dia) => {
                    const isToday = dia.idx === todayIdx;
                    const isSelected = filterDayOfWeek === dia.idx;
                    const isDimmed = filterDayOfWeek !== null && !isSelected;
                    const isMax = dia.vendas === totalDayOfWeekMax && dia.vendas > 0;
                    const isEmpty = dia.vendas <= 0;
                    const widthPct = totalDayOfWeekMax > 0 ? (dia.vendas / totalDayOfWeekMax) * 100 : 0;
                    return (
                      <button
                        key={dia.idx}
                        type="button"
                        onClick={() => setFilterDayOfWeek(prev => prev === dia.idx ? null : dia.idx)}
                        className={cn(
                          "w-full text-left transition-colors duration-200 rounded-lg px-3 py-2 -mx-1 group relative",
                          isSelected && "bg-primary/[0.07] ring-1 ring-primary/30",
                          isDimmed && "opacity-40",
                          !isDimmed && !isSelected && "hover:bg-muted/30",
                        )}
                      >
                        <div className="flex items-end justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-sm font-bold tracking-tight",
                              isMax ? "text-primary" : isEmpty ? "text-muted-foreground" : "text-foreground",
                              isToday && "text-amber-500",
                            )}>
                              {dia.dia}
                            </span>
                            {isToday && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse ring-2 ring-amber-500/30" />}
                            {isMax && <Trophy className="h-3.5 w-3.5 text-amber-500" />}
                          </div>
                          <span className={cn(
                            "text-sm font-bold tabular-nums tracking-tight",
                            isEmpty ? "text-muted-foreground/60" : isMax ? "text-foreground" : "text-foreground/90",
                          )}>
                            {formatCurrency(dia.vendas, true)}
                          </span>
                        </div>
                        <div className={cn(
                          "relative rounded-full bg-muted/40 overflow-hidden p-0.5",
                          isMax ? "h-3" : "h-2",
                        )}>
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-700",
                              isMax ? "bg-primary" : "bg-chart-2/70",
                            )}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className={cn("text-[10px] font-bold tabular-nums", isEmpty ? "text-muted-foreground/50" : "text-muted-foreground")}>
                            {dia.pedidos} ped.
                          </span>
                          <span className={cn(
                            "text-[10px] font-bold tabular-nums",
                            isMax ? "text-primary" : isEmpty ? "text-muted-foreground/50" : "text-muted-foreground",
                          )}>
                            {formatPercent(dia.percentual)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {/* Total da semana */}
                <div className="mt-auto pt-5">
                  <div className="p-3.5 rounded-lg bg-background/40 border border-border/50 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total da Semana</p>
                    <p className="text-xl font-black tabular-nums tracking-tight">
                      {formatCurrency(analiseDiaSemana.reduce((sum, d) => sum + (d.vendas || 0), 0), true)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============== MENSAL ============== */}
        <TabsContent value="mensal" className="mt-6 space-y-6 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 relative overflow-hidden rounded-lg border border-border/60 bg-card">
              <CardHeader className="relative pb-3 flex flex-row items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold tracking-tight flex items-center gap-2">
                      Faturamento Mensal
                      {acumuladoMensal && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Acumulado</Badge>}
                    </CardTitle>
                    <CardDescription className="text-[11px] mt-0.5">
                      Selecione a métrica · passe o mouse · clique para drill-down
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Seletor de métrica */}
                  <div className="flex items-center gap-1 bg-background/40 border border-border/50 p-1 rounded-lg">
                    {([
                      { k: 'vendas', label: 'Vendas', color: 'hsl(var(--primary))' },
                      { k: 'liquido', label: 'Líquido', color: 'hsl(var(--chart-2))' },
                      { k: 'devolucoes', label: 'Devol.', color: 'hsl(var(--destructive))' },
                      { k: 'pedidos', label: 'Pedidos', color: 'hsl(var(--chart-4))' },
                      { k: 'ticketMedio', label: 'Ticket', color: 'hsl(var(--chart-3))' },
                      { k: 'qtdClientes', label: 'Clientes', color: 'hsl(var(--chart-5))' },
                    ] as const).map(m => (
                      <button
                        key={m.k}
                        type="button"
                        onClick={() => setMensalMetric(m.k)}
                        className={cn(
                          "px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all",
                          mensalMetric === m.k
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >{m.label}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 bg-background/40 border border-border/50 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setAcumuladoMensal(false)}
                      className={cn("px-3 py-1 text-[11px] font-bold rounded-lg transition-colors", !acumuladoMensal ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                    >Mensal</button>
                    <button
                      type="button"
                      onClick={() => setAcumuladoMensal(true)}
                      className={cn("px-3 py-1 text-[11px] font-bold rounded-lg transition-colors", acumuladoMensal ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                    >Acumulado</button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative">
...
                <div className="h-[380px] cursor-pointer">
                  {(() => {
                    const metricMap = {
                      vendas: { label: 'Vendas', color: 'hsl(var(--primary))', isCurrency: true },
                      liquido: { label: 'Líquido (Vendas − Devol.)', color: 'hsl(var(--chart-2))', isCurrency: true },
                      devolucoes: { label: 'Devoluções', color: 'hsl(var(--destructive))', isCurrency: true },
                      pedidos: { label: 'Pedidos', color: 'hsl(var(--chart-4))', isCurrency: false },
                      ticketMedio: { label: 'Ticket Médio', color: 'hsl(var(--chart-3))', isCurrency: true },
                      qtdClientes: { label: 'Clientes', color: 'hsl(var(--chart-5))', isCurrency: false },
                    } as const;
                    const cfg = metricMap[mensalMetric];
                    const chartData = dadosEvolucaoMensal.map(m => ({
                      ...m,
                      liquido: (m.vendas || 0) - (m.devolucoes || 0),
                    }));
                    const media = chartData.length > 0
                      ? chartData.reduce((a, d: any) => a + (d[mensalMetric] || 0), 0) / chartData.length
                      : 0;
                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={chartData}
                          margin={{ top: 28, right: 80, left: 8, bottom: 28 }}
                          onClick={handleMonthChartClick}
                          onMouseMove={handleMonthChartMouseMove}
                        >
                          <defs>
                            <linearGradient id="mensalDynGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={cfg.color} stopOpacity={0.95} />
                              <stop offset="100%" stopColor={cfg.color} stopOpacity={0.35} />
                            </linearGradient>
                            <linearGradient id="mensalDynGradActive" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={cfg.color} stopOpacity={1} />
                              <stop offset="100%" stopColor={cfg.color} stopOpacity={0.75} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                          <XAxis
                            dataKey="mes"
                            height={42}
                            interval={0}
                            minTickGap={0}
                            tickMargin={12}
                            padding={{ left: 28, right: 28 }}
                            tick={{ fontSize: 10, dy: 4 }}
                            stroke="hsl(var(--muted-foreground))"
                          />
                          <YAxis
                            tickFormatter={(v) => cfg.isCurrency ? formatCompactNumber(v) : formatInteger(v)}
                            tick={{ fontSize: 10 }}
                            stroke="hsl(var(--muted-foreground))"
                          />
                          <Tooltip
                            content={<PremiumTooltip isCurrency={cfg.isCurrency} />}
                            cursor={{ fill: 'hsl(var(--primary)/0.08)' }}
                          />
                          {chartData.length > 1 && (
                            <ReferenceLine
                              y={media}
                              stroke={cfg.color}
                              strokeDasharray="4 4"
                              strokeOpacity={0.5}
                              label={{
                                value: `Média ${cfg.isCurrency ? formatCompactNumber(media) : formatInteger(media)}`,
                                position: 'insideTopRight',
                                fill: cfg.color,
                                fontSize: 10,
                                fontWeight: 700,
                                offset: 8,
                              }}
                            />
                          )}
                          <Bar
                            dataKey={mensalMetric}
                            name={cfg.label}
                            radius={[8, 8, 0, 0]}
                            barSize={chartData.length <= 3 ? 80 : chartData.length <= 6 ? 56 : 36}
                            onClick={(d: any) => d?.mesKey && setMonthDrill(d.mesKey)}
                          >
                            {chartData.map((m, i) => (
                              <Cell
                                key={i}
                                fill={hoveredMonth?.mesKey === m.mesKey ? 'url(#mensalDynGradActive)' : 'url(#mensalDynGrad)'}
                                style={{
                                  transition: 'filter 0.2s',
                                }}
                              />
                            ))}
                            <LabelList
                              dataKey={mensalMetric}
                              position="top"
                              content={(props: any) => {
                                const { x, y, width, value, index } = props;
                                if (value == null || index == null) return null;
                                const prev = index > 0 ? (chartData[index - 1] as any)[mensalMetric] : null;
                                const mom = prev && prev !== 0 ? ((value - prev) / Math.abs(prev)) * 100 : null;
                                const cx = x + width / 2;
                                return (
                                  <g>
                                    <text
                                      x={cx}
                                      y={y - 18}
                                      textAnchor="middle"
                                      fontSize={11}
                                      fontWeight={700}
                                      fill="hsl(var(--foreground))"
                                    >
                                      {cfg.isCurrency ? formatCompactNumber(value) : formatInteger(value)}
                                    </text>
                                    {mom !== null && Math.abs(mom) >= 0.1 && (
                                      <text
                                        x={cx}
                                        y={y - 4}
                                        textAnchor="middle"
                                        fontSize={9}
                                        fontWeight={700}
                                        fill={mom >= 0 ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))'}
                                      >
                                        {mom >= 0 ? '▲' : '▼'} {Math.abs(mom).toFixed(1)}%
                                      </text>
                                    )}
                                  </g>
                                );
                              }}
                            />
                          </Bar>
                        </ComposedChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden rounded-lg border border-border/60 bg-card">
              <CardHeader className="relative pb-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                    <CalendarRange className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold tracking-tight">Resumo por Mês</CardTitle>
                    <CardDescription className="text-[11px] mt-0.5">Clique para abrir o mês</CardDescription>
                  </div>
                </div>
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
                        isActive ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted/40",
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
                          "bg-primary",
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="relative overflow-hidden rounded-lg border border-border/60 bg-card">
              <CardHeader className="relative pb-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-chart-3/10 border border-chart-3/20 shrink-0">
                    <Target className="h-4 w-4 text-chart-3" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold tracking-tight">Evolução do Ticket Médio</CardTitle>
                    <CardDescription className="text-[11px] mt-0.5">Tendência mês a mês</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative">
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

            <Card className="relative overflow-hidden rounded-lg border border-border/60 bg-card">
              <CardHeader className="relative pb-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-chart-4/10 border border-chart-4/20 shrink-0">
                    <Users className="h-4 w-4 text-chart-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold tracking-tight">Clientes Ativos por Mês</CardTitle>
                    <CardDescription className="text-[11px] mt-0.5">Quantidade de clientes únicos</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative">
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
          <ComparativoColaboradoresTable
            pedidos={pedidos}
            devolucoes={devolucoes}
            onSelectVendedor={(nome) => setSellerDrill(nome)}
          />
          <Card className="relative overflow-hidden rounded-lg border border-border/60 bg-card">
            <CardHeader className="relative pb-3 flex flex-row items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold tracking-tight">Top 5 Vendedores · Evolução Mensal</CardTitle>
                  <CardDescription className="text-[11px] mt-0.5">Clique no nome para detalhes · "Solo" isola · clique na legenda para ocultar</CardDescription>
                </div>
              </div>
              {hiddenSellers.size > 0 && (
                <Button size="sm" variant="outline" className="h-8 text-[11px] font-bold gap-1.5 rounded-lg border-primary/30 text-primary hover:bg-primary/10" onClick={showAllSellers}>
                  <Sparkles className="h-3 w-3" /> Mostrar todos
                </Button>
              )}
            </CardHeader>
            <CardContent className="relative">
              <div className={cn(
                "mb-5 rounded-lg border transition-colors duration-200 overflow-hidden",
                hoveredSeller
                  ? "border-primary/30 bg-background/40"
                  : "border-border/40 bg-muted/10 border-dashed"
              )}>
                <div className="px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
                  {hoveredSeller ? (
                    <>
                      <div className="flex items-center gap-5 min-w-0 flex-wrap">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Vendedor</span>
                          <span className="text-sm font-semibold capitalize truncate max-w-[200px]">{hoveredSeller.nome}</span>
                        </div>
                        <div className="h-8 w-px bg-border/60 hidden sm:block" />
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Mês</span>
                          <span className="text-sm font-semibold">{hoveredSeller.mes}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-primary/80 flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Vendas</span>
                          <span className="text-base font-bold tabular-nums tracking-tight">{formatCurrency(hoveredSeller.valor, true)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="h-9 px-3 text-xs font-bold gap-1.5 rounded-lg" onClick={() => soloOnly(hoveredSeller.nome)}>
                          <Zap className="h-3.5 w-3.5" /> Solo
                        </Button>
                        <Button size="sm" className="h-9 px-4 text-xs font-bold gap-1.5 transition-colors" onClick={() => setSellerDrill(hoveredSeller.nome)}>
                          Detalhes <MousePointerClick className="h-3.5 w-3.5" />
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
                          style={undefined}
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
                    "relative overflow-hidden rounded-lg border border-border/60 bg-card transition-colors duration-200 hover:bg-muted/30",
                    isFocused && "ring-2 ring-primary/50",
                  )}>
                    <div
                      className="absolute top-0 left-0 h-full transition-all"
                      style={{ backgroundColor: color, width: isFocused ? 3 : 4 }}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <Card className="relative overflow-hidden rounded-lg border border-border/60 bg-card">
              <CardHeader className="relative pb-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold tracking-tight">Primeira vs Segunda Metade</CardTitle>
                    <CardDescription className="text-[11px] mt-0.5">Clique em uma metade para destacar</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative space-y-6">
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
                          "relative p-4 rounded-lg text-center border transition-colors duration-200 hover:bg-muted/30",
                          isP2 ? "bg-primary/10 border-primary/30" : "bg-muted/30 border-border/40",
                          isActive && "ring-2 ring-primary/60",
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
                  "p-5 rounded-lg text-center border relative overflow-hidden transition-colors",
                  comparativoPeriodos.variacao > 0 ? "bg-success/10 border-success/30" :
                  comparativoPeriodos.variacao < 0 ? "bg-destructive/10 border-destructive/30" :
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
                            style={{ transition: 'stroke-dasharray 800ms cubic-bezier(.2,.8,.2,1)' }}
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

            {(() => {
              // ===== Cálculos para Insights do Período =====
              const ultimos30Ins = dadosEvolucaoDiaria.slice(-30);
              const ativos = ultimos30Ins.filter(d => (d.vendas || 0) > 0);
              const totalIns = ativos.reduce((s, d) => s + (d.vendas || 0), 0);
              const mediaDia = ativos.length > 0 ? totalIns / ativos.length : 0;
              const ordenados = [...ativos].sort((a, b) => (b.vendas || 0) - (a.vendas || 0));
              const melhor = ordenados[0];
              // Concentração: quantos dias formam 80% do faturamento
              let acum = 0;
              let diasPara80 = 0;
              for (const d of ordenados) {
                acum += d.vendas || 0;
                diasPara80++;
                if (acum >= totalIns * 0.8) break;
              }
              const pctConcentracao = ativos.length > 0 ? (diasPara80 / ativos.length) * 100 : 0;
              // Dia da semana mais forte
              const diaMax = analiseDiaSemana.reduce((b, d) => (d.vendas > (b?.vendas || 0) ? d : b), analiseDiaSemana[0]);
              const nomesDiaSemana: Record<string, string> = { Dom: 'Domingo', Seg: 'Segunda-feira', Ter: 'Terça-feira', Qua: 'Quarta-feira', Qui: 'Quinta-feira', Sex: 'Sexta-feira', Sáb: 'Sábado' };
              // Projeção fim de mês
              const hoje = new Date();
              const diaHoje = hoje.getDate();
              const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
              const diasRestantes = Math.max(0, diasNoMes - diaHoje);
              const projecao = mediaDia * diasRestantes;
              const variacaoMetade = comparativoPeriodos.variacao;
              const formatarData = (iso?: string) => {
                if (!iso) return '—';
                const [y, m, d] = iso.split('-');
                const dt = new Date(Number(y), Number(m) - 1, Number(d));
                return dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
              };

              const insights = [
                {
                  icon: variacaoMetade >= 0 ? TrendingUp : TrendingDown,
                  cor: variacaoMetade >= 0 ? 'success' : 'destructive',
                  titulo: variacaoMetade >= 0 ? 'Crescimento entre metades' : 'Queda entre metades',
                  valor: `${variacaoMetade >= 0 ? '+' : ''}${formatPercent(variacaoMetade)}`,
                  desc: `2ª metade vs 1ª metade do período`,
                },
                {
                  icon: Trophy,
                  cor: 'primary',
                  titulo: 'Melhor dia',
                  valor: formatCurrency(melhor?.vendas || 0, true),
                  desc: melhor ? formatarData(melhor.data) : 'Sem dados',
                },
                {
                  icon: Calendar,
                  cor: 'chart-3',
                  titulo: 'Dia da semana mais forte',
                  valor: nomesDiaSemana[diaMax?.dia] || diaMax?.dia || '—',
                  desc: diaMax ? `${formatPercent(diaMax.percentual)} do volume` : 'Sem dados',
                },
                {
                  icon: AlertTriangle,
                  cor: pctConcentracao < 40 ? 'destructive' : pctConcentracao < 70 ? 'amber' : 'success',
                  titulo: 'Concentração de risco',
                  valor: `${diasPara80} dia${diasPara80 !== 1 ? 's' : ''}`,
                  desc: `geram 80% do faturamento (${formatPercent(pctConcentracao)} dos dias ativos)`,
                },
                {
                  icon: Target,
                  cor: 'chart-2',
                  titulo: 'Projeção fim do mês',
                  valor: `+${formatCurrency(projecao, true)}`,
                  desc: `${diasRestantes} dia(s) restantes · base média/dia`,
                },
              ];

              const corClasses: Record<string, { bg: string; text: string; border: string }> = {
                success: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/30' },
                destructive: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/30' },
                primary: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30' },
                'chart-2': { bg: 'bg-chart-2/10', text: 'text-chart-2', border: 'border-chart-2/30' },
                'chart-3': { bg: 'bg-chart-3/10', text: 'text-chart-3', border: 'border-chart-3/30' },
                amber: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/30' },
              };

              return (
                <Card className="relative overflow-hidden rounded-lg border border-border/60 bg-card">
                  <CardHeader className="relative pb-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-chart-3/10 border border-chart-3/20 shrink-0">
                        <Sparkles className="h-4 w-4 text-chart-3" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold tracking-tight">Insights do Período</CardTitle>
                        <CardDescription className="text-[11px] mt-0.5">Sinais automáticos extraídos dos últimos 30 dias</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="relative space-y-2">
                    {insights.map((ins, i) => {
                      const Ic = ins.icon;
                      const cls = corClasses[ins.cor] || corClasses.primary;
                      return (
                        <div
                          key={i}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border bg-card transition-colors hover:bg-muted/30",
                            cls.border,
                          )}
                        >
                          <div className={cn("p-2 rounded-lg shrink-0", cls.bg)}>
                            <Ic className={cn("h-4 w-4", cls.text)} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-muted-foreground leading-tight">{ins.titulo}</p>
                            <p className="text-[10px] text-muted-foreground/80 mt-0.5 truncate">{ins.desc}</p>
                          </div>
                          <span className={cn("text-sm font-bold tabular-nums shrink-0", cls.text)}>{ins.valor}</span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })()}
          </div>

          {/* Distribuição Semanal — full width */}
          <Card className="relative overflow-hidden rounded-lg border border-border/60 bg-card">
            <CardHeader className="relative pb-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-chart-2/10 border border-chart-2/20 shrink-0">
                  <Calendar className="h-4 w-4 text-chart-2" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold tracking-tight">Distribuição Semanal</CardTitle>
                  <CardDescription className="text-[11px] mt-0.5">Clique em um dia para abrir o detalhamento</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
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
                          isMax ? "bg-primary" : "bg-chart-2/70",
                        )} style={{ width: `${dia.percentual}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {(() => {
            const ultimos30 = dadosEvolucaoDiaria.slice(-30);
            const dadosAtivos = ultimos30.filter(d => (d.vendas || 0) > 0 || (d.pedidos || 0) > 0);
            const totalVendas30 = ultimos30.reduce((s, d) => s + (d.vendas || 0), 0);
            const totalPedidos30 = ultimos30.reduce((s, d) => s + (d.pedidos || 0), 0);
            const diasUteis = dadosAtivos.length || 1;
            const mediaVendas = totalVendas30 / diasUteis;
            const poucoDado = dadosAtivos.length <= 2;
            const showLabels = dadosAtivos.length <= 10;
            return (
              <Card className="relative overflow-hidden rounded-lg border border-border/60 bg-card">
                <CardHeader className="relative pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-chart-3/10 border border-chart-3/20 shrink-0">
                        <LineChartIcon className="h-4 w-4 text-chart-3" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold tracking-tight">Vendas · últimos 30 dias</CardTitle>
                        <CardDescription className="text-[11px] mt-0.5">
                          {dadosAtivos.length} dia(s) com movimento · clique numa barra para abrir o dia
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] gap-1 border-primary/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        Total: <span className="font-bold tabular-nums">{formatCurrency(totalVendas30, true)}</span>
                      </Badge>
                      <Badge variant="outline" className="text-[10px] gap-1 border-chart-3/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-chart-3" />
                        {formatInteger(totalPedidos30)} pedidos
                      </Badge>
                      <Badge variant="outline" className="text-[10px] gap-1 border-success/30 text-success">
                        Média/dia: <span className="font-bold tabular-nums">{formatCurrency(mediaVendas, true)}</span>
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  {dadosAtivos.length === 0 ? (
                    <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                      Sem movimento nos últimos 30 dias.
                    </div>
                  ) : (
                    <div className="h-[340px] cursor-pointer">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={dadosAtivos}
                          margin={{ top: 24, right: 32, left: 8, bottom: 8 }}
                          onClick={handleChartClick}
                          onMouseMove={handleChartMouseMove}
                        >
                          <defs>
                            <linearGradient id="cmpVendasGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.95} />
                              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                            </linearGradient>
                            <linearGradient id="cmpVendasGradActive" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.7} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.18} vertical={false} />
                          <XAxis
                            dataKey="dataFormatada"
                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                            stroke="hsl(var(--muted-foreground))"
                            interval="preserveStartEnd"
                            minTickGap={16}
                            padding={{ left: 24, right: 24 }}
                          />
                          <YAxis
                            yAxisId="left"
                            tickFormatter={(v) => formatCompactNumber(v)}
                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                            stroke="hsl(var(--muted-foreground))"
                            width={52}
                          />
                          <Tooltip
                            content={<PremiumTooltip labelMap={{ vendas: 'Vendas', pedidos: 'Pedidos' }} />}
                            cursor={{ fill: 'hsl(var(--primary)/0.08)' }}
                          />
                          <Legend
                            iconType="circle"
                            verticalAlign="bottom"
                            wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                            payload={[
                              { value: 'Vendas', type: 'circle', color: 'hsl(var(--primary))', id: 'vendas' },
                            ]}
                          />
                          {mediaVendas > 0 && !poucoDado && (
                            <ReferenceLine
                              yAxisId="left"
                              y={mediaVendas}
                              stroke="hsl(var(--success))"
                              strokeDasharray="4 4"
                              strokeWidth={1.5}
                              label={{ value: `Média ${formatCurrency(mediaVendas, true)}`, position: 'insideTopRight', fill: 'hsl(var(--success))', fontSize: 10, offset: 6 }}
                            />
                          )}
                          <Bar
                            yAxisId="left"
                            dataKey="vendas"
                            name="Vendas"
                            radius={[8, 8, 0, 0]}
                            maxBarSize={64}
                            legendType="circle"
                            onClick={(d: any) => d?.data && setDrillDate(d.data)}
                          >
                            {dadosAtivos.map((d, i) => {
                              const isHover = hoveredPoint?.data === d.data;
                              const fill = isHover ? 'url(#cmpVendasGradActive)' : 'url(#cmpVendasGrad)';
                              return (
                                <Cell
                                  key={i}
                                  fill={fill}
                                  style={{ transition: 'filter 200ms' }}
                                />
                              );
                            })}
                            {showLabels && (
                              <LabelList
                                dataKey="vendas"
                                position="top"
                                formatter={(v: number) => (v > 0 ? formatCompactNumber(v) : '')}
                                style={{ fill: 'hsl(var(--foreground))', fontSize: 10, fontWeight: 600 }}
                              />
                            )}
                          </Bar>
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}
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
                <div className="relative p-5 rounded-lg bg-card border border-primary/30 overflow-hidden">
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
