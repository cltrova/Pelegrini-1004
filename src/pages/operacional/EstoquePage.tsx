import { useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import {
  EnterpriseFilterBar,
  EnterpriseMultiSelectFilter,
  EnterpriseSearchFilter,
  EnterpriseSelectFilter,
} from '@/components/enterprise';
import { EstoqueAssistantTab } from '@/components/operacional/EstoqueAssistantTab';
import { GiroEstoqueTab } from '@/components/operacional/GiroEstoqueTab';
import { EstoqueCommandCenter } from '@/components/operacional/estoque/EstoqueCommandCenter';
import { PelegriniModuleHeader, PelegriniTabs } from '@/components/pelegrini';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useEstoqueData } from '@/hooks/useEstoqueData';
import type { EstoqueRecord, GiroFiltersState, GiroStatus, ViewMode } from '@/types/estoque';
import { toast } from 'sonner';

function calcDiasSemVenda(dataUltimaVenda: string | null): number {
  if (!dataUltimaVenda) return 9999;
  return Math.floor((Date.now() - new Date(dataUltimaVenda).getTime()) / (1000 * 60 * 60 * 24));
}

function exportToExcel(data: EstoqueRecord[]) {
  const header = ['Código', 'Produto', 'Marca', 'Fabricante', 'Nr Fabricante', 'Grupo', 'Filial', 'Curva', 'Qtd Estoque', 'Valor em Estoque', 'Custo Médio', 'Última Venda', 'Dias sem Venda'];
  const rows = data.map(r => [
    String(r.cod_produto), r.produto, r.marca, r.cod_fabricante, r.nr_fabricante, r.grupo, r.empresa, r.classe_abc,
    String(r.quantidade_estoque),
    r.valor_estoque.toFixed(2).replace('.', ','),
    r.custo_medio.toFixed(2).replace('.', ','),
    r.data_ultima_venda ? new Date(r.data_ultima_venda).toLocaleDateString('pt-BR') : '—',
    String(calcDiasSemVenda(r.data_ultima_venda) === 9999 ? 'N/A' : calcDiasSemVenda(r.data_ultima_venda)),
  ]);
  const csvContent = [header, ...rows].map(r => r.map(c => `"${c}"`).join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `estoque_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${data.length} itens exportados com sucesso!`);
}

const PERIODO_MESES_OPTIONS = [
  { value: 3, label: '3 meses' },
];
const STATUS_OPTIONS = [
  { key: 'atendendo' as GiroStatus, label: '🟢 Atendendo' },
  { key: 'alerta' as GiroStatus, label: '🟡 Alerta' },
  { key: 'faltando' as GiroStatus, label: '🔴 Faltando' },
  { key: 'excesso' as GiroStatus, label: '🔵 Excesso' },
];
const STATUS_CONFIG_LABELS: Record<GiroStatus, string> = {
  atendendo: 'Atendendo', alerta: 'Alerta', faltando: 'Faltando', excesso: 'Excesso',
};
const DEFAULT_GIRO_FILTERS: GiroFiltersState = {
  periodoMeses: 3, statusFilter: [], empresas: [], marcas: [], grupos: [], searchTerm: '',
};

