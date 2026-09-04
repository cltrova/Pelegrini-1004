import type { EstoqueRecord, GiroProductSummary, GiroRecord, GiroStatus } from '@/types/estoque';

const DAY_MS = 24 * 60 * 60 * 1000;

function code(value: unknown): string {
  const normalized = String(value ?? '').trim();
  return normalized === '0' ? '' : normalized;
}

function productLookupKey(companyCode: string | number | null | undefined, productCode: string | number): string {
  return `${code(companyCode)}:${String(productCode).trim()}`;
}

export function giroProductKey(
  companyCode: string | number | null | undefined,
  branchCode: string | number | null | undefined,
  productCode: string | number,
): string {
  return `${code(companyCode)}:${code(branchCode)}:${String(productCode).trim()}`;
}

export function calculateGiroStatus(estoque: number, vendasPeriodo: number, meses: number): GiroStatus {
  if (estoque === 0) return 'faltando';
  const mediaVendaMensal = meses > 0 ? vendasPeriodo / meses : 0;
  if (mediaVendaMensal === 0) return estoque > 0 ? 'excesso' : 'faltando';

  const mesesEstoque = estoque / mediaVendaMensal;
  if (mesesEstoque < 1) return 'faltando';
  if (mesesEstoque < 2) return 'alerta';
  if (mesesEstoque > 6) return 'excesso';
  return 'atendendo';
}

export function daysSince(value: string | null | undefined, now: Date): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / DAY_MS));
}

function latestDate(values: Array<string | null | undefined>): string | null {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

function movementAmount(row: GiroRecord, field: 'venda' | 'compra'): number {
  return row.tipo_movimento === (field === 'venda' ? 'Venda' : 'Compra')
    ? Number(row.quantidade_movimentada || 0)
    : 0;
}

function movementCutoff(months: number, now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - Math.max(0, months), 1);
}

export function normalizeGiroProducts(
  giroRows: GiroRecord[],
  stockRows: EstoqueRecord[],
  activeCompanyCode: string | number | null | undefined,
  months: number,
  now: Date,
): GiroProductSummary[] {
  const activeCode = code(activeCompanyCode);
  const stockByKey = new Map<string, EstoqueRecord[]>();
  const stockKeysByProduct = new Map<string, Set<string>>();

  stockRows.forEach((row) => {
    const rowCompanyCode = code(row.cod_empresa_bi);
    if (activeCode && rowCompanyCode !== activeCode) return;
    if (!rowCompanyCode) return;

    const key = giroProductKey(rowCompanyCode, row.cod_empresa, row.cod_produto);
    stockByKey.set(key, [...(stockByKey.get(key) ?? []), row]);
    const lookupKey = productLookupKey(rowCompanyCode, row.cod_produto);
    const keys = stockKeysByProduct.get(lookupKey) ?? new Set<string>();
    keys.add(key);
    stockKeysByProduct.set(lookupKey, keys);
  });

  const movementByKey = new Map<string, GiroRecord[]>();
  const cutoff = movementCutoff(months, now);

  giroRows.forEach((row) => {
    const timestamp = Date.parse(row.data_movimento);
    if (!Number.isFinite(timestamp) || timestamp < cutoff) return;

    const rowCompanyCode = code(row.cod_empresa_bi);
    if (activeCode && rowCompanyCode && rowCompanyCode !== activeCode) return;

    const effectiveCompanyCode = rowCompanyCode || activeCode;
    if (!effectiveCompanyCode) return;

    const matchingStockKeys = stockKeysByProduct.get(productLookupKey(effectiveCompanyCode, row.cod_produto));
    let key = giroProductKey(effectiveCompanyCode, row.cod_empresa, row.cod_produto);

    if (!rowCompanyCode && !stockByKey.has(key)) {
      // Sem codigo BI, somente a chave interna exata prova que o movimento e da filial ativa.
      return;
    }

    if (rowCompanyCode && !stockByKey.has(key) && matchingStockKeys?.size === 1) {
      key = [...matchingStockKeys][0];
    }

    movementByKey.set(key, [...(movementByKey.get(key) ?? []), row]);
  });

  const keys = new Set([...stockByKey.keys(), ...movementByKey.keys()]);

  return [...keys].map((key): GiroProductSummary => {
    const stocks = stockByKey.get(key) ?? [];
    const movements = movementByKey.get(key) ?? [];
    const latestMovement = [...movements].sort((a, b) => b.data_movimento.localeCompare(a.data_movimento))[0];
    const representative = stocks[0] ?? latestMovement;
    const totalVendas = movements.reduce((sum, row) => sum + movementAmount(row, 'venda'), 0);
    const totalCompras = movements.reduce((sum, row) => sum + movementAmount(row, 'compra'), 0);
    const quantidade = stocks.length > 0
      ? stocks.reduce((sum, row) => sum + Number(row.quantidade_estoque || 0), 0)
      : Number(latestMovement?.quantidade_estoque || 0);
    const valor = stocks.length > 0
      ? stocks.reduce((sum, row) => sum + Number(row.valor_estoque || 0), 0)
      : Number(latestMovement?.valor_estoque || 0);
    const ultimaVenda = latestDate([
      ...stocks.map((row) => row.data_ultima_venda),
      ...movements.filter((row) => movementAmount(row, 'venda') > 0).map((row) => row.data_movimento),
    ]);
    const mediaMensal = months > 0 ? totalVendas / months : 0;

    return {
      cod_empresa_bi: Number(code(representative?.cod_empresa_bi) || activeCode) || 0,
      cod_empresa: Number(representative?.cod_empresa || 0),
      cod_produto: Number(representative?.cod_produto || 0),
      produto: String(representative?.produto ?? ''),
      marca: String(representative?.marca ?? ''),
      grupo: String(representative?.grupo ?? ''),
      empresa: String(representative?.empresa ?? ''),
      quantidade_estoque: quantidade,
      valor_estoque: valor,
      total_vendas: totalVendas,
      total_compras: totalCompras,
      giro: quantidade > 0 ? totalVendas / quantidade : 0,
      status: calculateGiroStatus(quantidade, totalVendas, months),
      dias_sem_venda: daysSince(ultimaVenda, now),
      ultima_venda: ultimaVenda,
      total_saida_venda: movements.reduce((sum, row) => sum + Number(row.saida_venda || 0), 0),
      total_entrada_compra: movements.reduce((sum, row) => sum + Number(row.entrada_compra || 0), 0),
      total_saida_transferencia: movements.reduce((sum, row) => sum + Number(row.saida_transferencia || 0), 0),
      total_entrada_transferencia: movements.reduce((sum, row) => sum + Number(row.entrada_transferencia || 0), 0),
      cobertura_meses: mediaMensal > 0 ? quantidade / mediaMensal : null,
      classe_abc: stocks.find((row) => row.classe_abc)?.classe_abc ?? null,
    };
  }).sort((a, b) => b.valor_estoque - a.valor_estoque || a.cod_produto - b.cod_produto);
}
