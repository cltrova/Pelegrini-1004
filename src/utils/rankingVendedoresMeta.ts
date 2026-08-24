export interface PeriodoFiltroRanking {
  inicio?: string;
  fim?: string;
}

export interface VendedorRankingMetaBase {
  mes?: number;
  meta?: number;
  metaDiaria?: number;
}

export function isPeriodoDiario(periodo?: PeriodoFiltroRanking | null): boolean {
  const inicio = String(periodo?.inicio ?? '').trim();
  const fim = String(periodo?.fim ?? '').trim();
  return !!inicio && !!fim && inicio === fim;
}

export function resolveMetaReferenciaRankingVendedor(
  vendedor: VendedorRankingMetaBase,
  periodo?: PeriodoFiltroRanking | null,
) {
  const faturado = Number(vendedor.mes || 0);
  const usarMetaDiaria = isPeriodoDiario(periodo) && Number(vendedor.metaDiaria || 0) > 0;
  const meta = usarMetaDiaria
    ? Number(vendedor.metaDiaria || 0)
    : Number(vendedor.meta || 0);
  const pctMeta = meta > 0 ? (faturado / meta) * 100 : 0;
  const gap = meta - faturado;

  return {
    meta,
    label: usarMetaDiaria ? 'Meta diária' : 'Meta',
    pctMeta,
    gap,
    isMetaDiaria: usarMetaDiaria,
  };
}
