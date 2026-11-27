import { lazy, Suspense, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { useComercialData } from '@/hooks/useComercialData';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { 
  Target, TrendingUp, TrendingDown, Calendar, Trophy, AlertTriangle, ArrowUpRight, DollarSign, Wallet,
  ChevronUp, ChevronDown, Minus, Crown, Medal, Award, User, Eye
} from 'lucide-react';
import { VendedorDetailsDialog } from '@/components/comercial/VendedorDetailsDialog';
import { getDiasUteisNoMes, getDiasUteisDecorridos, type ComercialFilters as ComercialFiltersType, type Pedido } from '@/types/comercial';
import type { ProdutoItem } from '@/types/comercialProdutos';
import { formatCurrency, formatPercent, formatCompactNumber, formatPeriod, formatPeriodShort } from '@/utils/formatters';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, ReferenceLine
} from 'recharts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  getDefaultFiltersForEmpresa, 
} from '@/components/comercial/ComercialFilters';
import { EnterpriseComercialFilters } from '@/components/comercial/EnterpriseComercialFilters';
import { LayoutAlternativoComercial } from '@/components/comercial/LayoutAlternativoComercial';
import { getVendedorAvatar } from '@/config/vendedorAvatars';
import { getFeriadosComerciaisMeta } from '@/utils/feriadosComerciais';
import { VisaoGeralRapida1004 } from '@/components/comercial/VisaoGeralRapida1004';
import { RankingVendedoresChart } from '@/components/comercial/RankingVendedoresChart';
import { DashboardExecutiveSummary, DashboardPageHeading, DashboardPanelHeading, formatDashboardPeriod, getTeamGoalStatus } from '@/components/comercial/DashboardOverviewManagement';
import { ReceitaDetalheDialog } from '@/components/comercial/ReceitaDetalheDialog';
import { useComercialProdutos } from '@/hooks/useComercialProdutos';
import { useComercialTotaisIdeal } from '@/hooks/useComercialTotais';
import { PremiumSectionCard } from '@/components/comercial/premium1004';
import {
  aplicarEquipeContextualPelegrini1004AoFiltro,
  criarFiltroTotalizadores1004,
  isContextoChevrolet10041,
  incluirVendedoresSemReceita1004,
  montarVendedoresFiltroReceita1004,
  montarVendedoresFiltroVendasChevrolet10041,
  somarDevolucoesReceitaVendedores1004,
  unirVendedoresFiltro1004,
} from '@/utils/vendedores1004';
import { invalidarConsultasComerciais } from '@/utils/comercialQueryInvalidation';
import { resolverContagemTotalizadorPelegrini } from '@/utils/comercialKpiFallback';
import { ComercialCompactPage, ComercialDataViewport, ComercialMetricStrip } from '@/components/comercial/compact';
import { getMesesDoFiltro, getPeriodoReferencia, preservarPeriodoExplicito } from '@/utils/metasFilterPeriod';
import '@/components/comercial/DashboardTabs.css';

type VendedorDetalheRow = {
  codigo: string | number;
  nome: string;
  metaMensal: number;
  faturamentoMesAtual: number;
  totalDevolucoes?: number;
  valorPendente: number;
  valorTotal: number;
  percentualMetaFaturado: number;
  percentualMetaTotal: number;
  diferenca: number;
  status: 'acima' | 'proximo' | 'abaixo';
  metaDiaria: number;
  metaEsperada: number;
  ticketMedio?: number;
};

const loadMetasDiarias = () => import('@/pages/comercial/MetasDiariasPage');
const loadPremiumMetas = () => import('@/components/comercial/PremiumMetasView').then(module => ({ default: module.PremiumMetasView }));
const loadMetasLegacy = () => import('@/components/comercial/legacy/MetasViewLegacy').then(module => ({ default: module.MetasViewLegacy }));
const loadInsights = () => import('@/components/comercial/InsightsIATab').then(module => ({ default: module.InsightsIATab }));
const loadCampanhas = () => import('@/components/comercial/CampanhasTab').then(module => ({ default: module.CampanhasTab }));
const LazyMetasDiariasPage = lazy(loadMetasDiarias);
const LazyPremiumMetasView = lazy(loadPremiumMetas);
const LazyMetasViewLegacy = lazy(loadMetasLegacy);
const LazyInsightsIATab = lazy(loadInsights);
const LazyCampanhasTab = lazy(loadCampanhas);

function ComercialTabFallback() {
  return <LoadingState message="Carregando aba comercial" variant="content" className="min-h-24" />;
}

// Metas fixas de fallback para empresas que não possuem MetaVendedor no JSON
const METAS_VENDEDORES: Record<string | number, number> = {
  // Códigos de demonstração (fallback)
  5: 300000,
  6: 290000,
  7: 280000,
  8: 220000,
  9: 200000,
  10: 230000,
  11: 220000,
  12: 200000,
};

// Metas padrão quando não há meta específica definida para o vendedor
const META_PADRAO = 0; // Vendedores sem meta definida = 0 (não incluir no cálculo)

// Anos disponíveis para seleção
const ANOS_DISPONIVEIS = ['2023', '2024', '2025', '2026'];

