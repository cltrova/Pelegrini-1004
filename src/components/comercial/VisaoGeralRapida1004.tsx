import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency, formatFiltroPeriodoLabel, formatPercent } from '@/utils/formatters';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart
} from 'recharts';
import {
  CalendarDays, Target, Zap, Users, TrendingUp, TrendingDown, Crown, Activity, Flame
} from 'lucide-react';
import { RankingVendedoresChart } from './RankingVendedoresChart';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { isContextoChevrolet10041, vendedorOcultoFiltroContextual1004 } from '@/utils/vendedores1004';
import { PelegriniResponsiveValue } from '@/components/pelegrini';


interface Props {
  vendedoresComMeta: any[];
  vendedoresGrafico?: any[];
  kpisGerais: any;
  pedidos: any[];
  evolucaoDiaria: any[];
  evolucaoMensal: any[];
  periodoFiltros: { ano: number; mes: number };
  periodoAplicado?: { inicio: string; fim: string };
  diasUteisNoMes: number;
  diasUteisDecorridos: number;
  onDetalheVendedor?: (row: any, ranking: number) => void;
  onReceitaClick?: () => void;
}

const STATUS_COLOR = {
  acima: 'hsl(var(--success, 142 71% 45%))',
  proximo: 'hsl(var(--warning, 38 92% 50%))',
  abaixo: 'hsl(var(--destructive))',
};

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 173 58% 45%))',
  'hsl(var(--chart-3, 197 37% 55%))',
  'hsl(var(--chart-4, 43 74% 60%))',
  'hsl(var(--chart-5, 27 87% 60%))',
  'hsl(var(--accent))',
  'hsl(var(--secondary))',
];

export function getCorParticipacaoVendedor(nome: string, index: number): string {
  if (nome.trim().toUpperCase() === 'ELIELTON') return '#db2777';
  return PIE_COLORS[index % PIE_COLORS.length];
}

function getReceitaPedido1004(p: any): number {
  if (p.tipo === 'DEVOLUCAO') {
    return -Math.abs(Number(p.valor_devolucao_real || p.valor_real || p.valor_liquido || 0));
  }
  const liquidoFinal = Number(p.valor_liquido_final ?? Math.max(0, Math.abs(Number(p.valor_bruto || 0)) - Math.abs(Number(p.valor_desconto || 0))));
  const devolucao = Math.abs(Number(p.valor_devolucao_real || 0));
  return liquidoFinal - devolucao;
}

