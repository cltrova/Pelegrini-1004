import { renderHook } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useComercialProdutos } from './useComercialProdutos';

const context = vi.hoisted(() => ({ filial: 'transmissao' }));

vi.mock('@tanstack/react-query', () => ({
  keepPreviousData: vi.fn(),
  useQuery: vi.fn(() => ({ data: undefined, isLoading: false, isFetching: false })),
}));

vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: () => ({
    empresa: {
      cod_empresa_bi: '1004',
      endpoint_url: 'https://local.test',
      modulo_comercial: true,
    },
    codEmpresaAtiva: '1004',
    isLoading: false,
  }),
}));

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({ filialAtiva: context.filial }),
}));

describe('requisição de produtos do Comercial', () => {
  afterEach(() => {
    context.filial = 'transmissao';
    vi.clearAllMocks();
  });

  it('compartilha a mesma consulta para filtros que só mudam os cálculos locais', () => {
    const periodo = { inicio: '2026-11-01', fim: '2026-11-27' };
    renderHook(() => {
      useComercialProdutos({ periodo });
      useComercialProdutos({ periodo, ignorarEquipePadrao: true, excluirVendedoresOcultos1004: true });
    });
    const keys = vi.mocked(useQuery).mock.calls.map(([query]) => query.queryKey)
      .filter(key => key[0] === 'comercial-produtos');
    expect(keys).toHaveLength(2);
    expect(keys[1]).toEqual(keys[0]);
  });

  it('separa períodos e filiais que mudam a consulta na origem', () => {
    const { rerender } = renderHook(({ fim }) => useComercialProdutos({
      periodo: { inicio: '2026-11-01', fim },
    }), { initialProps: { fim: '2026-11-26' } });
    rerender({ fim: '2026-11-27' });
    context.filial = 'chevrolet';
    rerender({ fim: '2026-11-27' });
    const keys = vi.mocked(useQuery).mock.calls.map(([query]) => query.queryKey)
      .filter(key => key[0] === 'comercial-produtos');
    expect(new Set(keys.map(key => JSON.stringify(key))).size).toBe(3);
  });
});
