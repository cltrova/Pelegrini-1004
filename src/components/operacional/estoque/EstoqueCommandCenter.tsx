import { BellRing, Download, Layers3, ListTree } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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
import { EstoqueSmartFilters } from './EstoqueSmartFilters';
import { EstoqueSummaryCards } from './EstoqueSummaryCards';
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
}: EstoqueCommandCenterProps) {
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<StockQuickFilter>('all');
  const [brands, setBrands] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [lines, setLines] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<StockSortMode>('stock-desc');
  const [selectedProduct, setSelectedProduct] = useState<StockProductInsight | null>(null);
  const [attentionOpen, setAttentionOpen] = useState(false);

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

  return (
    <section
      aria-label="Central de estoque"
      className="min-w-0 max-w-full space-y-4 overflow-x-clip"
    >
      <section aria-label="Barra principal do estoque" className="sticky top-0 z-20 min-w-0 max-w-full border-b border-border/70 bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <EstoqueSmartFilters
          actions={(
            <>
              <Sheet onOpenChange={setAttentionOpen} open={attentionOpen}>
                <SheetTrigger asChild>
                  <Button aria-label="Abrir painel de atencao" className="h-9 gap-2" type="button" variant="outline">
                    <BellRing aria-hidden="true" className="h-4 w-4" />
                    <span className="hidden lg:inline">Atencao</span>
                    {attentionCount > 0 && <span className="tabular-nums text-xs">{attentionCount}</span>}
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-[min(96vw,42rem)] overflow-y-auto p-0 sm:max-w-2xl" side="right">
                  <SheetHeader className="border-b border-border px-5 py-4 pr-12 text-left">
                    <SheetTitle>Atencao no estoque</SheetTitle>
                    <SheetDescription>Alertas e movimentos que merecem acompanhamento.</SheetDescription>
                  </SheetHeader>
                  <div className="space-y-5 p-5">
                    <EstoqueAttentionPanel products={filtered} onSelectProduct={selectProduct} />
                    <EstoqueMovementHighlights products={filtered} onSelectProduct={selectProduct} />
                  </div>
                </SheetContent>
              </Sheet>
              <Button aria-label="Exportar visao atual" className="h-9 gap-2" onClick={() => onExport(filtered)} type="button" variant="outline">
                <Download aria-hidden="true" className="h-4 w-4" />
                <span className="hidden xl:inline">Exportar</span>
              </Button>
            </>
          )}
          brands={brands}
          groups={groups}
          leading={(
            <div
            aria-label="Modo de visualizacao do estoque"
            className="inline-flex h-9 min-w-0 max-w-full rounded-md border border-border bg-muted/20 p-0.5"
            role="group"
          >
            <Button
              aria-pressed={viewMode === 'consolidado'}
              className={cn('h-8 min-w-0 gap-2 px-2.5 text-xs', viewMode !== 'consolidado' && 'text-muted-foreground')}
              onClick={() => onViewModeChange('consolidado')}
              size="sm"
              type="button"
              variant={viewMode === 'consolidado' ? 'secondary' : 'ghost'}
            >
              <Layers3 aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>Consolidado</span>
            </Button>
            <Button
              aria-pressed={viewMode === 'detalhado'}
              className={cn('h-8 min-w-0 gap-2 px-2.5 text-xs', viewMode !== 'detalhado' && 'text-muted-foreground')}
              onClick={() => onViewModeChange('detalhado')}
              size="sm"
              type="button"
              variant={viewMode === 'detalhado' ? 'secondary' : 'ghost'}
            >
              <ListTree aria-hidden="true" className="h-4 w-4 shrink-0" />
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
      </section>

      <EstoqueSummaryCards
        activeFilter={quickFilter}
        movementAvailable={movementAvailable}
        onFilterChange={setQuickFilter}
        products={insights}
      />

      {viewMode === 'detalhado' && stockData.length > 0 && detailedGranularity === 'product' && (
        <p
          className="rounded-md border border-primary/20 bg-primary/[0.04] px-3 py-2 text-xs text-muted-foreground"
          role="status"
        >
          A fonte atual nao fornece filial ou localizacao para detalhar estes produtos.
        </p>
      )}

      <EstoqueProductsTable
        branchKey={branchKey}
        onSelectProduct={selectProduct}
        onSortChange={setSortMode}
        products={filtered}
        sortMode={sortMode}
        sourceEmpty={stockData.length === 0}
        viewMode={viewMode}
      />

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
