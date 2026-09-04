import type { EstoqueRecord, GiroRecord } from '@/types/estoque';

export type StockStatus = 'available' | 'low' | 'critical' | 'out';
export type StockGranularity = 'product' | 'branch' | 'location';
export type StockQuickFilter = 'all' | StockStatus | 'stagnant' | 'with-stock' | 'attention' | 'excess';
export type StockSortMode = 'stock-desc' | 'stock-asc' | 'product' | 'last-movement' | 'brand';
export type StockMovementTrend = 'increasing' | 'decreasing' | 'stagnant' | 'irregular';
export type StockPrimaryMovementType = 'sale' | 'withdrawal' | 'purchase' | 'entry';
export type StockMovementScope = 'branch' | 'product';

export interface StockProductInsight extends EstoqueRecord {
  sourceRowKey: string;
  status: StockStatus;
  operationalMinimum: number;
  coverageDays: number | null;
  totalInbound: number;
  totalOutbound: number;
  totalPhysicalOutbound: number;
  totalMovement: number;
  totalSales: number;
  totalWithdrawals: number;
  primaryMovementType: StockPrimaryMovementType | null;
  lastMovementDate: string | null;
  stagnantDays: number;
  movementDataAvailable: boolean;
  movements: GiroRecord[];
}

export interface StockEvolutionPoint {
  date: string;
  quantity: number;
}

export interface StockInsightFilters {
  search: string;
  quickFilter: StockQuickFilter;
  brands?: string[];
  groups?: string[];
  lines?: string[];
}

const DAY_MS = 86_400_000;
export const STOCK_EXCESS_COVERAGE_DAYS = 90;

export function isStockExcess(product: StockProductInsight): boolean {
  return product.status === 'available' &&
    product.movementDataAvailable &&
    product.coverageDays !== null &&
    product.coverageDays > STOCK_EXCESS_COVERAGE_DAYS;
}

function latestOperationalDate(values: Array<string | null>): string | null {
  return values.reduce<string | null>((latest, value) => {
    const timestamp = value ? civilDayTimestamp(value) : null;
    if (timestamp === null) return latest;
    if (!latest || timestamp > (civilDayTimestamp(latest) ?? 0)) return value;
    return latest;
  }, null);
}

export function detectStockGranularity(rows: EstoqueRecord[]): StockGranularity {
  if (rows.some((row) => Boolean(row.localizacao_produto?.trim()))) return 'location';

  const branches = new Set(rows.map((row) => `${row.cod_empresa}:${row.empresa}`));
  return branches.size > 1 ? 'branch' : 'product';
}

export function consolidateStockRecords(rows: EstoqueRecord[]): EstoqueRecord[] {
  const consolidated = new Map<string, EstoqueRecord>();

  rows.forEach((row) => {
    const key = String(row.cod_produto);
    const current = consolidated.get(key);
    if (!current) {
      consolidated.set(key, {
        ...row,
        data_ultima_compra: latestOperationalDate([row.data_ultima_compra]),
        data_ultima_venda: latestOperationalDate([row.data_ultima_venda]),
        data_ultima_transferencia: latestOperationalDate([row.data_ultima_transferencia]),
      });
      return;
    }

    consolidated.set(key, {
      ...current,
      quantidade_estoque: current.quantidade_estoque + row.quantidade_estoque,
      valor_estoque: current.valor_estoque + row.valor_estoque,
      data_ultima_compra: latestOperationalDate([current.data_ultima_compra, row.data_ultima_compra]),
      data_ultima_venda: latestOperationalDate([current.data_ultima_venda, row.data_ultima_venda]),
      data_ultima_transferencia: latestOperationalDate([
        current.data_ultima_transferencia,
        row.data_ultima_transferencia,
      ]),
    });
  });

  return [...consolidated.values()];
}

function movementKey(
  record: Pick<EstoqueRecord | GiroRecord, 'cod_empresa' | 'cod_produto'>,
  scope: StockMovementScope,
): string {
  return scope === 'product'
    ? String(record.cod_produto)
    : `${record.cod_empresa}:${record.cod_produto}`;
}

function stockSourceRowKey(item: EstoqueRecord, index: number): string {
  const location = item.localizacao_produto?.trim() || 'sem-localizacao';
  return `${item.cod_empresa}:${item.cod_produto}:${location}:${index}`;
}

function absoluteQuantity(...values: number[]): number {
  return values.reduce((total, value) => total + Math.abs(value), 0);
}

