import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Search, X } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { FilterDropdownChip, MultiSelectOptions, SingleSelectOptions } from '@/components/common/FilterDropdownChip';
import { LoadingState } from '@/components/common/LoadingState';
import { EstoqueAssistantTab } from '@/components/operacional/EstoqueAssistantTab';
import { GiroEstoqueTab } from '@/components/operacional/GiroEstoqueTab';
import { EstoqueCommandCenter } from '@/components/operacional/estoque/EstoqueCommandCenter';
import { GiroFilterPopover } from '@/components/operacional/estoque/GiroFilterPopover';
import { countVisibleGiroFilters, GIRO_STATUS_LABELS, summarizeVisibleGiroFilters } from '@/components/operacional/estoque/giroFilterPresentation';
import {
  EstoqueDataViewport,
  EstoqueWorkspace,
  EstoqueWorkspaceHeader,
} from '@/components/operacional/estoque/EstoqueWorkspace';
import { PelegriniTabs } from '@/components/pelegrini';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
const DEFAULT_GIRO_FILTERS: GiroFiltersState = {
  periodoMeses: 3, statusFilter: [], empresas: [], marcas: [], grupos: [], searchTerm: '',
};

export default function EstoquePage() {
  const { activeCompanyCode, consolidadoData, detalhadoData, giroData, isLoading, empresa, sourceErrors, sourceStatus, sourceLastUpdated, lastSuccessfulUpdate, partialSources, recoveredSources, recoveryStatus, isFetching, refetch } = useEstoqueData();
  const { codEmpresaContexto, filialAtiva } = useFilialSelecionada();
  const [activeTab, setActiveTab] = useState('central');
  const [viewMode, setViewMode] = useState<ViewMode>('consolidado');
  const [giroFilters, setGiroFilters] = useState<GiroFiltersState>(DEFAULT_GIRO_FILTERS);
  const [pendingGiro, setPendingGiro] = useState<GiroFiltersState>(DEFAULT_GIRO_FILTERS);
  const [requestedProductCode, setRequestedProductCode] = useState<string | null>(null);
  const [sourceNoticeDismissed, setSourceNoticeDismissed] = useState(false);

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
  const detailedStockLoading = activeTab === 'central' && viewMode === 'detalhado'
    && sourceStatus?.detalhado === 'loading' && detalhadoData.length === 0;
  const movementLoading = activeTab !== 'central' && sourceStatus?.giro === 'loading' && giroData.length === 0;
  const partialStock = Boolean(partialSources?.[viewMode]);
  const recoveredStock = Boolean(recoveredSources?.[viewMode]);
  const recoveringStock = recoveryStatus === 'loading' && (partialStock || stockUnavailable);
  const activeError = activeTab === 'central'
    ? stockUnavailable && stockError && !recoveringStock
    : (stockUnavailable && stockError) || (movementUnavailable && movementError);
  const sourceHasActiveIssue = Boolean(movementError || (stockError && !recoveredStock));
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
    : stockUnavailable
      ? 'Estoque indisponivel'
      : recoveredStock
        ? movementError ? 'Estoque recuperado, giro pendente' : 'Estoque recuperado'
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
    marcas: [...new Set(estoqueData.map(r => r.marca))].sort(),
    grupos: [...new Set(estoqueData.map(r => (r.grupo && String(r.grupo).trim()) || 'Sem grupo'))].sort(),
  }), [estoqueData]);

  const applyGiroFilters = () => setGiroFilters({ ...pendingGiro });

  const giroActiveCount = useMemo(() => countVisibleGiroFilters(giroFilters), [giroFilters]);
  const giroSummary = useMemo(() => summarizeVisibleGiroFilters(giroFilters), [giroFilters]);
  const pendingGiroCount = useMemo(() => countVisibleGiroFilters(pendingGiro), [pendingGiro]);

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

  const sourceNoticeFingerprint = sourceHasActiveIssue
    ? [branchKey, viewMode, partialStock, recoveringStock, stockError?.message, movementError?.message].join('|')
    : `healthy:${branchKey}:${viewMode}`;

  useEffect(() => {
    setSourceNoticeDismissed(false);
  }, [sourceNoticeFingerprint]);

  useEffect(() => {
    setGiroFilters(DEFAULT_GIRO_FILTERS);
    setPendingGiro(DEFAULT_GIRO_FILTERS);
    setRequestedProductCode(null);
  }, [branchKey]);

  const sourceNotice = sourceHasActiveIssue && !sourceNoticeDismissed ? (
    <Alert className="rounded-none border-x-0 border-t-0 py-1.5" role="status">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="pr-10 text-xs">
        {recoveringStock ? 'Recuperando estoque completo' : partialStock ? 'Estoque parcial' : 'Dados com atualizacao pendente'}
      </AlertTitle>
      <AlertDescription className="pr-10 text-xs">
        {recoveringStock
          ? 'Reconstruindo o estoque pelo historico completo de movimentacoes.'
          : partialStock
          ? 'Exibindo produtos presentes no giro do periodo enquanto a fonte principal e recuperada.'
          : movementError
            ? 'Movimentacoes indisponiveis; indicadores de giro podem estar incompletos.'
            : 'Os ultimos dados carregados foram preservados e podem estar desatualizados.'}
        <Button variant="ghost" size="sm" className="ml-2 h-7" disabled={isFetching} onClick={() => { void refetch(); }}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" />{isFetching ? 'Consultando...' : 'Tentar novamente'}
        </Button>
      </AlertDescription>
      <Button
        aria-label="Fechar aviso da fonte"
        className="absolute right-2 top-1.5 h-7 w-7"
        onClick={() => setSourceNoticeDismissed(true)}
        size="icon"
        type="button"
        variant="ghost"
      >
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </Button>
    </Alert>
  ) : null;

  if (isLoading) {
    return (
      <EstoqueWorkspace>
        <EstoqueDataViewport className="p-4"><LoadingState /></EstoqueDataViewport>
      </EstoqueWorkspace>
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
    <EstoqueWorkspace className="bg-background">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="contents">
        <EstoqueWorkspaceHeader className="gap-3">
          <span className="hidden shrink-0 text-xs font-semibold text-foreground lg:inline">{branchName}</span>
          <PelegriniTabs
            ariaLabel="Visões do estoque"
            className="estoque-tabs min-w-0 flex-1"
            value={activeTab}
            onValueChange={setActiveTab}
            items={[
              { value: 'central', label: 'Central de Estoque' },
              { value: 'giro', label: 'Giro de Estoque' },
              { value: 'assistente', label: 'Assistente' },
            ]}
          />
          <span
            aria-label={`Estado da fonte de estoque: ${sourceStateLabel}`}
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 data-[issue=true]:bg-amber-500"
            data-issue={sourceHasActiveIssue || undefined}
            role="status"
            title={sourceStateLabel}
          />
          <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:inline">{lastUpdateLabel}</span>
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
        </EstoqueWorkspaceHeader>

        {detailedStockLoading ? (
          <EstoqueDataViewport className="p-4" role="status" aria-label="Carregando dados detalhados do estoque">
            <LoadingState />
          </EstoqueDataViewport>
        ) : movementLoading ? (
          <EstoqueDataViewport className="p-4" role="status" aria-label="Carregando movimentacoes do estoque">
            <LoadingState />
          </EstoqueDataViewport>
        ) : activeError ? (
          <EstoqueDataViewport className="p-4" role="alert">
            <ErrorState
              title="Estoque indisponivel"
              message={`${activeError.message} Os dados nao puderam ser consultados; isso nao significa estoque zerado.`}
              onRetry={isFetching ? undefined : () => { void refetch(); }}
            />
            {isFetching && <p role="status" className="p-3 text-center text-sm text-muted-foreground">Consultando novamente...</p>}
          </EstoqueDataViewport>
        ) : (
          <>
        <TabsContent className="m-0 min-h-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col" aria-labelledby="pelegrini-tab-central" id="pelegrini-tabpanel-central" value="central">
          {recoveringStock && estoqueData.length === 0 ? (
            <EstoqueDataViewport
              aria-label="Recuperando dados completos do estoque"
              className="p-4"
              role="status"
            >
              {sourceNotice}
              <LoadingState />
            </EstoqueDataViewport>
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
              sourceNotice={sourceNotice}
            />
          )}
        </TabsContent>

        <TabsContent className="m-0 min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col" aria-labelledby="pelegrini-tab-giro" id="pelegrini-tabpanel-giro" value="giro">
          <GiroEstoqueTab
            activeCompanyCode={activeCompanyCode}
            giroData={giroData}
            estoqueData={estoqueData}
            filters={giroFilters}
            onStatusFilterChange={applyGiroStatusFilter}
            toolbarContent={(
              <>
                <div className="relative min-w-[15rem] flex-1 sm:max-w-md">
                  <Search aria-hidden="true" className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="Buscar produtos no giro"
                    className="h-8 pl-8"
                    placeholder="Buscar produto, fabricante, marca..."
                    value={pendingGiro.searchTerm}
                    onChange={(event) => setPendingGiro(filters => ({ ...filters, searchTerm: event.target.value }))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') applyGiroFilters();
                    }}
                  />
                </div>
                <GiroFilterPopover
                  appliedCount={giroActiveCount}
                  appliedSummary={giroSummary}
                  onApply={applyGiroFilters}
                  onClear={clearGiroFilters}
                  pendingCount={pendingGiroCount}
                >
              <FilterDropdownChip label="Período" displayValue={`${pendingGiro.periodoMeses} meses`} isActive={false} onClear={() => setPendingGiro(filters => ({ ...filters, periodoMeses: 3 }))}>
                <SingleSelectOptions options={PERIODO_MESES_OPTIONS} selected={pendingGiro.periodoMeses} onChange={(value) => setPendingGiro(filters => ({ ...filters, periodoMeses: Number(value) }))} />
              </FilterDropdownChip>
              <FilterDropdownChip label="Status" displayValue={pendingGiro.statusFilter.length > 0 ? pendingGiro.statusFilter.map(status => GIRO_STATUS_LABELS[status]).join(', ') : 'Todos'} isActive={pendingGiro.statusFilter.length > 0} onClear={() => setPendingGiro(filters => ({ ...filters, statusFilter: [] }))}>
                <MultiSelectOptions options={STATUS_OPTIONS.map(option => option.label)} selected={pendingGiro.statusFilter.map(status => STATUS_OPTIONS.find(option => option.key === status)?.label || '')} onChange={(labels) => { const statuses = labels.map(label => STATUS_OPTIONS.find(option => option.label === label)?.key).filter(Boolean) as GiroStatus[]; setPendingGiro(filters => ({ ...filters, statusFilter: statuses })); }} allLabel="Todos" />
              </FilterDropdownChip>
              <FilterDropdownChip label="Marca" displayValue={pendingGiro.marcas.length > 0 ? `${pendingGiro.marcas.length} selecionada(s)` : 'Todas'} isActive={pendingGiro.marcas.length > 0} onClear={() => setPendingGiro(filters => ({ ...filters, marcas: [] }))}>
                <MultiSelectOptions options={filterOptions.marcas} selected={pendingGiro.marcas} onChange={(value) => setPendingGiro(filters => ({ ...filters, marcas: value }))} searchable allLabel="Todas" />
              </FilterDropdownChip>
              <FilterDropdownChip label="Grupo" displayValue={pendingGiro.grupos.length > 0 ? `${pendingGiro.grupos.length} selecionado(s)` : 'Todos'} isActive={pendingGiro.grupos.length > 0} onClear={() => setPendingGiro(filters => ({ ...filters, grupos: [] }))}>
                <MultiSelectOptions options={filterOptions.grupos} selected={pendingGiro.grupos} onChange={(value) => setPendingGiro(filters => ({ ...filters, grupos: value }))} searchable allLabel="Todos" />
              </FilterDropdownChip>
                </GiroFilterPopover>
              </>
            )}
          />
        </TabsContent>

        <TabsContent className="m-0 min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col" aria-labelledby="pelegrini-tab-assistente" id="pelegrini-tabpanel-assistente" value="assistente">
          <EstoqueAssistantTab giroData={giroData} estoqueData={estoqueData} onProductAction={openProductFromAssistant} />
        </TabsContent>
          </>
        )}
      </Tabs>
    </EstoqueWorkspace>
  );
}
