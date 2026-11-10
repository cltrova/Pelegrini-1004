import { BellRing, Download, Layers3, ListTree } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { EstoqueRecord, GiroRecord, ViewMode } from '@/types/estoque';

import { EstoqueAttentionPanel } from './EstoqueAttentionPanel';
import { EstoqueMovementHighlights } from './EstoqueMovementHighlights';
import { EstoqueProductDrawer } from './EstoqueProductDrawer';
import { EstoqueProductsTable } from './EstoqueProductsTable';
import { readVisibleColumns, StockColumnPicker, storageKey, type StockColumnKey } from './EstoqueProductsTable';
import { EstoqueSmartFilters } from './EstoqueSmartFilters';
import { EstoqueSummaryCards } from './EstoqueSummaryCards';
import { EstoqueDataViewport, EstoqueToolbar } from './EstoqueWorkspace';
import { EMPTY_STOCK_VALUE, filterStockColumns, hasStockColumnFilter, reconcileStockBrands, stockClassificationOptions, stockColumnOptions, type StockColumnFilters, type StockColumnFilterValue, type StockFilterOption } from './stockColumnFilters';
import type { PelegriniStockPage, StockPageQuery } from './stockPagedApi';
import {
  buildStockInsights,
  consolidateStockRecords,
  detectStockGranularity,
  filterStockInsights,
  sortStockInsights,
  type StockProductInsight,
  type StockQuickFilter,
  type StockSortMode,
} from './estoqueIntelligence';

export interface EstoqueCommandCenterProps {
  stockData: EstoqueRecord[];
  movementData: GiroRecord[];
  branchKey: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onExport: (records: EstoqueRecord[]) => void;
  movementAvailable?: boolean;
  requestedProductCode?: number | string | null;
  onRequestedProductHandled?: () => void;
  sourceNotice?: ReactNode;
  requestedQuickFilter?: StockQuickFilter | null;
  onRequestedQuickFilterHandled?: () => void;
  serverPage?: PelegriniStockPage;
  serverPageLoading?: boolean;
  serverPaged?: boolean;
  stockColumnFiltersSupported?: boolean;
  stockPageQuery?: StockPageQuery;
  onStockPageQueryChange?: (query: StockPageQuery) => void;
}

