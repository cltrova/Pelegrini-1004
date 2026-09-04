import type { EstoqueRecord, GiroRecord } from '@/types/estoque';

export type StockActionInsightKind =
  | 'rupture-risk'
  | 'excess-low-sales'
  | 'no-sale-90-days'
  | 'purchase-without-later-movement';

export type StockActionInsightSeverity = 'critical' | 'warning' | 'info';

export interface StockActionInsight {
  kind: StockActionInsightKind;
  severity: StockActionInsightSeverity;
  productCode: string;
  productName: string;
  sourceLabel: string;
  periodLabel: string;
  reason: string;
  recommendedAction: string;
}

const DAY_MS = 86_400_000;
const ANALYSIS_DAYS = 90;
const EXCESS_COVERAGE_DAYS = 180;

export interface StrictDateValue {
  timestamp: number;
  civilTimestamp: number;
  monthKey: string;
}

export function parseStrictDate(value: string | null | undefined): StrictDateValue | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?)?$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const civilTimestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(civilTimestamp);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  const timestamp = value.includes('T') ? Date.parse(value) : civilTimestamp;
  if (Number.isNaN(timestamp)) return null;
  return { timestamp, civilTimestamp, monthKey: `${match[1]}-${match[2]}` };
}

function civilTimestamp(value: string | null | undefined): number | null {
  return parseStrictDate(value)?.civilTimestamp ?? null;
}

function currentCivilTimestamp(now: Date): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

function movementQuantity(row: GiroRecord): number {
  return [row.saida_venda, row.saida_transferencia, row.saida_outras, row.saida_devolucao,
    row.entrada_compra, row.entrada_transferencia, row.entrada_outras, row.entrada_devolucao]
    .reduce((total, value) => total + Math.abs(value || 0), 0);
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(timestamp));
}

function insightBase(product: EstoqueRecord) {
  return { productCode: String(product.cod_produto), productName: product.produto };
}

function consolidatedProductKey(record: Pick<EstoqueRecord | GiroRecord, 'cod_empresa_bi' | 'cod_produto'>): string {
  return `${record.cod_empresa_bi}:${record.cod_produto}`;
}

function detailedProductKey(record: Pick<EstoqueRecord | GiroRecord, 'cod_empresa_bi' | 'cod_empresa' | 'cod_produto'>): string {
  return `${record.cod_empresa_bi}:${record.cod_empresa}:${record.cod_produto}`;
}

function isConsolidatedStock(record: EstoqueRecord): boolean {
  return record.tipo_relatorio.trim().toUpperCase().includes('CONSOLID');
}

