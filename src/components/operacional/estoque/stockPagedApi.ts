import type { EstoqueRecord, ViewMode } from '@/types/estoque';
import { isForcaPEstoque } from '@/utils/estoque10041';
import { consolidateStockRecords, type StockQuickFilter, type StockSortMode } from './estoqueIntelligence';
import { EMPTY_STOCK_VALUE, columnFilterError, numericBound, type StockColumnFilters } from './stockColumnFilters';

export interface StockPageQuery {
  page: number;
  search: string;
  quickFilter: StockQuickFilter;
  brands: string[];
  groups: string[];
  lines: string[];
  sortMode: StockSortMode;
  columnFilters?: StockColumnFilters;
}
export const defaultStockPageQuery = (): StockPageQuery => ({ page: 1, search: '', quickFilter: 'all', brands: [], groups: [], lines: [], sortMode: 'group-brand-product', columnFilters: {} });

export interface StockApiCapabilities {
  release?: string;
  formatos_estoque?: string[];
  ordenacoes_adicionais?: string[];
  filtros_coluna?: { multipla?: string[] };
}
export interface PelegriniStockPage {
  release: string;
  cod_empresa_bi: number;
  cod_empresas: number[];
  atualizado_em: string;
  total_registros: number;
  total_itens: number;
  pagina: number;
  tamanho_pagina: number;
  total_paginas: number;
  totais: { quantidade_estoque?: number; valor_estoque?: number; produtos_com_estoque?: number; produtos_sem_estoque?: number; total_produtos?: number };
  opcoes: { marcas: string[]; grupos: string[]; linhas: string[]; filiais?: { codigo: number; nome: string }[]; localizacoes?: string[] };
  itens: Record<string, unknown>[];
}

export function supportsStockColumnFilters(value?: StockApiCapabilities): boolean {
  return Boolean(value?.formatos_estoque?.includes('pagina') && value.ordenacoes_adicionais?.includes('grupo_marca_produto') && ['grupo', 'marca', 'filial', 'localizacao', 'situacao'].every(key => value.filtros_coluna?.multipla?.includes(key)));
}

export function stockPageOrder(mode: StockSortMode): string {
  const orders: Partial<Record<StockSortMode, string>> = { 'group-brand-product': 'grupo_marca_produto', 'product-asc': 'produto_asc', 'product-desc': 'produto_desc', 'quantity-asc': 'quantidade_asc', 'quantity-desc': 'quantidade_desc', 'value-asc': 'valor_asc', 'value-desc': 'valor_desc', 'stock-asc': 'quantidade_asc', 'stock-desc': 'quantidade_desc' };
  if (!orders[mode]) throw new Error('Ordenação não suportada pela API de estoque.');
  return orders[mode]!;
}

export function buildStockPageParams(company: string, query: StockPageQuery): URLSearchParams {
  const params = new URLSearchParams({ cod_empresa_bi: company, formato: 'pagina', pagina: String(query.page), tamanho_pagina: '50', ordem: stockPageOrder(query.sortMode) });
  const repeat = (key: string, values: string[] = []) => [...new Set(values)].forEach(value => params.append(key, value === EMPTY_STOCK_VALUE ? '' : value));
  if (query.search.trim()) params.set('busca', query.search.trim());
  repeat('grupo', query.groups); repeat('marca', query.brands); repeat('linha', query.lines);
  const filters = query.columnFilters ?? {};
  for (const [key, filter] of Object.entries(filters)) {
    const error = columnFilterError(key as keyof StockColumnFilters, filter);
    if (error) throw new Error(error);
  }
  if (filters.product?.text?.trim()) params.set('produto', filters.product.text.trim());
  repeat('filial', filters.branch?.values); repeat('localizacao', filters.location?.values);
  const statuses = filters.status?.values ?? [];
  repeat('situacao', statuses);
  if (!statuses.length && ['available', 'low', 'critical', 'out'].includes(query.quickFilter)) params.append('situacao', query.quickFilter);
  if (query.quickFilter === 'with-stock') params.set('quantidade_min', '0.000000001');
  for (const [column, prefix] of [['quantity', 'quantidade'], ['value', 'valor'], ['averageCost', 'custo_medio']] as const) {
    for (const bound of ['min', 'max'] as const) {
      const value = numericBound(filters[column]?.[bound]);
      if (value !== null) params.set(`${prefix}_${bound}`, String(column === 'quantity' && bound === 'min' && query.quickFilter === 'with-stock' ? Math.max(value, 0.000000001) : value));
    }
  }
  for (const [column, prefix] of [['lastMovement', 'ultima_movimentacao'], ['lastPurchase', 'ultima_compra'], ['lastSale', 'ultima_venda']] as const) {
    const filter = filters[column];
    if (!filter) continue;
    if (filter.dateMode === 'unknown') params.set(`${prefix}_sem_data`, 'true');
    else {
      if (filter.from) params.set(`${prefix}_ini`, filter.from);
      if (filter.to) params.set(`${prefix}_fim`, filter.to);
      if (filter.dateMode === 'known' || filter.from || filter.to) params.set(`${prefix}_sem_data`, 'false');
    }
  }
  return params;
}

export function validateStockPage(value: unknown, company: string): PelegriniStockPage {
  const page = value as PelegriniStockPage;
  const allowed = company === '1004' ? [1] : company === '10041' ? [2, 3] : [];
  if (!allowed.length || page?.cod_empresa_bi !== Number(company) || !Array.isArray(page.itens) || !Array.isArray(page.cod_empresas) || page.cod_empresas.some(code => !allowed.includes(Number(code))) || !page.totais || !Number.isFinite(page.total_itens)) throw new Error('Resposta paginada incompatível com a empresa selecionada.');
  if (page.itens.some(row => Number(row.cod_empresa_bi) !== Number(company) || !allowed.includes(Number(row.cod_empresa)) || isForcaPEstoque(row)) || page.opcoes?.filiais?.some(branch => !allowed.includes(Number(branch.codigo)) || isForcaPEstoque({ empresa: branch.nome }))) throw new Error('A página do estoque contém registros fora da casa selecionada.');
  page.opcoes ??= { marcas: [], grupos: [], linhas: [] };
  return page;
}

/** The API paginates products; repeated consolidated amounts belong to the product, not each origin. */
export function normalizeStockPageRows(page: PelegriniStockPage, mode: ViewMode): EstoqueRecord[] {
  const rows = page.itens as unknown as EstoqueRecord[];
  if (mode === 'detalhado') return rows;
  return consolidateStockRecords(rows).map(row => ({
    ...row,
    quantidade_estoque: row.quantidade_consolidada ?? row.quantidade_estoque,
    valor_estoque: row.valor_estoque_consolidado ?? row.valor_estoque,
    custo_medio: row.custo_medio_consolidado !== undefined ? row.custo_medio_consolidado ?? 0 : row.custo_medio,
  }));
}
