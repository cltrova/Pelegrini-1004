import { useMemo, useState } from 'react';
import { AlertCircle, RefreshCw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useResumoComputed } from '@/hooks/useResumoData';
import { ResumoFilters } from '@/types/resumo';
import { ResumoVitalsKPIs } from '@/components/resumo/ResumoVitalsKPIs';
import { FunilCarteiraBar } from '@/components/resumo/FunilCarteiraBar';
import { AlertasCriticosBanner } from '@/components/resumo/AlertasCriticosBanner';
import { ProjecaoRecebimentosChart } from '@/components/resumo/ProjecaoRecebimentosChart';
import { AgingDetalhado } from '@/components/resumo/AgingDetalhado';
import { TopRiscoTable } from '@/components/resumo/TopRiscoTable';
import { PDDBreakdown } from '@/components/resumo/PDDBreakdown';
import { AnaliseClienteTab } from '@/components/resumo/AnaliseClienteTab';
import { ResumoFiltersBar } from '@/components/resumo/ResumoFiltersBar';
import { ResumoDuplicatasTable } from '@/components/resumo/ResumoDuplicatasTable';
import { AgenteCobrancaTab } from '@/components/resumo/AgenteCobrancaTab';
import { AcompanhamentoTab } from '@/components/resumo/AcompanhamentoTab';
import { PedidosAbertosTable } from '@/components/resumo/PedidosAbertosTable';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useCobrancaIntervencoes } from '@/hooks/useCobrancaIntervencoes';
import { EnterpriseBadge, EnterprisePageHeader } from '@/components/enterprise';
import { FinanceiroSearchPrompt } from '@/components/financeiro/FinanceiroSearchPrompt';
import { useFinanceiroSearch } from '@/contexts/FinanceiroSearchContext';


const initialFilters: ResumoFilters = {
  search: '',
  status: 'todos',
  empresa: 'todas',
  anos: [],
  meses: [],
  dataInicio: null,
  dataFim: null,
};

export default function ResumoPage() {
  const [filters, setFilters] = useState<ResumoFilters>(initialFilters);
  const [activeTab, setActiveTab] = useState('diagnostico');
  const { hasSearched, markSearched, resetSearch } = useFinanceiroSearch();
  const { empresa } = useEmpresaAtiva();
  const { pendentes } = useCobrancaIntervencoes();
  const {
    duplicatas,
    pedidos,
    kpis,
    clientesAnalytics,
    aging,
    projecao,
    pdd,
    alertas,
    filtradas,
    empresasDisponiveis,
    funil,
    isLoading,
    error,
    offlineError,
    hasSource,
    refetch,
  } = useResumoComputed(filters);

  const handleFunilSelect = (estagio: 'EM_ABERTO' | 'FATURADO_A_RECEBER' | 'RECEBIDO') => {
    if (estagio === 'EM_ABERTO') setActiveTab('pedidos');
    else setActiveTab('duplicatas');
  };

  const anosDisponiveis = useMemo(() => (
    Array.from(new Set(duplicatas.map((d) => d.dataVencimento?.slice(0, 4)).filter(Boolean) as string[])).sort().reverse()
  ), [duplicatas]);

  return (
    <div className="enterprise-page-shell max-w-[1600px]">
      <EnterprisePageHeader
        title="Resumo Financeiro"
        subtitle="Monitoramento de liquidez e contas a receber"
        icon={Wallet}
        actions={
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {hasSearched && !isLoading && hasSource && !error && alertas.length > 0 && (
            <AlertasCriticosBanner alertas={alertas} />
          )}
          <Button variant="outline" size="sm" onClick={() => { setFilters(initialFilters); resetSearch(); }}>
            Limpar
          </Button>
          <Button size="sm" onClick={() => markSearched()}>
            Buscar
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading || !hasSearched}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          </div>
        }
      />

      {hasSearched && !hasSource && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Fonte de dados não configurada</AlertTitle>
          <AlertDescription>
            Configure o JSON do módulo Resumo no cadastro da empresa para visualizar os dados.
          </AlertDescription>
        </Alert>
      )}

      {hasSearched && error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar dados</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {hasSearched && !error && offlineError && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Fonte externa indisponível</AlertTitle>
          <AlertDescription>
            O endpoint financeiro configurado não respondeu dados válidos. Os indicadores estão zerados até a API externa disponibilizar a rota.
          </AlertDescription>
        </Alert>
      )}

      {hasSearched && isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[120px] rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {!hasSearched && <FinanceiroSearchPrompt />}

      {hasSearched && !isLoading && hasSource && !error && (
        <>
          <ResumoVitalsKPIs kpis={kpis} pdd={pdd} />

          <FunilCarteiraBar segmentos={funil} onSelect={handleFunilSelect} />

          

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
            <TabsList className="grid w-full max-w-[1200px] shrink-0 grid-cols-6">
              <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
              <TabsTrigger value="clientes">Análise de Cliente</TabsTrigger>
              <TabsTrigger value="duplicatas">
                Faturado a Receber ({duplicatas.length})
              </TabsTrigger>
              <TabsTrigger value="pedidos">
                Em Aberto ({pedidos.length})
              </TabsTrigger>
              <TabsTrigger value="agente">🤖 Agente</TabsTrigger>
              <TabsTrigger value="acompanhamento" className="relative">
                📥 Acompanhamento
                {pendentes.length > 0 && (
                  <EnterpriseBadge tone="negative" className="ml-1 h-5 px-1.5">{pendentes.length}</EnterpriseBadge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="diagnostico" className="mt-3 min-h-0 flex-1 overflow-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-7 space-y-4">
                  <ProjecaoRecebimentosChart buckets={projecao} />
                  <AgingDetalhado faixas={aging} />
                  <PDDBreakdown pdd={pdd} />
                </div>
                <div className="lg:col-span-5 space-y-4">
                  <TopRiscoTable clientes={clientesAnalytics} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="clientes" className="mt-3 min-h-0 flex-1 overflow-auto">
              <AnaliseClienteTab clientes={clientesAnalytics} duplicatas={duplicatas} pedidos={pedidos} empresas={empresasDisponiveis} />
            </TabsContent>

            <TabsContent value="duplicatas" className="mt-3 min-h-0 flex-1 space-y-3 overflow-auto">
              <ResumoFiltersBar
                filters={filters}
                onChange={setFilters}
                empresas={empresasDisponiveis}
                anos={anosDisponiveis}
              />
              <ResumoDuplicatasTable duplicatas={filtradas} />
            </TabsContent>

            <TabsContent value="pedidos" className="mt-3 min-h-0 flex-1 overflow-auto">
              <PedidosAbertosTable pedidos={pedidos} />
            </TabsContent>

            <TabsContent value="agente" className="mt-3 min-h-0 flex-1 overflow-auto">
              <AgenteCobrancaTab duplicatas={duplicatas} />
            </TabsContent>

            <TabsContent value="acompanhamento" className="mt-3 min-h-0 flex-1 overflow-auto">
              <AcompanhamentoTab />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
