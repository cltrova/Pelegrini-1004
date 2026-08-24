import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Line, ComposedChart, Legend,
} from 'recharts';
import {
  Sparkles, Target, AlertTriangle, TrendingDown, Trophy, Calendar,
  ArrowUp, ArrowDown, Minus, Check, DollarSign, Users, TrendingUp, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent, formatCompactNumber } from '@/utils/formatters';
import { getDiasUteisNoMes } from '@/types/comercial';

/** Converte valores em formato brasileiro ("R$ 61.000,00", "61.000,00") para number puro. */
function parseBRLToNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const str = String(value).trim();
  if (!str) return 0;
  const cleaned = str.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Garante number finito (trata NaN/null/undefined → 0). */
function toNum(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  return parseBRLToNumber(v);
}

interface VendedorComMeta {
  codigo: string | number;
  nome: string;
  metaMensal: number;
  faturamentoMesAtual: number;
  valorTotal: number;
  percentualMetaFaturado: number;
  metaDiaria: number;
  metaEsperada: number;
}

interface PedidoMin {
  vendedor_codigo: string | number;
  vendedor_nome?: string;
  valor_liquido?: number;
  valor_liquido_final?: number;
  valor_devolucao_real?: number;
  valor_real?: number;
  valor_desconto?: number;
  valor_bruto?: number;
  data_faturamento?: string;
  data_pedido?: string;
  meta_vendedor?: number;
  tipo?: string;
}

function getReceitaPedido(p: PedidoMin): number {
  if (p.tipo === 'DEVOLUCAO') return -Math.abs(toNum(p.valor_devolucao_real ?? p.valor_real ?? p.valor_liquido));
  if (p.valor_liquido_final !== undefined) {
    return Math.abs(toNum(p.valor_liquido_final)) - Math.abs(toNum(p.valor_devolucao_real));
  }
  return toNum(p.valor_liquido);
}

interface Props {
  vendedoresComMeta: VendedorComMeta[];
  pedidos: PedidoMin[];
  kpisGerais: {
    totalMeta: number;
    totalFaturado: number;
    percentualFaturado: number;
    faltaFaturado: number;
    acimaMeta: number;
    abaixoMeta: number;
    totalVendedores: number;
    totalDevolucoes: number;
    clientesAtendidos: number;
    qtdPedidos?: number;
    ticketMedio?: number;
  };
  periodoFiltros: { ano: number; mes: number };
  diasUteisNoMes: number;
  diasUteisDecorridos: number;
}

type ChartView = 'anual' | 'mensal' | 'diario';

