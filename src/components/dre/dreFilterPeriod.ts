import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function toDreFilterDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function parseDreFilterDate(value?: string): Date | undefined {
  if (!value) return undefined;

  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;

  return new Date(year, month - 1, day);
}

export function formatDreDate(value?: string, pattern = 'dd/MM/yyyy'): string | undefined {
  const date = parseDreFilterDate(value);
  return date ? format(date, pattern, { locale: ptBR }) : undefined;
}

export function formatDrePeriodoLabel(dataInicio?: string, dataFim?: string): string | null {
  if (!dataInicio && !dataFim) return null;

  const start = dataInicio ? formatDreDate(dataInicio, dataFim ? 'dd/MM' : 'dd/MM/yyyy') : '...';
  const end = dataFim ? formatDreDate(dataFim, 'dd/MM/yyyy') : '...';

  return `${start} \u2013 ${end}`;
}
