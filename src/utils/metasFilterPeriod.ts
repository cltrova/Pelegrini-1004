import type { ComercialFilters } from '@/types/comercial';

export function preservarPeriodoExplicito(
  filters: ComercialFilters | undefined,
  usarPeriodoMesFechado: boolean,
  hoje = new Date(),
): ComercialFilters | undefined {
  if (!filters || !usarPeriodoMesFechado) return filters;

  const inicioExplicito = filters.periodo?.inicio;
  const fimExplicito = filters.periodo?.fim;
  if (inicioExplicito && fimExplicito) return filters;

  const ano = filters.anos?.length === 1 ? Number(filters.anos[0]) : NaN;
  const mes = filters.meses?.length === 1 ? Number(filters.meses[0]) : NaN;
  if (!Number.isFinite(ano) || !Number.isFinite(mes)) return filters;
  if (hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes) return filters;

  return {
    ...filters,
    periodo: {
      inicio: `${ano}-${String(mes).padStart(2, '0')}-01`,
      fim: `${ano}-${String(mes).padStart(2, '0')}-${String(new Date(ano, mes, 0).getDate()).padStart(2, '0')}`,
    },
  };
}

export function getPeriodoReferencia(
  filters: ComercialFilters | undefined,
  fallback: { ultimoAno: string; ultimoMes: string } | null | undefined,
  hoje = new Date(),
) {
  const fim = filters?.periodo?.fim;
  if (fim && /^\d{4}-\d{2}-\d{2}$/.test(fim)) {
    return { ano: Number(fim.slice(0, 4)), mes: Number(fim.slice(5, 7)) };
  }
  if (filters?.anos?.length && filters?.meses?.length) {
    return { ano: Number(filters.anos.at(-1)), mes: Number(filters.meses.at(-1)) };
  }
  if (fallback) return { ano: Number(fallback.ultimoAno), mes: Number(fallback.ultimoMes) };
  return { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
}

export function getMesesDoFiltro(filters: ComercialFilters | undefined): Set<string> | null {
  const inicio = filters?.periodo?.inicio;
  const fim = filters?.periodo?.fim;
  if (inicio && fim && /^\d{4}-\d{2}/.test(inicio) && /^\d{4}-\d{2}/.test(fim)) {
    const cursor = new Date(Number(inicio.slice(0, 4)), Number(inicio.slice(5, 7)) - 1, 1);
    const limite = new Date(Number(fim.slice(0, 4)), Number(fim.slice(5, 7)) - 1, 1);
    const meses = new Set<string>();
    while (cursor <= limite) {
      meses.add(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return meses;
  }

  const anos = filters?.anos ?? [];
  const meses = filters?.meses ?? [];
  if (!anos.length || !meses.length) return null;
  return new Set(anos.flatMap((ano) => meses.map((mes) => `${ano}-${String(Number(mes)).padStart(2, '0')}`)));
}
