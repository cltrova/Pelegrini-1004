import { useMemo, useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useComercialData } from '@/hooks/useComercialData';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { 
  Target, TrendingUp, TrendingDown, DollarSign, Calendar,
  Users, FileText, ReceiptText, Trophy, AlertTriangle,
  Sparkles, ChevronUp, ChevronDown, Minus, Crown, Medal, Award, User, Eye
} from 'lucide-react';
import { VendedorDetailsDialog } from '@/components/comercial/VendedorDetailsDialog';
import { getDiasUteisNoMes, getDiasUteisDecorridos, type ComercialFilters as ComercialFiltersType } from '@/types/comercial';
import { formatCurrency, formatPercent, formatCompactNumber, formatPeriodShort } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, ReferenceLine
} from 'recharts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CollapsibleFilterBar } from '@/components/common/CollapsibleFilterBar';
import { 
  ComercialFilters, 
  getDefaultFiltersForEmpresa, 
  getComercialFiltersSummary, 
  countActiveFilters 
} from '@/components/comercial/ComercialFilters';
import { LayoutAlternativoComercial } from '@/components/comercial/LayoutAlternativoComercial';
import { getVendedorAvatar } from '@/config/vendedorAvatars';
import { getFeriadosComerciaisMeta } from '@/utils/feriadosComerciais';
import { PremiumMetasView } from '@/components/comercial/PremiumMetasView';
import { MetasViewLegacy } from '@/components/comercial/legacy/MetasViewLegacy';
import { CampanhasTab } from '@/components/comercial/CampanhasTab';

