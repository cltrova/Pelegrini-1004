import { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { DFCFilters } from '@/components/variacao/DFCFilters';
import { DFCTable } from '@/components/variacao/DFCTable';
import { DFCDashboard } from '@/components/variacao/DFCDashboard';
import { VariacaoFilters } from '@/components/variacao/VariacaoFilters';
import { VariacaoAssistant } from '@/components/assistente/VariacaoAssistant';
import { DfcConfigTab } from '@/components/variacao/DfcConfigTab';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { CollapsibleFilterBar } from '@/components/common/CollapsibleFilterBar';
import { useDFCCrossYear, useFluxoCaixaDashboard, useVariacaoData, DEFAULT_GRUPOS_ATIVOS_OPERACIONAIS, type DFCConfig, type DfcLinhaConfigRuntime } from '@/hooks/useVariacaoData';
import { useDfcLineConfig } from '@/hooks/useDfcLineConfig';
import { RefreshCw, FileText, BarChart3, Filter, Bot, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { FinanceiroSearchPrompt } from '@/components/financeiro/FinanceiroSearchPrompt';
import { useFinanceiroSearch } from '@/contexts/FinanceiroSearchContext';

const TODOS_MESES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

export default function VariacaoPage() {
  // DFC Config state (shared with assistant)
  const [gruposAtivosOperacionais, setGruposAtivosOperacionais] = useState<Set<string>>(new Set(DEFAULT_GRUPOS_ATIVOS_OPERACIONAIS));

  // Configuração persistida por linha (modo grupo / grupo+contas / contas)
  const { config: lineConfigRows } = useDfcLineConfig();
  const lineConfigByLinhaId = useMemo(() => {
    const map = new Map<string, DfcLinhaConfigRuntime>();
    lineConfigRows.forEach(row => {
      map.set(row.linha_id, {
        modo: row.modo,
        grupo: row.grupo,
        contas: row.contas ?? [],
        invert_sinal: row.invert_sinal,
      });
    });
    return map;
  }, [lineConfigRows]);

  const dfcConfig: DFCConfig = useMemo(() => ({
    gruposInverterSinal: new Set<string>(),
    gruposAtivosOperacionais,
    lineConfigByLinhaId,
  }), [gruposAtivosOperacionais, lineConfigByLinhaId]);

  // DFC Demonstração - PENDENTES
  const [pendingAnoPeriodo1, setPendingAnoPeriodo1] = useState('');
  const [pendingMesPeriodo1, setPendingMesPeriodo1] = useState('12');
  const [pendingAnoPeriodo2, setPendingAnoPeriodo2] = useState('');
  const [pendingMesPeriodo2, setPendingMesPeriodo2] = useState('12');
  const [pendingEmpresa, setPendingEmpresa] = useState<string | undefined>();

  // DFC Demonstração - APLICADOS
  const [anoPeriodo1, setAnoPeriodo1] = useState('');
  const [mesPeriodo1, setMesPeriodo1] = useState('12');
  const [anoPeriodo2, setAnoPeriodo2] = useState('');
  const [mesPeriodo2, setMesPeriodo2] = useState('12');
  const [empresa, setEmpresa] = useState<string | undefined>();

  // Dashboard states
  const [pendingAnoDashboard, setPendingAnoDashboard] = useState('');
  const [pendingMesesSelecionados, setPendingMesesSelecionados] = useState<string[]>(TODOS_MESES);
  const [anoDashboard, setAnoDashboard] = useState('');
  const [mesesSelecionados, setMesesSelecionados] = useState<string[]>(TODOS_MESES);

  const [activeTab, setActiveTab] = useState<'demonstracao' | 'dashboard' | 'assistente' | 'configuracao'>('demonstracao');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const { hasSearched, markSearched, resetSearch } = useFinanceiroSearch();

  const isMobile = useIsMobile();

  // Hook para DFC cross-year with config
  const { dfc, filterOptions, isLoading, isError, refetch } = useDFCCrossYear(
    empresa, anoPeriodo1, mesPeriodo1, anoPeriodo2, mesPeriodo2, dfcConfig
  );

  // Hook para Dashboard
  const dashboardData = useFluxoCaixaDashboard(empresa, anoDashboard, mesesSelecionados);

  // Hook para dados brutos (assistente)
  const { data: variacaoData } = useVariacaoData();

  // Mudanças pendentes
  const hasChangesDFC =
    pendingEmpresa !== empresa ||
    pendingAnoPeriodo1 !== anoPeriodo1 ||
    pendingMesPeriodo1 !== mesPeriodo1 ||
    pendingAnoPeriodo2 !== anoPeriodo2 ||
    pendingMesPeriodo2 !== mesPeriodo2;

  const hasChangesDashboard =
    pendingEmpresa !== empresa ||
    pendingAnoDashboard !== anoDashboard ||
    JSON.stringify(pendingMesesSelecionados) !== JSON.stringify(mesesSelecionados);

  const hasChanges = activeTab === 'demonstracao' ? hasChangesDFC : hasChangesDashboard;

  const activeFiltersCountDFC = [
    anoPeriodo1 && anoPeriodo2,
    empresa,
    mesPeriodo1 !== '12' || mesPeriodo2 !== '12',
  ].filter(Boolean).length;

  const activeFiltersCountDashboard = [
    anoDashboard,
    empresa,
    mesesSelecionados.length !== 12,
  ].filter(Boolean).length;

  const filterSummaryDFC = useMemo(() => {
    const ML: Record<string, string> = {
      '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
      '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
      '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
    };
    const summary = [];
    if (anoPeriodo1) summary.push({ label: 'P1', value: `Jan-${ML[mesPeriodo1]}/${anoPeriodo1}` });
    if (anoPeriodo2) summary.push({ label: 'P2', value: `Jan-${ML[mesPeriodo2]}/${anoPeriodo2}` });
    if (empresa) summary.push({ label: 'Empresa', value: empresa });
    return summary;
  }, [anoPeriodo1, mesPeriodo1, anoPeriodo2, mesPeriodo2, empresa]);

  const filterSummaryDashboard = useMemo(() => {
    const summary = [];
    if (anoDashboard) summary.push({ label: 'Ano', value: anoDashboard });
    summary.push({ label: 'Meses', value: `${mesesSelecionados.length} selecionado(s)` });
    if (empresa) summary.push({ label: 'Empresa', value: empresa });
    return summary;
  }, [anoDashboard, mesesSelecionados, empresa]);

  const handleBuscar = useCallback(() => {
    setEmpresa(pendingEmpresa);
    if (activeTab === 'demonstracao') {
      setAnoPeriodo1(pendingAnoPeriodo1);
      setMesPeriodo1(pendingMesPeriodo1);
      setAnoPeriodo2(pendingAnoPeriodo2);
      setMesPeriodo2(pendingMesPeriodo2);
    } else {
      setAnoDashboard(pendingAnoDashboard);
      setMesesSelecionados([...pendingMesesSelecionados]);
    }
    markSearched();
    setShowMobileFilters(false);
  }, [activeTab, markSearched, pendingEmpresa, pendingAnoPeriodo1, pendingMesPeriodo1, pendingAnoPeriodo2, pendingMesPeriodo2, pendingAnoDashboard, pendingMesesSelecionados]);

  const handleClearFilters = useCallback(() => {
    setPendingEmpresa(undefined);
    setEmpresa(undefined);
    setPendingAnoPeriodo1('');
    setPendingAnoPeriodo2('');
    setPendingMesPeriodo1('12');
    setPendingMesPeriodo2('12');
    setAnoPeriodo1('');
    setAnoPeriodo2('');
    setPendingAnoDashboard('');
    setAnoDashboard('');
    setPendingMesesSelecionados(TODOS_MESES);
    setMesesSelecionados(TODOS_MESES);
    resetSearch();
  }, [resetSearch]);

  // Anos disponíveis: sem dados carregados usamos uma lista estática (estado neutro)
  const anosFallback = useMemo(() => {
    const atual = new Date().getFullYear();
    return [atual + 1, atual, atual - 1, atual - 2, atual - 3].map(String);
  }, []);
  const anosOptions = filterOptions.anos.length > 0 ? filterOptions.anos : anosFallback;

  const temDadosDFC = dfc.linhas.length > 0;

  // Mobile
  if (isMobile) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background pb-20">
        <MobileHeader
          title="Variação"
          subtitle="Fluxo de Caixa"
          actions={
            <div className="flex items-center gap-2">
              <Sheet open={showMobileFilters} onOpenChange={setShowMobileFilters}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Filter className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
                  <SheetHeader>
                    <SheetTitle>Filtros</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4 space-y-4 overflow-y-auto">
                    {activeTab === 'demonstracao' ? (
                      <DFCFilters
                        anos={anosOptions}
                        anoPeriodo1={pendingAnoPeriodo1}
                        mesPeriodo1={pendingMesPeriodo1}
                        anoPeriodo2={pendingAnoPeriodo2}
                        mesPeriodo2={pendingMesPeriodo2}
                        onAnoPeriodo1Change={setPendingAnoPeriodo1}
                        onMesPeriodo1Change={setPendingMesPeriodo1}
                        onAnoPeriodo2Change={setPendingAnoPeriodo2}
                        onMesPeriodo2Change={setPendingMesPeriodo2}
                        empresa={pendingEmpresa}
                        empresas={filterOptions.empresas}
                        onEmpresaChange={setPendingEmpresa}
                        onBuscar={handleBuscar}
                        hasChanges={hasChanges}
                      />
                    ) : (
                      <VariacaoFilters
                        anos={anosOptions}
                        anoSelecionado={pendingAnoDashboard}
                        onAnoChange={setPendingAnoDashboard}
                        mesesSelecionados={pendingMesesSelecionados}
                        onMesesChange={setPendingMesesSelecionados}
                        empresa={pendingEmpresa}
                        empresas={filterOptions.empresas}
                        onEmpresaChange={setPendingEmpresa}
                        onBuscar={handleBuscar}
                        hasChanges={hasChanges}
                      />
                    )}
                  </div>
                </SheetContent>
              </Sheet>
              <Button variant="ghost" size="icon" onClick={() => refetch()} className="h-9 w-9">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          }
        />

        <div className="sticky top-14 z-30 bg-background border-b border-border">
          <div className="flex">
            <button
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'demonstracao'
                  ? 'text-primary border-b-2 border-primary bg-primary/5'
                  : 'text-muted-foreground'
              }`}
              onClick={() => setActiveTab('demonstracao')}
            >
              <FileText className="h-4 w-4" />
              Demonstração
            </button>
            <button
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'dashboard'
                  ? 'text-primary border-b-2 border-primary bg-primary/5'
                  : 'text-muted-foreground'
              }`}
              onClick={() => setActiveTab('dashboard')}
            >
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!hasSearched ? (
            <div className="p-4">
              <FinanceiroSearchPrompt />
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center p-8">
              <LoadingState message="Carregando..." />
            </div>
          ) : isError ? (
            <div className="p-4">
              <ErrorState title="Erro ao carregar" message="Não foi possível carregar os dados." onRetry={() => refetch()} />
            </div>
          ) : filterOptions.anos.length < 1 ? (
            <div className="p-4">
              <EmptyState title="Dados insuficientes" message="É necessário ter pelo menos 1 ano de dados." />
            </div>
          ) : activeTab === 'demonstracao' ? (
            !temDadosDFC ? (
              <div className="p-4">
                <EmptyState title="Nenhum resultado" message="Nenhum dado encontrado para os períodos." />
              </div>
            ) : (
              <div className="p-4 space-y-6">
                <DFCTable
                  linhas={dfc.linhas}
                  anoPeriodo1={anoPeriodo1}
                  mesPeriodo1={mesPeriodo1}
                  anoPeriodo2={anoPeriodo2}
                  mesPeriodo2={mesPeriodo2}
                />
              </div>
            )
          ) : dashboardData.grupos.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Nenhum resultado" message="Nenhum dado encontrado para o ano." />
            </div>
          ) : (
            <div className="p-4">
              <DFCDashboard grupos={dashboardData.grupos} totais={dashboardData.totais} ano={anoDashboard} />
            </div>
          )}
        </div>

        <MobileBottomNav />
      </div>
    );
  }

  // Desktop
  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
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

      <div className="enterprise-page-shell max-w-[1600px]">
        {isLoading && hasSearched ? (
          <LoadingState message="Carregando dados de fluxo de caixa..." />
        ) : isError ? (
          <ErrorState
            title="Erro ao carregar dados"
            message="Não foi possível carregar os dados. Verifique sua conexão e tente novamente."
            onRetry={() => refetch()}
          />
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'demonstracao' | 'dashboard' | 'assistente' | 'configuracao')}
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
          >
            {activeTab === 'demonstracao' ? (
              <CollapsibleFilterBar
                title="Filtros - Demonstração"
                activeFiltersCount={activeFiltersCountDFC}
                summary={filterSummaryDFC}
                onClear={handleClearFilters}
              >
                <DFCFilters
                  anos={anosOptions}
                  anoPeriodo1={pendingAnoPeriodo1}
                  mesPeriodo1={pendingMesPeriodo1}
                  anoPeriodo2={pendingAnoPeriodo2}
                  mesPeriodo2={pendingMesPeriodo2}
                  onAnoPeriodo1Change={setPendingAnoPeriodo1}
                  onMesPeriodo1Change={setPendingMesPeriodo1}
                  onAnoPeriodo2Change={setPendingAnoPeriodo2}
                  onMesPeriodo2Change={setPendingMesPeriodo2}
                  empresa={pendingEmpresa}
                  empresas={filterOptions.empresas}
                  onEmpresaChange={setPendingEmpresa}
                  onBuscar={handleBuscar}
                  hasChanges={hasChanges}
                />
              </CollapsibleFilterBar>
            ) : activeTab === 'dashboard' ? (
              <CollapsibleFilterBar
                title="Filtros - Dashboard"
                activeFiltersCount={activeFiltersCountDashboard}
                summary={filterSummaryDashboard}
                onClear={handleClearFilters}
              >
                <VariacaoFilters
                  anos={anosOptions}
                  anoSelecionado={pendingAnoDashboard}
                  onAnoChange={setPendingAnoDashboard}
                  mesesSelecionados={pendingMesesSelecionados}
                  onMesesChange={setPendingMesesSelecionados}
                  empresa={pendingEmpresa}
                  empresas={filterOptions.empresas}
                  onEmpresaChange={setPendingEmpresa}
                  onBuscar={handleBuscar}
                  hasChanges={hasChanges}
                />
              </CollapsibleFilterBar>
            ) : null}

            <TabsList className="h-10 shrink-0 gap-1 rounded-lg border border-border/60 bg-muted/40 p-1 backdrop-blur">
              <TabsTrigger
                value="demonstracao"
                className="gap-2 h-9 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-foreground text-muted-foreground transition-all"
              >
                <FileText className="h-4 w-4" />
                Demonstração
              </TabsTrigger>
              <TabsTrigger
                value="dashboard"
                className="gap-2 h-9 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-foreground text-muted-foreground transition-all"
              >
                <BarChart3 className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger
                value="assistente"
                className="gap-2 h-9 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-foreground text-muted-foreground transition-all"
              >
                <Bot className="h-4 w-4" />
                Assistente
              </TabsTrigger>
              <TabsTrigger
                value="configuracao"
                className="gap-2 h-9 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-foreground text-muted-foreground transition-all"
              >
                <Settings2 className="h-4 w-4" />
                Configuração
              </TabsTrigger>
            </TabsList>

            <TabsContent value="demonstracao" className="mt-0 min-h-0 flex-1 space-y-3 overflow-auto">
              {!hasSearched ? (
                <FinanceiroSearchPrompt />
              ) : filterOptions.anos.length < 1 ? (
                <EmptyState title="Dados insuficientes" message="É necessário ter pelo menos 1 ano de dados para visualização." />
              ) : !temDadosDFC ? (
                <EmptyState title="Nenhum resultado" message="Nenhum dado encontrado para os períodos selecionados." />
              ) : (
                <DFCTable
                  linhas={dfc.linhas}
                  anoPeriodo1={anoPeriodo1}
                  mesPeriodo1={mesPeriodo1}
                  anoPeriodo2={anoPeriodo2}
                  mesPeriodo2={mesPeriodo2}
                />
              )}
            </TabsContent>

            <TabsContent value="dashboard" className="mt-0 min-h-0 flex-1 space-y-3 overflow-auto">
              {!hasSearched ? (
                <FinanceiroSearchPrompt />
              ) : filterOptions.anos.length < 1 ? (
                <EmptyState title="Dados insuficientes" message="É necessário ter pelo menos 1 ano de dados para visualização." />
              ) : dashboardData.grupos.length === 0 ? (
                <EmptyState title="Nenhum resultado" message="Nenhum dado encontrado para o ano selecionado." />
              ) : (
                <DFCDashboard grupos={dashboardData.grupos} totais={dashboardData.totais} ano={anoDashboard} />
              )}
            </TabsContent>

            <TabsContent value="assistente" className="mt-0 min-h-0 flex-1 space-y-3 overflow-auto">
              <VariacaoAssistant 
                variacaoData={variacaoData || []} 
                gruposInverterSinal={new Set<string>()}
                gruposAtivosOperacionais={gruposAtivosOperacionais}
                onUpdateInverterSinal={() => {}}
                onUpdateAtivosOperacionais={setGruposAtivosOperacionais}
              />
            </TabsContent>

            <TabsContent value="configuracao" className="mt-0 min-h-0 flex-1 space-y-3 overflow-auto">
              <DfcConfigTab />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
