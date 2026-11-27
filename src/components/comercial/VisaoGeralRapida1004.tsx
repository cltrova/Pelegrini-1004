import { useId, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatCompactNumber, formatCurrency, formatPercent, formatPeriod } from '@/utils/formatters';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, Legend,
} from 'recharts';
import { ArrowUpRight, BarChart3, CalendarDays, ChartNoAxesCombined, Percent, TrendingUp, Trophy, X } from 'lucide-react';
import { RankingVendedoresChart } from './RankingVendedoresChart';
import { DashboardGoalPace, DashboardPageHeading, DashboardTeamGoals, formatDashboardPeriod, getTeamGoalStatus, type TeamGoalStatus } from './DashboardOverviewManagement';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { getFeriadosComerciaisMeta } from '@/utils/feriadosComerciais';
import {
  isContextoChevrolet10041,
  vendedorForcaP1004,
  vendedorOcultoFiltroContextual1004,
} from '@/utils/vendedores1004';
import { ComercialMetricStrip, type ComercialMetric } from '@/components/comercial/compact';
import type { Pedido } from '@/types/comercial';
import './DashboardOverview.css';


type VendedorVisaoGeral = {
  codigo: string | number;
  nome: string;
  metaMensal?: number;
  metaDiaria?: number;
  faturamentoMesAtual?: number;
  metaReal?: number;
  valorFaturado?: number;
  faturamentoLiquido?: number;
  dia?: number;
  status?: string;
};

type LinhaFaturamento = Partial<Pick<Pedido,
  'tipo' | 'data_faturamento' | 'vendedor_codigo' | 'vendedor_nome' | 'cliente_codigo' |
  'valor_bruto' | 'valor_desconto' | 'valor_liquido' | 'valor_liquido_final' | 'valor_devolucao_real' | 'valor_real'
>> & { nome_interno?: unknown; nome_externo?: unknown };

type IndicadoresVisaoGeral = Partial<Record<
  'totalMeta' | 'totalMetaEsperada' | 'totalFaturado' | 'totalDevolucoes' | 'qtdPedidos' | 'qtdVendas' | 'clientesAtendidos',
  number
>>;

interface Props<TVendedor extends VendedorVisaoGeral> {
  vendedoresComMeta: TVendedor[];
  vendedoresGrafico?: TVendedor[];
  kpisGerais: IndicadoresVisaoGeral;
  pedidos: LinhaFaturamento[];
  periodoFiltros: { ano: number; mes: number };
  periodoAplicado?: { inicio: string; fim: string };
  diasUteisNoMes: number;
  diasUteisDecorridos: number;
  onDetalheVendedor?: (row: TVendedor, ranking: number) => void;
  onReceitaClick?: () => void;
}

function vendedorVisivelNoContexto1004(
  vendedor: Record<string, unknown> | null | undefined,
  isContextoChevrolet10041Ativo: boolean,
): boolean {
  if (isContextoChevrolet10041Ativo) {
    return !vendedorForcaP1004({
      codigo: vendedor?.codigo ?? vendedor?.vendedor_codigo ?? vendedor?.cod_vendedor,
      nome: vendedor?.nome ?? vendedor?.vendedor_nome ?? vendedor?.nome_interno ?? vendedor?.nome_externo,
    });
  }
  return !vendedorOcultoFiltroContextual1004(vendedor?.nome, false);
}

type SelecaoMapa = { codigo: string; dia: number; periodo: string };

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 173 58% 45%))',
  'hsl(var(--chart-3, 197 37% 55%))',
  'hsl(var(--chart-4, 43 74% 60%))',
  'hsl(var(--chart-5, 27 87% 60%))',
  'hsl(var(--accent))',
  'hsl(var(--secondary))',
];

const analysisTitles = {
  evolucao: 'Faturamento no mês',
  participacao: 'Participação nas vendas',
  mapa: 'Faturamento por dia e vendedor',
};

const QUICK_GOAL_SCALE = 120;