export function EstoqueCommandCenter({
  stockData,
  movementData,
  branchKey,
  viewMode,
  onViewModeChange,
  onExport,
  movementAvailable = true,
  requestedProductCode,
  onRequestedProductHandled,
  sourceNotice,
  requestedQuickFilter,
  onRequestedQuickFilterHandled,
  serverPage,
  serverPageLoading = false,
  serverPaged = false,
  stockColumnFiltersSupported = false,
  stockPageQuery,
  onStockPageQueryChange,
}: EstoqueCommandCenterProps) {
  const [search, setSearch] = useState(stockPageQuery?.search ?? '');
  const [quickFilter, setQuickFilter] = useState<StockQuickFilter>(stockPageQuery?.quickFilter ?? 'all');
  const [brands, setBrands] = useState<string[]>(stockPageQuery?.brands ?? []);
  const [groups, setGroups] = useState<string[]>(stockPageQuery?.groups ?? []);
  const [lines, setLines] = useState<string[]>(stockPageQuery?.lines ?? []);
  const [sortMode, setSortMode] = useState<StockSortMode>(stockPageQuery?.sortMode ?? 'group-brand-product');
  const [columnFilters, setColumnFilters] = useState<StockColumnFilters>(stockPageQuery?.columnFilters ?? {});
  const [visibleColumns, setVisibleColumns] = useState<StockColumnKey[]>(() => readVisibleColumns(branchKey, viewMode));
  const [selectedProduct, setSelectedProduct] = useState<StockProductInsight | null>(null);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const previousBranch = useRef(branchKey);

  useEffect(() => {
    if (!requestedQuickFilter) return;
    setQuickFilter(requestedQuickFilter);
    onRequestedQuickFilterHandled?.();
  }, [onRequestedQuickFilterHandled, requestedQuickFilter]);

  useEffect(() => {
    if (previousBranch.current === branchKey) return;
    previousBranch.current = branchKey;
    setSearch('');
    setQuickFilter('all');
    setBrands([]);
    setGroups([]);
    setLines([]);
    setColumnFilters({});
    setSortMode('group-brand-product');
    setSelectedProduct(null);
    setAttentionOpen(false);
  }, [branchKey]);

  useEffect(() => {
    setVisibleColumns(readVisibleColumns(branchKey, viewMode));
  }, [branchKey, viewMode]);

  useEffect(() => {
    if (!movementAvailable && quickFilter === 'excess') {
      setQuickFilter('all');
    }
  }, [movementAvailable, quickFilter]);

  useEffect(() => {
    if (serverPaged && ['stagnant', 'attention', 'excess'].includes(quickFilter)) setQuickFilter('all');
  }, [quickFilter, serverPaged]);
  const queryFilterKey = JSON.stringify({ search, quickFilter, brands, groups, lines, sortMode, columnFilters });
  const savedFilterKey = stockPageQuery ? JSON.stringify({ search: stockPageQuery.search, quickFilter: stockPageQuery.quickFilter, brands: stockPageQuery.brands, groups: stockPageQuery.groups, lines: stockPageQuery.lines, sortMode: stockPageQuery.sortMode, columnFilters: stockPageQuery.columnFilters ?? {} }) : '';
  useEffect(() => {
    if (serverPaged && onStockPageQueryChange && queryFilterKey !== savedFilterKey) onStockPageQueryChange({ ...JSON.parse(queryFilterKey), page: 1 });
  }, [serverPaged, onStockPageQueryChange, queryFilterKey, savedFilterKey]);
  useEffect(() => {
    if (serverPaged && serverPage && !serverPageLoading) setBrands(current => {
      const next = reconcileStockBrands(current, serverPage.opcoes.marcas);
      return next.length === current.length ? current : next;
    });
  }, [serverPaged, serverPage, serverPageLoading]);

  const displayedStock = useMemo(
    () => !serverPaged && viewMode === 'consolidado' ? consolidateStockRecords(stockData) : stockData,
    [stockData, viewMode, serverPaged],
  );
  const detailedGranularity = useMemo(() => detectStockGranularity(stockData), [stockData]);

  const insights = useMemo(
    () => buildStockInsights(
      displayedStock,
      serverPaged ? [] : movementData,
      new Date(),
      viewMode === 'consolidado' ? 'product' : 'branch',
    ),
    [displayedStock, movementData, viewMode, serverPaged],
  );

  const options = useMemo(() => serverPaged && serverPage ? { groups: serverPage.opcoes.grupos, brands: serverPage.opcoes.marcas, lines: serverPage.opcoes.linhas } : stockClassificationOptions(insights, groups), [insights, groups, serverPaged, serverPage]);
  const effectiveColumnFilters = useMemo<StockColumnFilters>(() => ({ ...columnFilters, group: { values: groups }, brand: { values: brands } }), [columnFilters, groups, brands]);
  const columnFilterOptions = useMemo(() => {
    const selection: Partial<Record<StockColumnKey, StockFilterOption[]>> = {};
    for (const key of ['group', 'brand', 'status', 'branch', 'location'] as const) selection[key] = stockColumnOptions(insights, key);
    selection.brand = selection.brand?.filter(option => options.brands.includes(option.value));
    if (serverPaged && serverPage) {
      selection.group = options.groups.map(value => ({ value, label: value || 'Sem informação' }));
      selection.brand = options.brands.map(value => ({ value, label: value || 'Sem informação' }));
      selection.branch = serverPage.opcoes.filiais?.map(branch => ({ value: String(branch.codigo), label: `${branch.codigo} · ${branch.nome}` })) ?? [];
      selection.location = serverPage.opcoes.localizacoes?.map(value => ({ value, label: value || 'Sem informação' })) ?? [];
      selection.status = [{ value: 'available', label: 'Disponível' }, { value: 'low', label: 'Estoque baixo' }, { value: 'critical', label: 'Crítico' }, { value: 'out', label: 'Sem estoque' }];
    }
    return selection;
  }, [insights, options, serverPaged, serverPage]);
  const handleGroupsChange = (next: string[]) => {
    const available = stockClassificationOptions(insights, next);
    setGroups(next);
    if (!serverPaged) setBrands(current => reconcileStockBrands(current, available.brands));
  };
  const handleColumnFilterChange = (key: StockColumnKey, value: StockColumnFilterValue) => {
    if (key === 'group') handleGroupsChange(value.values ?? []);
    else if (key === 'brand') setBrands(value.values ?? []);
    else {
      if (key === 'status') setQuickFilter('all');
      setColumnFilters(current => { const next = { ...current }; if (hasStockColumnFilter(value)) next[key] = value; else delete next[key]; return next; });
    }
  };
  const activeColumnCount = Object.values(columnFilters).filter(hasStockColumnFilter).length;
  const hasFilters = Boolean(search || quickFilter !== 'all' || brands.length || groups.length || lines.length || activeColumnCount);

  const filtered = useMemo(
    () => serverPaged ? insights : sortStockInsights(
      filterStockColumns(filterStockInsights(insights, {
        search,
        quickFilter,
        lines,
      }), effectiveColumnFilters),
      sortMode,
    ),
    [effectiveColumnFilters, insights, lines, quickFilter, search, sortMode, serverPaged],
  );

  useEffect(() => {
    if (requestedProductCode === null || requestedProductCode === undefined) return;
    const requested = insights.find(product => String(product.cod_produto) === String(requestedProductCode));
    if (requested) setSelectedProduct(requested);
    onRequestedProductHandled?.();
  }, [insights, onRequestedProductHandled, requestedProductCode]);
  const attentionCount = useMemo(
    () => insights.filter((item) => (
      item.status === 'out' ||
      item.status === 'critical' ||
      item.status === 'low' ||
      item.stagnantDays > 90
    )).length,
    [insights],
  );

  const clearFilters = () => {
    setSearch('');
    setQuickFilter('all');
    setBrands([]);
    setGroups([]);
    setLines([]);
    setColumnFilters({});
  };

  const selectProduct = (product: StockProductInsight) => {
    setAttentionOpen(false);
    setSelectedProduct(product);
  };

  const handleVisibleColumnsChange = (columns: StockColumnKey[]) => {
    setVisibleColumns(columns);
    window.localStorage.setItem(storageKey(branchKey, viewMode), JSON.stringify(columns));
  };

  return (
    <section
      aria-label="Central de estoque"
      className="operational-command-center estoque-manager-view flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden"
    >
      <EstoqueToolbar>
        <EstoqueSmartFilters
          compact
          actions={(
            <>
              {!serverPaged && <Sheet onOpenChange={setAttentionOpen} open={attentionOpen}>
                <SheetTrigger asChild>
                  <Button aria-label="Abrir painel de atencao" className="h-8 gap-1.5 px-2.5 text-xs" type="button" variant="outline">
                    <BellRing aria-hidden="true" className="h-3.5 w-3.5" />
                    <span className="hidden lg:inline">Atencao</span>
                    {attentionCount > 0 && <span className="tabular-nums text-xs">{attentionCount}</span>}
                  </Button>
                </SheetTrigger>
                <SheetContent className="operational-overlay w-[min(96vw,42rem)] overflow-y-auto p-0 sm:max-w-2xl" side="right">
                  <SheetHeader className="border-b border-border px-4 py-3 pr-12 text-left">
                    <SheetTitle>Atencao no estoque</SheetTitle>
                    <SheetDescription>Alertas e movimentos que merecem acompanhamento.</SheetDescription>
                  </SheetHeader>
                  <div className="space-y-4 p-4">
                    <EstoqueAttentionPanel products={filtered} onSelectProduct={selectProduct} />
                    <EstoqueMovementHighlights products={filtered} onSelectProduct={selectProduct} />
                  </div>
                </SheetContent>
              </Sheet>}
              <StockColumnPicker
                branchKey={branchKey}
                onVisibleColumnsChange={handleVisibleColumnsChange}
                viewMode={viewMode}
                visibleColumns={visibleColumns}
              />
            </>
          )}
          brands={brands}
          extraActiveCount={activeColumnCount}
          groups={groups}
          leading={(
            <div
            aria-label="Modo de visualizacao do estoque"
            className="inline-flex h-8 min-w-0 max-w-full shrink-0 justify-start rounded-md border border-border bg-muted/20 p-0.5"
            role="group"
          >
            <Button
              aria-pressed={viewMode === 'consolidado'}
              className={cn('h-7 min-w-0 gap-1.5 px-2 text-xs', viewMode !== 'consolidado' && 'text-muted-foreground')}
              onClick={() => onViewModeChange('consolidado')}
              size="sm"
              type="button"
              variant={viewMode === 'consolidado' ? 'secondary' : 'ghost'}
            >
              <Layers3 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              <span>Consolidado</span>
            </Button>
            <Button
              aria-pressed={viewMode === 'detalhado'}
              className={cn('h-7 min-w-0 gap-1.5 px-2 text-xs', viewMode !== 'detalhado' && 'text-muted-foreground')}
              onClick={() => onViewModeChange('detalhado')}
              size="sm"
              type="button"
              variant={viewMode === 'detalhado' ? 'secondary' : 'ghost'}
            >
              <ListTree aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              <span>Detalhado</span>
            </Button>
            </div>
          )}
          lines={lines}
          onBrandsChange={setBrands}
          onClearAll={clearFilters}
          onGroupsChange={handleGroupsChange}
          onLinesChange={setLines}
          onQuickFilterChange={filter => { setQuickFilter(filter); setColumnFilters(current => { const next = { ...current }; delete next.status; return next; }); }}
          onSearchChange={setSearch}
          options={options}
          quickFilter={quickFilter}
          search={search}
        />
      </EstoqueToolbar>

      <EstoqueSummaryCards
        activeFilter={quickFilter}
        movementAvailable={movementAvailable}
        onFilterChange={setQuickFilter}
        products={insights}
        serverSummary={serverPage ? { label: viewMode === 'consolidado' ? 'Produtos' : 'Registros detalhados', count: serverPage.total_itens, quantity: Number(serverPage.totais.quantidade_estoque ?? 0), value: Number(serverPage.totais.valor_estoque ?? 0) } : undefined}
      />

      <EstoqueDataViewport>
        {sourceNotice ? <div className="shrink-0">{sourceNotice}</div> : null}
        <div aria-label="Contagem e ordenacao dos produtos" className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-1.5 text-xs" role="group">
          <span className="tabular-nums text-muted-foreground">{(serverPage?.total_itens ?? filtered.length).toLocaleString('pt-BR')} {viewMode === 'consolidado' ? 'produto(s)' : 'registro(s)'}</span>
          {serverPageLoading && <span role="status" className="text-muted-foreground">Atualizando…</span>}
          {sortMode === 'group-brand-product' ? <span className="text-muted-foreground">1 Grupo → 2 Marca → 3 Produto</span> : <Button className="h-7 px-2 text-xs" type="button" variant="ghost" onClick={() => setSortMode('group-brand-product')}>Restaurar Grupo → Marca → Produto</Button>}
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="Filtros de coluna ativos">
            {Object.entries(effectiveColumnFilters).filter(([, value]) => hasStockColumnFilter(value)).map(([key, value]) => <button key={key} type="button" aria-label={`Remover filtro ${columnLabels[key as StockColumnKey]}`} onClick={() => handleColumnFilterChange(key as StockColumnKey, {})} title={describeFilter(value)} className="inline-flex max-w-48 shrink-0 items-center gap-1 rounded border border-primary/25 bg-primary/10 px-2 py-1 text-primary"><span className="truncate">{columnLabels[key as StockColumnKey]}: {describeFilter(value)}</span><span aria-hidden="true">×</span></button>)}
          </div>
          {hasFilters && <Button type="button" variant="ghost" className="h-7 px-2 text-xs" onClick={clearFilters}>Limpar filtros</Button>}
          <Button aria-label={serverPaged ? 'Baixar página de produtos' : 'Baixar lista de produtos'} disabled={!filtered.length || serverPageLoading} className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => onExport(filtered)} type="button" variant="outline"><Download aria-hidden="true" className="h-3.5 w-3.5" />{serverPaged ? 'Baixar página' : 'Baixar lista'}</Button>
        </div>
        <EstoqueProductsTable
          branchKey={branchKey}
          onSelectProduct={selectProduct}
          onSortChange={setSortMode}
          onVisibleColumnsChange={handleVisibleColumnsChange}
          products={filtered}
          columnFilters={effectiveColumnFilters}
          columnFilterOptions={columnFilterOptions}
          onColumnFilterChange={!serverPaged || stockColumnFiltersSupported ? handleColumnFilterChange : undefined}
          serverPagination={serverPage && stockPageQuery && onStockPageQueryChange ? { page: serverPage.pagina, pageCount: serverPage.total_paginas, loading: serverPageLoading, onPageChange: page => onStockPageQueryChange({ ...stockPageQuery, page }) } : undefined}
          sortMode={sortMode}
          sourceEmpty={!serverPaged && stockData.length === 0}
          visibleColumns={visibleColumns}
          viewMode={viewMode}
        />
      </EstoqueDataViewport>

      <EstoqueProductDrawer
        onOpenChange={(open) => {
          if (!open) setSelectedProduct(null);
        }}
        open={selectedProduct !== null}
        product={selectedProduct}
      />
    </section>
  );
}

const columnLabels: Record<StockColumnKey, string> = { product: 'Produto', brand: 'Marca', group: 'Grupo', quantity: 'Quantidade', value: 'Valor', lastMovement: 'Última movimentação', status: 'Situação', branch: 'Filial', averageCost: 'Custo médio', location: 'Localização', lastPurchase: 'Última compra', lastSale: 'Última venda' };
function describeFilter(value: StockColumnFilterValue): string {
  if (value.values?.length) return value.values.map(item => item === EMPTY_STOCK_VALUE ? 'Sem informação' : ({ available: 'Disponível', low: 'Estoque baixo', critical: 'Crítico', out: 'Sem estoque' }[item] ?? item)).join(', ');
  if (value.text) return value.text;
  if (value.min || value.max) return `${value.min || 'sem mínimo'} a ${value.max || 'sem máximo'}`;
  if (value.dateMode === 'unknown') return 'Data desconhecida';
  if (value.from || value.to) return `${value.from || 'início'} a ${value.to || 'hoje'}`;
  return 'Com data informada';
}
