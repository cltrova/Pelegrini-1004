const FERIADOS_UBERLANDIA_POR_EMPRESA: Record<string, string[]> = {
  '1004': ['2026-08-31'],
  '10041': ['2026-08-31'],
};

export function getFeriadosComerciaisMeta(codEmpresaBi: string | number | null | undefined, ano: number, mes: number): string[] {
  const codEmpresa = String(codEmpresaBi ?? '').trim();
  const feriados = FERIADOS_UBERLANDIA_POR_EMPRESA[codEmpresa] ?? [];
  const prefixoMes = `${ano}-${String(mes + 1).padStart(2, '0')}`;

  return feriados.filter((data) => data.startsWith(prefixoMes));
}
