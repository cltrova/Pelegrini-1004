import { lazy, Suspense, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useComercialData } from '@/hooks/useComercialData';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { VendedorDetailsDialog } from '@/components/comercial/VendedorDetailsDialog';
import { getDiasUteisNoMes, getDiasUteisDecorridos, type ComercialFilters as ComercialFiltersType, type Pedido } from '@/types/comercial';
import type { ProdutoItem } from '@/types/comercialProdutos';
import { formatCurrency } from '@/utils/formatters';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { 
  getDefaultFiltersForEmpresa, 
} from '@/components/comercial/ComercialFilters';
import { EnterpriseComercialFilters } from '@/components/comercial/EnterpriseComercialFilters';
import { LayoutAlternativoComercial } from '@/components/comercial/LayoutAlternativoComercial';
import { getFeriadosComerciaisMeta } from '@/utils/feriadosComerciais';
import { VisaoGeralRapida1004 } from '@/components/comercial/VisaoGeralRapida1004';
import { ReceitaDetalheDialog } from '@/components/comercial/ReceitaDetalheDialog';
import { useComercialProdutos } from '@/hooks/useComercialProdutos';
import { useComercialTotaisIdeal } from '@/hooks/useComercialTotais';
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
import { ComercialCompactPage, ComercialDataViewport } from '@/components/comercial/compact';
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
const loadCampanhas = () => import('@/components/comercial/CampanhasTab').then(module => ({ default: module.CampanhasTab }));
const LazyMetasDiariasPage = lazy(loadMetasDiarias);
const LazyPremiumMetasView = lazy(loadPremiumMetas);
const LazyMetasViewLegacy = lazy(loadMetasLegacy);
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
  const resolvedScopeRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('comercial:metas:tab');
      if (saved === 'ranking') return 'metas-diarias';
      return saved === 'insights' ? 'visao-geral' : saved || 'visao-geral';
    } catch { return 'visao-geral'; }
  });
  
  const [pendingFilters, setPendingFilters] = useState<ComercialFiltersType | undefined>(
    () => getDefaultFiltersForEmpresa(codEmpresaAtiva),
  );
  const [appliedFilters, setAppliedFilters] = useState(pendingFilters);
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

  const { vendedoresPerformance, pedidos, devolucoes, kpis, periodoDisponivel, vendedoresDisponiveis, isLoading, isFetching: isCommercialDataFetching, error } = useComercialData(filtrosAplicadosParaDados, {
    keepPreviousData: true,
  });
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
  const isAppliedDataPending = isLoading
    || isCommercialDataFetching
    || (isPelegriniPage && (
      isLoadingProdutos1004
      || isFetchingProdutos1004
      || isLoadingProdutosTotalizadores1004
      || isFetchingProdutosTotalizadores1004
    ))
    || (isEmpresa10041Page && (isLoadingTotalizadorOficial || isFetchingTotalizadorOficial));
  const isCompanyDataPending = isAppliedDataPending
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

  useEffect(() => {
    if (!isEmpresa10041Page) return;
    setPendingFilters((current) => aplicarFiltroPadraoPelegrini(current));
    setAppliedFilters((current) => aplicarFiltroPadraoPelegrini(current));
  }, [aplicarFiltroPadraoPelegrini, isEmpresa10041Page]);

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


  // Se empresa não possui metas de vendedor, renderiza layout alternativo
  if (!isLoadingEmpresa && empresa && empresa.possui_meta_vendedor === false) {
    return <LayoutAlternativoComercial />;
  }

  const showInitialLoading = isLoadingEmpresa || (!blockingCompanyDataError && !hasResolvedData);
  const isRefreshing = isAppliedDataPending && hasResolvedData;

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
  const vendedoresGraficoVisaoGeral1004 = isEmpresa10041Page
    && (!receita1004PorVendedor || receita1004PorVendedor.size === 0)
      ? []
      : vendedoresComMetaFonteFinal;
  const pedidosDetalheVisual: Array<Pedido | ProdutoItem> = isPelegriniPage ? pedidosFonteFinal : pedidos;
  const tabUsaFiltroProprio = activeTab === 'metas-diarias' || (isPelegriniPage && activeTab === 'campanhas');
  const tabTriggerClass = cn(
    'h-8 flex-none whitespace-nowrap px-3 text-xs',
    isPelegriniPage
      ? 'text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground'
      : undefined,
  );


  const commercialFilters = !tabUsaFiltroProprio && (
    <EnterpriseComercialFilters
      pendingFilters={pendingFilters || getDefaultFiltersForEmpresa(codEmpresaAtiva)}
      appliedFilters={appliedFilters || getDefaultFiltersForEmpresa(codEmpresaAtiva)}
      onPendingFiltersChange={handlePendingFiltersChange}
      onApply={handleBuscar}
      isApplying={isRefreshing && !hasChanges}
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
      hideActiveCount={isLayoutPremium}
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
          <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
            <TabsList aria-label="Dashboard comercial" className={cn(
              'commercial-tab-strip h-9 w-max min-w-full justify-start',
              isLayoutPremium && 'dashboard-tab-strip',
              isPelegriniPage && 'border border-border/60 bg-muted/40 p-1 text-muted-foreground shadow-none [&_button:hover]:text-foreground [&_button[data-state=active]]:bg-primary [&_button[data-state=active]]:text-primary-foreground',
            )}>
              <TabsTrigger value="visao-geral" className={tabTriggerClass}>Visão geral</TabsTrigger>
              {isPelegriniPage && <TabsTrigger value="detalhes" className={tabTriggerClass}>Detalhes</TabsTrigger>}
              <TabsTrigger value="metas-diarias" className={tabTriggerClass}>Metas</TabsTrigger>
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
        <TabsContent value="visao-geral" className={cn('mt-0 min-h-0 flex-1 overflow-auto', isLayoutPremium ? 'dashboard-overview-viewport' : 'space-y-3')}>
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
              filialAnalises={isEmpresa10041Page ? 'chevrolet' : filialAtiva === 'transmissao' ? 'transmissao' : undefined}
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
        {/* ==================== ABA: COMPARATIVOS ==================== */}
        <TabsContent value="comparativos" className="dashboard-tab-content mt-0 min-h-0 flex-1 overflow-auto">
          <div className="dashboard-management-tab dashboard-scenario-tab">
            <section aria-label="Cenários" className="dashboard-comparison-panel flex min-h-0 min-w-0 flex-col">
              {vendedoresBaseVisual.length > 0 ? (
                <ComercialDataViewport ariaLabel="Cenários por vendedor">
                  <ul role="list" className="dashboard-seller-list">
                    {vendedoresBaseVisual.map((vendedor) => {
                      const diasRestantes = diasUteisNoMes - diasUteisDecorridos;
                      const temMeta = vendedor.metaMensal > 0;
                      const ritmoAtual = diasUteisDecorridos > 0 ? vendedor.faturamentoMesAtual / diasUteisDecorridos : 0;
                      const cenarios = [
                        { label: 'Ritmo atual', ritmo: ritmoAtual },
                        { label: '+5% no ritmo diário', ritmo: ritmoAtual * 1.05 },
                        { label: '+10% no ritmo diário', ritmo: ritmoAtual * 1.1 },
                      ];

                      return (
                        <li key={vendedor.codigo} className="dashboard-scenario-row">
                          <div className="dashboard-scenario-seller">
                            <h2>{vendedor.nome}</h2>
                            <dl>
                              <div><dt>Realizado</dt><dd>{formatCurrency(vendedor.faturamentoMesAtual)}</dd></div>
                              {temMeta && <div><dt>Meta</dt><dd>{formatCurrency(vendedor.metaMensal)}</dd></div>}
                            </dl>
                          </div>
                          <dl className="dashboard-scenario-options">
                            {cenarios.map((cenario) => {
                              const projecao = vendedor.faturamentoMesAtual + cenario.ritmo * diasRestantes;
                              const atingeMeta = projecao >= vendedor.metaMensal;
                              return (
                                <div key={cenario.label} className="dashboard-scenario-option">
                                  <dt>{cenario.label}</dt>
                                  <dd>
                                    <span className="dashboard-scenario-projection">
                                      <strong>{formatCurrency(projecao)}</strong>
                                      <span>no fim do mês</span>
                                    </span>
                                    <span className="dashboard-scenario-footnote">
                                      <span>{formatCurrency(cenario.ritmo)} por dia útil</span>
                                      <span data-goal-tone={temMeta ? atingeMeta ? 'atingida' : 'abaixo' : undefined}>
                                        {temMeta ? atingeMeta ? 'Atinge a meta' : 'Abaixo da meta' : 'Sem meta'}
                                      </span>
                                    </span>
                                  </dd>
                                </div>
                              );
                            })}
                          </dl>
                        </li>
                      );
                    })}
                  </ul>
                </ComercialDataViewport>
              ) : (
                <p className="dashboard-analytics-empty">Nenhum vendedor para o período selecionado.</p>
              )}
            </section>
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
