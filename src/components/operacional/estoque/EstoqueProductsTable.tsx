import { useEffect, useState } from 'react';
import {
  CircleCheck,
  CircleOff,
  ChevronLeft,
  ChevronRight,
  Columns3,
  ExternalLink,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

import type { StockProductInsight, StockSortMode, StockStatus } from './estoqueIntelligence';

export type StockColumnKey =
  | 'product'
  | 'brand'
  | 'group'
  | 'quantity'
  | 'minimum'
  | 'lastMovement'
  | 'status'
  | 'branch'
  | 'abc'
  | 'value'
  | 'averageCost'
  | 'line'
  | 'application'
  | 'originalReference'
  | 'location';

interface StockColumnDefinition {
  key: StockColumnKey;
  label: string;
  required?: boolean;
  numeric?: boolean;
}

const stockColumns: readonly StockColumnDefinition[] = [
  { key: 'product', label: 'Produto', required: true },
  { key: 'brand', label: 'Marca' },
  { key: 'group', label: 'Grupo' },
  { key: 'quantity', label: 'Quantidade', required: true, numeric: true },
  { key: 'minimum', label: 'Minimo operacional estimado', numeric: true },
  { key: 'lastMovement', label: 'Ultima movimentacao' },
  { key: 'status', label: 'Situacao', required: true },
  { key: 'branch', label: 'Filial' },
  { key: 'abc', label: 'Curva ABC' },
  { key: 'value', label: 'Valor em estoque', numeric: true },
  { key: 'averageCost', label: 'Custo medio', numeric: true },
  { key: 'line', label: 'Linha' },
  { key: 'application', label: 'Aplicacao' },
  { key: 'originalReference', label: 'Referencia original' },
  { key: 'location', label: 'Localizacao' },
];

const defaultColumns: StockColumnKey[] = [
  'product',
  'brand',
  'group',
  'quantity',
  'lastMovement',
  'status',
];

const requiredColumns = new Set<StockColumnKey>(['product', 'quantity', 'status']);
const validColumns = new Set(stockColumns.map((column) => column.key));
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

const sortOptions: readonly { value: StockSortMode; label: string }[] = [
  { value: 'stock-desc', label: 'Maior estoque' },
  { value: 'stock-asc', label: 'Menor estoque' },
  { value: 'product', label: 'Produto' },
  { value: 'last-movement', label: 'Ultima movimentacao' },
  { value: 'brand', label: 'Marca' },
];

export interface EstoqueProductsTableProps {
  products: StockProductInsight[];
  sourceEmpty?: boolean;
  sortMode: StockSortMode;
  branchKey: string;
  onSortChange: (mode: StockSortMode) => void;
  onSelectProduct: (product: StockProductInsight) => void;
  onVisibleColumnsChange?: (columns: StockColumnKey[]) => void;
}

function storageKey(branchKey: string): string {
  return `pelegrini:estoque:columns:${branchKey}`;
}

function readVisibleColumns(branchKey: string): StockColumnKey[] {
  if (typeof window === 'undefined') return [...defaultColumns];

  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey(branchKey)) ?? 'null');
    if (!Array.isArray(stored)) return [...defaultColumns];

    const selected = new Set<StockColumnKey>(
      stored.filter((key): key is StockColumnKey => typeof key === 'string' && validColumns.has(key as StockColumnKey)),
    );
    requiredColumns.forEach((key) => selected.add(key));
    return stockColumns.filter((column) => selected.has(column.key)).map((column) => column.key);
  } catch {
    return [...defaultColumns];
  }
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