function operationalOutboundQuantity(row: GiroRecord): number {
  return absoluteQuantity(row.saida_venda, row.saida_transferencia, row.saida_outras);
}

function physicalOutboundQuantity(row: GiroRecord): number {
  return absoluteQuantity(row.saida_venda, row.saida_transferencia, row.saida_outras, row.saida_devolucao);
}

function inboundQuantity(row: GiroRecord): number {
  return absoluteQuantity(row.entrada_compra, row.entrada_transferencia, row.entrada_outras, row.entrada_devolucao);
}

function salesQuantity(row: GiroRecord): number {
  return Math.abs(row.saida_venda);
}

function withdrawalQuantity(row: GiroRecord): number {
  return absoluteQuantity(row.saida_transferencia, row.saida_outras, row.saida_devolucao);
}

function purchaseQuantity(row: GiroRecord): number {
  return Math.abs(row.entrada_compra);
}

function otherInboundQuantity(row: GiroRecord): number {
  return absoluteQuantity(row.entrada_transferencia, row.entrada_outras, row.entrada_devolucao);
}

function civilDayTimestamp(value: string): number | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) return null;

  return timestamp;
}

function currentCivilDayTimestamp(now: Date): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

function primaryMovementType(
  sales: number,
  withdrawals: number,
  purchases: number,
  otherInbound: number,
): StockPrimaryMovementType | null {
  const candidates: Array<[StockPrimaryMovementType, number]> = [
    ['sale', sales],
    ['withdrawal', withdrawals],
    ['purchase', purchases],
    ['entry', otherInbound],
  ];
  const primary = candidates.reduce((best, candidate) => candidate[1] > best[1] ? candidate : best);
  return primary[1] > 0 ? primary[0] : null;
}

