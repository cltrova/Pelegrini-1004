type StockIdentityRecord = {
  cod_empresa_bi?: number | string | null;
  cod_empresa?: number | string | null;
  empresa?: string | null;
  cod_produto: number | string;
};

function normalizedName(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

export function stockProductIdentity(record: StockIdentityRecord): string {
  const biCode = String(record.cod_empresa_bi ?? '').trim();
  const companyCode = String(record.cod_empresa ?? '').trim();
  const branchIdentity = biCode && biCode !== '0'
    ? `bi:${biCode}`
    : companyCode && companyCode !== '0'
      ? `empresa:${companyCode}`
      : `nome:${normalizedName(record.empresa) || 'DESCONHECIDA'}`;

  return `${branchIdentity}::produto:${String(record.cod_produto).trim()}`;
}
