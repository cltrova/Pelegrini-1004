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
import type { StockQuickFilter } from './estoqueIntelligence';

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

  const displayedStock = useMemo(
    () => viewMode === 'consolidado' ? consolidateStockRecords(stockData) : stockData,
    [stockData, viewMode],
  );
  const detailedGranularity = useMemo(() => detectStockGranularity(stockData), [stockData]);

  const insights = useMemo(
    () => buildStockInsights(
      displayedStock,
      movementData,
      new Date(),
      viewMode === 'consolidado' ? 'product' : 'branch',
    ),
    [displayedStock, movementData, viewMode],
  );

  const options = useMemo(() => ({
    brands: uniqueOptions(insights.map((product) => product.marca)),
    groups: uniqueOptions(insights.map((product) => product.grupo)),
    lines: uniqueOptions(insights.map((product) => product.linha)),
  }), [insights]);

  const filtered = useMemo(
    () => sortStockInsights(
      filterStockInsights(insights, {
        search,
        quickFilter,
        brands,
        groups,
        lines,
      }),
      sortMode,
    ),
    [brands, groups, insights, lines, quickFilter, search, sortMode],
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
              <Sheet onOpenChange={setAttentionOpen} open={attentionOpen}>
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
              </Sheet>
              <Button aria-label="Exportar visao atual" className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => onExport(filtered)} type="button" variant="outline">
                <Download aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">Exportar</span>
              </Button>
              <StockColumnPicker
                branchKey={branchKey}
                onVisibleColumnsChange={handleVisibleColumnsChange}
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
        />
      </EstoqueToolbar>

      <EstoqueSummaryCards
        activeFilter={quickFilter}
        movementAvailable={movementAvailable}
        onFilterChange={setQuickFilter}
        products={insights}
      />

      <EstoqueDataViewport>
        {sourceNotice ? <div className="shrink-0">{sourceNotice}</div> : null}
        <div aria-label="Contagem e ordenacao dos produtos" className="sr-only shrink-0" role="group" />
        <EstoqueProductsTable
          branchKey={branchKey}
          onSelectProduct={selectProduct}
          onSortChange={setSortMode}
          onVisibleColumnsChange={handleVisibleColumnsChange}
          products={filtered}
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
