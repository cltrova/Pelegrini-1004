import { describe, expect, it } from 'vitest';

import type { GiroFiltersState } from '@/types/estoque';

import { countVisibleGiroFilters, summarizeVisibleGiroFilters } from './giroFilterPresentation';

const filters: GiroFiltersState = {
  periodoMeses: 3,
  statusFilter: [],
  empresas: ['RAZAO SOCIAL QUE NAO DEVE APARECER'],
  marcas: [],
  grupos: [],
  searchTerm: '',
};

describe('giroFilterPresentation', () => {
  it('ignora empresa na contagem e no resumo visual', () => {
    expect(countVisibleGiroFilters(filters)).toBe(0);
    expect(summarizeVisibleGiroFilters(filters)).toBe('3 meses');
  });

  it('resume somente status, marca, grupo e periodo aplicados', () => {
    const applied: GiroFiltersState = {
      ...filters,
      statusFilter: ['alerta'],
      marcas: ['ZF'],
      grupos: ['TRANSMISSAO'],
    };

    expect(countVisibleGiroFilters(applied)).toBe(3);
    expect(summarizeVisibleGiroFilters(applied)).toBe('3 meses · Alerta · 1 marca(s) · 1 grupo(s)');
  });
});
