function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

export function isAgraleEstoque10041(record: Record<string, unknown>): boolean {
  const marca = normalizeText(record.marca ?? record.Marca);
  return marca === 'AGRALE' || marca.includes('AGRALE');
}

export function filtrarEstoqueCasaChevrolet10041<T extends Record<string, unknown>>(
  rows: T[],
  codEmpresaAtiva?: string | null,
): T[] {
  const activeCode = String(codEmpresaAtiva ?? '').trim();
  if (activeCode !== '1004' && activeCode !== '10041') return rows;

  return rows.filter((row) => {
    const codBi = String(row.cod_empresa_bi ?? row.CodEmpresa_bi ?? '').trim();
    const companyName = normalizeText(row.empresa ?? row.Empresa);
    const identifiedAsChevrolet = codBi === '10041' || companyName.includes('CHEVROLET');

    if (activeCode === '10041') {
      if (codBi && codBi !== '10041') return false;
      return !isAgraleEstoque10041(row);
    }

    return !identifiedAsChevrolet;
  });
}
