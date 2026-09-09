import type { EstoqueRecord, GiroProductSummary, GiroRecord, GiroStatus } from '@/types/estoque';

export type OverviewMetric = 'value' | 'quantity' | 'percent';

export interface OverviewProduct extends GiroProductSummary {
  cobertura_meses: number | null;
}

export interface OverviewMonth {
  mes: string;
  compras: number;
  vendas: number;
  valor: number;
}

export interface OverviewDistribution {
  name: string;
  value: number;
  quantity: number;
  percent: number;
}

export interface StockOverviewSummary {
  totalProducts: number;
  withStock: number;
  totalValue: number;
  out: number;
  low: number;
  critical: number;
  excess: number;
  idleCapital: number;
  excessValue: number;
  averageCoverage: number | null;
  sales: number;
  movements: number;
  noSale: number;
  months: OverviewMonth[];
  status: OverviewDistribution[];
  brands: OverviewDistribution[];
  groups: OverviewDistribution[];
  branches: OverviewDistribution[];
}

const statusLabel: Record<GiroStatus, string> = {
  atendendo: 'Atendendo', alerta: 'Alerta', faltando: 'Ruptura', excesso: 'Excesso',
};

export function formatStatus(status: GiroStatus): string {
  return statusLabel[status];
}

export function buildStockOverviewProducts(
  stock: EstoqueRecord[],
  movement: GiroRecord[],
  months: number,
  activeCompanyCode?: string | number | null,
  now = new Date(),
): OverviewProduct[] {
  const stockByCode = new Map(stock.map((row) => [String(row.cod_produto), row]));
  const movementByCode = new Map<string, GiroRecord[]>();
  const cutoff = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1);
  movement.forEach((row) => {
    const time = Date.parse(row.data_movimento);
    if (!Number.isFinite(time) || time < cutoff) return;
    if (activeCompanyCode && String(row.cod_empresa_bi) !== String(activeCompanyCode)) return;
    const key = String(row.cod_produto);
    movementByCode.set(key, [...(movementByCode.get(key) ?? []), row]);
  });

  return [...new Set([...stockByCode.keys(), ...movementByCode.keys()])].map((key) => {
    const row = stockByCode.get(key);
    const rows = movementByCode.get(key) ?? [];
    const sales = rows.filter((item) => item.tipo_movimento === 'Venda').reduce((sum, item) => sum + Number(item.quantidade_movimentada || 0), 0);
    const purchases = rows.filter((item) => item.tipo_movimento === 'Compra').reduce((sum, item) => sum + Number(item.quantidade_movimentada || 0), 0);
    const quantity = row?.quantidade_estoque ?? rows.at(-1)?.quantidade_estoque ?? 0;
    const value = row?.valor_estoque ?? rows.at(-1)?.valor_estoque ?? 0;
    const coverage = sales > 0 ? quantity / (sales / Math.max(months, 1)) : null;
    const status: GiroStatus = quantity <= 0 ? 'faltando' : coverage === null ? 'excesso' : coverage < 1 ? 'faltando' : coverage < 2 ? 'alerta' : coverage > 6 ? 'excesso' : 'atendendo';
    return {
      cod_empresa_bi: row?.cod_empresa_bi ?? rows[0]?.cod_empresa_bi,
      cod_empresa: row?.cod_empresa ?? rows[0]?.cod_empresa ?? 0,
      cod_produto: row?.cod_produto ?? rows[0]?.cod_produto ?? Number(key),
      produto: row?.produto ?? rows[0]?.produto ?? `Produto ${key}`,
      marca: row?.marca ?? rows[0]?.marca ?? 'Sem marca',
      grupo: row?.grupo ?? rows[0]?.grupo ?? 'Sem grupo',
      empresa: row?.empresa ?? rows[0]?.empresa ?? 'Sem filial',
      quantidade_estoque: quantity,
      valor_estoque: value,
      total_vendas: sales,
      total_compras: purchases,
      giro: quantity > 0 ? sales / quantity : 0,
      status,
      dias_sem_venda: row?.data_ultima_venda ? Math.max(0, Math.floor((now.getTime() - Date.parse(row.data_ultima_venda)) / 86400000)) : null,
      ultima_venda: row?.data_ultima_venda ?? null,
      total_saida_venda: sales,
      total_entrada_compra: purchases,
      total_saida_transferencia: 0,
      total_entrada_transferencia: 0,
      cobertura_meses: coverage,
      classe_abc: row?.classe_abc ?? null,
    };
  });
}