function StockStatusValue({ status }: { status: StockStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold',
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
      className="group flex min-w-0 max-w-full items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onSelectProduct(product)}
      type="button"
    >
      <span className="min-w-0">
        <span className="block truncate font-semibold text-foreground group-hover:text-primary" title={product.produto}>
          {product.produto}
        </span>
        <span className="block text-xs text-muted-foreground">Codigo {product.cod_produto}</span>
      </span>
      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
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
  if (column === 'minimum') {
    return product.movementDataAvailable
      ? <span className="tabular-nums">{formatNumber(product.operationalMinimum)}</span>
      : <span className="text-xs text-muted-foreground">Dados insuficientes</span>;
  }
  if (column === 'lastMovement') return <span className="whitespace-nowrap tabular-nums">{formatDate(product.lastMovementDate)}</span>;
  if (column === 'status') return <StockStatusValue status={product.status} />;
  if (column === 'branch') return product.empresa || '--';
  if (column === 'abc') return product.classe_abc || '--';
  if (column === 'value') {
    return <PelegriniResponsiveValue className="font-semibold tabular-nums" size="sm">{formatCurrency(product.valor_estoque)}</PelegriniResponsiveValue>;
  }
  if (column === 'averageCost') {
    return <PelegriniResponsiveValue className="tabular-nums" size="sm">{formatCurrency(product.custo_medio)}</PelegriniResponsiveValue>;
  }
  if (column === 'line') return product.linha || '--';
  if (column === 'application') return product.aplicacao_produto || '--';
  if (column === 'originalReference') return product.nr_original || '--';
  return product.localizacao_produto || '--';
}

export function EstoqueProductsTable({
  products,
  sourceEmpty = false,
  sortMode,
  branchKey,
  onSortChange,
  onSelectProduct,
  onVisibleColumnsChange,
}: EstoqueProductsTableProps) {
  const [visibleColumns, setVisibleColumns] = useState<StockColumnKey[]>(() => readVisibleColumns(branchKey));
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setVisibleColumns(readVisibleColumns(branchKey));
  }, [branchKey]);

  useEffect(() => {
    setPage(0);
  }, [branchKey, products, sortMode]);

  const selectedColumns = stockColumns.filter((column) => visibleColumns.includes(column.key));
  const pageCount = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleProducts = products.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const emptyMessage = sourceEmpty
    ? 'Nenhum produto disponivel na fonte de estoque.'
    : 'Nenhum produto corresponde aos filtros atuais.';

  const toggleColumn = (column: StockColumnKey) => {
    if (requiredColumns.has(column)) return;

    const next = visibleColumns.includes(column)
      ? visibleColumns.filter((key) => key !== column)
      : stockColumns
          .filter((definition) => visibleColumns.includes(definition.key) || definition.key === column)
          .map((definition) => definition.key);
    setVisibleColumns(next);
    window.localStorage.setItem(storageKey(branchKey), JSON.stringify(next));
    onVisibleColumnsChange?.(next);
  };

  return (
    <section aria-label="Produtos do estoque" className="min-w-0 max-w-full overflow-hidden border border-border/80 bg-background">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border/80 px-3 py-1.5">
        <p className="min-w-0 text-sm text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{products.length}</span>{' '}
          {products.length === 1 ? 'produto' : 'produtos'}
        </p>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <Select value={sortMode} onValueChange={(value) => onSortChange(value as StockSortMode)}>
            <SelectTrigger aria-label="Ordenar produtos" className="h-8 w-[11.5rem] max-w-full bg-background text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropdownMenu open={columnsMenuOpen} onOpenChange={setColumnsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Escolher colunas"
                className="h-8 gap-2 text-xs"
                onClick={() => {
                  if (!columnsMenuOpen) setColumnsMenuOpen(true);
                }}
                type="button"
                variant="outline"
              >
                <Columns3 aria-hidden="true" className="h-4 w-4" />
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
        </div>
      </div>

      <div
        aria-label="Tabela de produtos do estoque"
        className="hidden min-w-0 max-w-full overflow-x-auto overscroll-x-contain md:block"
      >
        {products.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="max-h-[calc(100vh-20rem)] min-h-[18rem] min-w-max overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead aria-label="Cabecalho da tabela" className="sticky top-0 z-10 bg-muted">
                <tr className="border-b border-border">
                  {selectedColumns.map((column) => (
                    <th
                      className={cn(
                        'whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase text-muted-foreground',
                        column.numeric && 'text-right',
                        column.key === 'product' && 'min-w-[18rem]',
                      )}
                      key={column.key}
                      scope="col"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {visibleProducts.map((product) => (
                  <tr className="transition-colors hover:bg-primary/[0.04]" key={`${product.cod_empresa}:${product.cod_produto}`}>
                    {selectedColumns.map((column) => (
                      <td
                        className={cn(
                          'h-11 max-w-[18rem] px-3 py-1.5 align-middle text-foreground',
                          column.numeric && 'text-right',
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
            <article className="min-w-0 p-3" data-testid={`stock-mobile-item-${product.cod_produto}`} key={`${product.cod_empresa}:${product.cod_produto}`}>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <ProductButton product={product} onSelectProduct={onSelectProduct} />
                  <p className="mt-1 truncate text-xs text-muted-foreground" title={product.marca}>{product.marca || '--'}</p>
                </div>
                <p className="shrink-0 text-right">
                  <span className="block text-lg font-semibold tabular-nums text-foreground">{formatNumber(product.quantidade_estoque)}</span>
                  <span className="block text-[11px] text-muted-foreground">em estoque</span>
                </p>
              </div>
              <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
                <StockStatusValue status={product.status} />
                <Button
                  aria-label={`Abrir ${product.produto}`}
                  className="h-8 w-8 shrink-0"
                  onClick={() => onSelectProduct(product)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
            </article>
          ))
        )}
      </div>

      {products.length > 0 && (
        <nav
          aria-label="Paginacao dos produtos"
          className="flex items-center justify-between gap-3 border-t border-border bg-muted/20 px-3 py-2"
        >
          <Button
            aria-label="Pagina anterior"
            disabled={safePage === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          </Button>
          <p className="text-sm font-medium tabular-nums text-muted-foreground">
            Pagina {safePage + 1} de {pageCount}
          </p>
          <Button
            aria-label="Proxima pagina"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
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