const MES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function PremiumMetasView({
  vendedoresComMeta,
  pedidos,
  kpisGerais,
  periodoFiltros,
  diasUteisNoMes,
  diasUteisDecorridos,
}: Props) {
  const [vendedorFoco, setVendedorFoco] = useState<string | null>(null);
  const [chartView, setChartView] = useState<ChartView>('diario');

  // Lista de vendedores (somente os com meta ou venda)
  const vendedoresLista = useMemo(() => {
    return vendedoresComMeta
      .filter(v => v.metaMensal > 0 || Math.abs(v.faturamentoMesAtual) > 0)
      .sort((a, b) => b.faturamentoMesAtual - a.faturamentoMesAtual);
  }, [vendedoresComMeta]);

  // Vendedor em foco (ou todos)
  const focado = useMemo(() => {
    if (!vendedorFoco) return null;
    return vendedoresLista.find(v => String(v.codigo) === vendedorFoco) || null;
  }, [vendedorFoco, vendedoresLista]);

  // Totais (gerais ou do focado)
  const totais = useMemo(() => {
    if (focado) {
      const metaTotal = focado.metaMensal;
      const valorTotal = focado.faturamentoMesAtual;
      const percentual = metaTotal > 0 ? (valorTotal / metaTotal) * 100 : 0;
      const falta = metaTotal - valorTotal;
      return {
        valorTotal,
        metaTotal,
        percentual,
        falta,
        diariaNecessaria: 0, // calculado adiante
      };
    }
    return {
      valorTotal: kpisGerais.totalFaturado,
      metaTotal: kpisGerais.totalMeta,
      percentual: kpisGerais.percentualFaturado,
      falta: kpisGerais.faltaFaturado,
      diariaNecessaria: 0,
    };
  }, [focado, kpisGerais]);

  // Dias úteis restantes
  const diasUteisRestantes = Math.max(0, diasUteisNoMes - diasUteisDecorridos);
  const diariaNecessaria = totais.falta > 0 && diasUteisRestantes > 0
    ? totais.falta / diasUteisRestantes
    : 0;

  // ===== INSIGHTS =====
  const insights = useMemo(() => {
    const result: Array<{ icon: any; title: string; subtitle: string; color: string }> = [];

    // Insight 1: faltam X / dia útil
    if (totais.falta > 0) {
      result.push({
        icon: Target,
        title: `Faltam ${formatCurrency(totais.falta)} para a meta`,
        subtitle: diasUteisRestantes > 0
          ? `Necessário ${formatCurrency(diariaNecessaria)}/dia em ${diasUteisRestantes} dia${diasUteisRestantes > 1 ? 's' : ''} úte${diasUteisRestantes > 1 ? 'is' : 'l'}.`
          : 'Período encerrado — meta não atingida.',
        color: 'text-amber-500',
      });
    } else {
      result.push({
        icon: Trophy,
        title: `Meta superada em ${formatCurrency(Math.abs(totais.falta))}`,
        subtitle: `${formatPercent(totais.percentual)} atingidos no período.`,
        color: 'text-emerald-500',
      });
    }

    // Insight 2: vendedores acima/abaixo da meta
    if (!focado) {
      const acima = kpisGerais.acimaMeta;
      const abaixo = vendedoresComMeta.filter(v => v.metaMensal > 0 && v.percentualMetaFaturado < 70).length;
      result.push({
        icon: AlertTriangle,
        title: `${acima === 1 ? 'Apenas 1 vendedor acima' : `${acima} vendedores acima`} da meta`,
        subtitle: abaixo > 0
          ? `${abaixo} abaixo de 70%. Concentração de risco na equipe.`
          : 'Equilíbrio saudável da equipe.',
        color: acima >= 3 ? 'text-emerald-500' : 'text-amber-500',
      });
    } else {
      const ranking = vendedoresLista.findIndex(v => String(v.codigo) === vendedorFoco) + 1;
      result.push({
        icon: AlertTriangle,
        title: `Posição #${ranking} entre ${vendedoresLista.length}`,
        subtitle: focado.percentualMetaFaturado >= 100
          ? 'Vendedor superando individualmente a meta.'
          : `${formatPercent(focado.percentualMetaFaturado)} da meta individual atingida.`,
        color: focado.percentualMetaFaturado >= 100 ? 'text-emerald-500' : 'text-amber-500',
      });
    }

    // Insight 3: Projeção em risco
    const ritmoDiario = diasUteisDecorridos > 0 ? totais.valorTotal / diasUteisDecorridos : 0;
    const projecaoFim = ritmoDiario * diasUteisNoMes;
    const projPct = totais.metaTotal > 0 ? (projecaoFim / totais.metaTotal) * 100 : 0;
    const gap = totais.metaTotal - projecaoFim;
    result.push({
      icon: TrendingDown,
      title: `Projeção${projPct < 100 ? ' em risco' : ''}: ${formatPercent(projPct)}`,
      subtitle: gap > 0
        ? `Ritmo atual fecha em ${formatCurrency(projecaoFim)} — gap de ${formatCurrency(gap)}.`
        : `Ritmo atual fecha em ${formatCurrency(projecaoFim)} — acima da meta.`,
      color: projPct >= 100 ? 'text-emerald-500' : projPct >= 90 ? 'text-amber-500' : 'text-red-500',
    });

    return result;
  }, [totais, diasUteisRestantes, diariaNecessaria, focado, kpisGerais, vendedoresComMeta, vendedoresLista, vendedorFoco, diasUteisDecorridos, diasUteisNoMes]);

  // ===== Média mensal por vendedor =====
  // Agrupa vendas e meta por vendedor + mês (a partir dos pedidos), usando todos os meses presentes
  const mediaMensalPorVendedor = useMemo(() => {
    // Map<codigo, Map<YYYY-MM, {valor, meta}>>
    const acc = new Map<string, { nome: string; meses: Map<string, { valor: number; meta: number }> }>();
    for (const p of pedidos) {
      const cod = String(p.vendedor_codigo);
      if (!cod) continue;
      const dataRef = (p.data_faturamento || p.data_pedido || '').toString();
      const mesKey = dataRef.substring(0, 7);
      if (!mesKey) continue;
      const valor = getReceitaPedido(p);
      const meta = p.meta_vendedor && p.meta_vendedor > 0 && p.tipo !== 'DEVOLUCAO' ? p.meta_vendedor : 0;
      if (!acc.has(cod)) acc.set(cod, { nome: p.vendedor_nome || cod, meses: new Map() });
      const entry = acc.get(cod)!;
      const m = entry.meses.get(mesKey) || { valor: 0, meta: 0 };
      m.valor += valor;
      // meta = MAX(meta) por mês
      if (meta > m.meta) m.meta = meta;
      entry.meses.set(mesKey, m);
    }

    const rows = Array.from(acc.entries()).map(([cod, data]) => {
      const meses = Array.from(data.meses.values());
      const mesesComAtividade = meses.filter(m => Math.abs(m.valor) > 0 || m.meta > 0);
      const qtdMeses = mesesComAtividade.length || 1;
      const valorMedio = mesesComAtividade.reduce((s, m) => s + m.valor, 0) / qtdMeses;
      const metaMedia = mesesComAtividade.reduce((s, m) => s + m.meta, 0) / qtdMeses;
      const pctMeta = metaMedia > 0 ? (valorMedio / metaMedia) * 100 : 0;
      // Buscar nome real no vendedoresComMeta
      const v = vendedoresComMeta.find(x => String(x.codigo) === cod);
      return {
        codigo: cod,
        nome: (v?.nome || data.nome).toUpperCase(),
        valorMedio,
        metaMedia,
        pctMeta,
        qtdMeses,
      };
    })
    .filter(r => r.metaMedia > 0 || Math.abs(r.valorMedio) > 0)
    .sort((a, b) => b.pctMeta - a.pctMeta);

    return rows;
  }, [pedidos, vendedoresComMeta]);

  const qtdMesesPeriodo = useMemo(() => {
    const set = new Set<string>();
    for (const p of pedidos) {
      const dataRef = (p.data_faturamento || p.data_pedido || '').toString().substring(0, 7);
      if (dataRef) set.add(dataRef);
    }
    return set.size || 1;
  }, [pedidos]);

  // ===== Realizado vs Meta - dataset por view =====
  const dadosGrafico = useMemo(() => {
    // Filtra pedidos pelo vendedor focado se houver
    const pedidosBase = focado
      ? pedidos.filter(p => String(p.vendedor_codigo) === String(focado.codigo))
      : pedidos;

    if (chartView === 'diario') {
      // Agrupa por dia no mês do periodoFiltros
      const ano = periodoFiltros.ano;
      const mes = periodoFiltros.mes;
      const map = new Map<string, { valor: number; meta: number }>();
      for (const p of pedidosBase) {
        const dataRef = (p.data_faturamento || p.data_pedido || '').toString();
        if (!dataRef.startsWith(`${ano}-${String(mes).padStart(2, '0')}`)) continue;
        const dia = dataRef.substring(8, 10);
        const valor = getReceitaPedido(p);
        const m = map.get(dia) || { valor: 0, meta: 0 };
        m.valor += valor;
        map.set(dia, m);
      }
      const metaDiariaRef = toNum(focado ? focado.metaDiaria : (kpisGerais.totalMeta / diasUteisNoMes));
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dia, v]) => ({
          label: `${dia}/${String(mes).padStart(2, '0')}`,
          valor: toNum(v.valor),
          meta: metaDiariaRef,
          metaDiaria: metaDiariaRef,
        }));
    }

    if (chartView === 'mensal') {
      // Agrupa por mês (YYYY-MM)
      const map = new Map<string, { valor: number; meta: number }>();
      for (const p of pedidosBase) {
        const dataRef = (p.data_faturamento || p.data_pedido || '').toString().substring(0, 7);
        if (!dataRef) continue;
        const valor = getReceitaPedido(p);
        const meta = p.meta_vendedor && p.meta_vendedor > 0 && p.tipo !== 'DEVOLUCAO' ? p.meta_vendedor : 0;
        const m = map.get(dataRef) || { valor: 0, meta: 0 };
        m.valor += valor;
        if (meta > m.meta) m.meta = meta;
        map.set(dataRef, m);
      }
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mes, v]) => {
          const [ano, m] = mes.split('-');
          const metaMes = toNum(v.meta);
          return {
            label: `${MES_NOMES[parseInt(m) - 1].substring(0, 3)}/${ano.substring(2)}`,
            valor: toNum(v.valor),
            meta: metaMes,
            metaDiaria: metaMes > 0 && diasUteisNoMes > 0 ? metaMes / diasUteisNoMes : 0,
          };
        });
    }

    // anual: agrupa por ano
    const map = new Map<string, { valor: number; meta: number; metasMensais: Map<string, number> }>();
    for (const p of pedidosBase) {
      const dataRef = (p.data_faturamento || p.data_pedido || '').toString();
      const ano = dataRef.substring(0, 4);
      const mesKey = dataRef.substring(0, 7);
      if (!ano) continue;
      const valor = getReceitaPedido(p);
      const meta = p.meta_vendedor && p.meta_vendedor > 0 && p.tipo !== 'DEVOLUCAO' ? p.meta_vendedor : 0;
      const m = map.get(ano) || { valor: 0, meta: 0, metasMensais: new Map() };
      m.valor += valor;
      // meta anual = soma dos MAX(meta) por mês
      if (meta > 0) {
        const cur = m.metasMensais.get(mesKey) || 0;
        if (meta > cur) m.metasMensais.set(mesKey, meta);
      }
      map.set(ano, m);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ano, v]) => {
        const metaAno = toNum(Array.from(v.metasMensais.values()).reduce((s, x) => s + x, 0));
        const mesesComMeta = v.metasMensais.size || 0;
        // Meta diária = meta mensal média / dias úteis no mês.
        // Fallback: se não houver meta por mês detectada mas existir meta total, usa kpisGerais.totalMeta.
        const metaMensalMedia = mesesComMeta > 0 ? metaAno / mesesComMeta : toNum(kpisGerais.totalMeta);
        const metaDiariaCalc = diasUteisNoMes > 0 ? metaMensalMedia / diasUteisNoMes : 0;
        return {
          label: ano,
          valor: toNum(v.valor),
          meta: metaAno > 0 ? metaAno : toNum(kpisGerais.totalMeta),
          metaDiaria: toNum(metaDiariaCalc),
        };
      });
  }, [chartView, pedidos, focado, periodoFiltros, kpisGerais, diasUteisNoMes]);

  const melhorPonto = useMemo(() => {
    if (!dadosGrafico.length) return null;
    return dadosGrafico.reduce((best, d) => (d.valor > best.valor ? d : best), dadosGrafico[0]);
  }, [dadosGrafico]);

  // ===== Média mensal geral (tabela inferior direita) =====
  const mediaMensalGeral = useMemo(() => {
    // Mês a mês: total faturado, meta, % meta, evolução vs mesmo mês ano anterior
    const map = new Map<string, { valor: number; metaMes: Map<string, number> }>();
    for (const p of pedidos) {
      const dataRef = (p.data_faturamento || p.data_pedido || '').toString().substring(0, 7);
      if (!dataRef) continue;
      const valor = getReceitaPedido(p);
      const meta = p.meta_vendedor && p.meta_vendedor > 0 && p.tipo !== 'DEVOLUCAO' ? p.meta_vendedor : 0;
      const cod = String(p.vendedor_codigo);
      const m = map.get(dataRef) || { valor: 0, metaMes: new Map() };
      m.valor += valor;
      if (meta > 0) {
        const cur = m.metaMes.get(cod) || 0;
        if (meta > cur) m.metaMes.set(cod, meta);
      }
      map.set(dataRef, m);
    }
    const linhas = Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, v]) => {
        const [ano, mes] = key.split('-');
        const meta = Array.from(v.metaMes.values()).reduce((s, x) => s + x, 0);
        const pct = meta > 0 ? (v.valor / meta) * 100 : 0;
        return {
          key,
          ano,
          mes,
          mesNome: MES_NOMES[parseInt(mes) - 1],
          valor: v.valor,
          meta,
          pct,
        };
      });

    // Calcula evolução vs mesmo mês ano anterior
    const indexed = new Map(linhas.map(l => [l.key, l.valor]));
    return linhas.map(l => {
      const anoAnt = String(parseInt(l.ano) - 1);
      const keyAnt = `${anoAnt}-${l.mes}`;
      const valorAnt = indexed.get(keyAnt);
      let evolucao: number | null = null;
      if (valorAnt !== undefined && valorAnt > 0) {
        evolucao = ((l.valor - valorAnt) / valorAnt) * 100;
      }
      return { ...l, evolucao };
    });
  }, [pedidos]);

  // Totais finais para os cards do gráfico
  // IMPORTANTE: usamos a Meta do mês corrente (focado ou geral) como referência única,
  // independente da view (anual/mensal/diária), para evitar somar metas duplicadas
  // por bucket. Total Realizado também reflete o mês corrente.
  const totaisGrafico = useMemo(() => {
    const totalRealizado = totais.valorTotal;
    const totalMeta = totais.metaTotal;
    const metaDiaria = diasUteisNoMes > 0 ? totalMeta / diasUteisNoMes : 0;
    return {
      totalRealizado,
      totalMeta,
      diferenca: totalRealizado - totalMeta,
      metaDiaria,
    };
  }, [totais, diasUteisNoMes]);

  // Anos com meta atingida
  const anosAtingidos = useMemo(() => {
    if (chartView !== 'anual') return null;
    const total = dadosGrafico.length;
    const ok = dadosGrafico.filter(d => d.meta > 0 && d.valor >= d.meta).length;
    return { ok, total };
  }, [chartView, dadosGrafico]);

  return (
    <div className="space-y-4">
      {/* ============== TOTALIZADORES (mesmo layout da Visão Geral) ============== */}
      {(() => {
        const receita = kpisGerais.totalFaturado || 0;
        const vendas = kpisGerais.qtdPedidos || pedidos.length || 0;
        const clientes = kpisGerais.clientesAtendidos || 0;
        const ticket = kpisGerais.ticketMedio ?? (vendas > 0 ? receita / vendas : 0);
        const pctMeta = kpisGerais.percentualFaturado || 0;
        const totalizadores = [
          {
            key: 'receita',
            label: 'Receita',
            value: formatCurrency(receita),
            icon: TrendingUp,
            hint: `Meta ${formatCurrency(kpisGerais.totalMeta)} · ${formatPercent(pctMeta)}`,
            accent: 'from-primary/25 via-primary/5 to-transparent',
            ring: 'hover:ring-primary/40',
            iconColor: 'text-primary',
            bar: Math.min(100, pctMeta),
            barColor: 'bg-primary',
          },
          {
            key: 'ticket',
            label: 'Ticket Médio',
            value: formatCurrency(ticket),
            icon: Target,
            hint: `${vendas.toLocaleString('pt-BR')} vendas no período`,
            accent: 'from-amber-500/25 via-amber-500/5 to-transparent',
            ring: 'hover:ring-amber-500/40',
            iconColor: 'text-amber-500',
            bar: null as number | null,
            barColor: 'bg-amber-500',
          },
          {
            key: 'clientes',
            label: 'Clientes',
            value: clientes.toLocaleString('pt-BR'),
            icon: Users,
            hint: `${vendas > 0 ? (vendas / Math.max(1, clientes)).toFixed(1) : '0'} pedidos por cliente`,
            accent: 'from-violet-500/25 via-violet-500/5 to-transparent',
            ring: 'hover:ring-violet-500/40',
            iconColor: 'text-violet-400',
            bar: null as number | null,
            barColor: 'bg-violet-500',
          },
          {
            key: 'devolucoes',
            label: 'Devoluções',
            value: formatCurrency(kpisGerais.totalDevolucoes || 0),
            icon: TrendingDown,
            hint: 'Σ ValorDevolucao (linhas DEVOLUCAO)',
            accent: 'from-destructive/25 via-destructive/5 to-transparent',
            ring: 'hover:ring-destructive/40',
            iconColor: 'text-destructive',
            bar: null as number | null,
            barColor: 'bg-destructive',
          },
          {
            key: 'vendas',
            label: 'Vendas',
            value: vendas.toLocaleString('pt-BR'),
            icon: Activity,
            hint: `${kpisGerais.totalVendedores} vendedor(es) ativo(s)`,
            accent: 'from-emerald-500/25 via-emerald-500/5 to-transparent',
            ring: 'hover:ring-emerald-500/40',
            iconColor: 'text-emerald-400',
            bar: null as number | null,
            barColor: 'bg-emerald-500',
          },
        ];
        return (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {totalizadores.map((t) => {
              const Icon = t.icon;
              return (
                <Card
                  key={t.key}
                  className={cn(
                    'group relative overflow-hidden border-border/60 transition-all duration-300',
                    'hover:-translate-y-0.5 hover:shadow-lg hover:ring-1',
                    t.ring
                  )}
                >
                  <div className={cn('absolute inset-0 bg-gradient-to-br opacity-70 pointer-events-none', t.accent)} />
                  <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-white/5 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="relative p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
                        {t.label}
                      </span>
                      <div className={cn(
                        'h-7 w-7 rounded-md flex items-center justify-center bg-background/60 backdrop-blur-sm ring-1 ring-border/50',
                        'transition-transform group-hover:scale-110 group-hover:rotate-[-4deg]'
                      )}>
                        <Icon className={cn('h-3.5 w-3.5', t.iconColor)} />
                      </div>
                    </div>
                    <div className="text-2xl xl:text-[26px] font-bold font-mono tracking-tight leading-none">
                      {t.value}
                    </div>
                    <div className="mt-2 text-[11px] text-muted-foreground truncate">{t.hint}</div>
                    {t.bar != null && (
                      <div className="mt-2 h-1 rounded-full bg-muted/60 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-700', t.barColor)}
                          style={{ width: `${t.bar}%` }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
      })()}

      {/* ============== INSIGHTS INTELIGENTES ============== */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Insights Inteligentes</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {insights.map((ins, i) => {
            const Icon = ins.icon;
            return (
              <Card
                key={i}
                className="relative overflow-hidden border-border/60 transition-all duration-300 hover:border-primary/40 hover:shadow-lg group cursor-default"
              >
                <div className={cn(
                  'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none',
                  'bg-gradient-to-br',
                  ins.color.includes('emerald') && 'from-emerald-500/10 via-transparent to-transparent',
                  ins.color.includes('amber') && 'from-amber-500/10 via-transparent to-transparent',
                  ins.color.includes('red') && 'from-red-500/10 via-transparent to-transparent',
                  ins.color.includes('primary') && 'from-primary/10 via-transparent to-transparent',
                )} />
                <div className={cn(
                  'absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 group-hover:w-1.5',
                  ins.color.includes('emerald') && 'bg-emerald-500',
                  ins.color.includes('amber') && 'bg-amber-500',
                  ins.color.includes('red') && 'bg-red-500',
                  ins.color.includes('primary') && 'bg-primary',
                )} />
                <CardContent className="p-3 flex items-start gap-3 relative">
                  <div className={cn(
                    'h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110',
                    ins.color,
                    ins.color.includes('emerald') && 'bg-emerald-500/15',
                    ins.color.includes('amber') && 'bg-amber-500/15',
                    ins.color.includes('red') && 'bg-red-500/15',
                    ins.color.includes('primary') && 'bg-primary/15',
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm font-semibold leading-tight', ins.color)}>{ins.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{ins.subtitle}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ============== LINHA 1: Vendedores | Total/Meta | Gauge | Média por vendedor ============== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Lista vendedores */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Vendedores</p>
                <p className="text-[10px] text-muted-foreground">Clique p/ filtrar</p>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                {vendedoresLista.length}
              </span>
            </div>
            <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1 pb-2 scrollbar-thin">
              <button
                onClick={() => setVendedorFoco(null)}
                className={cn(
                  'w-full text-left px-2 py-1.5 rounded-md text-xs font-semibold uppercase transition-all duration-200',
                  !vendedorFoco
                    ? 'bg-gradient-to-r from-primary/20 to-primary/5 text-primary shadow-sm ring-1 ring-primary/30'
                    : 'text-muted-foreground hover:bg-muted/60 hover:translate-x-0.5'
                )}
              >
                ◉ Todos
              </button>
              {vendedoresLista.map(v => {
                const active = vendedorFoco === String(v.codigo);
                const pct = v.percentualMetaFaturado || 0;
                const dotColor = pct >= 100 ? 'bg-emerald-500' : pct >= 80 ? 'bg-amber-500' : 'bg-red-500';
                return (
                  <button
                    key={String(v.codigo)}
                    onClick={() => setVendedorFoco(String(v.codigo))}
                    className={cn(
                      'group w-full text-left px-2 py-1.5 rounded-md text-xs font-semibold uppercase transition-all duration-200 truncate flex items-center gap-1.5',
                      active
                        ? 'bg-gradient-to-r from-primary/20 to-primary/5 text-primary shadow-sm ring-1 ring-primary/30'
                        : 'text-foreground hover:bg-muted/60 hover:translate-x-0.5'
                    )}
                    title={`${v.nome} · ${formatPercent(pct)}`}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', dotColor, 'shadow-[0_0_6px_currentColor]')} />
                    <span className="truncate flex-1">{v.nome}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Valor Total + Meta Total empilhados */}
        <div className="lg:col-span-3 grid grid-rows-2 gap-3">
          <Card className="relative overflow-hidden group transition-all duration-300 hover:shadow-lg hover:border-emerald-500/40">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-60" />
            <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-emerald-500/10 blur-2xl group-hover:bg-emerald-500/20 transition-colors" />
            <CardContent className="p-4 flex flex-col justify-between h-full relative">
              <div className="flex items-start justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Valor Total</p>
                <Calendar className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold mt-2 bg-gradient-to-br from-emerald-500 to-emerald-700 bg-clip-text text-transparent">
                  {formatCurrency(totais.valorTotal)}
                </p>
                <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
                    style={{ width: `${Math.min(totais.percentual, 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden group transition-all duration-300 hover:shadow-lg hover:border-violet-500/40">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent opacity-60" />
            <div className="absolute -right-6 -bottom-6 h-20 w-20 rounded-full bg-violet-500/10 blur-2xl group-hover:bg-violet-500/20 transition-colors" />
            <CardContent className="p-4 flex flex-col justify-between h-full relative">
              <div className="flex items-start justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Meta Total</p>
                <Target className="h-4 w-4 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-bold mt-2 bg-gradient-to-br from-violet-500 to-violet-700 bg-clip-text text-transparent">
                  {formatCurrency(totais.metaTotal)}
                </p>
                {(() => {
                  const diff = totais.valorTotal - totais.metaTotal;
                  const isAcima = diff >= 0;
                  return (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {isAcima ? 'Acima ' : 'Abaixo '}
                      <span className={cn('font-semibold', isAcima ? 'text-emerald-500' : 'text-rose-500')}>
                        {formatCurrency(Math.abs(diff))}
                      </span>
                    </p>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gauge % Meta - Premium SaaS Enterprise (Donut Gauge) */}
        <Card
          className="lg:col-span-3 relative overflow-hidden bg-card border-border"
          style={{
            fontFamily: 'Inter, "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          <CardContent className="p-5 flex flex-col h-full relative">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Target className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} />
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Meta Atingida
                </p>
              </div>
              {totais.percentual >= 100 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                  <Check className="h-3 w-3" strokeWidth={3} />
                  META SUPERADA
                </span>
              )}
            </div>
            <div className="flex-1 flex items-center justify-center">
              <GaugeSemi percent={totais.percentual} />
            </div>
          </CardContent>
        </Card>


        {/* Média mensal por vendedor */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Média Mensal por Vendedor</CardTitle>
            <p className="text-xs text-muted-foreground">{qtdMesesPeriodo} {qtdMesesPeriodo === 1 ? 'mês' : 'meses'} no período</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-[260px] overflow-y-auto overflow-x-hidden scrollbar-thin">
              <Table className="w-full table-fixed">
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="text-xs px-2 w-[52%]">Vendedor</TableHead>
                    <TableHead className="text-xs text-right px-2 w-[14%]">% Meta</TableHead>
                    <TableHead className="text-xs text-right px-2 w-[17%]">Valor Médio</TableHead>
                    <TableHead className="text-xs text-right px-2 w-[17%]">Meta Média</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mediaMensalPorVendedor.map(r => {
                    const cor = r.pctMeta >= 100 ? 'emerald' : r.pctMeta >= 80 ? 'amber' : 'red';
                    const isSelected = vendedorFoco === String(r.codigo);
                    return (
                      <TableRow
                        key={r.codigo}
                        onClick={() => setVendedorFoco(isSelected ? null : String(r.codigo))}
                        className={cn(
                          'cursor-pointer transition-colors group',
                          isSelected
                            ? 'bg-primary/10 hover:bg-primary/15 ring-1 ring-inset ring-primary/40'
                            : 'hover:bg-muted/40'
                        )}
                      >
                        <TableCell className="font-semibold uppercase text-xs px-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={cn(
                              'h-1.5 w-1.5 rounded-full flex-shrink-0',
                              cor === 'emerald' && 'bg-emerald-500',
                              cor === 'amber' && 'bg-amber-500',
                              cor === 'red' && 'bg-red-500',
                            )} />
                            <span className={cn('truncate', isSelected && 'text-primary')} title={r.nome}>{r.nome}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-2">
                          <span className={cn(
                            'font-mono text-xs font-semibold',
                            cor === 'emerald' && 'text-emerald-500',
                            cor === 'amber' && 'text-amber-500',
                            cor === 'red' && 'text-red-500',
                          )}>
                            {formatPercent(r.pctMeta)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs px-2 truncate">{formatCurrency(r.valorMedio)}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground px-2 truncate">{formatCurrency(r.metaMedia)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============== LINHA 2: Realizado vs Meta + Média Mensal Geral ============== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Gráfico Realizado vs Meta */}
        <Card className="lg:col-span-7">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Realizado vs Meta {chartView === 'anual' ? 'Anual' : chartView === 'mensal' ? 'Mensal' : 'Diária'}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Meta diária média: <span className="font-semibold text-foreground">{formatCurrency(kpisGerais.totalMeta / diasUteisNoMes)}</span>
                  {' • '}
                  <span className={cn(
                    'font-semibold',
                    totais.percentual >= 100 ? 'text-emerald-500' : totais.percentual >= 80 ? 'text-amber-500' : 'text-red-500'
                  )}>{formatPercent(totais.percentual)} atingido</span>
                  {anosAtingidos && (
                    <> {' • '}<span className="font-semibold">{anosAtingidos.ok}/{anosAtingidos.total} anos ≥ meta</span></>
                  )}
                </p>
              </div>
              {melhorPonto && chartView === 'anual' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30">
                  <Trophy className="h-4 w-4 text-emerald-500" />
                  <div className="text-xs">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">Melhor ano - {melhorPonto.label}</p>
                    <p className="font-bold text-emerald-500">{formatCurrency(melhorPonto.valor)}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-1 mt-2">
              {(['anual', 'mensal', 'diario'] as ChartView[]).map(v => (
                <Button
                  key={v}
                  variant={chartView === v ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-3 text-xs capitalize"
                  onClick={() => setChartView(v)}
                >
                  {v === 'diario' ? 'Diário' : v === 'mensal' ? 'Mensal' : 'Anual'}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dadosGrafico}>
                  <defs>
                    <linearGradient id="bar-realizado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(142, 71%, 55%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(142, 71%, 35%)" stopOpacity={0.85} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatCompactNumber(v)} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number) => formatCurrency(v)}
                    cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      boxShadow: '0 10px 30px -10px hsl(var(--primary) / 0.3)',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="valor" name="Valor Venda" fill="url(#bar-realizado)" radius={[6, 6, 0, 0]} maxBarSize={80} animationDuration={800} />
                  <Line
                    type="monotone"
                    dataKey="meta"
                    name="Meta"
                    stroke="hsl(280, 65%, 60%)"
                    strokeWidth={2.5}
                    strokeDasharray="5 5"
                    dot={{ r: 3, fill: 'hsl(280, 65%, 60%)', strokeWidth: 1, stroke: 'hsl(var(--background))' }}
                    activeDot={{ r: 5, fill: 'hsl(280, 65%, 70%)' }}
                    animationDuration={800}
                    isAnimationActive={false}
                  />
                  {chartView !== 'diario' && (
                    <Line
                      type="monotone"
                      dataKey="metaDiaria"
                      name="Meta Diária"
                      stroke="hsl(38, 92%, 55%)"
                      strokeWidth={2}
                      strokeDasharray="2 4"
                      dot={{ r: 2.5, fill: 'hsl(38, 92%, 55%)', strokeWidth: 1, stroke: 'hsl(var(--background))' }}
                      activeDot={{ r: 4, fill: 'hsl(38, 92%, 65%)' }}
                      animationDuration={800}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* KPIs do gráfico */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <div className="rounded-md border border-border/40 bg-muted/20 px-3 py-2 border-l-2 border-l-emerald-500/70 flex flex-col justify-between min-h-[58px]">
                <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">Total Realizado</p>
                <p className="font-bold text-sm font-mono mt-1">{formatCurrency(totaisGrafico.totalRealizado)}</p>
              </div>
              <div className="rounded-md border border-border/40 bg-muted/20 px-3 py-2 border-l-2 border-l-violet-500/70 flex flex-col justify-between min-h-[58px]">
                <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">Meta Total</p>
                <p className="font-bold text-sm font-mono mt-1">{formatCurrency(totaisGrafico.totalMeta)}</p>
              </div>
              <div className={cn(
                'rounded-md border border-border/40 bg-muted/20 px-3 py-2 border-l-2 flex flex-col justify-between min-h-[58px]',
                totaisGrafico.diferenca >= 0 ? 'border-l-emerald-500/70' : 'border-l-red-500/70'
              )}>
                <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">Diferença</p>
                <p className={cn('font-bold text-sm font-mono mt-1 flex items-center gap-1', totaisGrafico.diferenca >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                  {totaisGrafico.diferenca >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {formatCurrency(Math.abs(totaisGrafico.diferenca))}
                </p>
              </div>
              <div className="rounded-md border border-border/40 bg-muted/20 px-3 py-2 border-l-2 border-l-amber-500/70 flex flex-col justify-between min-h-[58px]">
                <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">Meta Diária</p>
                <p className="font-bold text-sm font-mono mt-1">{formatCurrency(totaisGrafico.metaDiaria)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Média mensal geral */}
        <Card className="lg:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Média Mensal Geral</CardTitle>
            <p className="text-xs text-muted-foreground">Faturamento e meta por período · evolução vs mesmo mês ano anterior</p>
          </CardHeader>
          <CardContent>
            <div className="max-h-[320px] overflow-y-auto overflow-x-hidden scrollbar-thin">
              <Table className="w-full table-fixed">
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="text-xs px-1.5 w-[10%]">Ano</TableHead>
                    <TableHead className="text-xs px-1.5 w-[14%]">Mês</TableHead>
                    <TableHead className="text-xs text-right px-1.5 w-[12%]">% Meta</TableHead>
                    <TableHead className="text-xs text-right px-1.5 w-[24%]">Valor</TableHead>
                    <TableHead className="text-xs text-right px-1.5 w-[22%]">Meta</TableHead>
                    <TableHead className="text-xs text-right px-1.5 w-[18%]">Evol.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mediaMensalGeral.map(l => {
                    const cor = l.pct >= 100 ? 'emerald' : l.pct >= 80 ? 'amber' : 'red';
                    return (
                      <TableRow key={l.key} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-semibold text-xs px-1.5">{l.ano}</TableCell>
                        <TableCell className="text-xs px-1.5 truncate">{l.mesNome}</TableCell>
                        <TableCell className="text-right px-1.5">
                          {l.meta > 0 ? (
                            <span className={cn(
                              'font-mono text-xs font-semibold',
                              cor === 'emerald' && 'text-emerald-500',
                              cor === 'amber' && 'text-amber-500',
                              cor === 'red' && 'text-red-500',
                            )}>
                              {formatPercent(l.pct)}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs px-1.5 whitespace-nowrap" title={formatCurrency(l.valor)}>
                          {formatCurrency(l.valor)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground px-1.5 whitespace-nowrap" title={l.meta > 0 ? formatCurrency(l.meta) : ''}>
                          {l.meta > 0 ? formatCurrency(l.meta) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs px-1.5">
                          {l.evolucao === null ? (
                            <span className="text-muted-foreground inline-flex items-center gap-0.5"><Minus className="h-3 w-3" /></span>
                          ) : (
                            <span className={cn(
                              'inline-flex items-center gap-0.5 font-semibold',
                              l.evolucao >= 0 ? 'text-emerald-500' : 'text-red-500'
                            )}>
                              {l.evolucao >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                              {formatPercent(Math.abs(l.evolucao))}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============== Donut 360° Premium (Apple Fitness + Stripe + Linear) ==============
function GaugeSemi({ percent }: { percent: number }) {
  const META = 80;
  const diffPp = percent - META;
  const isSuperada = percent >= 100;
  const performance = (percent / META) * 100;
  const fmt = (n: number) => n.toFixed(1).replace('.', ',');

  const SIZE = 260;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 98;
  const STROKE = 18;
  const OVER_GAP = 7;
  const OVER_STROKE = 5;
  const R_OVER = R + STROKE / 2 + OVER_GAP + OVER_STROKE / 2;

  const C = 2 * Math.PI * R;
  const C_OVER = 2 * Math.PI * R_OVER;

  // Progresso principal (cap em 100%)
  const mainPct = Math.min(percent, 100) / 100;
  const mainLen = C * mainPct;

  // Anel externo: fecha 360° quando a meta foi atingida/superada (sinalização de conclusão)
  const overLen = isSuperada ? C_OVER : 0;

  // Posição da ponta do anel principal (começa às 12h, sentido horário)
  const tipAngleRad = -Math.PI / 2 + 2 * Math.PI * mainPct;
  const tipX = CX + R * Math.cos(tipAngleRad);
  const tipY = CY + R * Math.sin(tipAngleRad);

  // Sem ponta no anel externo quando ele forma um círculo fechado
  const tipOverX = CX;
  const tipOverY = CY - R_OVER;

  return (
    <div className="relative w-full flex items-center justify-center">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <defs>
          <linearGradient id="grad-ring-main" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="55%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
          <linearGradient id="grad-ring-over" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6ee7b7" />
            <stop offset="100%" stopColor="#a7f3d0" />
          </linearGradient>
          <radialGradient id="grad-tip" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#a7f3d0" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </radialGradient>
          <filter id="glow-tip" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="ring-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
            <feOffset dx="0" dy="2" result="offset" />
            <feComponentTransfer><feFuncA type="linear" slope="0.4" /></feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Trilha do anel principal — usa border token */}
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          className="stroke-border"
          strokeWidth={STROKE}
          opacity={0.6}
        />

        {/* Anel principal verde 360° */}
        {percent > 0 && (
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke="url(#grad-ring-main)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${mainLen} ${C}`}
            transform={`rotate(-90 ${CX} ${CY})`}
          />
        )}

        {/* Glow concentrado na ponta do progresso */}
        {percent > 0 && percent < 100 && (
          <circle cx={tipX} cy={tipY} r={STROKE * 0.9} fill="url(#grad-tip)" filter="url(#glow-tip)" />
        )}

        {/* Trilha externa removida — apenas o arco real do excedente é desenhado abaixo */}

        {/* Anel fino externo — excedente acima de 100% */}
        {overLen > 0 && (
          <circle
            cx={CX}
            cy={CY}
            r={R_OVER}
            fill="none"
            stroke="url(#grad-ring-over)"
            strokeWidth={OVER_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${overLen} ${C_OVER}`}
            transform={`rotate(-90 ${CX} ${CY})`}
            filter="url(#glow-tip)"
          />
        )}

        {/* Anel externo fechado — sem ponta de glow */}

        {/* Centro: valor */}
        <text
          x={CX}
          y={CY - 12}
          className="fill-foreground"
          fontSize="42"
          fontWeight="700"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontFeatureSettings: '"tnum"',
            letterSpacing: '-1.5px',
          }}
        >
          {fmt(percent)}%
        </text>
        <text
          x={CX}
          y={CY + 18}
          className="fill-emerald-500"
          fontSize="10.5"
          fontWeight="700"
          letterSpacing="1.6"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ textTransform: 'uppercase' }}
        >
          {isSuperada ? 'Meta superada' : 'Abaixo da meta'}
        </text>
        <text
          x={CX}
          y={CY + 38}
          className="fill-muted-foreground"
          fontSize="11"
          fontWeight="500"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          {diffPp >= 0 ? '+' : ''}{fmt(diffPp)} p.p.
        </text>
      </svg>
    </div>
  );
}