export function VisaoGeralRapida1004({
  vendedoresComMeta,
  vendedoresGrafico,
  kpisGerais,
  pedidos,
  periodoFiltros,
  periodoAplicado,
  diasUteisNoMes,
  diasUteisDecorridos,
  onDetalheVendedor,
  onReceitaClick,
}: Props) {
  // sem toggle: sempre segue o filtro global (mês/período selecionado)
  const { codEmpresaAtiva, empresa } = useEmpresaAtiva();
  const { filialAtiva, filialNome } = useFilialSelecionada();
  const empresaComFilial = useMemo(() => {
    if (!filialNome) return empresa;
    return { ...empresa, nome: `${empresa?.nome ?? ''} ${filialNome}` };
  }, [empresa, filialNome]);
  const isContextoChevrolet10041Ativo = isContextoChevrolet10041(codEmpresaAtiva, filialAtiva, empresaComFilial);
  const isEmpresa1001 = codEmpresaAtiva === '1001';
  const isEmpresaPelegrini = codEmpresaAtiva === '1004' || codEmpresaAtiva === '10041' || isContextoChevrolet10041Ativo;
  const showDevolucoesCard = isEmpresa1001 || isEmpresaPelegrini;
  const periodoLabel = useMemo(
    () => formatFiltroPeriodoLabel(periodoAplicado, periodoFiltros),
    [periodoAplicado, periodoFiltros],
  );

  const { ano, mes } = periodoFiltros;
  const hoje = new Date();
  const isMesAtual = hoje.getFullYear() === ano && (hoje.getMonth() + 1) === mes;
  const diaHoje = isMesAtual ? hoje.getDate() : new Date(ano, mes, 0).getDate();
  const totalDiasMes = new Date(ano, mes, 0).getDate();

  // ============ Pedidos do mês filtrado (faturados) ============
  const pedidosMes = useMemo(() => {
    return pedidos.filter(p => {
      const d = (p.data_faturamento || '').toString();
      if (!d) return false;
      const [y, m] = d.split('-').map((x: string) => parseInt(x));
      return y === ano && m === mes;
    });
  }, [pedidos, ano, mes]);

  // ============ Acumulado diário do mês vs meta ============
  const dadosAcumulado = useMemo(() => {
    const porDia = new Map<number, number>();
    for (const p of pedidosMes) {
      const dia = parseInt((p.data_faturamento || '').substring(8, 10));
      if (!dia) continue;
      porDia.set(dia, (porDia.get(dia) || 0) + getReceitaPedido1004(p));
    }
    const metaMensal = kpisGerais.totalMeta || 0;
    const metaDiariaLinear = diasUteisNoMes > 0 ? metaMensal / diasUteisNoMes : 0;
    let acc = 0;
    let diaUtil = 0;
    const out: any[] = [];
    for (let d = 1; d <= totalDiasMes; d++) {
      const dt = new Date(ano, mes - 1, d);
      const dow = dt.getDay();
      const isUtil = dow !== 0 && dow !== 6;
      if (isUtil) diaUtil++;
      acc += porDia.get(d) || 0;
      const metaAcc = metaDiariaLinear * diaUtil;
      out.push({
        dia: d,
        label: String(d).padStart(2, '0'),
        realizado: d <= diaHoje ? acc : null,
        meta: metaAcc,
      });
    }
    return out;
  }, [pedidosMes, kpisGerais.totalMeta, diasUteisNoMes, ano, mes, totalDiasMes, diaHoje]);

  // Chave de agrupamento alinhada ao restante do dashboard 1004:
  // usa vendedor_codigo → vendedor_nome → nome_interno → nome_externo
  // para não colapsar pedidos sem código num único bucket.
  const getVendKey = (p: any) =>
    String(p?.vendedor_codigo ?? p?.vendedor_nome ?? p?.nome_interno ?? p?.nome_externo ?? '').trim();

  const vendedoresVisiveis1004 = useMemo(
    () => vendedoresComMeta.filter((v) => !vendedorOcultoFiltroContextual1004(v?.nome, isContextoChevrolet10041Ativo)),
    [vendedoresComMeta, isContextoChevrolet10041Ativo],
  );

  const vendedoresGraficoVisiveis1004 = useMemo(
    () => (vendedoresGrafico ?? vendedoresComMeta)
      .filter((v) => !vendedorOcultoFiltroContextual1004(v?.nome, isContextoChevrolet10041Ativo)),
    [vendedoresGrafico, vendedoresComMeta, isContextoChevrolet10041Ativo],
  );

  const pedidosMesVisiveis1004 = useMemo(
    () => pedidosMes.filter((p) => {
      const nome = p?.vendedor_nome ?? p?.nome_interno ?? p?.nome_externo ?? '';
      return !vendedorOcultoFiltroContextual1004(nome, isContextoChevrolet10041Ativo);
    }),
    [pedidosMes, isContextoChevrolet10041Ativo],
  );

  // ============ Faturamento por vendedor (dia atual x mês) ============
  const dadosPorVendedor = useMemo(() => {
    if (isEmpresaPelegrini) {
      return vendedoresGraficoVisiveis1004
        .map(v => {
          const valorMes = Number(
            v.faturamentoMesAtual ??
            v.metaReal ??
            v.valorFaturado ??
            v.faturamentoLiquido ??
            0
          );
          return {
            codigo: v.codigo,
            nome: v.nome,
            dia: Number(v.dia ?? 0),
            mes: Number.isFinite(valorMes) ? valorMes : 0,
            meta: v.metaMensal || 0,
            metaDiaria: v.metaDiaria || 0,
            status: v.status,
            _row: v,
          };
        })
        .filter(v => isContextoChevrolet10041Ativo || v.mes > 0 || v.meta > 0)
        .sort((a, b) => b.mes - a.mes);
    }

    const porVend = new Map<string, { dia: number; mes: number }>();
    for (const p of pedidosMesVisiveis1004) {
      const cod = getVendKey(p);
      if (!cod) continue;
      const cur = porVend.get(cod) || { dia: 0, mes: 0 };
      const val = getReceitaPedido1004(p);
      cur.mes += val;
      const dia = parseInt((p.data_faturamento || '').substring(8, 10));
      if (dia === diaHoje) cur.dia += val;
      porVend.set(cod, cur);
    }
    return vendedoresVisiveis1004
      .map(v => {
        const t = porVend.get(String(v.codigo)) || { dia: 0, mes: 0 };
        return {
          codigo: v.codigo,
          nome: v.nome,
          dia: t.dia,
          mes: t.mes,
          meta: v.metaMensal || 0,
          metaDiaria: v.metaDiaria || 0,
          status: v.status,
          _row: v,
        };
      })
      .filter(v => v.mes > 0 || v.meta > 0)
      .sort((a, b) => b.mes - a.mes);
  }, [pedidosMesVisiveis1004, vendedoresVisiveis1004, vendedoresGraficoVisiveis1004, diaHoje, isEmpresaPelegrini, isContextoChevrolet10041Ativo]);

  // ============ Participação (donut) ============
  const participacao = useMemo(() => {
    const total = isEmpresaPelegrini
      ? Number(kpisGerais.totalFaturado || 0) || 1
      : dadosPorVendedor.reduce((a, v) => a + v.mes, 0) || 1;
    return dadosPorVendedor
      .map(v => ({ nome: v.nome, valor: v.mes, pct: (v.mes / total) * 100 }));
  }, [dadosPorVendedor, isEmpresaPelegrini, kpisGerais.totalFaturado]);

  // ============ Heatmap dias x vendedores ============
  const heatmap = useMemo(() => {
    const map = new Map<string, Map<number, number>>();
    let maxVal = 0;
    for (const p of pedidosMesVisiveis1004) {
      const cod = getVendKey(p);
      if (!cod) continue;
      const dia = parseInt((p.data_faturamento || '').substring(8, 10));
      if (!dia) continue;
      if (!map.has(cod)) map.set(cod, new Map());
      const inner = map.get(cod)!;
      const nv = (inner.get(dia) || 0) + getReceitaPedido1004(p);
      inner.set(dia, nv);
      if (nv > maxVal) maxVal = nv;
    }
    const linhas = vendedoresVisiveis1004
      .filter(v => map.has(String(v.codigo)))
      .map(v => ({
        nome: v.nome,
        cells: Array.from({ length: totalDiasMes }, (_, i) => map.get(String(v.codigo))?.get(i + 1) || 0),
      }));
    return { linhas, maxVal: maxVal || 1 };
  }, [pedidosMesVisiveis1004, vendedoresVisiveis1004, totalDiasMes]);


  // ============ KPIs de decisão ============
  const kpiDecisao = useMemo(() => {
    const meta = kpisGerais.totalMeta || 0;
    const fat = kpisGerais.totalFaturado || 0;
    const pct = meta > 0 ? (fat / meta) * 100 : 0;
    const gap = meta - fat;
    const diasUteisRestantes = Math.max(0, diasUteisNoMes - diasUteisDecorridos);
    const diariaRealizada = diasUteisDecorridos > 0 ? fat / diasUteisDecorridos : 0;
    const diariaNecessaria = diasUteisRestantes > 0 && gap > 0 ? gap / diasUteisRestantes : 0;
    const projecao = diasUteisDecorridos > 0 ? diariaRealizada * diasUteisNoMes : fat;
    const projPct = meta > 0 ? (projecao / meta) * 100 : 0;
    let ritmoStatus: 'acelerar' | 'noritmo' | 'folga' = 'acelerar';
    if (gap <= 0) ritmoStatus = 'folga';
    else if (diariaRealizada >= diariaNecessaria * 0.95) ritmoStatus = 'noritmo';

    const acima = kpisGerais.acimaMeta || 0;
    const proximo = kpisGerais.proximoMeta || 0;
    const abaixo = kpisGerais.abaixoMeta || 0;
    const totalEq = acima + proximo + abaixo || 1;

    return {
      fat, meta, pct, gap,
      diariaRealizada, diariaNecessaria, ritmoStatus,
      projecao, projPct,
      acima, proximo, abaixo, totalEq,
      diasUteisRestantes,
    };
  }, [kpisGerais, diasUteisNoMes, diasUteisDecorridos]);

  // sparkline 7 dias
  const spark7 = useMemo(() => {
    const arr = dadosAcumulado
      .filter(d => d.realizado != null)
      .slice(-7)
      .map((d, i) => ({ i, v: d.realizado }));
    return arr;
  }, [dadosAcumulado]);

  // ============ Totalizadores simples ============
  // Alinhado com a aba Detalhes: usa TODOS os pedidos do período (inclui devoluções)
  // e conta clientes únicos por cliente_codigo.
  const totais = useMemo(() => {
    const receita = kpisGerais.totalFaturado || 0;
    const vendas = isEmpresa1001
      ? (kpisGerais.qtdPedidos || 0)
      : (kpisGerais.qtdVendas || kpisGerais.qtdPedidos || pedidos.length);
    const clientes = kpisGerais.clientesAtendidos ?? new Set(pedidos.map(p => p.cliente_codigo)).size;
    const ticket = vendas > 0 ? receita / vendas : 0;
    return { receita, vendas, clientes, ticket };
  }, [pedidos, kpisGerais.totalFaturado, kpisGerais.qtdPedidos, kpisGerais.qtdVendas, kpisGerais.clientesAtendidos, isEmpresa1001]);


  const totalizadores = [
    {
      key: 'receita',
      label: 'Receita',
      value: formatCurrency(totais.receita),
      icon: TrendingUp,
      hint: `Meta ${formatCurrency(kpiDecisao.meta)} · ${formatPercent(kpiDecisao.pct)}`,
      accent: 'from-primary/25 via-primary/5 to-transparent',
      ring: 'hover:ring-primary/40',
      iconColor: 'text-primary',
      bar: Math.min(100, kpiDecisao.pct),
      barColor: 'bg-primary',
    },
    {
      key: 'ticket',
      label: 'Ticket Médio',
      value: formatCurrency(totais.ticket),
      icon: Target,
      hint: `${totais.vendas} vendas no período`,
      accent: 'from-amber-500/25 via-amber-500/5 to-transparent',
      ring: 'hover:ring-amber-500/40',
      iconColor: 'text-amber-500',
      bar: null,
      barColor: 'bg-amber-500',
    },
    {
      key: 'clientes',
      label: 'Clientes',
      value: totais.clientes.toLocaleString('pt-BR'),
      icon: Users,
      hint: `${totais.vendas > 0 ? (totais.vendas / Math.max(1, totais.clientes)).toFixed(1) : '0'} pedidos por cliente`,
      accent: 'from-violet-500/25 via-violet-500/5 to-transparent',
      ring: 'hover:ring-violet-500/40',
      iconColor: 'text-violet-400',
      bar: null,
      barColor: 'bg-violet-500',
    },
    ...(showDevolucoesCard ? [{
      key: 'devolucoes',
      label: 'Devoluções',
      value: formatCurrency(kpisGerais.totalDevolucoes || 0),
      icon: TrendingDown,
      hint: isEmpresa1001 ? 'Σ Valor_Devolucao' : 'Σ ValorDevolucao (linhas DEVOLUCAO)',
      accent: 'from-destructive/25 via-destructive/5 to-transparent',
      ring: 'hover:ring-destructive/40',
      iconColor: 'text-destructive',
      bar: null,
      barColor: 'bg-destructive',
    }] : []),
    {
      key: 'vendas',
      label: 'Vendas',
      value: totais.vendas.toLocaleString('pt-BR'),
      icon: Activity,
      hint: `${kpiDecisao.totalEq} vendedor(es) ativo(s)`,
      accent: 'from-emerald-500/25 via-emerald-500/5 to-transparent',
      ring: 'hover:ring-emerald-500/40',
      iconColor: 'text-emerald-400',
      bar: null,
      barColor: 'bg-emerald-500',
    },
  ];

  return (
    <div className={cn(
      'space-y-4',
      isEmpresaPelegrini && 'rounded-2xl border border-border/60 bg-card p-3 text-foreground shadow-none md:p-4',
    )}>
      {isEmpresaPelegrini && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 shadow-none">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/20">
              <CalendarDays className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{periodoLabel}</p>
            </div>
          </div>
        </div>
      )}

      {/* ================= Totalizadores premium ================= */}
      <div className={cn(
        "grid gap-3",
        isEmpresaPelegrini
          ? "grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))]"
          : (showDevolucoesCard ? "grid-cols-5" : "grid-cols-4"),
      )}>
        {totalizadores.map((t) => {
          const Icon = t.icon;
          const clickable = t.key === 'receita' && !!onReceitaClick;
          const pelegriniAccent = {
            receita: 'from-primary/10 via-primary/5 to-transparent',
            ticket: 'from-primary/8 via-muted/20 to-transparent',
            clientes: 'from-primary/8 via-muted/20 to-transparent',
            devolucoes: 'from-destructive/8 via-muted/20 to-transparent',
            vendas: 'from-primary/8 via-muted/20 to-transparent',
          }[t.key] || 'from-primary/8 to-transparent';
          return (
            <Card
              key={t.key}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={clickable ? onReceitaClick : undefined}
              onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onReceitaClick?.(); } } : undefined}
              title={clickable ? 'Clique para ver o detalhamento da Receita' : undefined}
              className={cn(
                'group pelegrini-kpi-card relative min-w-0 overflow-hidden transition-all duration-300',
                isEmpresaPelegrini
                  ? 'pelegrini-led-card border-border/60 bg-card text-foreground hover:-translate-y-0.5'
                  : 'border-border/60 hover:-translate-y-0.5 hover:shadow-lg hover:ring-1',
                clickable && (isEmpresaPelegrini
                  ? 'cursor-pointer ring-1 ring-primary/20 hover:ring-primary/50'
                  : 'cursor-pointer ring-1 ring-primary/20 hover:ring-primary/60'),
                !isEmpresaPelegrini && t.ring
              )}
            >
              <div className={cn('absolute inset-0 bg-gradient-to-br pointer-events-none', isEmpresaPelegrini ? `opacity-45 ${pelegriniAccent}` : `opacity-70 ${t.accent}`)} />
              {!isEmpresaPelegrini && (
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-white/5 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
              <CardContent className="relative p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(
                    "text-[10px] uppercase tracking-[0.14em] font-medium",
                    isEmpresaPelegrini ? 'text-muted-foreground' : 'text-muted-foreground',
                  )}>
                    {t.label}
                  </span>
                  <div className={cn(
                    'h-7 w-7 rounded-md flex items-center justify-center backdrop-blur-sm ring-1',
                    isEmpresaPelegrini ? 'bg-background/60 text-primary ring-border/50' : 'bg-background/60 ring-border/50',
                    'transition-transform group-hover:scale-110 group-hover:rotate-[-4deg]',
                  )}>
                    <Icon className={cn('h-3.5 w-3.5', isEmpresaPelegrini ? 'text-primary' : t.iconColor)} />
                  </div>
                </div>
                <PelegriniResponsiveValue as="div" size="md" className={cn(isEmpresaPelegrini ? 'text-foreground' : 'tracking-tight')}>
                  {t.value}
                </PelegriniResponsiveValue>
                
                {t.bar != null && (
                  <div className={cn("mt-2 h-1 rounded-full overflow-hidden", isEmpresaPelegrini ? 'bg-muted/60' : 'bg-muted/60')}>
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', isEmpresaPelegrini ? 'bg-primary' : t.barColor)}
                      style={{ width: `${t.bar}%` }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

      </div>


      {/* ================= Faturamento por vendedor (interativo) ================= */}
      <RankingVendedoresChart
        data={dadosPorVendedor}
        periodo={periodoAplicado}
        variant={isEmpresaPelegrini ? 'pelegriniBlue' : 'default'}
        onClick={(row) => onDetalheVendedor?.(row, 0)}
      />

      {/* ================= Gráfico Acumulado ================= */}
      <Card className={cn(isEmpresaPelegrini && 'pelegrini-led-card border-border/60 bg-card text-foreground')}>
        <CardContent className="pt-6">

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dadosAcumulado} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRealizado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isEmpresaPelegrini ? 'hsl(var(--primary))' : 'hsl(var(--primary))'} stopOpacity={isEmpresaPelegrini ? 0.22 : 0.5} />
                    <stop offset="100%" stopColor={isEmpresaPelegrini ? 'hsl(var(--primary))' : 'hsl(var(--primary))'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={isEmpresaPelegrini ? 0.42 : 0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 13, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis
                  tick={{ fontSize: 13, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    color: 'hsl(var(--popover-foreground))',
                    fontSize: 14,
                  }}
                  formatter={(v: any, name: any) => [v != null ? formatCurrency(v) : '—', name]}
                  labelFormatter={(l) => `Dia ${l}`}
                />
                <Area
                  type="monotone" dataKey="realizado" name="Realizado"
                  stroke={isEmpresaPelegrini ? 'hsl(var(--primary))' : 'hsl(var(--primary))'} strokeWidth={2} fill="url(#gradRealizado)"
                />
                <Line
                  type="monotone" dataKey="meta" name="Meta acumulada"
                  stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="6 4" dot={false}
                />
                {isMesAtual && (
                  <ReferenceLine
                    x={String(diaHoje).padStart(2, '0')}
                    stroke="hsl(var(--destructive))"
                    strokeDasharray="3 3"
                    label={{ value: 'Hoje', position: 'top', fill: 'hsl(var(--destructive))', fontSize: 13 }}
                  />
                )}
                <Legend wrapperStyle={{ fontSize: 13 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>



      {/* ================= Grid extras ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut participação */}
        <Card className={cn(isEmpresaPelegrini && 'pelegrini-led-card border-border/60 bg-card text-foreground')}>
          <CardContent className="pt-6">

            <div className={cn("flex flex-col", isEmpresa1001 ? "h-96" : "h-64")}>
              <div className={cn("flex items-baseline justify-between px-1 pb-2 border-b", isEmpresaPelegrini ? 'border-border/60' : 'border-border/60')}>
                <span className={cn("text-[10px] uppercase tracking-wide", isEmpresaPelegrini ? 'text-muted-foreground' : 'text-muted-foreground')}>Total</span>
                <span className="text-sm font-bold font-mono">{formatCurrency(kpiDecisao.fat)}</span>
              </div>
              <div className={cn("flex-1 overflow-y-auto pr-1 mt-1 divide-y", isEmpresaPelegrini ? 'divide-border/40' : 'divide-border/40')}>
                {participacao.length === 0 && (
                  <div className={cn("text-center text-xs py-6", isEmpresaPelegrini ? 'text-muted-foreground' : 'text-muted-foreground')}>Sem dados</div>
                )}
                {participacao.map((v, i) => {
                  const corParticipacao = getCorParticipacaoVendedor(v.nome, i);
                  return <div
                    key={v.nome}
                    className={cn(
                      "items-center gap-2 text-sm",
                      isEmpresa1001 ? "flex py-2.5" : "grid grid-cols-[auto_1fr_auto_auto] py-1.5"
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ background: corParticipacao }}
                    />
                    <span className={cn(
                      "font-medium leading-tight",
                      isEmpresa1001 ? "flex-1 min-w-0 break-words" : "truncate"
                    )}>{v.nome}</span>
                    <span className="font-mono text-right tabular-nums text-foreground">
                      {formatCurrency(v.valor)}
                    </span>
                    <span
                      className="font-mono font-semibold w-14 text-right tabular-nums"
                      style={{ color: corParticipacao }}
                    >
                      {v.pct.toFixed(1)}%
                    </span>
                  </div>;
                })}
              </div>

            </div>
          </CardContent>
        </Card>


        {/* Heatmap dias x vendedores */}
        <Card className={cn(isEmpresaPelegrini && 'pelegrini-led-card border-border/60 bg-card text-foreground')}>
          <CardContent className="pt-6">

            <div className="overflow-x-auto">
              <div className="min-w-[500px]">
                {/* Cabeçalho dias */}
                <div className="flex items-center gap-[2px] mb-1 pl-24">
                  {Array.from({ length: totalDiasMes }, (_, i) => i + 1).map(d => (
                    <div key={d} className={cn("flex-1 text-center text-[9px]", isEmpresaPelegrini ? 'text-muted-foreground' : 'text-muted-foreground')}>
                      {d % 5 === 0 || d === 1 ? d : ''}
                    </div>
                  ))}
                </div>
                {heatmap.linhas.map(linha => (
                  <div key={linha.nome} className="flex items-center gap-[2px] mb-[2px]">
                    <div className="w-24 text-xs truncate uppercase pr-2">{linha.nome}</div>
                    {linha.cells.map((val, i) => {
                      const intensity = val / heatmap.maxVal;
                      const dt = new Date(ano, mes - 1, i + 1);
                      const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                      return (
                        <div
                          key={i}
                          title={`Dia ${i + 1}: ${formatCurrency(val)}`}
                          className="flex-1 h-5 rounded-sm transition-all hover:ring-1 hover:ring-primary"
                          style={{
                            background: val > 0
                              ? `hsl(var(--primary) / ${0.15 + intensity * 0.85})`
                              : isWeekend ? 'hsl(var(--muted) / 0.3)' : 'hsl(var(--muted) / 0.6)',
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
                {heatmap.linhas.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-8">Sem dados no período</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
