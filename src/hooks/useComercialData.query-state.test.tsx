import { useQuery } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useComercialData } from './useComercialData';

vi.mock('@tanstack/react-query', () => ({
  keepPreviousData: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: () => ({
    codEmpresaAtiva: '1004',
    empresa: null,
    isLoading: false,
    isMaster: false,
  }),
}));

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({ filialAtiva: null, filialNome: null }),
}));

describe('useComercialData query state', () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReturnValue({
      data: { pedidos: [], devolucoes: [] },
      error: null,
      isFetching: true,
      isLoading: false,
    } as ReturnType<typeof useQuery>);
  });

  it('expoe o isFetching da query comercial preservando o loading inicial separado', () => {
    const { result } = renderHook(() => useComercialData());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(true);
  });
});
