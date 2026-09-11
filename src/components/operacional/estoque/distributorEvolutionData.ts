export const DISTRIBUTOR_BRANDS = ['MWM', 'EATON', 'ZF', 'CUMMINS', 'MERITOR', 'MIC'] as const;

export type DistributorBrand = typeof DISTRIBUTOR_BRANDS[number];

export function canViewDistributorEvolution(companyCode: unknown, branchId: unknown): boolean {
  return String(companyCode ?? '').trim() === '1004' && branchId === 'transmissao';
}

export interface DistributorEvolutionRow {
  mes: string;
  cod_marca: string;
  marca: DistributorBrand;
  cod_grupo: string;
  grupo: string;
  classe: string | null;
  valor_estoque: number | null;
  percentual_estoque: number | null;
  duracao_estoque: number | null;
  valor_vendas: number | null;
  percentual_vendas: number | null;
  percentual_acumulado_vendas: number | null;
  margem_venda: number | null;
  prazo_medio_venda: number | null;
  valor_devolucoes: number | null;
  valor_compras: number | null;
  percentual_compras: number | null;
  prazo_medio_compra: number | null;
  percentual_diferenca_compra_cmv: number | null;
}

export interface DistributorMonthSummary extends DistributorEvolutionRow {
  variacao_valor_estoque: number | null;
}

export interface DistributorEvolutionGroup {
  key: string;
  cod_grupo: string;
  grupo: string;
  months: DistributorMonthSummary[];
}

export interface DistributorEvolutionBrand {
  marca: DistributorBrand;
  months: DistributorMonthSummary[];
  groups: DistributorEvolutionGroup[];
}

export interface DistributorEvolutionResult {
  months: string[];
  brands: DistributorEvolutionBrand[];
  summary: DistributorMonthSummary;
}

interface ProductsPreviewFilters {
  dataInicio: string;
  dataFim: string;
  marcas: DistributorBrand[];
}

const numericFields = [
  'valor_estoque', 'percentual_estoque', 'duracao_estoque', 'valor_vendas',
  'percentual_vendas', 'percentual_acumulado_vendas', 'margem_venda',
  'prazo_medio_venda', 'valor_devolucoes', 'valor_compras', 'percentual_compras',
  'prazo_medio_compra', 'percentual_diferenca_compra_cmv',
] as const;

type NumericField = typeof numericFields[number];

function read(obj: Record<string, unknown>, key: string): unknown {
  if (key in obj) return obj[key];
  const match = Object.keys(obj).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
  return match ? obj[match] : undefined;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMonth(value: unknown): string {
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d{4})[-/]?(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : '';
}

function normalizeBrand(value: unknown): DistributorBrand | null {
  const normalized = String(value ?? '').trim().toUpperCase();
  return DISTRIBUTOR_BRANDS.find((brand) => normalized === brand || normalized.startsWith(`${brand} `)) ?? null;
}

export function buildDistributorRowsFromProducts(
  products: Array<Record<string, unknown>>,
  filters: ProductsPreviewFilters,
): DistributorEvolutionRow[] {
  return products.flatMap((product) => {
    const date = String(product.data_faturamento ?? '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
    const type = String(product.tipo ?? '').trim().toUpperCase();
    if (!date || date < filters.dataInicio || date > filters.dataFim) return [];
    if (type !== 'PEDIDO' && type !== 'DEVOLUCAO') return [];

    const group = String(product.grupo ?? product.grupo_produto ?? 'Sem grupo').trim() || 'Sem grupo';
    const normalizedGroup = group.toUpperCase();
    const directBrand = normalizeBrand(product.marca);
    const brand = normalizedGroup.startsWith('MWM')
      ? 'MWM'
      : normalizedGroup.startsWith('EATON')
        ? 'EATON'
        : directBrand;
    if (!brand || !filters.marcas.includes(brand)) return [];

    const total = toNumber(product.valor_total);
    const rawReturnValue = (
      toNumber(product.valor_liquido_final_item)
      ?? toNumber(product.valor_devolucao_item)
      ?? total
    );
    const returnValue = rawReturnValue === null ? null : Math.abs(rawReturnValue);

    return [{
      mes: date.slice(0, 7),
      cod_marca: String(product.cod_marca ?? ''),
      marca: brand,
      cod_grupo: String(product.cod_grupo ?? ''),
      grupo: group,
      classe: null,
      valor_estoque: null,
      percentual_estoque: null,
      duracao_estoque: null,
      valor_vendas: type === 'PEDIDO' ? (total === null ? null : Math.max(0, total)) : 0,
      percentual_vendas: null,
      percentual_acumulado_vendas: null,
      margem_venda: null,
      prazo_medio_venda: null,
      valor_devolucoes: type === 'DEVOLUCAO' ? returnValue : 0,
      valor_compras: null,
      percentual_compras: null,
      prazo_medio_compra: null,
      percentual_diferenca_compra_cmv: null,
    }];
  });
}

export function buildClosedMonthsRange(now = new Date()): { dataInicio: string; dataFim: string } {
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 12, 1);
  const last = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0);
  const format = (date: Date) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
  return { dataInicio: format(first), dataFim: format(last) };
}

