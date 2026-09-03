import { useMemo, useState, useCallback, useEffect } from 'react';
import { useComercialData } from '@/hooks/useComercialData';
import { useComercialProdutos } from '@/hooks/useComercialProdutos';

import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { VendedorMetaDiariaCard } from '@/components/comercial/VendedorMetaDiariaCard';
import { AlertTriangle, BarChart3, Calendar, CheckCircle2, DollarSign, RefreshCw, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { getDiasUteisNoMes, getDiasUteisDecorridos } from '@/types/comercial';
import type { VendedorMetaDiaria, ComercialFilters as ComercialFiltersType } from '@/types/comercial';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CollapsibleFilterBar } from '@/components/common/CollapsibleFilterBar';
import { 
  ComercialFilters, 
  getDefaultFiltersForEmpresa, 
  getComercialFiltersSummary, 
  countActiveFilters 
} from '@/components/comercial/ComercialFilters';
import { AnaliseDiariaLayout } from '@/components/comercial/AnaliseDiariaLayout';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { getFeriadosComerciaisMeta } from '@/utils/feriadosComerciais';

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

// Meta padrão para vendedores sem meta definida
const META_PADRAO = 0;

// Anos disponíveis para seleção
const ANOS_DISPONIVEIS = ['2023', '2024', '2025', '2026'];