function distribution(products: OverviewProduct[], field: 'marca' | 'grupo' | 'empresa'): OverviewDistribution[] {
  const map = new Map<string, { value: number; quantity: number }>();
  products.forEach((product) => {
    const name = String(product[field] || 'Sem informação');
    const item = map.get(name) ?? { value: 0, quantity: 0 };
    item.value += product.valor_estoque;
    item.quantity += product.quantidade_estoque;
    map.set(name, item);
  });
  const total = products.reduce((sum, product) => sum + product.valor_estoque, 0);
  return [...map.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 8).map(([name, item]) => ({
    name, ...item, percent: total > 0 ? (item.value / total) * 100 : 0,
  }));
}

export function buildStockOverviewSummary(products: OverviewProduct[], movement: GiroRecord[], months: number): StockOverviewSummary {
  const totalValue = products.reduce((sum, product) => sum + product.valor_estoque, 0);
  const excessProducts = products.filter((product) => product.status === 'excesso' && product.quantidade_estoque > 0);
  const idleProducts = products.filter((product) => product.quantidade_estoque > 0 && (product.dias_sem_venda === null || product.dias_sem_venda > 90));
  const coverage = products.map((product) => product.cobertura_meses).filter((value): value is number => value !== null && Number.isFinite(value));
  const status = (['atendendo', 'alerta', 'faltando', 'excesso'] as GiroStatus[]).map((key) => {
    const matching = products.filter((product) => product.status === key);
    return { name: statusLabel[key], value: matching.length, quantity: matching.reduce((sum, product) => sum + product.quantidade_estoque, 0), percent: products.length ? matching.length / products.length * 100 : 0 };
  }).filter((item) => item.value > 0);
  const monthMap = new Map<string, OverviewMonth>();
  movement.forEach((row) => {
    const key = row.data_movimento.slice(0, 7);
    const item = monthMap.get(key) ?? { mes: `${key.slice(5)}/${key.slice(2, 4)}`, compras: 0, vendas: 0, valor: 0 };
    if (row.tipo_movimento === 'Venda') item.vendas += Number(row.quantidade_movimentada || 0);
    if (row.tipo_movimento === 'Compra') item.compras += Number(row.quantidade_movimentada || 0);
    monthMap.set(key, item);
  });
  const monthsData = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-Math.max(months, 1)).map(([key, item]) => ({ ...item, valor: products.reduce((sum, product) => sum + (product.valor_estoque * (key === new Date().toISOString().slice(0, 7) ? 1 : 0)), 0) }));
  return {
    totalProducts: products.length,
    withStock: products.filter((product) => product.quantidade_estoque > 0).length,
    totalValue,
    out: products.filter((product) => product.quantidade_estoque <= 0).length,
    low: products.filter((product) => product.status === 'alerta').length,
    critical: products.filter((product) => product.status === 'faltando' && product.quantidade_estoque > 0).length,
    excess: excessProducts.length,
    idleCapital: idleProducts.reduce((sum, product) => sum + product.valor_estoque, 0),
    excessValue: excessProducts.reduce((sum, product) => sum + product.valor_estoque, 0),
    averageCoverage: coverage.length ? coverage.reduce((sum, value) => sum + value, 0) / coverage.length : null,
    sales: products.reduce((sum, product) => sum + product.total_vendas, 0),
    movements: movement.reduce((sum, row) => sum + Number(row.quantidade_movimentada || 0), 0),
    noSale: products.filter((product) => product.total_vendas === 0).length,
    months: monthsData,
    status,
    brands: distribution(products, 'marca'),
    groups: distribution(products, 'grupo'),
    branches: distribution(products, 'empresa'),
  };
}
