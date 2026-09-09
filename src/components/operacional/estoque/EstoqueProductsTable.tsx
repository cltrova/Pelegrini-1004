import { useEffect, useState } from 'react';
import {
  CircleCheck,
  CircleOff,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Siren,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import { PelegriniResponsiveValue } from '@/components/pelegrini';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { ViewMode } from '@/types/estoque';

import type { StockProductInsight, StockSortKey, StockSortMode, StockStatus } from './estoqueIntelligence';

export type StockColumnKey =
  | 'product'
  | 'brand'
  | 'group'
  | 'quantity'
  | 'lastMovement'
  | 'status'
  | 'branch'
  | 'value'
  | 'averageCost'
  | 'location'
  | 'lastPurchase'
  | 'lastSale';

interface StockColumnDefinition {
  key: StockColumnKey;
  label: string;
  required?: boolean;
  numeric?: boolean;
}

const consolidatedColumns: readonly StockColumnDefinition[] = [
  { key: 'product', label: 'Produto', required: true },
  { key: 'brand', label: 'Marca' },
  { key: 'group', label: 'Grupo' },
  { key: 'quantity', label: 'Quantidade', required: true, numeric: true },
  { key: 'value', label: 'Valor em estoque', numeric: true },
  { key: 'lastMovement', label: 'Ultima movimentacao' },
  { key: 'status', label: 'Situacao' },
];

const detailedColumns: readonly StockColumnDefinition[] = [
  { key: 'product', label: 'Produto', required: true },
  { key: 'branch', label: 'Filial' },
  { key: 'location', label: 'Localizacao' },
  { key: 'quantity', label: 'Quantidade', required: true, numeric: true },
  { key: 'averageCost', label: 'Custo medio', numeric: true },
  { key: 'value', label: 'Valor em estoque', numeric: true },
  { key: 'lastPurchase', label: 'Ultima compra' },
  { key: 'lastSale', label: 'Ultima venda' },
];

const columnsByMode: Record<ViewMode, readonly StockColumnDefinition[]> = {
  consolidado: consolidatedColumns,
  detalhado: detailedColumns,
};
const requiredColumns = new Set<StockColumnKey>(['product', 'quantity']);
const PAGE_SIZE = 50;

const statusConfig: Record<
  StockStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  available: {
    label: 'Disponivel',
    icon: CircleCheck,
    className: 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
  },
  low: {
    label: 'Estoque baixo',
    icon: TriangleAlert,
    className: 'border-amber-500/40 text-amber-700 dark:text-amber-400',
  },
  critical: {
    label: 'Critico',
    icon: Siren,
    className: 'border-destructive/30 text-destructive',
  },
  out: {
    label: 'Sem estoque',
    icon: CircleOff,
    className: 'border-destructive/30 text-destructive',
  },
};

export interface EstoqueProductsTableProps {
  products: StockProductInsight[];
  sourceEmpty?: boolean;
  sortMode: StockSortMode;
  branchKey: string;
  viewMode: ViewMode;
  onSortChange: (mode: StockSortMode) => void;
  onSelectProduct: (product: StockProductInsight) => void;
  onVisibleColumnsChange?: (columns: StockColumnKey[]) => void;
  visibleColumns?: StockColumnKey[];
}

export function storageKey(branchKey: string, viewMode: ViewMode): string {
  return `pelegrini:estoque:columns:${branchKey}:${viewMode}`;
}

export function readVisibleColumns(branchKey: string, viewMode: ViewMode): StockColumnKey[] {
  const modeColumns = columnsByMode[viewMode];
  const defaultColumns = modeColumns.map((column) => column.key);
  const validColumns = new Set(defaultColumns);
  if (typeof window === 'undefined') return defaultColumns;

  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey(branchKey, viewMode)) ?? 'null');
    if (!Array.isArray(stored)) return defaultColumns;

    const selected = new Set<StockColumnKey>(
      stored.filter((key): key is StockColumnKey => typeof key === 'string' && validColumns.has(key as StockColumnKey)),
    );
    requiredColumns.forEach((key) => selected.add(key));
    return modeColumns.filter((column) => selected.has(column.key)).map((column) => column.key);
  } catch {
    return defaultColumns;
  }
}

