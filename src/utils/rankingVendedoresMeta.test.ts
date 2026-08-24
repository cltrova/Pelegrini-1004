import { describe, expect, it } from 'vitest';
import {
  isPeriodoDiario,
  resolveMetaReferenciaRankingVendedor,
} from './rankingVendedoresMeta';

describe('rankingVendedoresMeta', () => {
  it('usa meta diaria no tooltip quando o filtro tem um unico dia', () => {
    const row = {
      mes: 14_076.77,
      meta: 200_000,
      metaDiaria: 9_523.81,
    };

    const referencia = resolveMetaReferenciaRankingVendedor(row, {
      inicio: '2026-08-14',
      fim: '2026-08-14',
    });

    expect(referencia.meta).toBe(9_523.81);
    expect(referencia.label).toBe('Meta diária');
    expect(referencia.pctMeta).toBeCloseTo(147.806, 3);
    expect(referencia.gap).toBeCloseTo(-4_552.96, 2);
  });

  it('mantem meta mensal quando o filtro tem mais de um dia', () => {
    const row = {
      mes: 43_233.60,
      meta: 200_000,
      metaDiaria: 9_523.81,
    };

    const referencia = resolveMetaReferenciaRankingVendedor(row, {
      inicio: '2026-08-01',
      fim: '2026-08-14',
    });

    expect(referencia.meta).toBe(200_000);
    expect(referencia.label).toBe('Meta');
    expect(referencia.pctMeta).toBeCloseTo(21.6168, 4);
  });

  it('identifica periodo diario somente quando inicio e fim sao iguais', () => {
    expect(isPeriodoDiario({ inicio: '2026-08-14', fim: '2026-08-14' })).toBe(true);
    expect(isPeriodoDiario({ inicio: '2026-08-01', fim: '2026-08-14' })).toBe(false);
    expect(isPeriodoDiario(undefined)).toBe(false);
  });
});
