import { GiroRecord } from '@/types/estoque';

export type TrendDirection = 'declining' | 'stable' | 'growing';

export interface ProductTrend {
  cod_produto: number;
  produto: string;
  marca: string;
  grupo: string;
  empresa: string;
  valor_estoque: number;
  quantidade_estoque: number;
  monthlySales: { month: string; qty: number }[];
  trend: TrendDirection;
  trendSlope: number; // negative = declining
  avgSales: number;
  lastMonthSales: number;
  peakSales: number;
  dropPercent: number; // % drop from peak to last month
}

/**
 * Calculates the linear regression slope for a series of values.
 * Negative slope = declining trend.
 */
function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

/**
 * Analyzes giro data to detect sales trends per product.
 * Returns products sorted by severity of decline.
 */
export function analyzeSalesTrends(
  giroData: GiroRecord[],
  minMonths: number = 3
): ProductTrend[] {
  // Group sales by product → month
  const productMonthly = new Map<number, {
    produto: string;
    marca: string;
    grupo: string;
    empresa: string;
    valor_estoque: number;
    quantidade_estoque: number;
    months: Map<string, number>;
  }>();

  giroData.forEach(r => {
    if (r.saida_venda <= 0) return;
    const month = r.data_movimento.substring(0, 7); // YYYY-MM
    let entry = productMonthly.get(r.cod_produto);
    if (!entry) {
      entry = {
        produto: r.produto,
        marca: r.marca,
        grupo: r.grupo,
        empresa: r.empresa,
        valor_estoque: r.valor_estoque,
        quantidade_estoque: r.quantidade_estoque,
        months: new Map(),
      };
      productMonthly.set(r.cod_produto, entry);
    }
    entry.months.set(month, (entry.months.get(month) || 0) + r.saida_venda);
  });

  const results: ProductTrend[] = [];

  productMonthly.forEach((entry, cod_produto) => {
    // Sort months chronologically
    const sortedMonths = [...entry.months.entries()]
      .sort(([a], [b]) => a.localeCompare(b));

    if (sortedMonths.length < minMonths) return;

    const monthlySales = sortedMonths.map(([month, qty]) => ({ month, qty }));
    const values = monthlySales.map(m => m.qty);
    const slope = linearSlope(values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const peak = Math.max(...values);
    const lastMonth = values[values.length - 1];
    const dropPercent = peak > 0 ? ((peak - lastMonth) / peak) * 100 : 0;

    // Normalize slope by average to get relative trend
    const normalizedSlope = avg > 0 ? slope / avg : 0;

    let trend: TrendDirection;
    if (normalizedSlope < -0.05) trend = 'declining';
    else if (normalizedSlope > 0.05) trend = 'growing';
    else trend = 'stable';

    results.push({
      cod_produto,
      produto: entry.produto,
      marca: entry.marca,
      grupo: entry.grupo,
      empresa: entry.empresa,
      valor_estoque: entry.valor_estoque,
      quantidade_estoque: entry.quantidade_estoque,
      monthlySales,
      trend,
      trendSlope: slope,
      avgSales: avg,
      lastMonthSales: lastMonth,
      peakSales: peak,
      dropPercent,
    });
  });

  return results;
}

/**
 * Returns only products with declining sales trends, sorted by value at risk.
 */
export function getDecliningProducts(trends: ProductTrend[]): ProductTrend[] {
  return trends
    .filter(t => t.trend === 'declining' && t.dropPercent > 20)
    .sort((a, b) => b.valor_estoque - a.valor_estoque);
}