const sortKeyByColumn: Record<StockColumnKey, StockSortKey> = {
  product: 'product',
  brand: 'brand',
  group: 'group',
  quantity: 'quantity',
  lastMovement: 'last-movement',
  status: 'status',
  branch: 'branch',
  value: 'value',
  averageCost: 'average-cost',
  location: 'location',
  lastPurchase: 'last-purchase',
  lastSale: 'last-sale',
};

function sortKeyFromMode(mode: StockSortMode): StockSortKey {
  if (mode === 'stock-desc' || mode === 'stock-asc') return 'quantity';
  if (mode === 'product') return 'product';
  if (mode === 'brand') return 'brand';
  if (mode === 'last-movement') return 'last-movement';
  return mode.replace(/-(asc|desc)$/, '') as StockSortKey;
}

function sortDirectionFromMode(mode: StockSortMode, key: StockSortKey): 'ascending' | 'descending' | 'none' {
  if (sortKeyFromMode(mode) !== key) return 'none';
  return mode.endsWith('-asc') ? 'ascending' : 'descending';
}

function nextSortMode(mode: StockSortMode, key: StockSortKey): StockSortMode {
  const currentKey = sortKeyFromMode(mode);
  const direction = currentKey === key && sortDirectionFromMode(mode, key) === 'ascending' ? 'desc' : 'asc';
  return `${key}-${direction}` as StockSortMode;
}

