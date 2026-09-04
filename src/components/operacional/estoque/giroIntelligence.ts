import type { GiroProductSummary, GiroStatus } from '@/types/estoque';

const STATUS_ORDER: GiroStatus[] = ['atendendo', 'alerta', 'faltando', 'excesso'];
const ABC_ORDER = ['A', 'B', 'C'];

export interface GiroManagementSummary {
  counts: Record<GiroStatus, number>;
  idleCapital: number;
  averageKnownCoverageMonths: number;
  knownCoverageCount: number;
  statusDistribution: Array<{ status: GiroStatus; count: number }>;
  abcValueDistribution: Array<{ classe: string; valor: number; produtos: number }>;
  stockVersusSales: Array<{ empresa: string; cod_produto: number; produto: string; estoque: number; vendas: number; valor: number }>;
  noSaleBuckets: Array<{ faixa: string; count: number }>;
  idleCapitalRanking: Array<{ empresa: string; cod_produto: number; produto: string; valor: number; dias_sem_venda: number | null }>;
}

export const GIRO_STATUS_RULES: Record<GiroStatus, string> = {
  atendendo: 'Regra: cobertura entre 2 e 6 meses.',
  alerta: 'Regra: cobertura entre 1 e 2 meses.',
  faltando: 'Regra: sem estoque ou cobertura inferior a 1 mes.',
  excesso: 'Regra: cobertura superior a 6 meses ou estoque sem vendas no periodo.',
};

export const GIRO_RECOMMENDED_ACTIONS: Record<GiroStatus, string> = {
  atendendo: 'Manter',
  alerta: 'Monitorar',
  faltando: 'Repor',
  excesso: 'Revisar excesso',
};

function hasKnownSaleAge(product: GiroProductSummary) {
  return Boolean(
    product.ultima_venda &&
    Number.isFinite(Date.parse(product.ultima_venda)) &&
    product.dias_sem_venda !== null &&
    Number.isFinite(product.dias_sem_venda) &&
    product.dias_sem_venda >= 0,
  );
}

function isIdle(product: GiroProductSummary) {
  return product.quantidade_estoque > 0 && (
    product.status === 'excesso' ||
    (hasKnownSaleAge(product) && product.dias_sem_venda! > 90)
  );
}

export function buildGiroManagementSummary(products: GiroProductSummary[]): GiroManagementSummary {
  const counts: Record<GiroStatus, number> = { atendendo: 0, alerta: 0, faltando: 0, excesso: 0 };
  if (products.length === 0) {
    return {
      counts,
      idleCapital: 0,
      averageKnownCoverageMonths: 0,
      knownCoverageCount: 0,
      statusDistribution: [],
      abcValueDistribution: [],
      stockVersusSales: [],
      noSaleBuckets: [],
      idleCapitalRanking: [],
    };
  }

  const coverages: number[] = [];
  const abc = new Map<string, { valor: number; produtos: number }>();
  const buckets = [
    { faixa: '0-30 dias', count: 0 },
    { faixa: '31-60 dias', count: 0 },
    { faixa: '61-90 dias', count: 0 },
    { faixa: 'Mais de 90 dias', count: 0 },
    { faixa: 'Sem historico', count: 0 },
  ];

  for (const product of products) {
    counts[product.status] += 1;
    if (product.cobertura_meses !== null && product.cobertura_meses !== undefined && Number.isFinite(product.cobertura_meses)) {
      coverages.push(product.cobertura_meses);
    }
    const classe = product.classe_abc?.trim().toUpperCase();
    if (classe) {
      const current = abc.get(classe) ?? { valor: 0, produtos: 0 };
      current.valor += product.valor_estoque;
      current.produtos += 1;
      abc.set(classe, current);
    }
    if (!hasKnownSaleAge(product)) buckets[4].count += 1;
    else if (product.dias_sem_venda! <= 30) buckets[0].count += 1;
    else if (product.dias_sem_venda! <= 60) buckets[1].count += 1;
    else if (product.dias_sem_venda! <= 90) buckets[2].count += 1;
    else buckets[3].count += 1;
  }

  const idleProducts = products.filter(isIdle);
  return {
    counts,
    idleCapital: idleProducts.reduce((total, product) => total + product.valor_estoque, 0),
    averageKnownCoverageMonths: coverages.length
      ? coverages.reduce((total, value) => total + value, 0) / coverages.length
      : 0,
    knownCoverageCount: coverages.length,
    statusDistribution: STATUS_ORDER.filter(status => counts[status] > 0).map(status => ({ status, count: counts[status] })),
    abcValueDistribution: [...abc.entries()]
      .sort(([a], [b]) => (ABC_ORDER.indexOf(a) === -1 ? 99 : ABC_ORDER.indexOf(a)) - (ABC_ORDER.indexOf(b) === -1 ? 99 : ABC_ORDER.indexOf(b)) || a.localeCompare(b))
      .map(([classe, values]) => ({ classe, ...values })),
    stockVersusSales: [...products]
      .sort((a, b) => b.valor_estoque - a.valor_estoque || a.cod_produto - b.cod_produto || a.empresa.localeCompare(b.empresa))
      .slice(0, 100)
      .map(product => ({
        empresa: product.empresa,
        cod_produto: product.cod_produto,
        produto: product.produto,
        estoque: product.quantidade_estoque,
        vendas: product.total_vendas,
        valor: product.valor_estoque,
      })),
    noSaleBuckets: buckets.filter(bucket => bucket.count > 0),
    idleCapitalRanking: idleProducts
      .sort((a, b) => b.valor_estoque - a.valor_estoque || a.cod_produto - b.cod_produto || a.empresa.localeCompare(b.empresa))
      .slice(0, 10)
      .map(product => ({
        empresa: product.empresa,
        cod_produto: product.cod_produto,
        produto: product.produto,
        valor: product.valor_estoque,
        dias_sem_venda: product.dias_sem_venda,
      })),
  };
}
