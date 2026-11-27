import type { DreRecord } from '@/types/dre';

export async function loadLocalDreData(): Promise<DreRecord[]> {
  const { default: data } = await import('./dreData.json');
  return data as DreRecord[];
}
