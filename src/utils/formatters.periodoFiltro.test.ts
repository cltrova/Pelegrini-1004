import { describe, expect, it } from 'vitest';
import { formatFiltroPeriodoLabel } from './formatters';

describe('formatFiltroPeriodoLabel', () => {
  it('mostra dia unico quando inicio e fim sao iguais', () => {
    expect(formatFiltroPeriodoLabel(
      { inicio: '2026-08-18', fim: '2026-08-18' },
      { ano: 2026, mes: 8 },
    )).toBe('Dia filtrado: 18/08/2026');
  });

  it('mostra mes inteiro quando o periodo cobre todo o mes', () => {
    expect(formatFiltroPeriodoLabel(
      { inicio: '2026-08-01', fim: '2026-08-31' },
      { ano: 2026, mes: 8 },
    )).toBe('Mês filtrado: Agosto de 2026');
  });

  it('mostra intervalo quando o periodo e parcial', () => {
    expect(formatFiltroPeriodoLabel(
      { inicio: '2026-08-01', fim: '2026-08-18' },
      { ano: 2026, mes: 8 },
    )).toBe('Período filtrado: 01/08/2026 a 18/08/2026');
  });
});