export function StockColumnPicker({
  branchKey,
  viewMode,
  visibleColumns,
  onVisibleColumnsChange,
}: {
  branchKey: string;
  viewMode: ViewMode;
  visibleColumns: StockColumnKey[];
  onVisibleColumnsChange: (columns: StockColumnKey[]) => void;
}) {
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const stockColumns = columnsByMode[viewMode];

  const toggleColumn = (column: StockColumnKey) => {
    if (requiredColumns.has(column)) return;
    const next = visibleColumns.includes(column)
      ? visibleColumns.filter((key) => key !== column)
      : stockColumns
          .filter((definition) => visibleColumns.includes(definition.key) || definition.key === column)
          .map((definition) => definition.key);
    window.localStorage.setItem(storageKey(branchKey, viewMode), JSON.stringify(next));
    onVisibleColumnsChange(next);
  };

  return (
    <DropdownMenu open={columnsMenuOpen} onOpenChange={setColumnsMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Escolher colunas" className="h-8 gap-1.5 px-2.5 text-xs" type="button" variant="outline">
          <Columns3 aria-hidden="true" className="h-3.5 w-3.5" />
          <span>Colunas</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[24rem] w-64 overflow-y-auto">
        <DropdownMenuLabel>Colunas visiveis</DropdownMenuLabel>
        {stockColumns.map((column) => (
          <DropdownMenuCheckboxItem
            checked={visibleColumns.includes(column.key)}
            disabled={column.required}
            key={column.key}
            onCheckedChange={() => toggleColumn(column.key)}
            onSelect={(event) => event.preventDefault()}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(value: string | null): string {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : 'Data desconhecida';
}

function stockTableRowKey(product: StockProductInsight, viewMode: ViewMode): string {
  if (viewMode === 'consolidado') {
    return `${product.cod_produto}:${product.sourceRowKey}`;
  }

  const location = product.localizacao_produto?.trim() || 'sem-localizacao';
  return `${product.cod_empresa}:${product.cod_produto}:${location}:${product.sourceRowKey}`;
}

function isContingencyRecord(product: StockProductInsight): boolean {
  return product.tipo_relatorio.trim().toUpperCase() === 'GIRO API - CONTINGENCIA';
}

function AverageCostValue({ product }: { product: StockProductInsight }) {
  const estimated = isContingencyRecord(product);

  return (
    <span className="inline-flex min-w-0 flex-col items-center text-center">
      {estimated && (
        <span className="block text-[10px] font-medium uppercase text-amber-600 dark:text-amber-400">
          Custo estimado
        </span>
      )}
      <PelegriniResponsiveValue className="tabular-nums" size="sm">
        {formatCurrency(product.custo_medio)}
      </PelegriniResponsiveValue>
    </span>
  );
}

function StockStatusValue({ status }: { status: StockStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex h-6 w-[7.5rem] items-center justify-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold',
        config.className,
      )}
      data-stock-status={status}
    >
      <span aria-label={`Situacao: ${config.label}`} role="img">
        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      </span>
      {config.label}
    </span>
  );
}

function ProductButton({ product, onSelectProduct }: Pick<EstoqueProductsTableProps, 'onSelectProduct'> & {
  product: StockProductInsight;
}) {
  return (
    <button
      aria-label={`Abrir ${product.produto}`}
      className="group flex min-w-0 w-full max-w-full items-center justify-center text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onSelectProduct(product)}
      title={`Codigo ${product.cod_produto}`}
      type="button"
    >
      <span className="min-w-0 max-w-full text-center">
        <span className="block truncate font-semibold text-foreground group-hover:text-primary" title={product.produto}>
          {product.produto}
        </span>
      </span>
    </button>
  );
}

function ColumnValue({ column, product, onSelectProduct }: {
  column: StockColumnKey;
  product: StockProductInsight;
  onSelectProduct: EstoqueProductsTableProps['onSelectProduct'];
}) {
  if (column === 'product') return <ProductButton product={product} onSelectProduct={onSelectProduct} />;
  if (column === 'brand') return product.marca || '--';
  if (column === 'group') return product.grupo || '--';
  if (column === 'quantity') return <span className="font-semibold tabular-nums">{formatNumber(product.quantidade_estoque)}</span>;
  if (column === 'lastMovement') return <span className="whitespace-nowrap tabular-nums">{formatDate(product.lastMovementDate)}</span>;
  if (column === 'lastPurchase') return <span className="whitespace-nowrap tabular-nums">{formatDate(product.data_ultima_compra)}</span>;
  if (column === 'lastSale') return <span className="whitespace-nowrap tabular-nums">{formatDate(product.data_ultima_venda)}</span>;
  if (column === 'status') return <StockStatusValue status={product.status} />;
  if (column === 'branch') return product.empresa || '--';
  if (column === 'value') {
    return <PelegriniResponsiveValue className="font-semibold tabular-nums" size="sm">{formatCurrency(product.valor_estoque)}</PelegriniResponsiveValue>;
  }
  if (column === 'averageCost') {
    return <AverageCostValue product={product} />;
  }
  return product.localizacao_produto || '--';
}

export function EstoqueProductsTable({
  products,
  sourceEmpty = false,
  sortMode,
  branchKey,
  viewMode,
  onSortChange,
  onSelectProduct,
  onVisibleColumnsChange,
  visibleColumns: controlledVisibleColumns,
}: EstoqueProductsTableProps) {
  const [internalVisibleColumns, setInternalVisibleColumns] = useState<StockColumnKey[]>(() => readVisibleColumns(branchKey, viewMode));
  const [page, setPage] = useState(0);
  const isControlled = controlledVisibleColumns !== undefined;
  const visibleColumns = controlledVisibleColumns ?? internalVisibleColumns;

  useEffect(() => {
    if (!isControlled) setInternalVisibleColumns(readVisibleColumns(branchKey, viewMode));
  }, [branchKey, viewMode]);

  useEffect(() => {
    setPage(0);
  }, [branchKey, products, sortMode, viewMode]);

  const stockColumns = columnsByMode[viewMode];
  const selectedColumns = stockColumns.filter((column) => visibleColumns.includes(column.key));
  const pageCount = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleProducts = products.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const emptyMessage = sourceEmpty
    ? 'Nenhum produto disponivel na fonte de estoque.'
    : 'Nenhum produto corresponde aos filtros atuais.';

  return (
    <section aria-label="Produtos do estoque" className="estoque-products-table flex h-full min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden border border-border/70 bg-background">
      {!isControlled && <div
        aria-label="Opcoes da tabela"
        className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-1.5 border-b border-border/70 px-2.5 py-1"
        role="group"
      >
        <StockColumnPicker branchKey={branchKey} onVisibleColumnsChange={(next) => {
          setInternalVisibleColumns(next);
          onVisibleColumnsChange?.(next);
        }} viewMode={viewMode} visibleColumns={visibleColumns} />
      </div>}

      <div
        aria-label="Rolagem dos produtos do estoque"
        className="min-h-0 min-w-0 flex-1 overflow-auto"
        role="region"
      >
        <div
          aria-label="Tabela de produtos do estoque"
          className="hidden min-w-0 max-w-full md:block"
        >
          {products.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            <div className="min-h-full min-w-full">
              <table className="w-full table-fixed text-sm">
                <thead aria-label="Cabecalho da tabela" className="sticky top-0 z-10 bg-muted">
                <tr className="border-b border-border">
                  {selectedColumns.map((column) => {
                    const sortKey = sortKeyByColumn[column.key];
                    return (
                    <th
                      aria-sort={sortDirectionFromMode(sortMode, sortKey)}
                      style={{ width: `${100 / selectedColumns.length}%` }}
                      className={cn(
                        'whitespace-nowrap px-2 py-1 text-center text-[10px] font-semibold uppercase text-muted-foreground',
                      )}
                      key={column.key}
                      scope="col"
                    >
                      <button
                        aria-label={`Ordenar por ${column.label}`}
                        className="flex h-7 w-full items-center justify-center rounded px-1 text-center hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        onClick={() => onSortChange(nextSortMode(sortMode, sortKey))}
                        type="button"
                      >
                        {column.label}
                      </button>
                    </th>
                    );
                  })}
                </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                {visibleProducts.map((product) => (
                  <tr className="transition-colors hover:bg-primary/[0.04]" key={stockTableRowKey(product, viewMode)}>
                    {selectedColumns.map((column) => (
                      <td
                        className={cn(
                          'h-9 max-w-[17rem] px-2 py-1 text-center align-middle text-[12px] text-foreground',
                        )}
                        key={column.key}
                      >
                        <ColumnValue column={column.key} product={product} onSelectProduct={onSelectProduct} />
                      </td>
                    ))}
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div aria-label="Lista compacta de produtos" className="min-w-0 divide-y divide-border/70 md:hidden">
          {products.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            visibleProducts.map((product) => (
            <article className="min-w-0 p-3" data-testid={`stock-mobile-item-${product.cod_produto}`} key={stockTableRowKey(product, viewMode)}>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <ProductButton product={product} onSelectProduct={onSelectProduct} />
                  {viewMode === 'consolidado' && (
                    <p className="mt-1 truncate text-xs text-muted-foreground" title={product.marca}>{product.marca || '--'}</p>
                  )}
                </div>
                <p className="shrink-0 text-right">
                  <span className="block text-lg font-semibold tabular-nums text-foreground">{formatNumber(product.quantidade_estoque)}</span>
                  <span className="block text-[11px] text-muted-foreground">em estoque</span>
                </p>
              </div>
              {viewMode === 'detalhado' && (
                <dl className="mt-3 grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 border-t border-border/60 pt-3 text-xs">
                  <div className="min-w-0">
                    <dt className="text-[10px] uppercase text-muted-foreground">Filial</dt>
                    <dd className="truncate font-medium text-foreground" title={product.empresa}>{product.empresa || '--'}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] uppercase text-muted-foreground">Localizacao</dt>
                    <dd className="truncate font-medium text-foreground" title={product.localizacao_produto}>{product.localizacao_produto || '--'}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] uppercase text-muted-foreground">Custo medio</dt>
                    <dd className="font-medium text-foreground"><AverageCostValue product={product} /></dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] uppercase text-muted-foreground">Valor em estoque</dt>
                    <dd className="font-medium text-foreground">
                      <PelegriniResponsiveValue className="tabular-nums" size="sm">{formatCurrency(product.valor_estoque)}</PelegriniResponsiveValue>
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] uppercase text-muted-foreground">Ultima compra</dt>
                    <dd className="font-medium tabular-nums text-foreground">{formatDate(product.data_ultima_compra)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] uppercase text-muted-foreground">Ultima venda</dt>
                    <dd className="font-medium tabular-nums text-foreground">{formatDate(product.data_ultima_venda)}</dd>
                  </div>
                </dl>
              )}
              <div className="mt-2 flex min-w-0 items-center justify-end gap-2">
                {viewMode === 'consolidado' ? <StockStatusValue status={product.status} /> : <span />}
              </div>
            </article>
            ))
          )}
        </div>
      </div>

      {products.length > 0 && (
        <nav
          aria-label="Paginacao dos produtos"
          className="flex shrink-0 items-center justify-between gap-2 border-t border-border bg-background px-2.5 py-1"
        >
          <Button
            aria-label="Pagina anterior"
            disabled={safePage === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            className="h-7 w-7"
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          </Button>
          <p className="text-xs font-medium tabular-nums text-muted-foreground">
            Pagina {safePage + 1} de {pageCount}
          </p>
          <Button
            aria-label="Proxima pagina"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
            className="h-7 w-7"
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Button>
        </nav>
      )}
    </section>
  );
}
