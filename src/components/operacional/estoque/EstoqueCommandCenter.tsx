import { BellRing, Download, Layers3, ListTree } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

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
import type { PelegriniStockPage } from '@/hooks/useEstoqueData';
import type { StockPageQuery } from './estoqueIntelligence';

import { EstoqueAttentionPanel } from './EstoqueAttentionPanel';
import { EstoqueMovementHighlights } from './EstoqueMovementHighlights';
import { EstoqueProductDrawer } from './EstoqueProductDrawer';
import { EstoqueProductsTable } from './EstoqueProductsTable';
import { readVisibleColumns, StockColumnPicker, storageKey, type StockColumnKey } from './EstoqueProductsTable';
import { EstoqueSmartFilters } from './EstoqueSmartFilters';
import { EstoqueSummaryCards } from './EstoqueSummaryCards';
import { EstoqueDataViewport, EstoqueToolbar } from './EstoqueWorkspace';
import {
  buildStockInsights,
  consolidateStockRecords,
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
  stockPageQuery?: StockPageQuery;
  onStockPageQueryChange?: (query: StockPageQuery) => void;
}

function uniqueOptions(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
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
  stockPageQuery,
  onStockPageQueryChange,
}: EstoqueCommandCenterProps) {
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<StockQuickFilter>('all');
  const [brands, setBrands] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [lines, setLines] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<StockSortMode>('product-asc');
  const [visibleColumns, setVisibleColumns] = useState<StockColumnKey[]>(() => readVisibleColumns(branchKey, viewMode));
  const [selectedProduct, setSelectedProduct] = useState<StockProductInsight | null>(null);
  const [attentionOpen, setAttentionOpen] = useState(false);

  useEffect(() => {
    if (!requestedQuickFilter) return;
    setQuickFilter(requestedQuickFilter);
    onRequestedQuickFilterHandled?.();
  }, [onRequestedQuickFilterHandled, requestedQuickFilter]);

  useEffect(() => {
    setSearch('');
    setQuickFilter('all');
    setBrands([]);
    setGroups([]);
    setLines([]);
    setSortMode('product-asc');
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
    if (serverPaged && (viewMode !== 'detalhado' || quickFilter !== 'with-stock') && quickFilter !== 'all') {
      setQuickFilter('all');
    }
  }, [quickFilter, serverPaged, viewMode]);

  const queryFilterKey = JSON.stringify({
    search,
    quickFilter: viewMode === 'detalhado' && quickFilter === 'with-stock' ? 'with-stock' : 'all',
    brands,
    groups,
    lines,
    sortMode,
  });
  const savedFilterKey = stockPageQuery ? JSON.stringify({
    search: stockPageQuery.search,
    quickFilter: stockPageQuery.quickFilter,
    brands: stockPageQuery.brands,
    groups: stockPageQuery.groups,
    lines: stockPageQuery.lines,
    sortMode: stockPageQuery.sortMode,
  }) : '';
  useEffect(() => {
    if (!serverPaged || !stockPageQuery || !onStockPageQueryChange || queryFilterKey === savedFilterKey) return;
    onStockPageQueryChange({ page: 1, search, quickFilter: viewMode === 'detalhado' && quickFilter === 'with-stock' ? 'with-stock' : 'all', brands, groups, lines, sortMode });
  }, [brands, groups, lines, onStockPageQueryChange, quickFilter, queryFilterKey, savedFilterKey, search, serverPaged, sortMode, stockPageQuery, viewMode]);

  const displayedStock = useMemo(
    () => viewMode === 'consolidado' ? consolidateStockRecords(stockData) : stockData,
    [stockData, viewMode],
  );
  const insights = useMemo(
    () => buildStockInsights(
      displayedStock,
      movementData,
      new Date(),
      viewMode === 'consolidado' ? 'product' : 'branch',
    ),
    [displayedStock, movementData, viewMode],
  );

  const localOptions = useMemo(() => ({
    brands: uniqueOptions(insights.map((product) => product.marca)),
    groups: uniqueOptions(insights.map((product) => product.grupo)),
    lines: uniqueOptions(insights.map((product) => product.linha)),
  }), [insights]);
  const options = serverPage?.opcoes ? {
    brands: serverPage.opcoes.marcas,
    groups: serverPage.opcoes.grupos,
    lines: serverPage.opcoes.linhas,
  } : localOptions;

  const filtered = useMemo(
    () => serverPaged ? sortStockInsights(insights, sortMode) : sortStockInsights(
      filterStockInsights(insights, {
        search,
        quickFilter,
        brands,
        groups,
        lines,
      }),
      sortMode,
    ),
    [brands, groups, insights, lines, quickFilter, search, serverPaged, sortMode],
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
                serverPaged={serverPaged}
                viewMode={viewMode}
                visibleColumns={visibleColumns}
              />
            </>
          )}
          brands={brands}
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
          onGroupsChange={setGroups}
          onLinesChange={setLines}
          onQuickFilterChange={setQuickFilter}
          onSearchChange={setSearch}
          options={options}
          quickFilter={quickFilter}
          search={search}
          serverPagedMode={serverPaged ? viewMode : undefined}
        />
      </EstoqueToolbar>

      <EstoqueSummaryCards
        activeFilter={quickFilter}
        movementAvailable={movementAvailable}
        onFilterChange={setQuickFilter}
        products={insights}
        serverSummary={serverPage ? {
          label: viewMode === 'consolidado' ? 'Produtos' : 'Registros detalhados',
          count: serverPage.total_itens,
          quantity: Number(serverPage.totais.quantidade_estoque ?? 0),
          value: Number(serverPage.totais.valor_estoque ?? 0),
        } : undefined}
      />
      {serverPaged && <p className="shrink-0 px-3 py-1 text-[11px] text-muted-foreground">
        Para carregar a lista rapidamente, os indicadores de giro e o painel Atenção ficam na aba Giro de Estoque.
      </p>}

      <EstoqueDataViewport>
        {sourceNotice ? <div className="shrink-0">{sourceNotice}</div> : null}
        <div aria-label="Contagem e ordenacao dos produtos" className="sr-only shrink-0" role="group" />
        {filtered.length > 0 && <div className="flex shrink-0 justify-end border-b border-border px-3 py-2"><Button aria-label="Baixar lista de produtos" disabled={!filtered.length} className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => onExport(filtered)} type="button" variant="outline"><Download aria-hidden="true" className="h-3.5 w-3.5" />{serverPaged ? 'Baixar página' : 'Baixar lista'}</Button></div>}
        <EstoqueProductsTable
          branchKey={branchKey}
          onSelectProduct={selectProduct}
          onSortChange={setSortMode}
          onVisibleColumnsChange={handleVisibleColumnsChange}
          products={filtered}
          serverPaged={serverPaged}
          serverPagination={serverPage && stockPageQuery && onStockPageQueryChange ? {
            page: serverPage.pagina,
            pageCount: serverPage.total_paginas,
            loading: serverPageLoading,
            onPageChange: (page) => onStockPageQueryChange({ ...stockPageQuery, page }),
          } : undefined}
          sortMode={sortMode}
          sourceEmpty={stockData.length === 0}
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