export default function EstoquePage() {
  const { consolidadoData, detalhadoData, giroData, isLoading, empresa, sourceErrors, sourceStatus, sourceLastUpdated, lastSuccessfulUpdate, partialSources, recoveredSources, recoveryStatus, isFetching, refetch } = useEstoqueData();
  const { codEmpresaContexto, filialAtiva } = useFilialSelecionada();
  const [activeTab, setActiveTab] = useState('central');
  const [viewMode, setViewMode] = useState<ViewMode>('consolidado');
  const [giroFilters, setGiroFilters] = useState<GiroFiltersState>(DEFAULT_GIRO_FILTERS);
  const [pendingGiro, setPendingGiro] = useState<GiroFiltersState>(DEFAULT_GIRO_FILTERS);
  const [requestedProductCode, setRequestedProductCode] = useState<string | null>(null);
  const [giroFiltersOpen, setGiroFiltersOpen] = useState(false);

  const estoqueData = useMemo(
    () => viewMode === 'consolidado' ? consolidadoData : detalhadoData,
    [consolidadoData, detalhadoData, viewMode],
  );
  const branchKey = `${codEmpresaContexto ?? empresa?.cod_empresa_bi ?? 'empresa'}:${filialAtiva ?? 'sem-filial'}`;
  const stockError = sourceErrors?.[viewMode];
  const movementError = sourceErrors?.giro;
  const stockUnavailable = Boolean(stockError && estoqueData.length === 0);
  const movementUnavailable = Boolean(movementError);
  const movementAvailable = !movementUnavailable && (
    sourceStatus?.giro === undefined || sourceStatus.giro === 'ready' || (sourceStatus.giro === 'fetching' && giroData.length > 0)
  );
  const movementLoading = activeTab !== 'central' && sourceStatus?.giro === 'loading' && giroData.length === 0;
  const partialStock = Boolean(partialSources?.[viewMode]);
  const recoveredStock = Boolean(recoveredSources?.[viewMode]);
  const recoveringStock = recoveryStatus === 'loading' && (partialStock || stockUnavailable);
  const activeError = activeTab === 'central'
    ? stockUnavailable && stockError && !recoveringStock
    : (stockUnavailable && stockError) || (movementUnavailable && movementError);
  const hasSourceIssue = Boolean(stockError || movementError);
  const branchName = filialAtiva === 'chevrolet' ? 'Casa do Chevrolet' : 'Casa da Transmissao';
  const activeSourceUpdate = activeTab === 'central'
    ? sourceLastUpdated?.[viewMode]
    : sourceLastUpdated?.giro;
  const displayedUpdate = sourceLastUpdated === undefined ? lastSuccessfulUpdate : activeSourceUpdate;
  const lastUpdateLabel = displayedUpdate
    ? `Atualizado as ${displayedUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : 'Aguardando primeira atualizacao';
  const stockSourceState = sourceStatus?.[viewMode];
  const sourceStateLabel = isFetching
    ? recoveringStock ? 'Recuperando estoque completo' : 'Atualizando dados'
    : recoveredStock
      ? 'Estoque recuperado'
    : partialStock
      ? 'Fonte parcial'
      : stockError
        ? 'Ultimos dados preservados'
        : movementError
          ? 'Estoque atualizado, giro pendente'
          : stockSourceState === 'ready'
            ? 'Dados atualizados'
            : 'Fonte aguardando consulta';

  const filterOptions = useMemo(() => ({
    empresas: [...new Set(estoqueData.map(r => r.empresa))].sort(),
    marcas: [...new Set(estoqueData.map(r => r.marca))].sort(),
    grupos: [...new Set(estoqueData.map(r => (r.grupo && String(r.grupo).trim()) || 'Sem grupo'))].sort(),
  }), [estoqueData]);

  const applyGiroFilters = () => setGiroFilters({ ...pendingGiro });

  const giroActiveCount = useMemo(() => {
    let count = 0;
    if (pendingGiro.periodoMeses !== 3) count++;
    if (pendingGiro.statusFilter.length > 0) count++;
    if (pendingGiro.empresas.length > 0) count++;
    if (pendingGiro.marcas.length > 0) count++;
    if (pendingGiro.grupos.length > 0) count++;
    return count;
  }, [pendingGiro]);

  const giroSummary = useMemo(() => {
    const parts: string[] = [`${pendingGiro.periodoMeses} meses`];
    if (pendingGiro.statusFilter.length > 0) parts.push(pendingGiro.statusFilter.map(s => STATUS_CONFIG_LABELS[s]).join(', '));
    if (pendingGiro.empresas.length > 0) parts.push(`${pendingGiro.empresas.length} filial(is)`);
    if (pendingGiro.marcas.length > 0) parts.push(`${pendingGiro.marcas.length} marca(s)`);
    return parts.join(' · ');
  }, [pendingGiro]);

  const clearGiroFilters = () => {
    setPendingGiro(DEFAULT_GIRO_FILTERS);
    setGiroFilters(DEFAULT_GIRO_FILTERS);
  };

  const applyGiroStatusFilter = (statusFilter: GiroStatus[]) => {
    setPendingGiro(current => ({ ...current, statusFilter }));
    setGiroFilters(current => ({ ...current, statusFilter }));
  };

  const openProductFromAssistant = (productCode: string) => {
    setViewMode('consolidado');
    setRequestedProductCode(productCode);
    setActiveTab('central');
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <PelegriniModuleHeader title="Gestao de Estoque" subtitle="Carregando dados..." moduleKey="operacional" compact className="ml-10 sm:ml-0" />
        <LoadingState />
      </div>
    );
  }

  if (!empresa?.modulo_operacional) {
    return (
      <div className="p-6">
        <EmptyState message="O módulo Operacional não está ativado para esta empresa." />
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-3 overflow-x-clip p-3 md:p-4">
      <div className="relative min-w-0">
        <PelegriniModuleHeader
          title="Gestao de Estoque"
          subtitle={`${branchName} · ${lastUpdateLabel}`}
          moduleKey="operacional"
          compact
          className="ml-10 sm:ml-0"
        />
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border/70 bg-card px-4 py-2">
          <span className="min-w-0 truncate text-xs font-medium text-muted-foreground" role="status">
            {sourceStateLabel}
          </span>
          <Button
            aria-label={isFetching ? 'Atualizando dados do estoque' : 'Atualizar dados do estoque'}
            className="h-8 w-8 shrink-0"
            disabled={isFetching}
            onClick={() => { void refetch(); }}
            size="icon"
            title="Atualizar dados"
            type="button"
            variant="ghost"
          >
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <PelegriniTabs
          ariaLabel="Visões do estoque"
          className="estoque-tabs"
          value={activeTab}
          onValueChange={setActiveTab}
          items={[
            { value: 'central', label: 'Central de Estoque' },
            { value: 'giro', label: 'Giro de Estoque' },
            { value: 'assistente', label: 'Assistente' },
          ]}
        />

        {movementLoading ? (
          <div className="border border-border bg-card p-4" role="status" aria-label="Carregando movimentacoes do estoque">
            <LoadingState />
          </div>
        ) : activeError ? (
          <div role="alert">
            <ErrorState
              title="Estoque indisponivel"
              message={`${activeError.message} Os dados nao puderam ser consultados; isso nao significa estoque zerado.`}
              onRetry={isFetching ? undefined : () => { void refetch(); }}
            />
            {isFetching && <p role="status" className="p-3 text-center text-sm text-muted-foreground">Consultando novamente...</p>}
          </div>
        ) : (
          <>
            {hasSourceIssue && !recoveredStock && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{recoveringStock ? 'Recuperando estoque completo' : partialStock ? 'Estoque parcial' : 'Dados com atualizacao pendente'}</AlertTitle>
                <AlertDescription>
                  {recoveringStock
                    ? 'A fonte consolidada falhou. O sistema esta reconstruindo o estoque pelo historico completo de movimentacoes.'
                    : partialStock
                    ? 'A fonte principal falhou. Exibindo apenas produtos presentes no giro do periodo, nao o estoque completo.'
                    : movementError
                      ? 'Nao foi possivel atualizar as movimentacoes. Indicadores que dependem do giro podem estar incompletos ou desatualizados.'
                      : 'A consulta falhou. Os ultimos dados carregados foram preservados e podem estar desatualizados.'}
                  <Button variant="outline" size="sm" className="ml-2 mt-2" disabled={isFetching} onClick={() => { void refetch(); }}>
                    <RefreshCw className="mr-2 h-4 w-4" />{isFetching ? 'Consultando...' : 'Tentar novamente'}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
        <TabsContent aria-labelledby="pelegrini-tab-central" id="pelegrini-tabpanel-central" value="central">
          {recoveringStock && estoqueData.length === 0 ? (
            <div
              aria-label="Recuperando dados completos do estoque"
              className="border border-border bg-card p-4"
              role="status"
            >
              <LoadingState />
            </div>
          ) : (
            <EstoqueCommandCenter
              stockData={estoqueData}
              movementData={giroData}
              movementAvailable={movementAvailable}
              branchKey={branchKey}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onExport={exportToExcel}
              requestedProductCode={requestedProductCode}
              onRequestedProductHandled={() => setRequestedProductCode(null)}
            />
          )}
        </TabsContent>

        <TabsContent aria-labelledby="pelegrini-tab-giro" id="pelegrini-tabpanel-giro" value="giro">
          <div className="mb-3 space-y-2">
            <EnterpriseFilterBar
              activeCount={giroActiveCount}
              applyLabel="Aplicar"
              isOpen={giroFiltersOpen}
              onApply={() => {
                applyGiroFilters();
                setGiroFiltersOpen(false);
              }}
              onClear={clearGiroFilters}
              onOpenChange={setGiroFiltersOpen}
              resultCount={estoqueData.length}
              resultLabel="itens"
              summary={(
                <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
                  <EnterpriseSearchFilter
                    label="Buscar giro"
                    onChange={(value) => setPendingGiro(filters => ({ ...filters, searchTerm: value }))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') applyGiroFilters();
                    }}
                    placeholder="Buscar produto, fabricante, marca..."
                    value={pendingGiro.searchTerm}
                  />
                  {giroActiveCount > 0 && (
                    <span className="min-w-0 truncate pb-1 text-xs text-muted-foreground">
                      {giroSummary}
                    </span>
                  )}
                </div>
              )}
            >
              {giroFiltersOpen && (
                <>
                  <EnterpriseSelectFilter
                    label="Período"
                    onChange={(value) => setPendingGiro(filters => ({ ...filters, periodoMeses: Number(value ?? 6) }))}
                    options={PERIODO_MESES_OPTIONS.map((option) => ({ value: String(option.value), label: option.label }))}
                    value={String(pendingGiro.periodoMeses)}
                  />
                  <EnterpriseMultiSelectFilter
                    allLabel="Todos"
                    label="Status"
                    onChange={(values) => setPendingGiro(filters => ({ ...filters, statusFilter: values as GiroStatus[] }))}
                    options={STATUS_OPTIONS.map((option) => ({ value: option.key, label: option.label }))}
                    searchable={false}
                    values={pendingGiro.statusFilter}
                  />
                  <EnterpriseMultiSelectFilter
                    allLabel="Todas"
                    label="Filial"
                    onChange={(value) => setPendingGiro(filters => ({ ...filters, empresas: value }))}
                    options={filterOptions.empresas.map((value) => ({ value, label: value }))}
                    values={pendingGiro.empresas}
                  />
                  <EnterpriseMultiSelectFilter
                    allLabel="Todas"
                    label="Marca"
                    onChange={(value) => setPendingGiro(filters => ({ ...filters, marcas: value }))}
                    options={filterOptions.marcas.map((value) => ({ value, label: value }))}
                    values={pendingGiro.marcas}
                  />
                  <EnterpriseMultiSelectFilter
                    allLabel="Todos"
                    label="Grupo"
                    onChange={(value) => setPendingGiro(filters => ({ ...filters, grupos: value }))}
                    options={filterOptions.grupos.map((value) => ({ value, label: value }))}
                    values={pendingGiro.grupos}
                  />
                </>
              )}
            </EnterpriseFilterBar>
          </div>
          <GiroEstoqueTab
            activeCompanyCode={codEmpresaContexto ?? empresa?.cod_empresa_bi}
            giroData={giroData}
            estoqueData={estoqueData}
            filters={giroFilters}
            onStatusFilterChange={applyGiroStatusFilter}
          />
        </TabsContent>

        <TabsContent aria-labelledby="pelegrini-tab-assistente" id="pelegrini-tabpanel-assistente" value="assistente">
          <EstoqueAssistantTab giroData={giroData} estoqueData={estoqueData} onProductAction={openProductFromAssistant} />
        </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