export default function MetasDiariasPage() {
  const { empresa, codEmpresaAtiva, isLoading: isLoadingEmpresa } = useEmpresaAtiva();
  const [initialized, setInitialized] = useState(false);
  
  // Filtros - estado pendente e aplicado (undefined até periodoDisponivel chegar,
  // mantendo a mesma queryKey inicial das demais páginas do Comercial e evitando flicker)
  const [pendingFilters, setPendingFilters] = useState<ComercialFiltersType | undefined>(undefined);
  const [appliedFilters, setAppliedFilters] = useState<ComercialFiltersType | undefined>(undefined);
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  const { vendedoresPerformance, pedidos, periodoDisponivel, vendedoresDisponiveis, isLoading, error } = useComercialData(appliedFilters);

  // 1004 (Pelegrini): M.REAL precisa vir da MESMA fonte do card "Receita".
  const isEmpresa1004 = String(codEmpresaAtiva ?? '') === '1004';
  const { receitaPorVendedor1004: receita1004PorVendedor } = useComercialProdutos(appliedFilters);


  // Inicializar filtros padrão mesmo quando periodoDisponivel vier nulo
  useEffect(() => {
    if (!initialized && !isLoading) {
      const filtrosInteligentes = getDefaultFiltersForEmpresa(codEmpresaAtiva, periodoDisponivel);
      setPendingFilters(filtrosInteligentes);
      setAppliedFilters(filtrosInteligentes);
      setInitialized(true);
    }
  }, [periodoDisponivel, isLoading, initialized, codEmpresaAtiva]);

  // Verificar se há mudanças pendentes
  const hasChanges = JSON.stringify(pendingFilters) !== JSON.stringify(appliedFilters);

  // Aplicar filtros
  const handleBuscar = useCallback(() => {
    setAppliedFilters(pendingFilters);
    setFiltersOpen(false);
  }, [pendingFilters]);

  // Limpar filtros
  const handleClearFilters = useCallback(() => {
    const defaults = getDefaultFiltersForEmpresa(codEmpresaAtiva, periodoDisponivel);
    setPendingFilters(defaults);
    setAppliedFilters(defaults);
  }, [periodoDisponivel, codEmpresaAtiva]);

  const hoje = new Date();
  // Usa o último período disponível no JSON (fallback: mês atual do sistema)
  const anoRef = periodoDisponivel?.ultimoAno ? parseInt(periodoDisponivel.ultimoAno, 10) : hoje.getFullYear();
  const mesRef = periodoDisponivel?.ultimoMes ? parseInt(periodoDisponivel.ultimoMes, 10) - 1 : hoje.getMonth();
  const anoAtual = anoRef;
  const mesAtual = mesRef;
  // Se o mês de referência é o mês corrente do sistema, usa o dia de hoje;
  // se for mês passado (JSON defasado), considera o mês inteiro como decorrido.
  const isMesCorrente = anoRef === hoje.getFullYear() && mesRef === hoje.getMonth();
  // Usar a última data EFETIVAMENTE faturada no JSON como referência de "dia atual"
  // para evitar que o denominador (dias úteis decorridos) avance enquanto o numerador
  // (M.Real) ainda não foi atualizado pelo ERP.
  let diaAtual: number;
  if (isMesCorrente) {
    const fim = periodoDisponivel?.fim as string | undefined;
    const fimAno = fim ? parseInt(fim.substring(0, 4), 10) : NaN;
    const fimMes = fim ? parseInt(fim.substring(5, 7), 10) - 1 : NaN;
    if (fim && fimAno === anoRef && fimMes === mesRef) {
      diaAtual = parseInt(fim.substring(8, 10), 10) || hoje.getDate();
    } else {
      diaAtual = hoje.getDate();
    }
  } else {
    diaAtual = new Date(anoRef, mesRef + 1, 0).getDate();
  }

  const feriadosMeta = useMemo(
    () => getFeriadosComerciaisMeta(codEmpresaAtiva, anoAtual, mesAtual),
    [codEmpresaAtiva, anoAtual, mesAtual]
  );

  const diasUteisNoMes = getDiasUteisNoMes(anoAtual, mesAtual, feriadosMeta);
  
  // Determinar dias úteis decorridos baseado no período:
  // - Mês passado: 100% dos dias úteis (mês completo)
  // - Mês atual: proporcional ao dia atual
  // - Mês futuro: 0 dias
  const anoMesAtualNum = hoje.getFullYear() * 100 + (hoje.getMonth() + 1);
  const anoMesFiltro = anoAtual * 100 + (mesAtual + 1);
  
  let diasUteisDecorridos: number;
  if (anoMesFiltro < anoMesAtualNum) {
    // Mês passado - 100% completo
    diasUteisDecorridos = diasUteisNoMes;
  } else if (anoMesFiltro === anoMesAtualNum) {
    // Mês atual - proporcional
    diasUteisDecorridos = getDiasUteisDecorridos(anoAtual, mesAtual, diaAtual, feriadosMeta);
  } else {
    // Mês futuro - nenhum dia decorrido
    diasUteisDecorridos = 0;
  }

  // Calcular ranking detalhado com métricas diárias
  const rankingVendedores = useMemo((): VendedorMetaDiaria[] => {
    const mesAtualStr = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}`;
    const normalizar = (value: unknown) => String(value ?? '').trim().toUpperCase();
    const receitas1004 = Array.from(receita1004PorVendedor?.values() ?? []);
    const fonteVendedores = isEmpresa1004 && receitas1004.length > 0
      ? receitas1004.map((receita) => {
          const existente = vendedoresPerformance.find((v) => (
            normalizar(v.codigo) === normalizar(receita.codigo) ||
            normalizar(v.nome) === normalizar(receita.nome)
          ));
          return {
            ...(existente || {}),
            codigo: existente?.codigo ?? receita.codigo,
            nome: existente?.nome ?? receita.nome,
            receitaUnificada1004: receita.receita,
          };
        })
      : vendedoresPerformance;

    
    const vendedoresCalculados = fonteVendedores.map(v => {
      // Pedidos do mês atual (apenas faturados)
      const pedidosMes = pedidos.filter(p => 
        (normalizar(p.vendedor_codigo) === normalizar(v.codigo) || normalizar(p.vendedor_nome) === normalizar(v.nome)) && 
        p.status === 'faturado' &&
        p.data_pedido.startsWith(mesAtualStr)
      );
      
      // Replica DAX MAX(MetaVendedor) para o mês corrente do vendedor
      // (apenas tipo PEDIDO; devoluções não definem meta)
      const metaDoJson = pedidosMes.reduce((max, p) => {
        if (p.tipo === 'DEVOLUCAO') return max;
        const m = p.meta_vendedor;
        return m != null && m > max ? m : max;
      }, 0);
      
      // Usar meta do JSON, ou fallback para mapeamento fixo
      const codigoVendedor = v.codigo;
      const metaMensal = metaDoJson > 0 ? metaDoJson : (METAS_VENDEDORES[codigoVendedor] ?? META_PADRAO);
      
      // 1004: usa a fonte única de Receita (Σ ValorVenda − Σ ValorDevolucao), igual ao card.
      const receita1004 = isEmpresa1004
        ? receitas1004.find((r) => (
            normalizar(r.codigo) === normalizar(v.codigo) ||
            normalizar(r.nome) === normalizar(v.nome)
          ))
        : undefined;
      const faturamentoMesAtual = receita1004
        ? receita1004.receita
        : pedidosMes.reduce((acc, p) => acc + (p.valor_liquido || 0), 0);

      
      // Meta diária (meta mensal / dias úteis do mês)
      const metaDiaria = metaMensal / diasUteisNoMes;
      
      // Meta esperada até hoje (meta diária × dias úteis decorridos)
      const metaEsperada = metaDiaria * diasUteisDecorridos;
      
      // Meta real (valor efetivamente faturado)
      const metaReal = faturamentoMesAtual;
      
      // Diferença (Meta Real - Meta Esperada)
      const diferenca = metaReal - metaEsperada;
      
      // Média por dia útil trabalhado
      const mediaDiaria = diasUteisDecorridos > 0 ? metaReal / diasUteisDecorridos : 0;

      // Projeção: extrapola média atual para o mês inteiro
      const projecaoMensal = mediaDiaria * diasUteisNoMes;
      const percentualProjecao = metaMensal > 0 ? (projecaoMensal / metaMensal) * 100 : 0;

      // Percentual de atingimento (pace) — matematicamente igual à projeção
      const percentualAtingimento = metaEsperada > 0
        ? (metaReal / metaEsperada) * 100
        : 0;

      // Status baseado na PROJEÇÃO de meta (não no atingimento atual)
      // ≥80% → tende a bater a meta (verde); 70-80% → próximo (amber); <70% → abaixo (vermelho)
      let status: 'acima' | 'proximo' | 'abaixo';
      if (percentualProjecao >= 80) {
        status = 'acima';
      } else if (percentualProjecao >= 70) {
        status = 'proximo';
      } else {
        status = 'abaixo';
      }
      
      return {
        ...v,
        metaMensal,
        metaDiaria,
        metaEsperada,
        metaReal,
        diferenca,
        mediaDiaria,
        percentualAtingimento,
        status,
        ranking: 0, // será definido após ordenação
      } as VendedorMetaDiaria;
    });
    
    // Ordenar do melhor para o pior percentual
    // Filtrar apenas vendedores com meta definida para o ranking
    return vendedoresCalculados
      .filter(v => isEmpresa1004 ? (v.metaMensal > 0 || Math.abs(v.metaReal) > 0) : v.metaMensal > 0)
      .sort((a, b) => b.percentualAtingimento - a.percentualAtingimento)
      .map((v, index) => ({ ...v, ranking: index + 1 }));
  }, [vendedoresPerformance, pedidos, anoAtual, mesAtual, diasUteisNoMes, diasUteisDecorridos, isEmpresa1004, receita1004PorVendedor]);

  const resumoMetas1004 = useMemo(() => {
    const totalRealizado = rankingVendedores.reduce((acc, v) => acc + v.metaReal, 0);
    const totalEsperado = rankingVendedores.reduce((acc, v) => acc + v.metaEsperada, 0);
    const totalMensal = rankingVendedores.reduce((acc, v) => acc + v.metaMensal, 0);
    const diferenca = totalRealizado - totalEsperado;
    const percentual = totalEsperado > 0 ? (totalRealizado / totalEsperado) * 100 : 0;

    return {
      totalRealizado,
      totalEsperado,
      totalMensal,
      diferenca,
      percentual,
      acima: rankingVendedores.filter(v => v.status === 'acima').length,
      proximo: rankingVendedores.filter(v => v.status === 'proximo').length,
      abaixo: rankingVendedores.filter(v => v.status === 'abaixo').length,
      totalVendedores: rankingVendedores.length,
    };
  }, [rankingVendedores]);

  if (!isLoadingEmpresa && empresa && empresa.possui_meta_vendedor === false) {
    return <AnaliseDiariaLayout />;
  }

  if (isLoading && !vendedoresPerformance.length) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-[60vh]">
        <RefreshCw className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Carregando dados reais...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6 text-center max-w-md mx-auto">
          <Target className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-destructive mb-2">Erro ao carregar dados</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Não foi possível carregar os dados de metas diárias.
          </p>
          <Button onClick={() => window.location.reload()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!rankingVendedores.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <Target className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Nenhum dado encontrado para o período</h2>
        <p className="text-muted-foreground">Selecione um período diferente ou verifique os filtros.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Barra de Filtros */}
      <CollapsibleFilterBar
        title="Filtros"
        summary={appliedFilters ? getComercialFiltersSummary(appliedFilters, vendedoresDisponiveis) : []}
        activeFiltersCount={appliedFilters ? countActiveFilters(appliedFilters) : 0}
        onClear={handleClearFilters}
        isOpen={filtersOpen}
        onOpenChange={setFiltersOpen}
      >
        <ComercialFilters
          filters={pendingFilters || getDefaultFiltersForEmpresa(codEmpresaAtiva)}
          onFiltersChange={setPendingFilters}
          onBuscar={handleBuscar}
          hasChanges={hasChanges}
          anos={ANOS_DISPONIVEIS}
          vendedores={vendedoresDisponiveis}
          showVendedorFilter
        />
      </CollapsibleFilterBar>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />
            Metas Diárias
          </h1>
          <p className="page-subtitle">
            {isEmpresa1004
              ? 'Acompanhamento do ritmo diário da equipe no período filtrado'
              : 'Ranking detalhado de vendedores com análise de metas diárias'}
          </p>
        </div>
        <Badge variant="outline" className="text-sm px-4 py-2">
          <Calendar className="h-4 w-4 mr-2" />
          <span className="font-bold">{diasUteisDecorridos}</span>
          <span className="mx-1">de</span>
          <span className="font-bold">{diasUteisNoMes}</span>
          <span className="ml-1">dias úteis</span>
        </Badge>
      </div>

      {isEmpresa1004 && (
        <div className="rounded-lg border border-border/60 bg-card/55 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            {[
              {
                label: 'Realizado',
                value: formatCurrency(resumoMetas1004.totalRealizado),
                helper: 'faturado no período',
                icon: DollarSign,
                tone: 'text-sky-300',
              },
              {
                label: 'Meta até hoje',
                value: formatCurrency(resumoMetas1004.totalEsperado),
                helper: `${diasUteisDecorridos} de ${diasUteisNoMes} dias úteis`,
                icon: Target,
                tone: 'text-blue-300',
              },
              {
                label: 'Diferença',
                value: formatCurrency(resumoMetas1004.diferenca, true),
                helper: resumoMetas1004.diferenca >= 0 ? 'acima do esperado' : 'abaixo do esperado',
                icon: resumoMetas1004.diferenca >= 0 ? TrendingUp : TrendingDown,
                tone: resumoMetas1004.diferenca >= 0 ? 'text-emerald-300' : 'text-red-300',
              },
              {
                label: 'Ritmo geral',
                value: formatPercent(resumoMetas1004.percentual),
                helper: `meta mensal ${formatCurrency(resumoMetas1004.totalMensal)}`,
                icon: BarChart3,
                tone: resumoMetas1004.percentual >= 100 ? 'text-emerald-300' : resumoMetas1004.percentual >= 80 ? 'text-amber-300' : 'text-red-300',
              },
              {
                label: 'No caminho',
                value: `${resumoMetas1004.acima + resumoMetas1004.proximo}/${resumoMetas1004.totalVendedores}`,
                helper: `${resumoMetas1004.acima} acima, ${resumoMetas1004.proximo} próximos`,
                icon: CheckCircle2,
                tone: 'text-emerald-300',
              },
              {
                label: 'Atenção',
                value: String(resumoMetas1004.abaixo),
                helper: 'abaixo do ritmo esperado',
                icon: AlertTriangle,
                tone: 'text-amber-300',
              },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border/50 bg-background/35 px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{item.label}</span>
                  <item.icon className={`h-4 w-4 ${item.tone}`} />
                </div>
                <p className="mono-value truncate text-xl font-bold tabular-nums text-foreground">{item.value}</p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">{item.helper}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de Cards */}
      <div className={isEmpresa1004 ? 'space-y-2.5' : 'space-y-3'}>
        {rankingVendedores.map((vendedor) => (
          <VendedorMetaDiariaCard
            key={String(vendedor.codigo)}
            vendedor={vendedor}
            compact1004={isEmpresa1004}
          />
        ))}
      </div>
    </div>
  );
}
