import type { StockColumnKey } from './EstoqueProductsTable';
import type { StockProductInsight } from './estoqueIntelligence';

export interface StockColumnFilterValue {
  values?: string[];
  text?: string;
  min?: string;
  max?: string;
  from?: string;
  to?: string;
  dateMode?: 'any' | 'known' | 'unknown';
}
export type StockColumnFilters = Partial<Record<StockColumnKey, StockColumnFilterValue>>;
export interface StockFilterOption { value: string; label: string }
export const EMPTY_STOCK_VALUE = '__stock_missing_value__';
const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export function stockFilterKind(key: StockColumnKey): 'text' | 'selection' | 'number' | 'date' {
  if (key === 'product') return 'text';
  if (['quantity', 'value', 'averageCost'].includes(key)) return 'number';
  if (['lastMovement', 'lastPurchase', 'lastSale'].includes(key)) return 'date';
  return 'selection';
}

export function stockColumnValue(row: StockProductInsight, key: StockColumnKey): string | number | null {
  switch (key) {
    case 'product': return row.produto;
    case 'brand': return row.marca;
    case 'group': return row.grupo;
    case 'quantity': return row.quantidade_estoque;
    case 'value': return row.valor_estoque;
    case 'averageCost': return row.custo_medio;
    case 'branch': return row.empresa;
    case 'location': return row.localizacao_produto ?? null;
    case 'status': return row.status;
    case 'lastMovement': return row.lastMovementDate;
    case 'lastPurchase': return row.data_ultima_compra;
    case 'lastSale': return row.data_ultima_venda;
  }
}

export function stockSelectionValue(value: string | number | null): string {
  return value === null || String(value).trim() === '' ? EMPTY_STOCK_VALUE : String(value);
}

export function numericBound(value?: string): number | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  if (!/^-?\d+(?:[.,]\d+)*$/.test(raw)) return NaN;
  return Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : /^-?\d{1,3}(?:\.\d{3})+$/.test(raw) ? raw.replace(/\./g, '') : raw);
}

function day(value: string | number | null): string | null {
  if (typeof value !== 'string') return null;
  const civil = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!civil) return null;
  const date = new Date(`${civil}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === civil ? civil : null;
}

export function hasStockColumnFilter(value?: StockColumnFilterValue): boolean {
  return Boolean(value && (value.values?.length || value.text?.trim() || value.min?.trim() || value.max?.trim() || value.from || value.to || value.dateMode && value.dateMode !== 'any'));
}

export function columnFilterError(key: StockColumnKey, value: StockColumnFilterValue): string | null {
  if (stockFilterKind(key) === 'number') {
    const min = numericBound(value.min), max = numericBound(value.max);
    if (min !== null && !Number.isFinite(min) || max !== null && !Number.isFinite(max)) return 'Informe um número válido.';
    if (min !== null && max !== null && min > max) return 'O mínimo deve ser menor ou igual ao máximo.';
  }
  if (stockFilterKind(key) === 'date' && value.dateMode !== 'unknown') {
    if (value.from && !day(value.from) || value.to && !day(value.to)) return 'Informe uma data válida.';
    if (value.from && value.to && value.from > value.to) return 'A data inicial deve ser anterior ou igual à final.';
  }
  return null;
}

export function filterStockColumns(rows: StockProductInsight[], filters: StockColumnFilters): StockProductInsight[] {
  const predicates = (Object.entries(filters) as [StockColumnKey, StockColumnFilterValue][])
    .filter(([, value]) => hasStockColumnFilter(value))
    .map(([key, filter]) => {
      const kind = stockFilterKind(key), selection = new Set(filter.values ?? []);
      const text = normalize(filter.text?.trim() ?? '');
      const min = numericBound(filter.min), max = numericBound(filter.max);
      return (row: StockProductInsight) => {
        const value = stockColumnValue(row, key);
        if (kind === 'selection') return !selection.size || selection.has(stockSelectionValue(value));
        if (kind === 'text') return normalize([row.produto, row.cod_produto, row.cod_fabricante, row.nr_fabricante, row.nr_original].join(' ')).includes(text);
        if (kind === 'number') return typeof value === 'number' && Number.isFinite(value) && (min === null || value >= min) && (max === null || value <= max);
        const civil = day(value);
        if (filter.dateMode === 'unknown') return civil === null;
        if (civil === null) return filter.dateMode !== 'known' && !filter.from && !filter.to;
        return (!filter.from || civil >= filter.from) && (!filter.to || civil <= filter.to);
      };
    });
  return predicates.length ? rows.filter(row => predicates.every(predicate => predicate(row))) : rows;
}

export function stockColumnOptions(rows: StockProductInsight[], key: StockColumnKey): StockFilterOption[] {
  const labels: Record<string, string> = { available: 'Disponível', low: 'Estoque baixo', critical: 'Crítico', out: 'Sem estoque' };
  return [...new Set(rows.map(row => stockSelectionValue(stockColumnValue(row, key))))]
    .sort(collator.compare)
    .map(value => ({ value, label: value === EMPTY_STOCK_VALUE ? 'Sem informação' : key === 'status' ? labels[value] ?? value : value }));
}

export function stockClassificationOptions(rows: StockProductInsight[], groups: string[]) {
  const scoped = groups.length ? rows.filter(row => groups.includes(stockSelectionValue(row.grupo))) : rows;
  return {
    groups: stockColumnOptions(rows, 'group').map(option => option.value),
    brands: stockColumnOptions(scoped, 'brand').map(option => option.value),
    lines: [...new Set(scoped.map(row => row.linha).filter((value): value is string => Boolean(value)))].sort(collator.compare),
  };
}

export function reconcileStockBrands(selected: string[], available: string[]) {
  const valid = new Set(available);
  return selected.filter(brand => valid.has(brand));
}
