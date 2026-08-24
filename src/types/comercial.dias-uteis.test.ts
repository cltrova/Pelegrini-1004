import { describe, expect, it } from 'vitest';
import { getDiasUteisDecorridos, getDiasUteisNoMes } from './comercial';
import { getFeriadosComerciaisMeta } from '@/utils/feriadosComerciais';

describe('dias uteis comerciais', () => {
  it('mantem a contagem padrao sem feriados cadastrados', () => {
    expect(getDiasUteisNoMes(2026, 7)).toBe(21);
  });

  it('desconta o feriado local de Uberlandia em agosto de 2026 para Pelegrini', () => {
    const feriados = getFeriadosComerciaisMeta('1004', 2026, 7);

    expect(feriados).toEqual(['2026-08-31']);
    expect(getDiasUteisNoMes(2026, 7, feriados)).toBe(20);
    expect(getDiasUteisDecorridos(2026, 7, 31, feriados)).toBe(20);
  });

  it('nao aplica o feriado de Uberlandia em empresas fora do contexto Pelegrini', () => {
    expect(getFeriadosComerciaisMeta('1001', 2026, 7)).toEqual([]);
  });
});
