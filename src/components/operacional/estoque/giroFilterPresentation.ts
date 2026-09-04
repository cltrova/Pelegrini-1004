import type { GiroFiltersState, GiroStatus } from '@/types/estoque';

export const GIRO_STATUS_LABELS: Record<GiroStatus, string> = {
  atendendo: 'Atendendo',
  alerta: 'Alerta',
  faltando: 'Faltando',
  excesso: 'Excesso',
};

export function countVisibleGiroFilters(filters: GiroFiltersState): number {
  return Number(filters.periodoMeses !== 3)
    + Number(filters.statusFilter.length > 0)
    + Number(filters.marcas.length > 0)
    + Number(filters.grupos.length > 0);
}

export function summarizeVisibleGiroFilters(filters: GiroFiltersState): string {
  const parts: string[] = [`${filters.periodoMeses} meses`];
  if (filters.statusFilter.length > 0) parts.push(filters.statusFilter.map(status => GIRO_STATUS_LABELS[status]).join(', '));
  if (filters.marcas.length > 0) parts.push(`${filters.marcas.length} marca(s)`);
  if (filters.grupos.length > 0) parts.push(`${filters.grupos.length} grupo(s)`);
  return parts.join(' · ');
}