export function getCorParticipacaoVendedor(nome: string, index: number): string {
  if (nome.trim().toUpperCase() === 'ELIELTON') return '#db2777';
  return PIE_COLORS[index % PIE_COLORS.length];
}

function getReceitaPedido1004(p: LinhaFaturamento): number {
  if (p.tipo === 'DEVOLUCAO') {
    return -Math.abs(Number(p.valor_devolucao_real || p.valor_real || p.valor_liquido || 0));
  }
  const liquidoFinal = Number(p.valor_liquido_final ?? Math.max(0, Math.abs(Number(p.valor_bruto || 0)) - Math.abs(Number(p.valor_desconto || 0))));
  const devolucao = Math.abs(Number(p.valor_devolucao_real || 0));
  return liquidoFinal - devolucao;
}

export function VisaoGeralRapida1004<TVendedor extends VendedorVisaoGeral>({
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
}: Props<TVendedor>) {
  // sem toggle: sempre segue o filtro global (mês/período selecionado)
  const { codEmpresaAtiva, empresa } = useEmpresaAtiva();
  const { filialAtiva, filialNome } = useFilialSelecionada();
  const empresaComFilial = useMemo(() => {
    if (!filialNome) return empresa;
    return { ...empresa, nome: `${empresa?.nome ?? ''} ${filialNome}` };
  }, [empresa, filialNome]);
  const isContextoChevrolet10041Ativo = isContextoChevrolet10041(codEmpresaAtiva, filialAtiva, empresaComFilial);
  const isEmpresa1001 = String(codEmpresaAtiva) === '1001';
  const isEmpresaPelegrini = codEmpresaAtiva === '1004' || codEmpresaAtiva === '10041' || isContextoChevrolet10041Ativo;
  const reduceMotion = useReducedMotion();
  const gradientId = `dashboard-trend${useId().replace(/:/g, '')}`;
  const [previewHeatCell, setPreviewHeatCell] = useState<SelecaoMapa | null>(null);
  const [selectedHeatCell, setSelectedHeatCell] = useState<SelecaoMapa | null>(null);
  const [teamFilter, setTeamFilter] = useState<TeamGoalStatus | null>(null);
  const [analysisView, setAnalysisView] = useState<keyof typeof analysisTitles>('evolucao');
  const rankingRef = useRef<HTMLElement>(null);
  const rankingChartRef = useRef<HTMLElement>(null);

  const { ano, mes } = periodoFiltros;
  const hoje = new Date();
  const isMesAtual = hoje.getFullYear() === ano && (hoje.getMonth() + 1) === mes;
  const diaHoje = isMesAtual ? hoje.getDate() : new Date(ano, mes, 0).getDate();
  const totalDiasMes = new Date(ano, mes, 0).getDate();
  const periodoMapa = `${ano}-${String(mes).padStart(2, '0')}`;

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
    const feriados = new Set(getFeriadosComerciaisMeta(codEmpresaAtiva, ano, mes - 1));
    const metaDiariaLinear = diasUteisNoMes > 0 ? metaMensal / diasUteisNoMes : 0;
    let acc = 0;
    let diaUtil = 0;
    const out: Array<{ dia: number; label: string; realizado: number | null; meta: number }> = [];
    for (let d = 1; d <= totalDiasMes; d++) {
      const dt = new Date(ano, mes - 1, d);
      const dow = dt.getDay();
      const isUtil = dow !== 0 && dow !== 6 && !feriados.has(`${periodoMapa}-${String(d).padStart(2, '0')}`);
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
  }, [pedidosMes, kpisGerais.totalMeta, diasUteisNoMes, codEmpresaAtiva, ano, mes, periodoMapa, totalDiasMes, diaHoje]);

  // Chave de agrupamento alinhada ao restante do dashboard 1004:
  // usa vendedor_codigo → vendedor_nome → nome_interno → nome_externo
  // para não colapsar pedidos sem código num único bucket.
  const getVendKey = (p: LinhaFaturamento) =>
    String(p?.vendedor_codigo ?? p?.vendedor_nome ?? p?.nome_interno ?? p?.nome_externo ?? '').trim();

  const vendedoresVisiveis1004 = useMemo(
    () => vendedoresComMeta.filter((vendedor) => vendedorVisivelNoContexto1004(vendedor, isContextoChevrolet10041Ativo)),
    [vendedoresComMeta, isContextoChevrolet10041Ativo],
  );

  const vendedoresGraficoVisiveis1004 = useMemo(
    () => (vendedoresGrafico ?? vendedoresComMeta)
      .filter((vendedor) => vendedorVisivelNoContexto1004(vendedor, isContextoChevrolet10041Ativo)),
    [vendedoresGrafico, vendedoresComMeta, isContextoChevrolet10041Ativo],
  );

  const pedidosMesVisiveis1004 = useMemo(
    () => pedidosMes.filter((pedido) => vendedorVisivelNoContexto1004(pedido, isContextoChevrolet10041Ativo)),
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
    return dadosPorVendedor.map((v, index) => ({ ...v, ranking: index + 1, pct: (v.mes / total) * 100 }));
  }, [dadosPorVendedor, isEmpresaPelegrini, kpisGerais.totalFaturado]);

  const ranking = useMemo(() => {
    const counts: Record<TeamGoalStatus, number> = { atingida: 0, proxima: 0, abaixo: 0 };
    const rows = participacao.map((vendedor) => {
      const percent = vendedor.meta > 0 ? (vendedor.mes / vendedor.meta) * 100 : null;
      const status = percent === null ? null : getTeamGoalStatus(percent);
      if (status) counts[status]++;
      return { ...vendedor, percent, status, balance: percent === null ? null : vendedor.mes - vendedor.meta };
    });
    return { counts, rows };
  }, [participacao]);
  const rankingRows = teamFilter ? ranking.rows.filter(({ status }) => status === teamFilter) : ranking.rows;
  if (teamFilter === 'abaixo') {
    rankingRows.sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0));
  }

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
        codigo: String(v.codigo),
        nome: v.nome,
        cells: Array.from({ length: totalDiasMes }, (_, i) => map.get(String(v.codigo))?.get(i + 1) || 0),
      }));
    return { linhas, maxVal: maxVal || 1 };
  }, [pedidosMesVisiveis1004, vendedoresVisiveis1004, totalDiasMes]);

  const activeHeatCell = previewHeatCell ?? selectedHeatCell;
  const activeHeatRow = activeHeatCell?.periodo === periodoMapa
    ? heatmap.linhas.find(linha => linha.codigo === activeHeatCell.codigo)
    : undefined;


  // ============ KPIs de decisão ============
  const kpiDecisao = useMemo(() => {
    const meta = kpisGerais.totalMeta || 0;
    const fat = kpisGerais.totalFaturado || 0;
    const gap = meta - fat;
    const diasUteisRestantes = Math.max(0, diasUteisNoMes - diasUteisDecorridos);
    const diariaRealizada = diasUteisDecorridos > 0 ? fat / diasUteisDecorridos : 0;
    const diariaNecessaria = diasUteisRestantes > 0 && gap > 0 ? gap / diasUteisRestantes : 0;
    const projecao = diasUteisDecorridos > 0 ? diariaRealizada * diasUteisNoMes : fat;
    let ritmoStatus: 'acelerar' | 'noritmo' | 'folga' = 'acelerar';
    if (gap <= 0) ritmoStatus = 'folga';
    else if (diariaRealizada >= diariaNecessaria) ritmoStatus = 'noritmo';

    return { fat, meta, gap, diariaRealizada, diariaNecessaria, ritmoStatus, projecao, diasUteisRestantes };
  }, [kpisGerais, diasUteisNoMes, diasUteisDecorridos]);

  const hasGoal = kpiDecisao.meta > 0;
  const periodStartsAtMonthBeginning = !periodoAplicado || periodoAplicado.inicio === `${periodoMapa}-01`;
  const hasDailyAverage = periodStartsAtMonthBeginning && diasUteisDecorridos > 0;
  const showProjection = hasGoal && hasDailyAverage && isMesAtual && kpiDecisao.diasUteisRestantes > 0;
  const monthLabel = formatPeriod(periodoMapa);
  const periodLabel = formatDashboardPeriod(periodoAplicado) ?? monthLabel;

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


  const totalizadores: ComercialMetric[] = [
    {
      label: 'Pedidos',
      value: totais.vendas.toLocaleString('pt-BR'),
      tooltip: 'Quantidade de pedidos considerada no período selecionado.',
    },
    {
      label: 'Ticket médio',
      value: formatCurrency(totais.ticket),
      tooltip: 'Faturamento líquido dividido pela quantidade de pedidos.',
    },
    {
      label: 'Clientes',
      value: totais.clientes.toLocaleString('pt-BR'),
      tooltip: 'Clientes atendidos no período selecionado.',
    },
    {
      label: 'Devoluções',
      value: formatCurrency(kpisGerais.totalDevolucoes || 0),
      tone: kpisGerais.totalDevolucoes ? 'danger' : 'neutral',
      tooltip: 'Valor das devoluções registradas no período.',
    },
  ];

  const ParticipationRow = onDetalheVendedor ? 'button' : 'div';
  const handleTeamFilter = (status: TeamGoalStatus) => {
    setTeamFilter((current) => current === status ? null : status);
    const rankingSection = rankingRef.current;
    const viewport = rankingSection?.closest('[role="tabpanel"]');
    if (rankingSection && viewport) {
      const rankingBounds = rankingSection.getBoundingClientRect();
      const viewportBounds = viewport.getBoundingClientRect();
      if (rankingBounds.top < viewportBounds.top || rankingBounds.bottom > viewportBounds.bottom) {
        rankingSection.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    }
  };

  return (
    <div className="dashboard-overview-grid min-w-0 text-foreground">
      <DashboardPageHeading title="Desempenho comercial" period={periodLabel} />
      <DashboardGoalPace
        revenue={totais.receita}
        goal={hasGoal ? kpiDecisao.meta : null}
        expected={showProjection ? kpisGerais.totalMetaEsperada ?? null : null}
        daysRemaining={hasGoal && periodStartsAtMonthBeginning ? kpiDecisao.diasUteisRestantes : null}
        dailyActual={hasDailyAverage ? kpiDecisao.diariaRealizada : null}
        projection={showProjection ? kpiDecisao.projecao : null}
        dailyNeeded={showProjection && kpiDecisao.gap > 0 ? kpiDecisao.diariaNecessaria : null}
        pace={kpiDecisao.ritmoStatus}
        onRevenueClick={onReceitaClick}
      />
      <ComercialMetricStrip metrics={totalizadores} ariaLabel="Indicadores do dashboard comercial" />

      <section ref={rankingChartRef} className="dashboard-inline-ranking" aria-label="Gráfico de ranking de vendedores" tabIndex={-1}>
        <RankingVendedoresChart
          data={dadosPorVendedor}
          periodo={periodoAplicado}
          variant={isEmpresaPelegrini ? 'pelegriniBlue' : 'default'}
          onClick={onDetalheVendedor ? (row) => {
            onDetalheVendedor(row, ranking.rows.find(({ codigo }) => codigo === row.codigo)?.ranking ?? 0);
          } : undefined}
        />
      </section>

      <section ref={rankingRef} className="dashboard-frame dashboard-quick-ranking" id="dashboard-quick-ranking" aria-label="Metas por vendedor">
        <header className="dashboard-panel-heading">
          <h2><Trophy aria-hidden="true" /> Metas por vendedor</h2>
          <div className="dashboard-ranking-actions">
            {teamFilter && (
              <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setTeamFilter(null)}>
                Todos <X aria-hidden="true" className="size-3" />
              </Button>
            )}
            {ranking.rows.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => {
                  rankingChartRef.current?.focus({ preventScroll: true });
                  rankingChartRef.current?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
                }}
              >
                <BarChart3 aria-hidden="true" className="size-3.5" /> Ir para o gráfico
              </Button>
            )}
          </div>
        </header>
        {rankingRows.length === 0 ? (
          <p className="dashboard-analytics-empty">{teamFilter ? 'Nenhum vendedor nesta situação.' : 'Sem vendas ou metas no período.'}</p>
        ) : (
          <>
            <div className="dashboard-quick-row dashboard-quick-header" aria-hidden="true">
              <span />
              <span>Vendedor</span>
              <span className="dashboard-quick-bar" title="Escala de 0% a 120%. A marca indica 100% da meta.">Ritmo da meta</span>
              <span className="dashboard-quick-value">Faturado</span>
              <span className="dashboard-quick-percent">% Meta</span>
              <span className="dashboard-quick-balance">Saldo da meta</span>
            </div>
            <ol className="dashboard-quick-list" aria-label={teamFilter === 'abaixo' ? 'Vendedores por menor atingimento' : 'Vendedores por faturamento'}>
            {rankingRows.map((vendedor) => {
              const barValue = (Math.max(0, Math.min(vendedor.percent ?? 0, QUICK_GOAL_SCALE)) / QUICK_GOAL_SCALE) * 100;
              const goalDescription = vendedor.percent === null || vendedor.balance === null
                ? 'Sem meta cadastrada.'
                : `${formatPercent(vendedor.percent)} da meta. Saldo de ${formatCurrency(vendedor.balance, true)}.`;
              return (
                <li key={vendedor.codigo}>
                  <ParticipationRow
                    className="dashboard-quick-row"
                    type={onDetalheVendedor ? 'button' : undefined}
                    aria-label={onDetalheVendedor ? `Ver detalhes de ${vendedor.nome} no ranking` : undefined}
                    aria-description={onDetalheVendedor ? `${formatCurrency(vendedor.mes)} faturados. ${goalDescription}` : undefined}
                    onClick={onDetalheVendedor ? () => onDetalheVendedor(vendedor._row, vendedor.ranking) : undefined}
                  >
                    <span className="dashboard-quick-position" data-leading={vendedor.ranking <= 3}>{vendedor.ranking}</span>
                    <span className="dashboard-quick-name" title={vendedor.nome}>{vendedor.nome}</span>
                    <span className="dashboard-quick-bar dashboard-quick-track" aria-hidden="true" data-goal-tone={vendedor.status}>
                      {vendedor.percent !== null && <span style={{ width: `${barValue}%` }} />}
                    </span>
                    <strong className="dashboard-quick-value">{formatCurrency(vendedor.mes)}</strong>
                    <span className="dashboard-quick-percent" data-goal-tone={vendedor.status} title={vendedor.percent === null ? 'Sem meta cadastrada' : 'Atingimento da meta'}>
                      {vendedor.percent === null ? '—' : formatPercent(vendedor.percent)}
                    </span>
                    <span className="dashboard-quick-balance" data-goal-tone={vendedor.status}>
                      {vendedor.balance === null ? '—' : formatCurrency(vendedor.balance, true)}
                    </span>
                    {onDetalheVendedor && <ArrowUpRight className="dashboard-quick-link" aria-hidden="true" />}
                  </ParticipationRow>
                </li>
              );
            })}
            </ol>
          </>
        )}
      </section>
      <DashboardTeamGoals
        counts={ranking.counts}
        selected={teamFilter}
        onSelect={handleTeamFilter}
      />

      <section aria-label="Análise do faturamento" className="dashboard-frame dashboard-overview-panel commercial-dashboard-panel commercial-chart-frame">
        <Tabs value={analysisView} onValueChange={(value) => setAnalysisView(value as keyof typeof analysisTitles)} className="flex min-h-0 flex-1 flex-col">
          <div className="dashboard-panel-heading dashboard-overview-chart-heading">
            <div className="dashboard-chart-name">
              <h2><ChartNoAxesCombined aria-hidden="true" /> {analysisTitles[analysisView]}</h2>
              <span>
                {analysisView === 'participacao' ? periodLabel : monthLabel}
                {analysisView === 'evolucao' && pedidosMes.length > 0 && <strong> · {formatCurrency(dadosAcumulado[diaHoje - 1]?.realizado ?? 0)}</strong>}
              </span>
            </div>
            <TabsList aria-label="Análises da visão geral" className="dashboard-overview-views">
              <TabsTrigger value="evolucao">
                <TrendingUp aria-hidden="true" className="size-3.5" />
                Evolução
              </TabsTrigger>
              <TabsTrigger value="participacao">
                <Percent aria-hidden="true" className="size-3.5" />
                Participação
              </TabsTrigger>
              <TabsTrigger value="mapa">
                <CalendarDays aria-hidden="true" className="size-3.5" />
                Mapa diário
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="evolucao" className="dashboard-overview-view mt-0" aria-label="Evolução do faturamento e da meta acumulada">
            <div className="min-h-0 min-w-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={dadosAcumulado}
                  margin={{ top: 10, right: 12, left: -6, bottom: 0 }}
                  accessibilityLayer
                >
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.24} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.7} />
                  <XAxis
                    dataKey="label"
                    height={20}
                    minTickGap={18}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    tickCount={4}
                    width={54}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={formatCompactNumber}
                  />
                  <Tooltip
                    cursor={{ stroke: 'hsl(var(--primary))', strokeOpacity: 0.4 }}
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 4,
                      color: 'hsl(var(--popover-foreground))',
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => [value != null ? formatCurrency(value) : '—', name]}
                    labelFormatter={(dia) => `Dia ${dia}`}
                    isAnimationActive={!reduceMotion}
                  />
                  <Area
                    type="monotone"
                    dataKey="realizado"
                    name="Realizado"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    fill={`url(#${gradientId})`}
                    activeDot={{ r: 4, strokeWidth: 2 }}
                    isAnimationActive={!reduceMotion}
                    animationDuration={220}
                  />
                  <Line
                    type="monotone"
                    dataKey="meta"
                    name="Meta acumulada"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={1.75}
                    strokeDasharray="6 4"
                    dot={false}
                    isAnimationActive={!reduceMotion}
                    animationDuration={220}
                  />
                  {isMesAtual && (
                    <ReferenceLine
                      x={String(diaHoje).padStart(2, '0')}
                      stroke="hsl(var(--destructive))"
                      strokeDasharray="3 3"
                      label={{ value: 'Hoje', position: 'insideTopLeft', fill: 'hsl(var(--destructive))', fontSize: 11 }}
                    />
                  )}
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="participacao" className="dashboard-overview-view mt-0">
            <div className="mb-1 flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-1 pb-1">
              <span className="text-xs text-muted-foreground">Faturamento total</span>
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(kpiDecisao.fat)}</span>
            </div>
            {participacao.length === 0 ? (
              <div className="grid flex-1 place-items-center text-xs text-muted-foreground">Sem dados no período</div>
            ) : (
              <ol className="min-h-0 flex-1 divide-y divide-border/50 overflow-y-auto pr-1">
                {participacao.map((vendedor, index) => {
                  const color = getCorParticipacaoVendedor(vendedor.nome, index);
                  return (
                    <li key={vendedor.codigo}>
                      <ParticipationRow
                        type={onDetalheVendedor ? 'button' : undefined}
                        aria-label={onDetalheVendedor ? `Abrir detalhes de ${vendedor.nome}` : undefined}
                        onClick={onDetalheVendedor ? () => onDetalheVendedor(vendedor._row, vendedor.ranking) : undefined}
                        className={cn(
                          'dashboard-overview-participant',
                          onDetalheVendedor && 'hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                        )}
                      >
                        <span className="size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
                        <span className="truncate text-left font-medium" title={vendedor.nome}>{vendedor.nome}</span>
                        <span className="dashboard-overview-share-bar" aria-hidden="true">
                          <span style={{ width: `${Math.min(100, Math.max(0, vendedor.pct))}%`, background: color }} />
                        </span>
                        <span className="text-right font-medium tabular-nums">{formatCurrency(vendedor.mes)}</span>
                        <span className="text-right font-semibold tabular-nums text-muted-foreground">{formatPercent(vendedor.pct)}</span>
                      </ParticipationRow>
                    </li>
                  );
                })}
              </ol>
            )}
          </TabsContent>

          <TabsContent value="mapa" className="dashboard-overview-view mt-0">
            {heatmap.linhas.length === 0 ? (
              <div className="grid flex-1 place-items-center text-xs text-muted-foreground">Sem dados no período</div>
            ) : (
              <div className="dashboard-overview-heatmap-scroll" role="region" aria-label="Faturamento por vendedor e dia" tabIndex={0}>
                <div className="dashboard-overview-heatmap" style={{ gridTemplateColumns: `6.5rem repeat(${totalDiasMes}, minmax(0, 1fr))` }}>
                  <span className="text-xs font-medium text-muted-foreground">Vendedor</span>
                  {Array.from({ length: totalDiasMes }, (_, index) => index + 1).map(dia => (
                    <span key={dia} className="text-center text-[10px] tabular-nums text-muted-foreground">
                      {dia === 1 || dia % 5 === 0 ? dia : ''}
                    </span>
                  ))}
                  {heatmap.linhas.map(linha => (
                    <div key={linha.codigo} className="contents">
                      <span className="truncate pr-2 text-xs font-medium" title={linha.nome}>{linha.nome}</span>
                      {linha.cells.map((valor, index) => {
                        const dia = index + 1;
                        const diaSemana = new Date(ano, mes - 1, dia).getDay();
                        const fimDeSemana = diaSemana === 0 || diaSemana === 6;
                        const cell = { codigo: linha.codigo, dia, periodo: periodoMapa };
                        const isPinned = selectedHeatCell?.periodo === periodoMapa
                          && selectedHeatCell.codigo === linha.codigo && selectedHeatCell.dia === dia;
                        const isActive = activeHeatRow === linha && activeHeatCell?.dia === dia;
                        return (
                          <button
                            key={dia}
                            type="button"
                            aria-pressed={isPinned}
                            aria-label={`${linha.nome}, dia ${dia}, ${formatCurrency(valor)}`}
                            title={`Dia ${dia} · ${formatCurrency(valor)}`}
                            onMouseEnter={() => setPreviewHeatCell(cell)}
                            onMouseLeave={() => setPreviewHeatCell(null)}
                            onFocus={() => setPreviewHeatCell(cell)}
                            onBlur={() => setPreviewHeatCell(null)}
                            onClick={() => setSelectedHeatCell(isPinned ? null : cell)}
                            className="dashboard-overview-heat-cell"
                            data-highlighted={isActive}
                            style={{
                              backgroundColor: valor > 0
                                ? `hsl(var(--primary) / ${0.16 + (valor / heatmap.maxVal) * 0.84})`
                                : fimDeSemana ? 'hsl(var(--muted) / 0.35)' : 'hsl(var(--muted))',
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-1 flex min-h-6 shrink-0 items-center justify-between gap-2 border-t border-border/60 px-1 pt-1 text-xs">
              <span className="truncate font-medium">
                {activeHeatRow && activeHeatCell ? `${activeHeatRow.nome} - dia ${activeHeatCell.dia}` : 'Selecione um dia para ver o faturamento'}
              </span>
              {activeHeatRow && activeHeatCell && (
                <span className="shrink-0 font-semibold tabular-nums text-primary">
                  {formatCurrency(activeHeatRow.cells[activeHeatCell.dia - 1])}
                </span>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