export default function MetasVendedoresPage() {
  const queryClient = useQueryClient();
  const commercialFetchCount = useIsFetching({
    predicate: (query) => {
      const rootKey = query.queryKey[0];
      return typeof rootKey === 'string' && rootKey.startsWith('comercial');
    },
  });
  const { empresa, codEmpresaAtiva, isLoading: isLoadingEmpresa } = useEmpresaAtiva();
  const { filialAtiva, filialNome } = useFilialSelecionada();
  const codEmpresaNorm = String(codEmpresaAtiva ?? '').trim();
  const empresaComFilial = useMemo(() => {
    if (!filialNome) return empresa;
    return { ...empresa, nome: `${empresa?.nome ?? ''} ${filialNome}` };
  }, [empresa, filialNome]);
  const isContextoChevrolet10041Page = isContextoChevrolet10041(codEmpresaAtiva, filialAtiva, empresaComFilial);
  const isEmpresa1004Page = codEmpresaNorm === '1004';
  const isEmpresa10041Page = codEmpresaNorm === '10041' || isContextoChevrolet10041Page;
  const isPelegriniPage = isEmpresa1004Page || isEmpresa10041Page;
  const isLayoutPremium = isPelegriniPage;
  const [initialized, setInitialized] = useState(false);
  const resolvedScopeRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('comercial:metas:tab');
      return saved === 'insights' ? 'visao-geral' : saved || 'visao-geral';
    } catch { return 'visao-geral'; }
  });
  
   // Filtros - inicializar como undefined para NÃO filtrar até periodoDisponivel estar disponível
   const [pendingFilters, setPendingFilters] = useState<ComercialFiltersType | undefined>(undefined);
   const [appliedFilters, setAppliedFilters] = useState<ComercialFiltersType | undefined>(undefined);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dashboardFilterTarget, setDashboardFilterTarget] = useState<HTMLDivElement | null>(null);

  const aplicarFiltroPadraoPelegrini = useCallback((filters: ComercialFiltersType | undefined) => {
    return aplicarEquipeContextualPelegrini1004AoFiltro(
      filters,
      codEmpresaAtiva,
      filialAtiva,
      empresaComFilial,
    );
  }, [codEmpresaAtiva, empresaComFilial, filialAtiva]);
  
  const filtrosAplicadosParaDados = useMemo(() => {
    const filtrosComEquipe1004 = aplicarFiltroPadraoPelegrini(appliedFilters);
    return preservarPeriodoExplicito(filtrosComEquipe1004, isPelegriniPage);
  }, [aplicarFiltroPadraoPelegrini, appliedFilters, isPelegriniPage]);

  const filtrosTotalizadores1004 = useMemo(() => {
    if (!isPelegriniPage) return filtrosAplicadosParaDados;
    return criarFiltroTotalizadores1004(filtrosAplicadosParaDados ?? {});
  }, [filtrosAplicadosParaDados, isPelegriniPage]);

  const filtrosVendedoresPendentes1004 = useMemo<ComercialFiltersType | undefined>(() => {
    if (!isPelegriniPage) return undefined;
    const base = pendingFilters ?? getDefaultFiltersForEmpresa(codEmpresaAtiva);
    return criarFiltroTotalizadores1004({
      anos: base.anos,
      meses: base.meses,
      periodo: base.periodo,
      tipo: 'todos',
      status: base.status,
    });
  }, [codEmpresaAtiva, isPelegriniPage, pendingFilters]);

  const { vendedoresPerformance, pedidos, devolucoes, evolucaoDiaria, evolucaoMensal, clientesPerformance, insights, kpis, periodoDisponivel, vendedoresDisponiveis, isLoading, isFetching: isCommercialDataFetching, error } = useComercialData(filtrosAplicadosParaDados, {
    keepPreviousData: true,
  });
  const [chartView, setChartView] = useState<'mensal' | 'diario'>('diario');
  const [vendedorDetalhe, setVendedorDetalhe] = useState<{ row: VendedorDetalheRow; ranking: number } | null>(null);
  const [receitaDetalheOpen, setReceitaDetalheOpen] = useState(false);
  const {
    produtos: produtos1004,
    receitaTotalizada: receita1004Totalizada,
    pedidosDistintosTotalizados: pedidos1004Distintos,
    receitaPorVendedor1004: receita1004PorVendedor,

    isLoading: isLoadingProdutos1004,
    isFetching: isFetchingProdutos1004,
    error: errorProdutos1004,
  } = useComercialProdutos(filtrosAplicadosParaDados, {
    keepPreviousData: true,
  });
  const {
    produtos: produtos1004Totalizadores,
    receitaTotalizada: receita1004TotalizadaGeral,
    pedidosDistintosTotalizados: pedidos1004DistintosGeral,
    isLoading: isLoadingProdutosTotalizadores1004,
    isFetching: isFetchingProdutosTotalizadores1004,
    error: errorProdutosTotalizadores1004,
  } = useComercialProdutos(filtrosTotalizadores1004, {
    keepPreviousData: true,
  });
  const {
    pedidos: pedidosTotalizadorOficial,
    produtos: produtosTotalizadorOficial,
    isLoading: isLoadingTotalizadorOficial,
    isFetching: isFetchingTotalizadorOficial,
    error: errorTotalizadorOficial,
  } = useComercialTotaisIdeal(
    filtrosTotalizadores1004?.periodo,
    null,
    {
      enabled: isEmpresa10041Page,
      keepPreviousData: true,
    },
  );
  const {
    produtos: produtosVendedoresFiltro1004,
    receitaPorVendedor1004: receitaPorVendedorFiltro1004,
    isLoading: isLoadingVendedoresFiltro1004,
    isFetching: isFetchingVendedoresFiltro1004,
    error: errorVendedoresFiltro1004,
  } = useComercialProdutos(filtrosVendedoresPendentes1004, {
    enabled: filtersOpen && isPelegriniPage,
    keepPreviousData: false,
  });
  const isFiltroProdutosRequired = filtersOpen && isPelegriniPage;
  const companyDataError = error
    || (isPelegriniPage ? errorProdutos1004 || errorProdutosTotalizadores1004 : null)
    || (isEmpresa10041Page ? errorTotalizadorOficial : null)
    || (isFiltroProdutosRequired ? errorVendedoresFiltro1004 : null);
  const isCompanyDataPending = isLoading
    || isCommercialDataFetching
    || (isPelegriniPage && (
      isLoadingProdutos1004
      || isFetchingProdutos1004
      || isLoadingProdutosTotalizadores1004
      || isFetchingProdutosTotalizadores1004
    ))
    || (isEmpresa10041Page && (isLoadingTotalizadorOficial || isFetchingTotalizadorOficial))
    || (isFiltroProdutosRequired && (isLoadingVendedoresFiltro1004 || isFetchingVendedoresFiltro1004));
  const branchKey = String(filialAtiva ?? '').trim() || 'sem-filial';
  const dataScopeKey = codEmpresaNorm ? `${codEmpresaNorm}:${branchKey}` : '';
  if (!isLoadingEmpresa && codEmpresaNorm && !isCompanyDataPending && !companyDataError) {
    resolvedScopeRef.current = dataScopeKey;
  }
  const hasResolvedData = resolvedScopeRef.current === dataScopeKey && dataScopeKey !== '';
  const blockingCompanyDataError = hasResolvedData ? null : companyDataError;

  const vendedoresParaFiltro1004 = useMemo(() => {
    if (!isPelegriniPage || !filtersOpen) return vendedoresDisponiveis;
    const isCarregandoPeriodo = isLoadingVendedoresFiltro1004 || isFetchingVendedoresFiltro1004;
    if (isEmpresa10041Page && isCarregandoPeriodo) return [];
    const vendedoresFiltro = montarVendedoresFiltroReceita1004(receitaPorVendedorFiltro1004);
    if (isEmpresa10041Page) {
      const vendedoresComVenda = montarVendedoresFiltroVendasChevrolet10041(
        (produtosVendedoresFiltro1004 || []) as unknown as Array<Record<string, unknown>>,
      );
      const vendedoresUnificados = unirVendedoresFiltro1004(vendedoresComVenda, vendedoresFiltro);
      if (vendedoresUnificados.length > 0) return vendedoresUnificados;
    }
    if (vendedoresFiltro.length > 0) return vendedoresFiltro;
    const vendedoresAplicados = montarVendedoresFiltroReceita1004(receita1004PorVendedor);
    if (vendedoresAplicados.length > 0) return vendedoresAplicados;
    return [...vendedoresDisponiveis].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [filtersOpen, isEmpresa10041Page, isLoadingVendedoresFiltro1004, isFetchingVendedoresFiltro1004, isPelegriniPage, produtosVendedoresFiltro1004, receitaPorVendedorFiltro1004, receita1004PorVendedor, vendedoresDisponiveis]);

  const hoje = useMemo(() => new Date(), []);
  const diaAtual = hoje.getDate();

  // Extrair período dos filtros aplicados para cálculos de dias úteis
  const periodoFiltros = useMemo(() => {
    return getPeriodoReferencia(appliedFilters, periodoDisponivel, hoje);
  }, [appliedFilters, hoje, periodoDisponivel]);

  const periodoCampanhas = useMemo(() => {
    if (appliedFilters?.periodo?.inicio && appliedFilters?.periodo?.fim) {
      return appliedFilters.periodo;
    }

    const ano = periodoFiltros.ano;
    const mes = periodoFiltros.mes;
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0);

    return {
      inicio: inicio.toISOString().split('T')[0],
      fim: fim.toISOString().split('T')[0],
    };
  }, [appliedFilters?.periodo, periodoFiltros]);

  // Aplicar filtros
  const handleBuscar = useCallback(() => {
    setAppliedFilters(aplicarFiltroPadraoPelegrini(pendingFilters));
    invalidarConsultasComerciais(queryClient);
  }, [aplicarFiltroPadraoPelegrini, pendingFilters, queryClient]);

  const handlePendingFiltersChange = useCallback((filters: ComercialFiltersType) => {
    setPendingFilters(aplicarFiltroPadraoPelegrini(filters));
  }, [aplicarFiltroPadraoPelegrini]);

  // Limpar filtros
  const handleClearFilters = useCallback(() => {
    const defaultsBase = getDefaultFiltersForEmpresa(codEmpresaAtiva, periodoDisponivel);
    const defaults = aplicarFiltroPadraoPelegrini(defaultsBase);
    setPendingFilters(defaults);
    setAppliedFilters(defaults);
  }, [aplicarFiltroPadraoPelegrini, periodoDisponivel, codEmpresaAtiva]);

  // Inicializar filtros padrão mesmo quando periodoDisponivel vier nulo
  useEffect(() => {
    if (!initialized && !isLoading) {
      const filtrosBase = getDefaultFiltersForEmpresa(codEmpresaAtiva, periodoDisponivel);
      const filtrosInteligentes = aplicarFiltroPadraoPelegrini(filtrosBase);
      setPendingFilters(filtrosInteligentes);
      setAppliedFilters(filtrosInteligentes);
      setInitialized(true);
    }
  }, [aplicarFiltroPadraoPelegrini, periodoDisponivel, isLoading, initialized, codEmpresaAtiva]);

  // Verificar se há mudanças pendentes
  useEffect(() => {
    if (!initialized || !isEmpresa10041Page) return;
    setPendingFilters((current) => aplicarFiltroPadraoPelegrini(current));
    setAppliedFilters((current) => aplicarFiltroPadraoPelegrini(current));
  }, [aplicarFiltroPadraoPelegrini, initialized, isEmpresa10041Page]);

  const hasChanges = JSON.stringify(pendingFilters) !== JSON.stringify(appliedFilters);

  const feriadosMeta = useMemo(
    () => getFeriadosComerciaisMeta(codEmpresaAtiva, periodoFiltros.ano, periodoFiltros.mes - 1),
    [codEmpresaAtiva, periodoFiltros.ano, periodoFiltros.mes]
  );

  const diasUteisNoMes = getDiasUteisNoMes(periodoFiltros.ano, periodoFiltros.mes - 1, feriadosMeta);
  
  // Determinar dias úteis decorridos baseado no período:
  // - Mês passado: 100% dos dias úteis (mês completo)
  // - Mês atual: proporcional ao dia atual
  // - Mês futuro: 0 dias
  const anoMesAtual = hoje.getFullYear() * 100 + (hoje.getMonth() + 1);
  const anoMesFiltro = periodoFiltros.ano * 100 + periodoFiltros.mes;
  
  let diasUteisDecorridos: number;
  if (anoMesFiltro < anoMesAtual) {
    // Mês passado - 100% completo
    diasUteisDecorridos = diasUteisNoMes;
  } else if (anoMesFiltro === anoMesAtual) {
    // Mês atual - proporcional
    diasUteisDecorridos = getDiasUteisDecorridos(periodoFiltros.ano, periodoFiltros.mes - 1, diaAtual, feriadosMeta);
  } else {
    // Mês futuro - nenhum dia decorrido
    diasUteisDecorridos = 0;
  }

  // Calcular performance de cada vendedor com metas
  // Conjunto de meses (YYYY-MM) selecionados no filtro. Se vazio, considera todos.
  const mesesSelecionadosSet = useMemo(() => {
    return getMesesDoFiltro(appliedFilters);
  }, [appliedFilters]);

  const vendedoresComMeta = useMemo(() => {
    const usaRegraReceitaPelegrini = isPelegriniPage;
    return vendedoresPerformance.map(v => {
      // Filtrar pedidos deste vendedor
      const pedidosVendedor = pedidos.filter(p => String(p.vendedor_codigo) === String(v.codigo));
      
      // Replica o DAX:
      //   SUMX( SUMMARIZE(Pedidos, CodVendedor, NoMes), MAX(MetaVendedor) )
      // Agrupar pedidos do vendedor por mês (YYYY-MM) e somar o MAX(meta_vendedor)
      // de cada mês — restrito aos meses do filtro. Sem isso, pedidos antigos do
      // vendedor inflariam a meta total.
      const metasPorMes = new Map<string, number>();
      for (const p of pedidosVendedor) {
        // Ignorar devoluções: meta deve vir apenas de PEDIDO
        if (p.tipo === 'DEVOLUCAO') continue;
        const meta = p.meta_vendedor;
        if (meta == null || !(meta > 0)) continue;
        const dataRef = (p.data_faturamento || p.data_pedido || '').toString();
        const mesKey = dataRef.substring(0, 7); // YYYY-MM
        if (!mesKey) continue;
        if (mesesSelecionadosSet && !mesesSelecionadosSet.has(mesKey)) continue;
        const atual = metasPorMes.get(mesKey) ?? 0;
        if (meta > atual) metasPorMes.set(mesKey, meta);
      }
      const metaDoJson = Array.from(metasPorMes.values()).reduce((acc, v) => acc + v, 0);
      
      // Usar meta do JSON, ou fallback para mapeamento fixo
      const codigoVendedor = v.codigo;
      const metaMensal = metaDoJson > 0 ? metaDoJson : (METAS_VENDEDORES[codigoVendedor] ?? META_PADRAO);
      
      // Pelegrini: base de receita é `ValorLiquidoFinal` (bruto com desconto) - valor_devolucao.
      const faturamentoMesAtual = usaRegraReceitaPelegrini
        ? pedidosVendedor.reduce((acc, p) => {
            if (p.tipo === 'DEVOLUCAO') return acc - Math.abs(p.valor_devolucao_real || p.valor_real || 0);
            const base = Math.abs(Number(p.valor_liquido_final ?? Math.max(0, Math.abs(p.valor_bruto || 0) - Math.abs(p.valor_desconto || 0))));
            const devolucao = Math.abs(Number(p.valor_devolucao_real || 0));
            return acc + base - devolucao;
          }, 0)
        : pedidosVendedor.reduce((acc, p) => acc + (p.valor_liquido || 0), 0);

      // REGRA: Em Aberto / Pendente = SUM(valor_bruto) dos pedidos SEM data_faturamento (PEDIDO em carteira).
      // Somar diretamente em vez de subtrair faturado, para não capturar diferenças de desconto.
      const valorPendente = pedidosVendedor.reduce((acc, p) => {
        if (p.tipo === 'DEVOLUCAO') return acc;
        const temData = !!(p.data_faturamento && String(p.data_faturamento).trim() !== '' && p.data_faturamento !== 'null');
        return temData ? acc : acc + Math.abs(p.valor_bruto || 0);
      }, 0);

      // Valor Total = Faturado + Em Aberto (coerente com as colunas exibidas)
      const valorTotalPedidos = faturamentoMesAtual + valorPendente;
      
      // Meta diária
      const metaDiaria = metaMensal / diasUteisNoMes;
      
      // Meta esperada até hoje
      const metaEsperada = metaDiaria * diasUteisDecorridos;
      
      // Performance em % (faturado / meta mensal total)
      const percentualMetaFaturado = metaMensal > 0 
        ? (faturamentoMesAtual / metaMensal) * 100 
        : 0;

      // Performance total (faturado + em aberto / meta mensal)
      const percentualMetaTotal = metaMensal > 0 
        ? (valorTotalPedidos / metaMensal) * 100 
        : 0;

      // Diferença em relação à meta esperada (baseado no faturado)
      const diferenca = faturamentoMesAtual - metaEsperada;

      // Status
      const status: VendedorDetalheRow['status'] = percentualMetaFaturado >= 100 ? 'acima' : percentualMetaFaturado >= 90 ? 'proximo' : 'abaixo';
      
      return {
        ...v,
        metaMensal,
        faturamentoMesAtual,
        valorPendente,
        valorTotal: valorTotalPedidos,
        percentualMetaFaturado,
        percentualMetaTotal,
        diferenca,
        status,
        metaDiaria,
        metaEsperada,
      };
    })
    .sort((a, b) => b.percentualMetaFaturado - a.percentualMetaFaturado);
  }, [vendedoresPerformance, pedidos, diasUteisNoMes, diasUteisDecorridos, mesesSelecionadosSet, isPelegriniPage]);

  // Vendedores exibidos no ranking: somente quem tem meta OU venda
  const vendedoresRanking = useMemo(() => {
    return vendedoresComMeta
      .filter(v => (v.metaMensal > 0) || (Math.abs(v.faturamentoMesAtual) > 0) || (Math.abs(v.valorTotal) > 0))
      .sort((a, b) => b.faturamentoMesAtual - a.faturamentoMesAtual);
  }, [vendedoresComMeta]);

  const vendedoresComMetaFonteFinal = useMemo(() => {
    if (!isPelegriniPage) return vendedoresComMeta;

    // FONTE ÚNICA: mesma base e fórmula do card "Receita" (Σ ValorVenda − Σ ValorDevolucao).
    const receitaPorVendedor = receita1004PorVendedor;
    if (!receitaPorVendedor || receitaPorVendedor.size === 0) return vendedoresComMeta;

    const linhasReceita = Array.from(receitaPorVendedor.values()).map((v) => {
      const existente = vendedoresComMeta.find(row => String(row.codigo) === v.codigo || String(row.nome).trim().toUpperCase() === v.nome.toUpperCase());
      const metaMensal = existente?.metaMensal || 0;
      const percentualMetaFaturado = metaMensal > 0 ? (v.receita / metaMensal) * 100 : 0;
      const status: VendedorDetalheRow['status'] = percentualMetaFaturado >= 100 ? 'acima' : percentualMetaFaturado >= 90 ? 'proximo' : 'abaixo';
      return {
        ...(existente || {}),
        codigo: existente?.codigo ?? v.codigo,
        nome: existente?.nome ?? v.nome,
        metaMensal,
        faturamentoMesAtual: v.receita,
        valorPendente: existente?.valorPendente || 0,
        valorTotal: v.receita,
        totalDevolucoes: v.devolucoes,
        participacao: receita1004Totalizada > 0 ? (v.receita / receita1004Totalizada) * 100 : 0,
        percentualMetaFaturado,
        percentualMetaTotal: percentualMetaFaturado,
        diferenca: v.receita - (existente?.metaEsperada || 0),
        status,
        metaDiaria: existente?.metaDiaria || 0,
        metaEsperada: existente?.metaEsperada || 0,
        vendas: v.pedidos.size,
      };
    });

    return incluirVendedoresSemReceita1004<VendedorDetalheRow>(linhasReceita, vendedoresComMeta);
  }, [isPelegriniPage, receita1004PorVendedor, receita1004Totalizada, vendedoresComMeta]);


  const pedidosFonteFinal = useMemo(() => {
    if (!isPelegriniPage) return pedidos;
    return (produtos1004 || []).map((item) => ({
      ...item,
      vendedor_codigo: item.vendedor_codigo,
      vendedor_nome: item.vendedor_nome,
      data_faturamento: item.data_faturamento,
      data_pedido: item.data_pedido,
      cliente_codigo: item.cliente_codigo,
      valor_liquido_final: Number(item.valor_liquido_final_item ?? item.valor_total ?? 0),
      valor_liquido: Number(item.valor_liquido_final_item ?? item.valor_total ?? 0),
      valor_real: Number(item.valor_liquido_final_item ?? item.valor_total ?? 0),
      valor_bruto: Number(item.valor_venda_item ?? item.valor_bruto_item ?? 0),
      valor_desconto: Number(item.valor_desconto ?? 0),
      valor_devolucao_real: Number(item.valor_devolucao_item ?? 0),
    }));
  }, [isPelegriniPage, pedidos, produtos1004]);

  // KPIs gerais consolidados
  const kpisGerais = useMemo(() => {
    const isEmpresa1004 = isPelegriniPage;
    const vendedoresFonteReceita = isEmpresa1004 ? vendedoresComMetaFonteFinal : vendedoresComMeta;
    // IMPORTANTE: Meta total é APENAS a soma das metas mensais dos vendedores
    // Não multiplicar por dias ou fazer proporção - é o valor fixo da meta do período
    const vendedoresComMetaDefinida = vendedoresFonteReceita.filter(v => v.metaMensal > 0);
    
    // totalMeta = soma simples das metas mensais de todos os vendedores
    const totalMeta = vendedoresComMetaDefinida.reduce((acc, v) => acc + v.metaMensal, 0);
    
    // Meta esperada até agora = proporção da meta mensal pelos dias úteis decorridos
    const totalMetaEsperada = vendedoresComMetaDefinida.reduce((acc, v) => acc + v.metaEsperada, 0);
    
    // Faturado Pelegrini vem dos totalizadores reconciliados do 1004/10041.
    const totalFaturadoLocal = isEmpresa1004
      ? receita1004TotalizadaGeral
      : vendedoresFonteReceita.reduce((acc, v) => acc + v.faturamentoMesAtual, 0);
    const totalPedidos = vendedoresFonteReceita.reduce((acc, v) => acc + v.valorTotal, 0);
    const totalPendente = vendedoresFonteReceita.reduce((acc, v) => acc + v.valorPendente, 0);
    // Devoluções: SUM(Valor_Devolucao) das linhas com tipo=DEVOLUCAO (campo separado no JSON).
    // Fonte única = JSON pedidos. Fallback para o array legado de devolucoes só se a base unificada não trouxer nada.
    const totalDevolucoesUnificado = isEmpresa1004
      ? somarDevolucoesReceitaVendedores1004(vendedoresFonteReceita)
      : pedidos
        .filter(p => p.tipo === 'DEVOLUCAO')
        .reduce((acc, p) => acc + Math.abs(p.valor_devolucao_real ?? p.valor_real ?? p.valor_liquido ?? 0), 0);
    const totalDevolucoesLegado = devolucoes.reduce((acc, d) => acc + Math.abs(d.valor_liquido || 0), 0);
    const totalDevolucoesLocal = totalDevolucoesUnificado || totalDevolucoesLegado;

    // Fonte única da tela: JSON de pedidos já filtrado por período/filial/equipe.
    // Não misturar com /comercial/totais, pois isso deixa receita de uma base e
    // vendas/clientes/ranking de outra base, gerando divergência nos totalizadores.
    const totalFaturado = totalFaturadoLocal;
    const totalDevolucoes = totalDevolucoesLocal;

    // Meta Faturado: faturado / meta mensal total (comparar com a meta do mês inteiro)
    const percentualFaturado = totalMeta > 0 ? (totalFaturado / totalMeta) * 100 : 0;
    // Meta Total (Pedidos): total pedidos (valor_bruto) / meta mensal total
    const percentualTotal = totalMeta > 0 ? (totalPedidos / totalMeta) * 100 : 0;
    
    // Quanto falta para bater a meta do mês
    const faltaFaturado = totalMeta - totalFaturado;
    const faltaTotal = totalMeta - totalPedidos;
    
    // Contagem de vendedores por status (apenas os que têm meta definida)
    const acimaMeta = vendedoresComMetaDefinida.filter(v => v.percentualMetaFaturado >= 100).length;
    const proximoMeta = vendedoresComMetaDefinida.filter(v => v.percentualMetaFaturado >= 90 && v.percentualMetaFaturado < 100).length;
    const abaixoMeta = vendedoresComMetaDefinida.filter(v => v.percentualMetaFaturado < 90).length;
    
    const quantidadeVendidaOficial10041 = Number(pedidosTotalizadorOficial?.quantidade_pedidos || 0)
      || Number(produtosTotalizadorOficial?.quantidade_total_vendida || 0);
    const contagemPelegrini = resolverContagemTotalizadorPelegrini({
      produtosQuantidade: produtos1004Totalizadores.length,
      produtosClientes: new Set(produtos1004Totalizadores.map(p => p.cliente_codigo)).size,
      produtosPedidosDistintos: pedidos1004DistintosGeral,
      fallbackClientes: kpis.qtdClientes,
      fallbackPedidos: kpis.qtdPedidos,
      fallbackLinhas: pedidos.length,
      vendasOficiais: isEmpresa10041Page ? quantidadeVendidaOficial10041 : undefined,
      preferirBasePedidos: isEmpresa10041Page,
    });
    const clientesAtendidos = isEmpresa1004
      ? contagemPelegrini.clientes
      : new Set(pedidos.map(p => p.cliente_codigo)).size;
    const qtdParaTicket = isEmpresa1004 ? contagemPelegrini.vendas : pedidos.length;
    const ticketMedio = qtdParaTicket > 0 ? totalFaturado / qtdParaTicket : 0;
    const mediaMetaVendedores = vendedoresComMetaDefinida.length > 0 
      ? vendedoresComMetaDefinida.reduce((acc, v) => acc + v.percentualMetaFaturado, 0) / vendedoresComMetaDefinida.length 
      : 0;

    // Calcular participação de cada vendedor
    const totalGeral = totalFaturado || 1;
    const participacoes = vendedoresFonteReceita.map(v => ({
      ...v,
      participacao: (v.faturamentoMesAtual / totalGeral) * 100
    }));
    
    return {
      totalMeta,
      totalMetaEsperada,
      totalFaturado,
      totalPendente,
      totalPedidos,
      totalDevolucoes,
      percentualFaturado,
      percentualTotal,
      faltaFaturado,
      faltaTotal,
      acimaMeta,
      proximoMeta,
      abaixoMeta,
      totalVendedores: vendedoresFonteReceita.length,
      clientesAtendidos,
      qtdPedidos: qtdParaTicket,
      ticketMedio,
      mediaMetaVendedores,
      participacoes,
      fatVsPed: totalPedidos > 0 ? (totalFaturado / totalPedidos) * 100 : 0,
    };
  }, [vendedoresComMeta, vendedoresComMetaFonteFinal, devolucoes, pedidos, kpis, receita1004TotalizadaGeral, pedidos1004DistintosGeral, produtos1004Totalizadores, pedidosTotalizadorOficial?.quantidade_pedidos, produtosTotalizadorOficial?.quantidade_total_vendida, isEmpresa10041Page, isPelegriniPage]);


  // Dados para gráfico de evolução
  const dadosEvolucao = useMemo(() => {
    // Dados já filtrados pelo hook useComercialData
    return evolucaoDiaria.map(d => ({
      ...d,
      dataFormatada: new Date(d.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    }));
  }, [evolucaoDiaria]);

  // Se empresa não possui metas de vendedor, renderiza layout alternativo
  if (!isLoadingEmpresa && empresa && empresa.possui_meta_vendedor === false) {
    return <LayoutAlternativoComercial />;
  }

  const showInitialLoading = isLoadingEmpresa || (!blockingCompanyDataError && !hasResolvedData);
  const isFetching = commercialFetchCount > 0;
  const isRefreshing = isFetching && hasResolvedData;

  if (showInitialLoading) {
    return <LoadingState message="Carregando visão comercial" variant="content" className="min-h-0 flex-1" />;
  }

  if (blockingCompanyDataError) {
    return <ErrorState message="Erro ao carregar dados comerciais" />;
  }

  // Observação: NÃO substituímos a página inteira quando não há vendedores.
  // O aviso de "sem vendedores" é renderizado inline dentro da seção afetada
  // (mais abaixo), mantendo o shell do dashboard (header, filtros e abas)
  // sempre montado — evita a regressão do empty state em tela cheia.
  const vendedoresBaseVisual = isPelegriniPage ? vendedoresComMetaFonteFinal : vendedoresComMeta;
  const vendedoresRankingVisual = isPelegriniPage ? vendedoresComMetaFonteFinal : vendedoresRanking;
  const resumoRanking = isLayoutPremium && activeTab === 'ranking'
    ? vendedoresRankingVisual.reduce((totais, vendedor) => ({
      faturado: totais.faturado + vendedor.faturamentoMesAtual,
      emAberto: totais.emAberto + vendedor.valorPendente,
      meta: totais.meta + vendedor.metaMensal,
    }), { faturado: 0, emAberto: 0, meta: 0 })
    : null;
  const rankingPercent = resumoRanking && resumoRanking.meta > 0 ? resumoRanking.faturado / resumoRanking.meta * 100 : null;
  const periodoDashboard = formatDashboardPeriod(appliedFilters?.periodo)
    ?? formatPeriod(`${periodoFiltros.ano}-${String(periodoFiltros.mes).padStart(2, '0')}`);
  const vendedoresGraficoVisaoGeral1004 = isEmpresa10041Page
    && (!receita1004PorVendedor || receita1004PorVendedor.size === 0)
      ? []
      : vendedoresComMetaFonteFinal;
  const pedidosDetalheVisual: Array<Pedido | ProdutoItem> = isPelegriniPage ? pedidosFonteFinal : pedidos;
  const semVendedores = !vendedoresBaseVisual.length;
  const tabUsaFiltroProprio = activeTab === 'metas-diarias' || (isPelegriniPage && activeTab === 'campanhas');
  const tabTriggerClass = cn(
    'h-8 flex-none whitespace-nowrap px-3 text-xs',
    isPelegriniPage
      ? 'text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground'
      : undefined,
  );


  // Badge ranking icon
  const getRankingIcon = (position: number) => {
    if (position === 1) return <Crown className="h-3 w-3" />;
    if (position === 2) return <Medal className="h-3 w-3" />;
    if (position === 3) return <Award className="h-3 w-3" />;
    return <span className="text-xs font-bold">#{position}</span>;
  };

  // Badge ranking color
  const getRankingBgColor = (position: number) => {
    if (position === 1) return 'bg-amber-500 text-black';
    if (position === 2) return 'bg-slate-300 text-slate-900';
    if (position === 3) return 'bg-amber-700 text-white';
    return 'bg-muted text-muted-foreground';
  };

  const commercialFilters = !tabUsaFiltroProprio && (
    <EnterpriseComercialFilters
      pendingFilters={pendingFilters || getDefaultFiltersForEmpresa(codEmpresaAtiva)}
      appliedFilters={appliedFilters || getDefaultFiltersForEmpresa(codEmpresaAtiva)}
      onPendingFiltersChange={handlePendingFiltersChange}
      onApply={handleBuscar}
      isApplying={isRefreshing}
      onClear={handleClearFilters}
      hasChanges={hasChanges}
      anos={ANOS_DISPONIVEIS}
      vendedores={vendedoresParaFiltro1004}
      resultCount={pedidosFonteFinal.length}
      showVendedorFilter
      useNativeControls
      isOpen={filtersOpen}
      onOpenChange={setFiltersOpen}
      presentation={isLayoutPremium ? 'popover' : 'inline'}
    />
  );

  const handleTabChange = (value: string) => {
    if (isLayoutPremium) setFiltersOpen(false);
    setActiveTab(value);
    try { sessionStorage.setItem('comercial:metas:tab', value); } catch { /* storage pode estar bloqueado pelo navegador */ }
  };

  return (
    <ComercialCompactPage as="div" className={cn(
      'commercial-dashboard dashboard-commercial-page enterprise-page relative',
      isPelegriniPage && 'bg-background text-foreground',
      isLayoutPremium && 'dashboard-compact-workspace',
    )}>
      {!isLayoutPremium && commercialFilters}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <div className={cn('flex min-w-0 shrink-0 items-start gap-2', isLayoutPremium && 'dashboard-tab-toolbar')}>
          <div className={cn('min-w-0 flex-1 rounded-md', !isLayoutPremium && 'overflow-x-auto overscroll-x-contain [scrollbar-width:thin]')}>
            <TabsList aria-label="Dashboard comercial" className={cn(
              'commercial-tab-strip justify-start',
              isLayoutPremium ? 'flex h-auto min-h-9 w-full flex-wrap' : 'h-9 w-max min-w-full',
              isPelegriniPage && 'border border-border/60 bg-muted/40 p-1 text-muted-foreground shadow-none [&_button:hover]:text-foreground [&_button[data-state=active]]:bg-primary [&_button[data-state=active]]:text-primary-foreground',
            )}>
              <TabsTrigger value="visao-geral" className={tabTriggerClass}>Visão geral</TabsTrigger>
              {isPelegriniPage && <TabsTrigger value="detalhes" className={tabTriggerClass}>Detalhes</TabsTrigger>}
              <TabsTrigger value="metas-diarias" className={tabTriggerClass}>Metas</TabsTrigger>
              <TabsTrigger value="ranking" className={tabTriggerClass}>Ranking</TabsTrigger>
              <TabsTrigger value="comparativos" className={tabTriggerClass}>Comparativos</TabsTrigger>
              {isPelegriniPage && <TabsTrigger value="campanhas" className={tabTriggerClass}>Campanhas</TabsTrigger>}
            </TabsList>
          </div>
          {isLayoutPremium && (
            <div ref={setDashboardFilterTarget} className="dashboard-tab-actions flex shrink-0 items-center gap-1">
              {commercialFilters}
            </div>
          )}
        </div>

      <Suspense fallback={<ComercialTabFallback />}>

        {/* ==================== ABA: VISÃO GERAL ==================== */}
        <TabsContent value="visao-geral" className={cn('mt-0 min-h-0 flex-1 overflow-auto', !isLayoutPremium && 'space-y-3')}>
          {isLayoutPremium ? (
            <VisaoGeralRapida1004
              vendedoresComMeta={vendedoresComMetaFonteFinal}
              vendedoresGrafico={vendedoresGraficoVisaoGeral1004}
              kpisGerais={kpisGerais}
              pedidos={pedidosFonteFinal}
              periodoFiltros={periodoFiltros}
              periodoAplicado={appliedFilters?.periodo}
              diasUteisNoMes={diasUteisNoMes}
              diasUteisDecorridos={diasUteisDecorridos}
              onDetalheVendedor={(row, ranking) => setVendedorDetalhe({ row, ranking })}
              onReceitaClick={isPelegriniPage ? () => setReceitaDetalheOpen(true) : undefined}
            />

          ) : (
            <LazyMetasViewLegacy
              vendedoresComMeta={vendedoresBaseVisual}
              pedidos={pedidosDetalheVisual}
              kpisGerais={kpisGerais}
              periodoFiltros={periodoFiltros}
              diasUteisNoMes={diasUteisNoMes}
              diasUteisDecorridos={diasUteisDecorridos}
            />
          )}
        </TabsContent>

        {/* ==================== ABA: DETALHES (antiga Visão Geral 1004) ==================== */}
        {isPelegriniPage && (
          <TabsContent value="detalhes" className="dashboard-tab-content mt-0 min-h-0 flex-1 overflow-auto">
            <LazyPremiumMetasView
              compactDashboard
              vendedoresComMeta={vendedoresComMetaFonteFinal}
              pedidos={pedidosFonteFinal}
              kpisGerais={kpisGerais}
              periodoFiltros={periodoFiltros}
              periodoAplicado={appliedFilters?.periodo}
              diasUteisNoMes={diasUteisNoMes}
              diasUteisDecorridos={diasUteisDecorridos}
            />
          </TabsContent>
        )}

        {/* ==================== ABA: METAS DIÁRIAS ==================== */}
        <TabsContent value="metas-diarias" className="dashboard-tab-content mt-0 min-h-0 flex-1 overflow-auto">
          <LazyMetasDiariasPage dashboardFilterTarget={isLayoutPremium ? dashboardFilterTarget : undefined} />
        </TabsContent>




        {/* ==================== ABA: RANKING ==================== */}
        <TabsContent value="ranking" className="dashboard-tab-content mt-0 min-h-0 flex-1 overflow-auto">
          <div className={isLayoutPremium ? 'dashboard-management-tab' : 'min-h-0 flex-1 overflow-auto'}>
            {resumoRanking && (
              <>
                <DashboardPageHeading title="Desempenho por vendedor" period={periodoDashboard} />
                <DashboardExecutiveSummary
                  label="Resumo do ranking"
                  primary={{
                    label: 'Faturamento do ranking',
                    icon: DollarSign,
                    value: formatCurrency(resumoRanking.faturado),
                    context: vendedoresRankingVisual.length ? 'Meta indisponível no ranking atual.' : 'Nenhum vendedor nos filtros selecionados.',
                    readings: [{ label: 'Meta mensal da equipe', value: resumoRanking.meta > 0 ? formatCurrency(resumoRanking.meta) : '—' }],
                  }}
                  secondary={{
                    label: 'Valor em aberto',
                    icon: Wallet,
                    value: formatCurrency(resumoRanking.emAberto),
                    readings: [{ label: 'Vendedores no ranking', value: vendedoresRankingVisual.length }],
                  }}
                  progress={rankingPercent === null ? undefined : {
                    percent: rankingPercent, context: 'da meta mensal', tone: getTeamGoalStatus(rankingPercent),
                  }}
                />
                <section className="dashboard-inline-ranking dashboard-tab-ranking-chart" aria-label="Gráfico do ranking">
                  <RankingVendedoresChart
                    data={vendedoresRankingVisual.map((row) => ({
                      codigo: row.codigo,
                      nome: row.nome,
                      mes: row.faturamentoMesAtual,
                      meta: row.metaMensal,
                      metaDiaria: row.metaDiaria,
                      status: row.status,
                      _row: row,
                    }))}
                    periodo={appliedFilters?.periodo}
                    variant="pelegriniBlue"
                    onClick={(row) => setVendedorDetalhe({
                      row,
                      ranking: vendedoresRankingVisual.findIndex((current) => current.codigo === row.codigo) + 1,
                    })}
                  />
                </section>
              </>
            )}
            <section
              aria-label="Tabela do ranking"
              className={cn(isLayoutPremium && 'dashboard-frame dashboard-ranking-panel')}
            >
              {isLayoutPremium && <DashboardPanelHeading title="Resultados por vendedor" icon={Trophy} />}
              <ComercialDataViewport ariaLabel="Ranking de vendedores" className={cn(
                'dashboard-ranking-viewport',
                !isLayoutPremium && 'commercial-dashboard-panel border border-border/70 bg-card',
              )}>
                <table className="dashboard-ranking-table w-full text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Vendedor</TableHead>
                      <TableHead className="text-right">Valor Faturado</TableHead>
                      <TableHead className="text-center">% Meta Faturado</TableHead>
                      <TableHead className="text-right">Valor em Aberto</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead className="text-center">% Meta Total</TableHead>
                      <TableHead className="text-right">Meta</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      {!isLayoutPremium && <TableHead className="text-center w-12">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendedoresRankingVisual.map((v, idx) => (
                      <TableRow key={String(v.codigo)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold",
                              idx === 0 ? "bg-amber-500 text-black" :
                              idx === 1 ? "bg-slate-300 text-slate-900" :
                              idx === 2 ? "bg-amber-700 text-white" :
                              "bg-muted text-muted-foreground"
                            )}>
                              {idx + 1}
                            </div>
                            {isLayoutPremium ? (
                              <button
                                type="button"
                                className="dashboard-ranking-seller"
                                onClick={() => setVendedorDetalhe({ row: v, ranking: idx + 1 })}
                                aria-label={`Ver detalhes de ${v.nome}`}
                                title={v.nome}
                              >
                                <span>{v.nome}</span>
                                <ArrowUpRight aria-hidden="true" className="size-3.5" />
                              </button>
                            ) : (
                              <span className="truncate font-medium" title={v.nome}>{v.nome}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={cn('text-right font-mono', !isLayoutPremium && 'text-emerald-500')}>
                          {formatCurrency(v.faturamentoMesAtual)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn(
                            "font-mono",
                            v.percentualMetaFaturado >= 100 ? "text-emerald-500 border-emerald-500/50" :
                            v.percentualMetaFaturado >= 80 ? "text-amber-500 border-amber-500/50" :
                            "text-destructive border-destructive/50"
                          )}>
                            {formatPercent(v.percentualMetaFaturado)}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={cn('text-right font-mono', isLayoutPremium ? 'dashboard-toned-number' : 'text-amber-500')}
                          data-goal-tone={isLayoutPremium && v.valorPendente > 0 ? 'proxima' : undefined}
                        >
                          {formatCurrency(v.valorPendente)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(v.valorTotal)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn(
                            "font-mono",
                            v.percentualMetaTotal >= 100 ? "text-emerald-500 border-emerald-500/50" :
                            v.percentualMetaTotal >= 80 ? "text-amber-500 border-amber-500/50" :
                            "text-destructive border-destructive/50"
                          )}>
                            {formatPercent(v.percentualMetaTotal)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(v.metaMensal)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={cn(
                            v.status === 'acima' ? "bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30" :
                            v.status === 'proximo' ? "bg-amber-500/20 text-amber-500 hover:bg-amber-500/30" :
                            "bg-destructive/20 text-destructive hover:bg-destructive/30"
                          )}>
                            {v.status === 'acima' ? 'Acima da meta' :
                             v.status === 'proximo' ? 'Próximo' : 'Abaixo da meta'}
                          </Badge>
                        </TableCell>
                        {!isLayoutPremium && <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => setVendedorDetalhe({ row: v, ranking: idx + 1 })}
                            aria-label={`Ver detalhes de ${v.nome}`}
                            title={`Ver detalhes de ${v.nome}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>}
                      </TableRow>
                    ))}
                    {vendedoresRankingVisual.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={isLayoutPremium ? 8 : 9} className="h-24 text-center text-muted-foreground">
                          Nenhum vendedor para os filtros selecionados.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </table>
              </ComercialDataViewport>
            </section>
          </div>
        </TabsContent>

        {/* ==================== ABA: COMPARATIVOS ==================== */}
        <TabsContent value="comparativos" className="dashboard-tab-content mt-0 min-h-0 flex-1 gap-2 overflow-auto">
          <div className={isLayoutPremium ? 'dashboard-management-tab' : 'flex min-h-0 flex-1 flex-col gap-2'}>
            {isLayoutPremium && (
              <>
                <DashboardPageHeading title="Comparativos comerciais" period={periodoDashboard} />
                <DashboardExecutiveSummary
                  label="Resumo de comparativos"
                  primary={{
                    label: 'Faturado no período',
                    icon: DollarSign,
                    value: formatCurrency(kpisGerais.totalFaturado),
                    context: 'Sem valor de pedidos para comparar.',
                    readings: [{ label: 'Valor dos pedidos usado na comparação', value: formatCurrency(kpisGerais.totalPedidos) }],
                  }}
                  secondary={{
                    label: 'Valor em aberto',
                    icon: Wallet,
                    value: formatCurrency(kpisGerais.totalPendente),
                    readings: [
                      { label: 'Pedidos', value: kpisGerais.qtdPedidos.toLocaleString('pt-BR') },
                      { label: 'Ticket médio', value: formatCurrency(kpisGerais.ticketMedio) },
                    ],
                  }}
                  progress={kpisGerais.totalPedidos > 0 ? { percent: kpisGerais.fatVsPed, context: 'do valor dos pedidos' } : undefined}
                />
              </>
            )}
            <ComercialMetricStrip
              ariaLabel="Indicadores de comparativos"
              className={isLayoutPremium ? 'dashboard-layout-metrics' : 'dashboard-tab-metrics dashboard-tab-metrics-6'}
              metrics={[
                ...(!isLayoutPremium ? [{ label: 'Faturado', value: formatCurrency(kpisGerais.totalFaturado), tone: 'success' as const }] : []),
                { label: isLayoutPremium ? 'Faturado + em aberto' : 'Valor em pedidos', value: formatCurrency(kpisGerais.totalFaturado + kpisGerais.totalPendente) },
                { label: 'Meta total', value: formatCurrency(kpisGerais.totalMeta) },
                { label: 'Média da meta', value: formatPercent(kpisGerais.mediaMetaVendedores), tone: 'warning' },
                { label: 'Clientes', value: kpisGerais.clientesAtendidos.toLocaleString('pt-BR') },
                ...(!isLayoutPremium ? [{ label: 'Faturado × pedidos', value: formatPercent(kpisGerais.fatVsPed) }] : []),
              ]}
            />
            <Tabs defaultValue="desempenho" className="dashboard-section-tabs">
              <div className="dashboard-section-toolbar">
                <TabsList aria-label="Comparativos do Dashboard" className={isLayoutPremium ? 'dashboard-overview-views' : 'dashboard-section-list'}>
                  <TabsTrigger value="desempenho">Desempenho</TabsTrigger>
                  <TabsTrigger value="cenarios">Cenários</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="desempenho" className="dashboard-section-view mt-0">
                <div className="dashboard-comparison-grid grid grid-cols-1 gap-2 lg:grid-cols-3">
                {/* Análises executivas */}
                <PremiumSectionCard
                  title="Análises executivas"
                  icon={TrendingUp}
                  tone="azul"
                  className={cn('commercial-dashboard-panel lg:col-span-2', isLayoutPremium && 'dashboard-frame dashboard-comparison-panel')}
                  contentClassName="p-3 pt-2"
                >
                  <LazyInsightsIATab vendedores={vendedoresBaseVisual} kpis={kpisGerais} />
                </PremiumSectionCard>

                {/* Ranking de Performance */}
                <PremiumSectionCard
                  title="Ranking de Performance"
                  icon={Trophy}
                  tone="amarelo"
                  className={cn('commercial-dashboard-panel', isLayoutPremium && 'dashboard-frame dashboard-comparison-panel')}
                  contentClassName="space-y-3 p-3 pt-2"
                >
                    {vendedoresBaseVisual.slice(0, 3).map((v, idx) => (
                      <div key={String(v.codigo)} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "h-6 w-6 rounded-full flex items-center justify-center",
                            getRankingBgColor(idx + 1)
                          )}>
                            {getRankingIcon(idx + 1)}
                          </div>
                          <span className="font-medium text-sm uppercase flex-1">{v.nome}</span>
                          <span className={cn(
                            "text-sm font-semibold",
                            v.percentualMetaFaturado >= 100 ? "text-emerald-500" :
                            v.percentualMetaFaturado >= 80 ? "text-amber-500" : "text-red-500"
                          )}>
                            {formatPercent(v.percentualMetaFaturado)}
                          </span>
                        </div>
                        <Progress
                          value={Math.max(0, Math.min(v.percentualMetaFaturado, 100))}
                          className={cn(
                            "h-2",
                            v.percentualMetaFaturado >= 100 ? "[&>div]:bg-emerald-500" :
                            v.percentualMetaFaturado >= 80 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500"
                          )}
                        />
                        <div className="flex flex-wrap justify-between gap-1 text-xs text-muted-foreground">
                          <span>Faturado: {formatCurrency(v.faturamentoMesAtual)}</span>
                          <span>Meta: {formatCurrency(v.metaMensal)}</span>
                        </div>
                      </div>
                    ))}

                    {/* Precisam de atenção */}
                    <div className="pt-2 border-t border-border/50">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>Precisam de atenção</span>
                      </div>
                      {vendedoresBaseVisual
                        .filter(v => v.percentualMetaFaturado < 50)
                        .slice(0, 2)
                        .map((v) => (
                          <div key={String(v.codigo)} className="flex items-center justify-between py-2">
                            <span className="text-sm uppercase">{v.nome}</span>
                            <Badge className="bg-red-500/20 text-red-500 text-xs">
                              {formatPercent(v.percentualMetaFaturado)}
                            </Badge>
                          </div>
                        ))
                    }
                    </div>
                </PremiumSectionCard>
                </div>
              </TabsContent>

              <TabsContent value="cenarios" className="dashboard-section-view mt-0">
                <PremiumSectionCard
                  className={cn('commercial-dashboard-panel', isLayoutPremium && 'dashboard-frame dashboard-comparison-panel')}
                  contentClassName="space-y-2 p-3"
                >
                  <p className="text-xs text-muted-foreground">
                    Projeção até o fim do mês pelo ritmo atual e com aumentos simulados de 5% e 10% no ritmo diário.
                  </p>
                  {vendedoresBaseVisual.length > 0 ? (
                    <Accordion type="single" collapsible defaultValue={String(vendedoresBaseVisual[0].codigo)} className="space-y-2">
                      {vendedoresBaseVisual.slice(0, 4).map((vendedor) => {
                        const diasRestantes = diasUteisNoMes - diasUteisDecorridos;
                        const ritmoAtual = diasUteisDecorridos > 0 ? vendedor.faturamentoMesAtual / diasUteisDecorridos : 0;
                        const cenarios = [
                          { label: 'Se mantiver ritmo atual', ritmo: ritmoAtual, color: 'text-primary' },
                          { label: 'Ritmo diário 5% maior', ritmo: ritmoAtual * 1.05, color: 'text-amber-600 dark:text-amber-400' },
                          { label: 'Ritmo diário 10% maior', ritmo: ritmoAtual * 1.1, color: 'text-violet-600 dark:text-violet-400' },
                        ].map((cenario) => {
                          const projecao = vendedor.faturamentoMesAtual + cenario.ritmo * diasRestantes;
                          return { ...cenario, projecao, atingeMeta: projecao >= vendedor.metaMensal };
                        });
                        const cenariosPositivos = cenarios.filter((cenario) => cenario.atingeMeta).length;

                        return (
                          <AccordionItem
                            key={String(vendedor.codigo)}
                            value={String(vendedor.codigo)}
                            className="commercial-scenario-panel rounded-md border border-border/70 bg-muted/30"
                          >
                            <AccordionTrigger className="gap-2 rounded-md px-3 py-2 text-left hover:bg-muted/60 hover:no-underline">
                              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="text-xs font-semibold">{vendedor.nome}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {cenariosPositivos}/3 cenários atingem a meta
                                </Badge>
                                <span className="text-xs font-normal text-muted-foreground lg:ml-auto">
                                  {formatCurrency(vendedor.faturamentoMesAtual)} de {formatCurrency(vendedor.metaMensal)} · {formatPercent(vendedor.percentualMetaFaturado)}
                                </span>
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className="grid gap-2 px-2 pb-2 md:grid-cols-3">
                              {cenarios.map((cenario) => (
                                <div key={cenario.label} className="min-w-0 rounded-md border bg-background p-2.5 text-xs">
                                  <p className={cn('mb-1.5 font-semibold', cenario.color)}>{cenario.label}</p>
                                  <dl className="space-y-1">
                                    <div className="flex flex-wrap justify-between gap-x-2">
                                      <dt className="text-muted-foreground">Ritmo/dia útil</dt>
                                      <dd className="tabular-nums">{formatCurrency(cenario.ritmo)}</dd>
                                    </div>
                                    <div className="flex flex-wrap justify-between gap-x-2">
                                      <dt className="text-muted-foreground">Projeção no fim do mês</dt>
                                      <dd className="tabular-nums">{formatCurrency(cenario.projecao)}</dd>
                                    </div>
                                    <div className="flex justify-between gap-2 border-t pt-1">
                                      <dt className="text-muted-foreground">Atinge a meta?</dt>
                                      <dd className={cn('font-semibold', cenario.atingeMeta ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                                        {cenario.atingeMeta ? 'Sim' : 'Não'}
                                      </dd>
                                    </div>
                                  </dl>
                                </div>
                              ))}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  ) : (
                    <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                      Nenhum vendedor para o período selecionado.
                    </p>
                  )}
                </PremiumSectionCard>
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        {/* ==================== ABA: CAMPANHAS ==================== */}
        {isPelegriniPage && (
          <TabsContent value="campanhas" className="dashboard-tab-content mt-0 min-h-0 flex-1 overflow-auto">
            <LazyCampanhasTab periodoFiltro={periodoCampanhas} dashboardFilterTarget={dashboardFilterTarget} />
          </TabsContent>
        )}
      </Suspense>
        </Tabs>

      <VendedorDetailsDialog
        vendedor={vendedorDetalhe?.row ?? null}
        ranking={vendedorDetalhe?.ranking ?? 0}
        pedidos={pedidosDetalheVisual}
        devolucoes={devolucoes}
        diasUteisNoMes={diasUteisNoMes}
        diasUteisDecorridos={diasUteisDecorridos}
        open={!!vendedorDetalhe}
        onOpenChange={(o) => { if (!o) setVendedorDetalhe(null); }}
      />

      {isPelegriniPage && (
        <ReceitaDetalheDialog
          open={receitaDetalheOpen}
          onOpenChange={setReceitaDetalheOpen}
          produtos={produtos1004 || []}
          totalEsperado={receita1004Totalizada || 0}
          isLoading={isLoadingProdutos1004}
          error={errorProdutos1004}
        />
      )}
    </ComercialCompactPage>
  );
}
