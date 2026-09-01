import { Download, Layers3, ListTree } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
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
}: EstoqueCommandCenterProps) {
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<StockQuickFilter>('all');
  const [brands, setBrands] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [lines, setLines] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<StockSortMode>('stock-desc');
  const [selectedProduct, setSelectedProduct] = useState<StockProductInsight | null>(null);

  const insights = useMemo(
    () => buildStockInsights(stockData, movementData),
    [stockData, movementData],
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

  const clearFilters = () => {
    setSearch('');
    setQuickFilter('all');
    setBrands([]);
    setGroups([]);
    setLines([]);
  };

  const selectProduct = (product: StockProductInsight) => {
    setSelectedProduct(product);
  };

  return (
    <section
      aria-label="Central de estoque"
      className="min-w-0 max-w-full space-y-4 overflow-x-clip"
    >
      <section
        aria-label="Barra principal do estoque"
        className="min-w-0 max-w-full space-y-3"
      >
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div
            aria-label="Modo de visualizacao do estoque"
            className="inline-flex min-w-0 max-w-full rounded-md border border-border bg-muted/30 p-1"
            role="group"
          >
            <Button
              aria-pressed={viewMode === 'consolidado'}
              className={cn('h-8 min-w-0 gap-2 px-3', viewMode !== 'consolidado' && 'text-muted-foreground')}
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
              className={cn('h-8 min-w-0 gap-2 px-3', viewMode !== 'detalhado' && 'text-muted-foreground')}
              onClick={() => onViewModeChange('detalhado')}
              size="sm"
              type="button"
              variant={viewMode === 'detalhado' ? 'secondary' : 'ghost'}
            >
              <ListTree aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>Detalhado</span>
            </Button>
          </div>

          <Button
            aria-label="Exportar visao atual"
            className="h-9 min-w-0 max-w-full gap-2"
            onClick={() => onExport(filtered)}
            type="button"
            variant="outline"
          >
            <Download aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="truncate">Exportar visao atual</span>
          </Button>
        </div>

        <EstoqueSmartFilters
          brands={brands}
          groups={groups}
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
        onFilterChange={setQuickFilter}
        products={insights}
      />

      <EstoqueAttentionPanel products={filtered} onSelectProduct={selectProduct} />

      <EstoqueProductsTable
        branchKey={branchKey}
        onSelectProduct={selectProduct}
        onSortChange={setSortMode}
        products={filtered}
        sortMode={sortMode}
        sourceEmpty={stockData.length === 0}
      />

      <EstoqueMovementHighlights products={filtered} onSelectProduct={selectProduct} />

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