import MetasDiariasPage from '@/pages/comercial/MetasDiariasPage';
import { InsightsIATab } from '@/components/comercial/InsightsIATab';
import { VisaoGeralRapida1004 } from '@/components/comercial/VisaoGeralRapida1004';
import { ReceitaDetalheDialog } from '@/components/comercial/ReceitaDetalheDialog';
import { useComercialProdutos } from '@/hooks/useComercialProdutos';
import { useComercialTotaisIdeal } from '@/hooks/useComercialTotais';
import {
  PremiumSectionCard,
  PremiumStatCard,
} from '@/components/comercial/premium1004';
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
  const [initialized, setInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(() => {
    try { return sessionStorage.getItem('comercial:metas:tab') || 'visao-geral'; } catch { return 'visao-geral'; }
  });
  
   // Filtros - inicializar como undefined para NÃO filtrar até periodoDisponivel estar disponível
   const [pendingFilters, setPendingFilters] = useState<ComercialFiltersType | undefined>(undefined);
   const [appliedFilters, setAppliedFilters] = useState<ComercialFiltersType | undefined>(undefined);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const aplicarFiltroPadraoPelegrini = useCallback((filters: ComercialFiltersType | undefined) => {
    return aplicarEquipeContextualPelegrini1004AoFiltro(
      filters,
      codEmpresaAtiva,
      filialAtiva,
      empresaComFilial,
    );
  }, [codEmpresaAtiva, empresaComFilial, filialAtiva]);
  
  const filtrosAplicadosParaDados = useMemo(() => {
    const usarPeriodoMesFechado = isPelegriniPage;
    const filtrosComEquipe1004 = aplicarFiltroPadraoPelegrini(appliedFilters);
    const ano = appliedFilters?.anos?.length === 1 ? Number(appliedFilters.anos[0]) : NaN;
    const mes = appliedFilters?.meses?.length === 1 ? Number(appliedFilters.meses[0]) : NaN;
    if (!usarPeriodoMesFechado || !Number.isFinite(ano) || !Number.isFinite(mes)) return filtrosComEquipe1004;
    const hoje = new Date();
    const isMesAtual = hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes;
    if (isMesAtual) return filtrosComEquipe1004;

    const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(new Date(ano, mes, 0).getDate()).padStart(2, '0')}`;
    return {
      ...filtrosComEquipe1004,
      periodo: { inicio, fim },
    };
  }, [aplicarFiltroPadraoPelegrini, appliedFilters, codEmpresaNorm, isPelegriniPage]);

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

  const { vendedoresPerformance, pedidos, devolucoes, evolucaoDiaria, evolucaoMensal, clientesPerformance, insights, kpis, periodoDisponivel, vendedoresDisponiveis, isLoading, error } = useComercialData(filtrosAplicadosParaDados, {
    keepPreviousData: !isPelegriniPage,
  });
  const [chartView, setChartView] = useState<'mensal' | 'diario'>('diario');
  const [vendedorDetalhe, setVendedorDetalhe] = useState<{ row: any; ranking: number } | null>(null);
  const [receitaDetalheOpen, setReceitaDetalheOpen] = useState(false);
  const {
    produtos: produtos1004,
    receitaTotalizada: receita1004Totalizada,
    pedidosDistintosTotalizados: pedidos1004Distintos,
    receitaPorVendedor1004: receita1004PorVendedor,

    isLoading: isLoadingProdutos1004,
    error: errorProdutos1004,
  } = useComercialProdutos(filtrosAplicadosParaDados, {
    keepPreviousData: !isPelegriniPage,
  });
  const {
    produtos: produtos1004Totalizadores,
    receitaTotalizada: receita1004TotalizadaGeral,
    pedidosDistintosTotalizados: pedidos1004DistintosGeral,
  } = useComercialProdutos(filtrosTotalizadores1004, {
    keepPreviousData: !isPelegriniPage,
  });
  const {
    pedidos: pedidosTotalizadorOficial,
    produtos: produtosTotalizadorOficial,
  } = useComercialTotaisIdeal(
    filtrosTotalizadores1004?.periodo,
    null,
    {
      enabled: isEmpresa10041Page,
      keepPreviousData: false,
    },
  );
  const {
    produtos: produtosVendedoresFiltro1004,
    receitaPorVendedor1004: receitaPorVendedorFiltro1004,
    isLoading: isLoadingVendedoresFiltro1004,
    isFetching: isFetchingVendedoresFiltro1004,
  } = useComercialProdutos(filtrosVendedoresPendentes1004, {
    enabled: filtersOpen && isPelegriniPage,
    keepPreviousData: false,
  });

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

  const hoje = new Date();
  const diaAtual = hoje.getDate();

  // Extrair período dos filtros aplicados para cálculos de dias úteis
  const periodoFiltros = useMemo(() => {
     if (appliedFilters?.anos?.length && appliedFilters?.meses?.length) {
      const ano = parseInt(appliedFilters.anos[0]);
      const mes = parseInt(appliedFilters.meses[0]);
      return {
        ano,
        mes
      };
    }
    // Fallback para período disponível nos dados
    if (periodoDisponivel) {
      return {
        ano: parseInt(periodoDisponivel.ultimoAno),
        mes: parseInt(periodoDisponivel.ultimoMes)
      };
    }
    // Último fallback: data atual
    return {
      ano: hoje.getFullYear(),
      mes: hoje.getMonth() + 1
    };
  }, [appliedFilters, periodoDisponivel]);

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
    setFiltersOpen(false);
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
    const anos = appliedFilters?.anos ?? [];
    const meses = appliedFilters?.meses ?? [];
    if (!anos.length || !meses.length) return null; // null = sem restrição
    const set = new Set<string>();
    for (const a of anos) {
      for (const m of meses) {
        const mm = String(parseInt(m)).padStart(2, '0');
        set.add(`${a}-${mm}`);
      }
    }
    return set;
  }, [appliedFilters?.anos, appliedFilters?.meses]);

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
            if (p.tipo === 'DEVOLUCAO') return acc - Math.abs((p as any).valor_devolucao_real || p.valor_real || 0);
            const base = Math.abs(Number((p as any).valor_liquido_final ?? Math.max(0, Math.abs(p.valor_bruto || 0) - Math.abs(p.valor_desconto || 0))));
            const devolucao = Math.abs(Number((p as any).valor_devolucao_real || 0));
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
      const status = percentualMetaFaturado >= 100 ? 'acima' : percentualMetaFaturado >= 90 ? 'proximo' : 'abaixo';
      
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
  }, [vendedoresPerformance, pedidos, diasUteisNoMes, diasUteisDecorridos, mesesSelecionadosSet, codEmpresaNorm, isPelegriniPage]);

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
        status: percentualMetaFaturado >= 100 ? 'acima' : percentualMetaFaturado >= 90 ? 'proximo' : 'abaixo',
        metaDiaria: existente?.metaDiaria || 0,
        metaEsperada: existente?.metaEsperada || 0,
        vendas: v.pedidos.size,
      };
    });

    return incluirVendedoresSemReceita1004(linhasReceita, vendedoresComMeta);
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
      valor_liquido_final: Number((item as any).valor_liquido_final_item ?? item.valor_total ?? 0),
      valor_liquido: Number((item as any).valor_liquido_final_item ?? item.valor_total ?? 0),
      valor_real: Number((item as any).valor_liquido_final_item ?? item.valor_total ?? 0),
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
  }, [vendedoresComMeta, vendedoresComMetaFonteFinal, devolucoes, pedidos, kpis, codEmpresaAtiva, receita1004TotalizadaGeral, pedidos1004DistintosGeral, produtos1004Totalizadores, pedidosTotalizadorOficial?.quantidade_pedidos, produtosTotalizadorOficial?.quantidade_total_vendida]);


  // Dados para gráfico de evolução
  const dadosEvolucao = useMemo(() => {
    // Dados já filtrados pelo hook useComercialData
    return evolucaoDiaria.map(d => ({
      ...d,
      dataFormatada: new Date(d.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    }));
  }, [evolucaoDiaria]);

  // Mês formatado
  const mesFormatado = new Date(periodoFiltros.ano, periodoFiltros.mes - 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });

  // Se empresa não possui metas de vendedor, renderiza layout alternativo
  if (!isLoadingEmpresa && empresa && empresa.possui_meta_vendedor === false) {
    return <LayoutAlternativoComercial />;
  }

  if (isLoading && !vendedoresPerformance.length) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 h-24" />
            </Card>
          ))}
        </div>
        <Card className="animate-pulse h-96" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message="Erro ao carregar dados comerciais" />;
  }

  // Observação: NÃO substituímos a página inteira quando não há vendedores.
  // O aviso de "sem vendedores" é renderizado inline dentro da seção afetada
  // (mais abaixo), mantendo o shell do dashboard (header, filtros e abas)
  // sempre montado — evita a regressão do empty state em tela cheia.
  const vendedoresBaseVisual = isPelegriniPage ? vendedoresComMetaFonteFinal : vendedoresComMeta;
  const vendedoresRankingVisual = isPelegriniPage ? vendedoresComMetaFonteFinal : vendedoresRanking;
  const vendedoresGraficoVisaoGeral1004 = isEmpresa10041Page
    && (!receita1004PorVendedor || receita1004PorVendedor.size === 0)
      ? []
      : vendedoresComMetaFonteFinal;
  const pedidosDetalheVisual: any[] = isPelegriniPage ? pedidosFonteFinal : pedidos;
  const semVendedores = !vendedoresBaseVisual.length;
  const isCampanhas1004Ativa = isPelegriniPage && activeTab === 'campanhas';
  const filtersResumo = pendingFilters ? (aplicarFiltroPadraoPelegrini(pendingFilters) ?? pendingFilters) : undefined;
  const tabTriggerClass = cn(
    'flex-none whitespace-nowrap px-4 text-sm',
    isPelegriniPage
      ? 'text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm'
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

  return (
    <div className={cn(
      'p-4 md:p-6 space-y-4',
      isPelegriniPage && 'min-h-screen bg-background text-foreground',
    )}>
      {/* Barra de Filtros */}
      {!isCampanhas1004Ativa && (
        <CollapsibleFilterBar
          title="Filtros"
           summary={filtersResumo ? getComercialFiltersSummary(filtersResumo, vendedoresParaFiltro1004) : []}
           activeFiltersCount={filtersResumo ? countActiveFilters(filtersResumo) : 0}
          onClear={handleClearFilters}
          isOpen={filtersOpen}
          onOpenChange={setFiltersOpen}
          className={isPelegriniPage ? '[&_>div]:border-border/60 [&_>div]:bg-card [&_>div]:shadow-none [&_>div>button]:text-foreground [&_>div>button:hover]:bg-muted/40' : undefined}
        >
          <ComercialFilters
             filters={pendingFilters || getDefaultFiltersForEmpresa(codEmpresaAtiva)}
            onFiltersChange={handlePendingFiltersChange}
            onBuscar={handleBuscar}
            hasChanges={hasChanges}
            anos={ANOS_DISPONIVEIS}
            vendedores={vendedoresParaFiltro1004}
            showVendedorFilter
          />
        </CollapsibleFilterBar>
      )}





      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); try { sessionStorage.setItem('comercial:metas:tab', v); } catch { /* storage pode estar bloqueado pelo navegador */ } }} className="space-y-6">
        <div className="w-full overflow-x-auto overscroll-x-contain rounded-md [scrollbar-width:thin]">
        <TabsList className={cn(
          'flex h-12 w-max min-w-full justify-start',
          isPelegriniPage && 'border border-border/60 bg-muted/40 p-1 text-muted-foreground shadow-none [&_button:hover]:text-foreground [&_button[data-state=active]]:bg-primary [&_button[data-state=active]]:text-primary-foreground [&_button[data-state=active]]:shadow-sm',
        )}>
          <TabsTrigger value="visao-geral" className={tabTriggerClass}>Visão Geral</TabsTrigger>
          {isPelegriniPage && (
          <TabsTrigger value="detalhes" className={tabTriggerClass}>Detalhes</TabsTrigger>
          )}
          <TabsTrigger value="metas-diarias" className={tabTriggerClass}>Metas Diárias</TabsTrigger>
          <TabsTrigger value="ranking" className={tabTriggerClass}>Ranking</TabsTrigger>
          <TabsTrigger value="comparativos" className={tabTriggerClass}>Comparativos</TabsTrigger>
          <TabsTrigger value="insights" className={tabTriggerClass}>Insights IA</TabsTrigger>
          {isPelegriniPage && (
            <TabsTrigger value="campanhas" className={tabTriggerClass}>Campanhas</TabsTrigger>
          )}
        </TabsList>
        </div>


        {/* ==================== ABA: VISÃO GERAL ==================== */}
        <TabsContent value="visao-geral" className="space-y-6">
          {isLayoutPremium ? (
            <VisaoGeralRapida1004
              vendedoresComMeta={vendedoresComMetaFonteFinal}
              vendedoresGrafico={vendedoresGraficoVisaoGeral1004}
              kpisGerais={kpisGerais}
              pedidos={pedidosFonteFinal}
              evolucaoDiaria={evolucaoDiaria}
              evolucaoMensal={evolucaoMensal}
              periodoFiltros={periodoFiltros}
              periodoAplicado={appliedFilters?.periodo}
              diasUteisNoMes={diasUteisNoMes}
              diasUteisDecorridos={diasUteisDecorridos}
              onDetalheVendedor={(row, ranking) => setVendedorDetalhe({ row, ranking })}
              onReceitaClick={isPelegriniPage ? () => setReceitaDetalheOpen(true) : undefined}
            />

          ) : (
            <MetasViewLegacy
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
          <TabsContent value="detalhes" className="space-y-6">
            <PremiumMetasView
              vendedoresComMeta={vendedoresComMetaFonteFinal}
              pedidos={pedidosFonteFinal}
              kpisGerais={kpisGerais}
              periodoFiltros={periodoFiltros}
              diasUteisNoMes={diasUteisNoMes}
              diasUteisDecorridos={diasUteisDecorridos}
            />
          </TabsContent>
        )}

        {/* ==================== ABA: METAS DIÁRIAS ==================== */}
        <TabsContent value="metas-diarias" className="space-y-6">
          <MetasDiariasPage />
        </TabsContent>




        {/* ==================== ABA: RANKING ==================== */}
        <TabsContent value="ranking" className="space-y-6">
          <PremiumSectionCard
            title="Ranking de Vendedores"
            subtitle="Performance por vendedor ordenada por valor líquido"
            icon={Trophy}
            tone="amarelo"
            contentClassName="pt-0"
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Grupo Vendedor</TableHead>
                    <TableHead className="text-right">Valor Faturado</TableHead>
                    <TableHead className="text-center">% Meta Faturado</TableHead>
                    <TableHead className="text-right">Valor em Aberto</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-center">% Meta Total</TableHead>
                    <TableHead className="text-right">Meta</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center w-[60px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendedoresRankingVisual.map((v, idx) => (
                    <TableRow key={String(v.codigo)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold",
                            idx === 0 ? "bg-amber-500 text-black" :
                            idx === 1 ? "bg-slate-300 text-slate-900" :
                            idx === 2 ? "bg-amber-700 text-white" :
                            "bg-muted text-muted-foreground"
                          )}>
                            {idx + 1}
                          </div>
                          <span className="font-medium uppercase">{v.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-500">
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
                      <TableCell className="text-right font-mono text-amber-500">
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
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setVendedorDetalhe({ row: v, ranking: idx + 1 })}
                          title="Ver detalhes completos"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </PremiumSectionCard>
        </TabsContent>

        {/* ==================== ABA: COMPARATIVOS ==================== */}
        <TabsContent value="comparativos" className="space-y-6">
          <>
          {/* KPIs Comparativos — padrão premium1004 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <PremiumStatCard
              label="Faturado"
              value={formatCurrency(kpisGerais.totalFaturado)}
              icon={DollarSign}
              tone="verde"
            />
            <PremiumStatCard
              label="Pedidos"
              value={formatCurrency(kpisGerais.totalFaturado + kpisGerais.totalPendente)}
              icon={ReceiptText}
              tone="azul"
            />
            <PremiumStatCard
              label="Meta Total"
              value={formatCurrency(kpisGerais.totalMeta)}
              icon={Target}
              tone="roxo"
            />
            <PremiumStatCard
              label="Média Meta"
              value={formatPercent(kpisGerais.mediaMetaVendedores)}
              icon={TrendingUp}
              tone="amarelo"
              bar={kpisGerais.mediaMetaVendedores}
            />
            <PremiumStatCard
              label="Clientes"
              value={String(kpisGerais.clientesAtendidos)}
              icon={Users}
              tone="azul"
            />
            <PremiumStatCard
              label="Fat vs Ped"
              value={formatPercent(kpisGerais.fatVsPed)}
              icon={FileText}
              tone="vermelho"
              bar={kpisGerais.fatVsPed}
            />
          </div>

          {/* Grid Insights + Ranking */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Insights Executivos */}
            <PremiumSectionCard
              title="Insights Executivos (IA)"
              icon={Sparkles}
              tone="azul"
              className="lg:col-span-2"
            >
              <InsightsIATab vendedores={vendedoresBaseVisual} kpis={kpisGerais} />
            </PremiumSectionCard>

            {/* Ranking de Performance */}
            <PremiumSectionCard
              title="Ranking de Performance"
              icon={Trophy}
              tone="amarelo"
              contentClassName="space-y-4 pt-2"
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
                      value={Math.min(v.percentualMetaFaturado, 100)} 
                      className={cn(
                        "h-2",
                        v.percentualMetaFaturado >= 100 ? "[&>div]:bg-emerald-500" : 
                        v.percentualMetaFaturado >= 80 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500"
                      )}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Faturado: {formatCurrency(v.faturamentoMesAtual)}</span>
                      <span>Meta: {formatCurrency(v.metaMensal)}</span>
                    </div>
                  </div>
                ))}

                {/* Precisam de atenção */}
                <div className="pt-4 border-t border-border/50">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
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

          {/* Projeções por Cenário */}
          <PremiumSectionCard
            title="Projeções por Cenário - Vai Bater a Meta?"
            subtitle="Análise de cada vendedor com base em diferentes cenários de performance"
            icon={Target}
            tone="verde"
          >
              <div className="flex flex-wrap gap-4 mb-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span><strong>Ritmo Atual:</strong> Projeção se mantiver o ritmo diário atual</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <span><strong>Mês Anterior:</strong> Ritmo dos dias restantes igual ao mesmo período do mês passado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-destructive" />
                  <span><strong>Ano Anterior:</strong> Ritmo dos dias restantes igual ao mesmo período do ano passado</span>
                </div>
              </div>

              <div className="space-y-4">
                {vendedoresBaseVisual.slice(0, 4).map((v) => {
                  const diasRestantes = diasUteisNoMes - diasUteisDecorridos;
                  const ritmoDiaUtil = diasUteisDecorridos > 0 ? v.faturamentoMesAtual / diasUteisDecorridos : 0;
                  const projecaoRitmoAtual = v.faturamentoMesAtual + (ritmoDiaUtil * diasRestantes);
                  const vaiBaterMeta = projecaoRitmoAtual >= v.metaMensal;
                  
                  // Cenários simulados (em produção viriam do backend)
                  const ritmoMesAnterior = ritmoDiaUtil * 1.05; // +5% simulado
                  const projecaoMesAnterior = v.faturamentoMesAtual + (ritmoMesAnterior * diasRestantes);
                  const vaiBaterMesAnterior = projecaoMesAnterior >= v.metaMensal;
                  
                  const ritmoAnoAnterior = ritmoDiaUtil * 1.1; // +10% simulado  
                  const projecaoAnoAnterior = v.faturamentoMesAtual + (ritmoAnoAnterior * diasRestantes);
                  const vaiBaterAnoAnterior = projecaoAnoAnterior >= v.metaMensal;

                  const cenariosPositivos = [vaiBaterMeta, vaiBaterMesAnterior, vaiBaterAnoAnterior].filter(Boolean).length;

                  return (
                    <Card key={String(v.codigo)} className="bg-muted/30">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className="font-bold uppercase">{v.nome}</span>
                            <Badge className={cn(
                              "text-xs",
                              cenariosPositivos === 3 ? "bg-emerald-500/20 text-emerald-500" :
                              cenariosPositivos >= 1 ? "bg-amber-500/20 text-amber-500" :
                              "bg-red-500/20 text-red-500"
                            )}>
                              {cenariosPositivos}/3 cenários positivos
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Atual: {formatCurrency(v.faturamentoMesAtual)} | Meta: {formatCurrency(v.metaMensal)} | {formatPercent(v.percentualMetaFaturado)}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Cenário 1: Ritmo Atual */}
                          <div className="p-3 rounded-lg bg-background border">
                            <div className="flex items-center gap-2 text-xs text-primary font-medium mb-2">
                              <div className="h-2 w-2 rounded-full bg-primary" />
                              Se mantiver ritmo atual
                            </div>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Ritmo/dia útil:</span>
                                <span className="font-mono">{formatCurrency(ritmoDiaUtil)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Projeção fim mês:</span>
                                <span className="font-mono">{formatCurrency(projecaoRitmoAtual)}</span>
                              </div>
                              <div className="flex justify-between pt-1 border-t">
                                <span className="text-muted-foreground">Vai bater meta?</span>
                                <span className={cn(
                                  "font-semibold",
                                  vaiBaterMeta ? "text-emerald-500" : "text-red-500"
                                )}>
                                  {vaiBaterMeta ? "✓ SIM" : "✗ NÃO"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Cenário 2: Mês Anterior */}
                          <div className="p-3 rounded-lg bg-background border">
                            <div className="flex items-center gap-2 text-xs text-amber-500 font-medium mb-2">
                              <div className="h-2 w-2 rounded-full bg-amber-500" />
                              Se restante = mês anterior
                            </div>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Ritmo mês ant.:</span>
                                <span className="font-mono">{formatCurrency(ritmoMesAnterior)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Projeção fim mês:</span>
                                <span className="font-mono">{formatCurrency(projecaoMesAnterior)}</span>
                              </div>
                              <div className="flex justify-between pt-1 border-t">
                                <span className="text-muted-foreground">Vai bater meta?</span>
                                <span className={cn(
                                  "font-semibold",
                                  vaiBaterMesAnterior ? "text-emerald-500" : "text-red-500"
                                )}>
                                  {vaiBaterMesAnterior ? "✓ SIM" : "✗ NÃO"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Cenário 3: Ano Anterior */}
                          <div className="p-3 rounded-lg bg-background border">
                            <div className="flex items-center gap-2 text-xs text-destructive font-medium mb-2">
                              <div className="h-2 w-2 rounded-full bg-destructive" />
                              Se restante = ano anterior
                            </div>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Ritmo ano ant.:</span>
                                <span className="font-mono">{formatCurrency(ritmoAnoAnterior)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Projeção fim mês:</span>
                                <span className="font-mono">{formatCurrency(projecaoAnoAnterior)}</span>
                              </div>
                              <div className="flex justify-between pt-1 border-t">
                                <span className="text-muted-foreground">Vai bater meta?</span>
                                <span className={cn(
                                  "font-semibold",
                                  vaiBaterAnoAnterior ? "text-emerald-500" : "text-red-500"
                                )}>
                                  {vaiBaterAnoAnterior ? "✓ SIM" : "✗ NÃO"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
          </PremiumSectionCard>
          </>
        </TabsContent>

        {/* ==================== ABA: INSIGHTS IA ==================== */}
        <TabsContent value="insights" className="space-y-6">
          <InsightsIATab vendedores={vendedoresBaseVisual} kpis={kpisGerais} />
        </TabsContent>


        {/* ==================== ABA: CAMPANHAS ==================== */}
        {isPelegriniPage && (
          <TabsContent value="campanhas" className="space-y-6">
            <CampanhasTab periodoFiltro={periodoCampanhas} />
          </TabsContent>
        )}
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
    </div>
  );
}