export function buildStockActionInsights(stock: EstoqueRecord[], giro: GiroRecord[], now = new Date()): StockActionInsight[] {
  if (stock.length === 0) return [];
  const currentDay = currentCivilTimestamp(now);
  const periodStart = currentDay - ANALYSIS_DAYS * DAY_MS;
  const consolidatedMovements = new Map<string, GiroRecord[]>();
  const detailedMovements = new Map<string, GiroRecord[]>();

  giro.forEach((row) => {
    const timestamp = civilTimestamp(row.data_movimento);
    if (timestamp === null || timestamp > currentDay) return;
    const consolidatedKey = consolidatedProductKey(row);
    const detailedKey = detailedProductKey(row);
    consolidatedMovements.set(consolidatedKey, [...(consolidatedMovements.get(consolidatedKey) ?? []), row]);
    detailedMovements.set(detailedKey, [...(detailedMovements.get(detailedKey) ?? []), row]);
  });

  const insights: StockActionInsight[] = [];
  stock.forEach((product) => {
    const movements = isConsolidatedStock(product)
      ? consolidatedMovements.get(consolidatedProductKey(product)) ?? []
      : detailedMovements.get(detailedProductKey(product)) ?? [];
    const recentMovements = movements.filter((row) => {
      const timestamp = civilTimestamp(row.data_movimento);
      return timestamp !== null && timestamp >= periodStart;
    });
    const recentSales = recentMovements.reduce((total, row) => total + Math.abs(row.saida_venda || 0), 0);
    const commonPeriod = `Consulta atual e ultimos ${ANALYSIS_DAYS} dias`;

    if (product.quantidade_estoque <= 0 && recentSales > 0) {
      insights.push({ ...insightBase(product), kind: 'rupture-risk', severity: 'critical',
        sourceLabel: 'Estoque e movimentacoes', periodLabel: commonPeriod,
        reason: `Saldo zerado com ${recentSales.toLocaleString('pt-BR')} unidade(s) vendida(s) no periodo.`,
        recommendedAction: 'Revisar reposicao e pedidos de compra em aberto.' });
    }

    if (product.quantidade_estoque > 0 && recentSales > 0) {
      const datedRecent = recentMovements.map((row) => civilTimestamp(row.data_movimento))
        .filter((timestamp): timestamp is number => timestamp !== null);
      const firstMovement = datedRecent.length ? Math.min(...datedRecent) : currentDay;
      const observedDays = Math.max(1, Math.min(ANALYSIS_DAYS, Math.floor((currentDay - firstMovement) / DAY_MS) + 1));
      const coverageDays = product.quantidade_estoque / (recentSales / observedDays);
      if (coverageDays > EXCESS_COVERAGE_DAYS) {
        insights.push({ ...insightBase(product), kind: 'excess-low-sales', severity: 'warning',
          sourceLabel: 'Estoque e movimentacoes', periodLabel: commonPeriod,
          reason: `Estoque cobre aproximadamente ${Math.round(coverageDays)} dias no ritmo de vendas observado.`,
          recommendedAction: 'Avaliar transferencia, promocao ou suspensao temporaria de compra.' });
      }
    }

    const saleDates = [civilTimestamp(product.data_ultima_venda),
      ...movements.filter((row) => Math.abs(row.saida_venda || 0) > 0).map((row) => civilTimestamp(row.data_movimento))]
      .filter((timestamp): timestamp is number => timestamp !== null && timestamp <= currentDay);
    const lastSale = saleDates.length ? Math.max(...saleDates) : null;
    if (product.quantidade_estoque > 0 && lastSale !== null) {
      const daysWithoutSale = Math.floor((currentDay - lastSale) / DAY_MS);
      if (daysWithoutSale > 90) {
        insights.push({ ...insightBase(product), kind: 'no-sale-90-days', severity: 'warning',
          sourceLabel: 'Cadastro de estoque e movimentacoes', periodLabel: `Ultima venda valida em ${formatDate(lastSale)}`,
          reason: `${daysWithoutSale.toLocaleString('pt-BR')} dias sem venda registrada.`,
          recommendedAction: 'Revisar aplicacao, demanda e possibilidade de transferencia ou promocao.' });
      }
    }

    const purchaseDates = [civilTimestamp(product.data_ultima_compra),
      ...movements.filter((row) => Math.abs(row.entrada_compra || 0) > 0).map((row) => civilTimestamp(row.data_movimento))]
      .filter((timestamp): timestamp is number => timestamp !== null && timestamp <= currentDay);
    const lastPurchase = purchaseDates.length ? Math.max(...purchaseDates) : null;
    if (lastPurchase !== null) {
      const hasLaterMovement = movements.some((row) => {
        const timestamp = civilTimestamp(row.data_movimento);
        return timestamp !== null && timestamp > lastPurchase && timestamp <= currentDay && movementQuantity(row) > 0;
      });
      if (!hasLaterMovement) {
        insights.push({ ...insightBase(product), kind: 'purchase-without-later-movement', severity: 'info',
          sourceLabel: 'Compras e movimentacoes', periodLabel: `Desde a compra de ${formatDate(lastPurchase)}`,
          reason: 'Nao ha movimentacao registrada depois da compra mais recente.',
          recommendedAction: 'Conferir recebimento, localizacao e disponibilidade comercial do item.' });
      }
    }
  });

  const order: Record<StockActionInsightSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return insights.sort((a, b) => order[a.severity] - order[b.severity] || a.productName.localeCompare(b.productName, 'pt-BR'));
}
