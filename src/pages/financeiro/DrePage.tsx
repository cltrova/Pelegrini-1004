import { useState, useMemo, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { MobileHeader, MobilePageContainer } from '@/components/layout/MobileHeader';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { DreFilters } from '@/components/dre/DreFilters';
import { DreIndicators } from '@/components/dre/DreIndicators';
import { DreGroupedTable } from '@/components/dre/DreGroupedTable';
import { DreDashboard } from '@/components/dre/DreDashboard';
import { DreComparativo } from '@/components/dre/DreComparativo';
import { DreMobileView } from '@/components/dre/DreMobileView';
import { DreAssistant } from '@/components/assistente/DreAssistant';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { CollapsibleFilterBar } from '@/components/common/CollapsibleFilterBar';
import {
  useDreData,
  filterDreData,
  extractFilterOptions,
  calculateIndicators,
  calculateGroupSummary,
} from '@/hooks/useDreData';
import { DreFilters as DreFiltersType } from '@/types/dre';
import { RefreshCw, LayoutDashboard, Table, Filter, GitCompare, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDreExpenseAccountConfig } from '@/hooks/useDreExpenseAccountConfig';
import { FinanceiroSearchPrompt } from '@/components/financeiro/FinanceiroSearchPrompt';
import { useFinanceiroSearch } from '@/contexts/FinanceiroSearchContext';

export default function DrePage() {
  const { data, isLoading, isError, refetch } = useDreData();
  const { hasSearched, markSearched, resetSearch } = useFinanceiroSearch();
  // Estado neutro: nenhum filtro padrão (sem mês/ano atual)
  const [pendingFilters, setPendingFilters] = useState<DreFiltersType>({});
  const [appliedFilters, setAppliedFilters] = useState<DreFiltersType>({});
  const [activeTab, setActiveTab] = useState<'dashboard' | 'comparativo' | 'detalhe' | 'assistente'>('dashboard');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isFilterBarOpen, setIsFilterBarOpen] = useState(false);
  const isMobile = useIsMobile();

  // Lifted state for expense account sets (shared between Dashboard and Assistant)
  const {
    contasDespVar,
    contasDespFixas,
    excludedContasDespFixas,
    excludedContasDespVar,
    setContasDespVar,
    setContasDespFixas,
    setExcludedContasDespFixas,
    setExcludedContasDespVar,
  } = useDreExpenseAccountConfig();

  const anosFallback = useMemo(() => {
    const atual = new Date().getFullYear();
    return [atual + 1, atual, atual - 1, atual - 2, atual - 3].map(String);
  }, []);

  const filterOptions = useMemo(() => {
    if (!data) return { empresas: [], periodos: [], anos: anosFallback, grupos: [], codigos: [], codigoDescricaoMap: new Map<string, string>(), vendedoresInternos: [], vendedoresExternos: [], empresasVendedorInterno: [], empresasVendedorExterno: [] };
    return extractFilterOptions(data);
  }, [data, anosFallback]);

  // Filtrar dados usando filtros APLICADOS (não pendentes)
  const filteredData = useMemo(() => {
    if (!data) return [];
    return filterDreData(data, appliedFilters);
  }, [data, appliedFilters]);

  const indicators = useMemo(() => {
    if (filteredData.length === 0) return [];
    return calculateIndicators(filteredData);
  }, [filteredData]);

  const groupSummary = useMemo(() => {
    if (filteredData.length === 0) return [];
    return calculateGroupSummary(filteredData);
  }, [filteredData]);

  // Contagem de filtros ativos (usando filtros aplicados para exibição)
  const activeFiltersCount = [
    appliedFilters.empresa,
    appliedFilters.anos?.length,
    appliedFilters.meses?.length,
    appliedFilters.dataInicio || appliedFilters.dataFim,
    appliedFilters.grupos?.length,
    appliedFilters.codigos?.length,
    appliedFilters.vendedoresInternos?.length,
    appliedFilters.vendedoresExternos?.length,
    appliedFilters.empresasVendedorInterno?.length,
    appliedFilters.empresasVendedorExterno?.length,
  ].filter(Boolean).length;

  // Resumo dos filtros para exibir na barra fechada
  const filterSummary = useMemo(() => {
    const summary = [];
    if (appliedFilters.anos?.length) {
      summary.push({ label: 'Anos', value: appliedFilters.anos.join(', ') });
    }
    if (appliedFilters.meses?.length) {
      summary.push({ label: 'Meses', value: `${appliedFilters.meses.length} mês(es)` });
    }
    if (appliedFilters.dataInicio || appliedFilters.dataFim) {
      summary.push({ label: 'Período', value: `${appliedFilters.dataInicio || '...'} até ${appliedFilters.dataFim || '...'}` });
    }
    if (appliedFilters.empresa) {
      summary.push({ label: 'Empresa', value: appliedFilters.empresa });
    }
    if (appliedFilters.grupos?.length) {
      summary.push({ label: 'Grupos', value: `${appliedFilters.grupos.length} grupo(s)` });
    }
    if (appliedFilters.vendedoresInternos?.length) {
      summary.push({ label: 'Vend. Interno', value: `${appliedFilters.vendedoresInternos.length} selec.` });
    }
    if (appliedFilters.vendedoresExternos?.length) {
      summary.push({ label: 'Vend. Externo', value: `${appliedFilters.vendedoresExternos.length} selec.` });
    }
    if (appliedFilters.empresasVendedorInterno?.length) {
      summary.push({ label: 'Emp. V. Interno', value: `${appliedFilters.empresasVendedorInterno.length} selec.` });
    }
    if (appliedFilters.empresasVendedorExterno?.length) {
      summary.push({ label: 'Emp. V. Externo', value: `${appliedFilters.empresasVendedorExterno.length} selec.` });
    }
    return summary;
  }, [appliedFilters]);

  const hasActiveFilters =
    appliedFilters.empresa ||
    (appliedFilters.anos && appliedFilters.anos.length > 0) ||
    (appliedFilters.meses && appliedFilters.meses.length > 0) ||
    !!(appliedFilters.dataInicio || appliedFilters.dataFim) ||
    (appliedFilters.grupos && appliedFilters.grupos.length > 0);

  // Handler de busca - aplica filtros pendentes e colapsa a barra
  const handleSearch = useCallback(() => {
    setAppliedFilters(pendingFilters);
    markSearched();
    setIsFilterBarOpen(false);
  }, [pendingFilters, markSearched]);

  // Handler de limpar filtros
  const handleClearFilters = useCallback(() => {
    setPendingFilters({});
    setAppliedFilters({});
    resetSearch();
  }, [resetSearch]);

  const filtersBar = (
      <CollapsibleFilterBar
        title="Filtros"
        activeFiltersCount={activeFiltersCount}
        summary={filterSummary}
        onClear={handleClearFilters}
        isOpen={isFilterBarOpen}
        onOpenChange={setIsFilterBarOpen}
      >
        <DreFilters
          filters={pendingFilters}
          onFiltersChange={setPendingFilters}
          onSearch={handleSearch}
          empresas={filterOptions.empresas}
          periodos={filterOptions.periodos}
          anos={filterOptions.anos}
          grupos={filterOptions.grupos}
          codigos={filterOptions.codigos}
          codigoDescricaoMap={filterOptions.codigoDescricaoMap}
          vendedoresInternos={filterOptions.vendedoresInternos}
          vendedoresExternos={filterOptions.vendedoresExternos}
          empresasVendedorInterno={filterOptions.empresasVendedorInterno}
          empresasVendedorExterno={filterOptions.empresasVendedorExterno}
        />
      </CollapsibleFilterBar>
  );

  // Versão Mobile
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-background pb-20">
        {/* Header Mobile */}
        <MobileHeader
          title="DRE"
          subtitle="Demonstrativo de Resultado"
          actions={
            <div className="flex items-center gap-2">
              <Sheet open={showMobileFilters} onOpenChange={setShowMobileFilters}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative h-9 w-9">
                    <Filter className="h-4 w-4" />
                    {hasActiveFilters && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
                  <SheetHeader>
                    <SheetTitle>Filtros</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4 space-y-4 overflow-y-auto">
                    <DreFilters
                      filters={pendingFilters}
                      onFiltersChange={setPendingFilters}
                      onSearch={() => {
                        setAppliedFilters(pendingFilters);
                        markSearched();
                        setShowMobileFilters(false);
                      }}
                      empresas={filterOptions.empresas}
                      periodos={filterOptions.periodos}
                      anos={filterOptions.anos}
                      grupos={filterOptions.grupos}
                      codigos={filterOptions.codigos}
                      codigoDescricaoMap={filterOptions.codigoDescricaoMap}
                      vendedoresInternos={filterOptions.vendedoresInternos}
                      vendedoresExternos={filterOptions.vendedoresExternos}
                      empresasVendedorInterno={filterOptions.empresasVendedorInterno}
                      empresasVendedorExterno={filterOptions.empresasVendedorExterno}
                    />
                  </div>
                </SheetContent>
              </Sheet>
              <Button variant="ghost" size="icon" onClick={() => refetch()} className="h-9 w-9">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          }
        />

        {/* Conteúdo */}
        <div className="flex-1 overflow-hidden">
          {!hasSearched ? (
            <div className="p-4">
              <FinanceiroSearchPrompt />
            </div>
          ) : isLoading ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <LoadingState message="Carregando..." />
            </div>
          ) : isError ? (
            <div className="p-4">
              <ErrorState
                title="Erro ao carregar"
                message="Não foi possível carregar os dados."
                onRetry={() => refetch()}
              />
            </div>
          ) : !data || data.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Sem dados"
                message="Nenhum dado disponível."
              />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Nenhum resultado"
                message="Nenhum dado encontrado com os filtros."
              />
            </div>
          ) : (
            <DreMobileView 
              data={filteredData} 
              indicators={indicators}
              groupSummary={groupSummary}
            />
          )}
        </div>

        <MobileBottomNav />
      </div>
    );
  }

  // Versão Desktop
  return (
    <div className="min-h-screen">
      <Header
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {filtersBar}

        {!hasSearched ? (
          <FinanceiroSearchPrompt />
        ) : isLoading ? (
          <LoadingState message="Carregando dados da DRE..." />
        ) : isError ? (
          <ErrorState
            title="Erro ao carregar DRE"
            message="Não foi possível carregar os dados da DRE. Verifique sua conexão e tente novamente."
            onRetry={() => refetch()}
          />
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="Nenhum dado disponível"
            message="Não há dados de DRE disponíveis no momento."
          />
        ) : (
          <>

            {filteredData.length === 0 ? (
              <EmptyState
                title="Nenhum resultado"
                message="Nenhum dado encontrado com os filtros selecionados."
              />
            ) : (
              <>
                <DreIndicators indicators={indicators} />

                {/* Tabs de visualização */}
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'dashboard' | 'comparativo' | 'detalhe' | 'assistente')}>
                  <TabsList
                    className="mb-5 h-11 p-1 bg-muted/40 backdrop-blur border border-border/60 rounded-xl gap-1"
                  >
                    <TabsTrigger
                      value="dashboard"
                      className="gap-2 h-9 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-foreground text-muted-foreground transition-all"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Visão Geral
                    </TabsTrigger>
                    <TabsTrigger
                      value="comparativo"
                      className="gap-2 h-9 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-foreground text-muted-foreground transition-all"
                    >
                      <GitCompare className="h-4 w-4" />
                      Comparativo
                    </TabsTrigger>
                    <TabsTrigger
                      value="detalhe"
                      className="gap-2 h-9 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-foreground text-muted-foreground transition-all"
                    >
                      <Table className="h-4 w-4" />
                      Detalhe
                    </TabsTrigger>
                    <TabsTrigger
                      value="assistente"
                      className="gap-2 h-9 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-foreground text-muted-foreground transition-all"
                    >
                      <Bot className="h-4 w-4" />
                      Assistente
                    </TabsTrigger>
                  </TabsList>


                  <TabsContent value="dashboard" className="mt-0">
                    <DreDashboard
                      data={filteredData}
                      groupSummary={groupSummary}
                      contasDespVar={contasDespVar}
                      contasDespFixas={contasDespFixas}
                      excludedContasDespFixas={excludedContasDespFixas}
                      excludedContasDespVar={excludedContasDespVar}
                      onContasDespVarChange={setContasDespVar}
                      onContasDespFixasChange={setContasDespFixas}
                      onExcludedContasDespFixasChange={setExcludedContasDespFixas}
                      onExcludedContasDespVarChange={setExcludedContasDespVar}
                    />
                  </TabsContent>



                  <TabsContent value="comparativo" className="mt-0">
                    <DreComparativo data={filteredData} groupSummary={groupSummary} />
                  </TabsContent>

                  <TabsContent value="detalhe" className="mt-0">
                    <DreGroupedTable data={filteredData} />
                  </TabsContent>

                  <TabsContent value="assistente" className="mt-0">
                    <DreAssistant dreData={filteredData} indicators={indicators} contasDespVar={contasDespVar} contasDespFixas={contasDespFixas} onUpdateDespVar={setContasDespVar} onUpdateDespFixas={setContasDespFixas} />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