function validTimestamp(value: string | null): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function normalizeStockSearch(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

export function buildStockInsights(
  stock: EstoqueRecord[],
  movement: GiroRecord[],
  now = new Date(),
  movementScope: StockMovementScope = 'branch',
): StockProductInsight[] {
  const currentDay = currentCivilDayTimestamp(now);
  const startDay = currentDay - 90 * DAY_MS;

  const byProduct = new Map<string, GiroRecord[]>();
  movement.forEach((row) => {
    const movementDay = civilDayTimestamp(row.data_movimento);
    if (movementDay === null || movementDay < startDay || movementDay > currentDay) return;

    const key = movementKey(row, movementScope);
    byProduct.set(key, [...(byProduct.get(key) ?? []), row]);
  });

  return stock.map((item, index) => {
    const movements = byProduct.get(movementKey(item, movementScope)) ?? [];
    const totalOutbound = movements.reduce((sum, row) => sum + operationalOutboundQuantity(row), 0);
    const totalPhysicalOutbound = movements.reduce((sum, row) => sum + physicalOutboundQuantity(row), 0);
    const totalInbound = movements.reduce((sum, row) => sum + inboundQuantity(row), 0);
    const totalSales = movements.reduce((sum, row) => sum + salesQuantity(row), 0);
    const totalWithdrawals = movements.reduce((sum, row) => sum + withdrawalQuantity(row), 0);
    const totalPurchases = movements.reduce((sum, row) => sum + purchaseQuantity(row), 0);
    const totalOtherInbound = movements.reduce((sum, row) => sum + otherInboundQuantity(row), 0);
    const firstMovement = movements.reduce(
      (earliest, row) => Math.min(earliest, civilDayTimestamp(row.data_movimento) ?? currentDay),
      currentDay,
    );
    const coveredDays = movements.length
      ? Math.max(1, Math.min(90, Math.floor((currentDay - firstMovement) / DAY_MS) + 1))
      : 0;
    const dailyOutbound = coveredDays ? totalOutbound / coveredDays : 0;
    const operationalMinimum = Math.ceil(dailyOutbound * 30);
    const coverageDays = dailyOutbound > 0 ? item.quantidade_estoque / dailyOutbound : null;

    let status: StockStatus = 'available';
    if (item.quantidade_estoque <= 0) status = 'out';
    else if (coverageDays !== null && coverageDays < 15) status = 'critical';
    else if (coverageDays !== null && coverageDays < 30) status = 'low';

    const latestTimestamp = [
      ...movements.map((row) => row.data_movimento),
      item.data_ultima_venda,
      item.data_ultima_compra,
      item.data_ultima_transferencia,
    ].reduce((latest, value) => Math.max(latest, validTimestamp(value)), 0);
    const lastMovementDate = latestTimestamp ? new Date(latestTimestamp).toISOString() : null;
    const stagnantDays = latestTimestamp
      ? Math.max(0, Math.floor((now.getTime() - latestTimestamp) / DAY_MS))
      : 0;

    return {
      ...item,
      sourceRowKey: stockSourceRowKey(item, index),
      status,
      operationalMinimum,
      coverageDays,
      totalInbound,
      totalOutbound,
      totalPhysicalOutbound,
      totalMovement: totalInbound + totalPhysicalOutbound,
      totalSales,
      totalWithdrawals,
      primaryMovementType: primaryMovementType(totalSales, totalWithdrawals, totalPurchases, totalOtherInbound),
      lastMovementDate,
      stagnantDays,
      movementDataAvailable: movements.length > 0,
      movements: [...movements].sort((a, b) => b.data_movimento.localeCompare(a.data_movimento)),
    };
  });
}

export function classifyStockTrend(points: StockEvolutionPoint[]): StockMovementTrend {
  let hasIncrease = false;
  let hasDecrease = false;

  for (let index = 1; index < points.length; index += 1) {
    if (points[index].quantity > points[index - 1].quantity) hasIncrease = true;
    if (points[index].quantity < points[index - 1].quantity) hasDecrease = true;
  }

  if (hasIncrease && hasDecrease) return 'irregular';
  if (hasIncrease) return 'increasing';
  if (hasDecrease) return 'decreasing';
  return 'stagnant';
}

export function buildStockEvolution(insight: StockProductInsight): StockEvolutionPoint[] {
  const byDate = new Map<string, { inbound: number; outbound: number }>();
  insight.movements.forEach((row) => {
    const date = row.data_movimento.slice(0, 10);
    const totals = byDate.get(date) ?? { inbound: 0, outbound: 0 };
    byDate.set(date, {
      inbound: totals.inbound + inboundQuantity(row),
      outbound: totals.outbound + physicalOutboundQuantity(row),
    });
  });

  let quantity = insight.quantidade_estoque;
  const points: StockEvolutionPoint[] = [];
  [...byDate.keys()]
    .sort((a, b) => b.localeCompare(a))
    .forEach((date) => {
      points.push({ date, quantity });
      const totals = byDate.get(date)!;
      quantity = quantity - totals.inbound + totals.outbound;
    });

  return points.reverse();
}

export function filterStockInsights(
  insights: StockProductInsight[],
  filters: StockInsightFilters,
): StockProductInsight[] {
  const search = normalizeStockSearch(filters.search);
  const brands = new Set(filters.brands ?? []);
  const groups = new Set(filters.groups ?? []);
  const lines = new Set(filters.lines ?? []);

  return insights.filter((item) => {
    const searchable = [
      item.cod_produto,
      item.produto,
      item.marca,
      item.grupo,
      item.linha,
      item.aplicacao_produto,
      item.cod_fabricante,
      item.nr_fabricante,
      item.nr_original,
    ]
      .map(normalizeStockSearch)
      .join(' ');
    const matchesSearch = !search || searchable.includes(search);
    const matchesBrand = brands.size === 0 || brands.has(item.marca);
    const matchesGroup = groups.size === 0 || groups.has(item.grupo);
    const matchesLine = lines.size === 0 || lines.has(item.linha ?? '');
    const matchesQuickFilter =
      filters.quickFilter === 'all' ||
      (filters.quickFilter === 'attention' && (
        item.status === 'out' ||
        item.status === 'critical' ||
        item.status === 'low' ||
        item.stagnantDays > 90
      )) ||
      (filters.quickFilter === 'stagnant' && item.stagnantDays > 90) ||
      (filters.quickFilter === 'with-stock' && item.quantidade_estoque > 0) ||
      (filters.quickFilter === 'excess' && isStockExcess(item)) ||
      item.status === filters.quickFilter;

    return matchesSearch && matchesBrand && matchesGroup && matchesLine && matchesQuickFilter;
  });
}

export function sortStockInsights(insights: StockProductInsight[], mode: StockSortMode): StockProductInsight[] {
  return [...insights].sort((a, b) => {
    if (mode === 'stock-asc') return a.quantidade_estoque - b.quantidade_estoque;
    if (mode === 'stock-desc') return b.quantidade_estoque - a.quantidade_estoque;
    if (mode === 'product') return a.produto.localeCompare(b.produto, 'pt-BR');
    if (mode === 'brand') return a.marca.localeCompare(b.marca, 'pt-BR');

    return (b.lastMovementDate ?? '').localeCompare(a.lastMovementDate ?? '');
  });
}