export function normalizeDistributorRows(payload: unknown): DistributorEvolutionRow[] {
  const source = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : [];

  return source.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Record<string, unknown>;
    const marca = normalizeBrand(read(raw, 'marca'));
    const mes = normalizeMonth(read(raw, 'mes'));
    if (!marca || !mes) return [];
    const numbers = Object.fromEntries(numericFields.map((field) => [field, toNumber(read(raw, field))]));
    return [{
      mes,
      cod_marca: String(read(raw, 'cod_marca') ?? ''),
      marca,
      cod_grupo: String(read(raw, 'cod_grupo') ?? ''),
      grupo: String(read(raw, 'grupo') ?? 'Sem grupo').trim() || 'Sem grupo',
      classe: read(raw, 'classe') == null ? null : String(read(raw, 'classe')),
      ...numbers,
    } as DistributorEvolutionRow];
  }).sort((a, b) => a.mes.localeCompare(b.mes) || a.marca.localeCompare(b.marca) || a.grupo.localeCompare(b.grupo));
}

function aggregateRows(rows: DistributorEvolutionRow[], mes: string, marca: DistributorBrand = 'MWM'): DistributorMonthSummary {
  const additive: NumericField[] = ['valor_estoque', 'valor_vendas', 'valor_devolucoes', 'valor_compras'];
  const additivePercentages: NumericField[] = ['percentual_estoque', 'percentual_vendas', 'percentual_compras'];
  const result = { ...rows[0], mes, marca } as DistributorMonthSummary;
  result.cod_marca = rows[0]?.cod_marca ?? '';
  result.cod_grupo = rows.length === 1 ? rows[0].cod_grupo : '';
  result.grupo = rows.length === 1 ? rows[0].grupo : 'Todos os grupos';
  result.classe = rows.length === 1 ? rows[0].classe : null;
  numericFields.forEach((field) => {
    const values = rows.map((row) => row[field]).filter((value): value is number => value !== null);
    if (additive.includes(field) || additivePercentages.includes(field)) {
      result[field] = values.length ? values.reduce((sum, value) => sum + value, 0) : null;
      return;
    }
    if (field === 'percentual_acumulado_vendas') {
      result[field] = values.length ? Math.max(...values) : null;
      return;
    }
    const weightField = field === 'duracao_estoque' ? 'valor_estoque'
      : field === 'margem_venda' || field === 'prazo_medio_venda' ? 'valor_vendas'
        : 'valor_compras';
    const weighted = rows.filter((row) => row[field] !== null && (row[weightField] ?? 0) > 0);
    const totalWeight = weighted.reduce((sum, row) => sum + (row[weightField] ?? 0), 0);
    result[field] = totalWeight > 0
      ? weighted.reduce((sum, row) => sum + Number(row[field]) * (row[weightField] ?? 0), 0) / totalWeight
      : values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  });
  result.variacao_valor_estoque = null;
  return result;
}

function withVariation(months: DistributorMonthSummary[]): DistributorMonthSummary[] {
  return months.map((month, index) => {
    const previous = months[index - 1]?.valor_estoque;
    return {
      ...month,
      variacao_valor_estoque: calculateVariation(month.valor_estoque, previous),
    };
  });
}

export function calculateVariation(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current === null || current === undefined || previous === null || previous === undefined || previous === 0) return null;
  return (current - previous) / previous;
}

export function buildDistributorEvolution(rows: DistributorEvolutionRow[]): DistributorEvolutionResult {
  const months = [...new Set(rows.map((row) => row.mes))].sort();
  const brands = DISTRIBUTOR_BRANDS.flatMap((marca) => {
    const brandRows = rows.filter((row) => row.marca === marca);
    if (!brandRows.length) return [];
    const brandMonths = withVariation(months.flatMap((mes) => {
      const matching = brandRows.filter((row) => row.mes === mes);
      return matching.length ? [aggregateRows(matching, mes, marca)] : [];
    }));
    const groupKeys = [...new Set(brandRows.map((row) => `${row.cod_grupo}|${row.grupo}`))];
    const groups = groupKeys.map((key) => {
      const [cod_grupo, grupo] = key.split('|');
      const groupRows = brandRows.filter((row) => row.cod_grupo === cod_grupo && row.grupo === grupo);
      return {
        key: `${marca}:${key}`,
        cod_grupo,
        grupo,
        months: withVariation(months.flatMap((mes) => {
          const matching = groupRows.filter((row) => row.mes === mes);
          return matching.length ? [aggregateRows(matching, mes, marca)] : [];
        })),
      };
    });
    return [{ marca, months: brandMonths, groups }];
  });
  const latestMonth = months.at(-1) ?? '';
  const latestRows = rows.filter((row) => row.mes === latestMonth);
  const summary = aggregateRows(latestRows, latestMonth, latestRows[0]?.marca ?? 'MWM');
  const previousMonth = months.at(-2);
  const previousRows = rows.filter((row) => row.mes === previousMonth);
  const previousValues = previousRows
    .map((row) => row.valor_estoque)
    .filter((value): value is number => value !== null);
  const previousValue = previousValues.length
    ? previousValues.reduce((sum, value) => sum + value, 0)
    : null;
  summary.variacao_valor_estoque = calculateVariation(summary.valor_estoque, previousValue);
  return { months, brands, summary };
}
