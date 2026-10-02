export interface EstoqueAtualGroup {
  code: string;
  name: string;
  quantity: number;
  stockValue: number;
  averageCost: number;
  lastPurchaseCost: number;
  supplierCost: number;
  lastRealCost: number;
  salesQuantity: number;
  salesValue: number;
  netSalesValue: number;
  purchaseValue: number;
  original: Record<string, unknown>;
}

export interface EstoqueAtualReport {
  date: string;
  groups: EstoqueAtualGroup[];
  stockTotal: number;
  averageCostTotal: number;
  lastPurchaseCostTotal: number;
  supplierCostTotal: number;
  salesTotal: number;
  purchasesTotal: number;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Relatório de estoque inválido.');
  return value as Record<string, unknown>;
}

function number(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('O relatório de estoque contém valores ausentes ou inválidos.');
  return value;
}

export function parseEstoqueAtual(value: unknown): EstoqueAtualReport {
  const data = record(value);
  if (data.cod_empresa_bi !== 1004 || data.empresa_estoque !== 1) throw new Error('O relatório não pertence à Casa da Transmissão.');
  const date = String(data.data_estoque ?? '');
  const period = record(data.periodo_movimentacao);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || period.data_ini !== date || period.data_fim !== date) {
    throw new Error('O relatório não contém estoque e movimentos do mesmo dia.');
  }
  if (!Array.isArray(data.empresa) || data.empresa.length !== 1 || Number(record(data.empresa[0]).Empresa) !== 1) {
    throw new Error('A empresa do relatório de estoque não foi confirmada.');
  }
  if (!Array.isArray(data.agrupado)) throw new Error('Grupos de estoque não disponíveis.');
  const groups = data.agrupado.map(value => {
    const row = record(value);
    if (row.Quebra == null || typeof row['Label Quebra'] !== 'string') throw new Error('Grupo de estoque inválido.');
    return {
      code: String(row.Quebra), name: row['Label Quebra'],
      quantity: number(row, 'TotEst.Quantidade Estoque'), stockValue: number(row, 'TotEst.ValorEstoque'),
      averageCost: number(row, 'TotEst.ValorCustoMedio'), lastPurchaseCost: number(row, 'TotEst.ValorCustoUltimaC'),
      supplierCost: number(row, 'TotEst.ValorCustoFornecedor'), lastRealCost: number(row, 'TotEst.ValorCustoUltReal'),
      salesQuantity: number(row, 'Movimento.QtdeVenda'), salesValue: number(row, 'Movimento.Valor Venda'),
      netSalesValue: number(row, 'Movimento.Valor Venda Liquido'), purchaseValue: number(row, 'Movimento.Valor Compra'),
      original: row,
    };
  });
  const stock = record(data.totais_estoque);
  const movement = record(data.totais_movimento);
  return {
    date, groups,
    stockTotal: number(stock, 'ValorEstoque'), averageCostTotal: number(stock, 'Valor Total Custo Medio'),
    lastPurchaseCostTotal: number(stock, 'Valor Total Custo Ultima C.'), supplierCostTotal: number(stock, 'Valor Custo Fornecedor'),
    salesTotal: number(movement, 'ValorTotalVendas'), purchasesTotal: number(movement, 'ValorTotalCompras'),
  };
}

export function filterEstoqueAtualGrupos(groups: EstoqueAtualGroup[], search: string): EstoqueAtualGroup[] {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const term = normalize(search.trim());
  return groups.filter(group => normalize(`${group.code} ${group.name}`).includes(term));
}

export function estoqueAtualCsv(groups: EstoqueAtualGroup[]): string {
  const fields = [...new Set(groups.flatMap(group => Object.keys(group.original)))];
  const cell = (value: unknown) => {
    const text = typeof value === 'number' ? String(value).replace('.', ',') : String(value ?? '');
    const safe = typeof value === 'string' && /^[=+@-]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return [fields.map(cell).join(';'), ...groups.map(group => fields.map(field => cell(group.original[field])).join(';'))].join('\r\n');
}
