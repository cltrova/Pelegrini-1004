import { describe, expect, it } from 'vitest';
import { formatDrePeriodoLabel, parseDreFilterDate, toDreFilterDate } from './dreFilterPeriod';

describe('DRE period helpers', () => {
  it('keeps filter dates in local YYYY-MM-DD format', () => {
    const date = new Date(2026, 6, 30);

    expect(toDreFilterDate(date)).toBe('2026-07-30');
    expect(parseDreFilterDate('2026-07-30')?.getFullYear()).toBe(2026);
    expect(parseDreFilterDate('2026-07-30')?.getMonth()).toBe(6);
    expect(parseDreFilterDate('2026-07-30')?.getDate()).toBe(30);
  });

  it('formats a selected range like the finance filter trigger', () => {
    expect(formatDrePeriodoLabel('2026-07-01', '2026-07-30')).toBe('01/07 \u2013 30/07/2026');
  });

  it('formats a partial selected range without losing the chosen side', () => {
    expect(formatDrePeriodoLabel('2026-07-01', undefined)).toBe('01/07/2026 \u2013 ...');
    expect(formatDrePeriodoLabel(undefined, '2026-07-30')).toBe('... \u2013 30/07/2026');
  });
});
