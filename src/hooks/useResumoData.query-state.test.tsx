import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useResumoData } from './useResumoData';

const download = vi.hoisted(() => vi.fn());

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: () => ({
    codEmpresaAtiva: '1004',
    empresa: { json_path_resumo: 'storage:resumo.json' },
  }),
}));

vi.mock('@/contexts/FinanceiroSearchContext', () => ({
  useFinanceiroSearch: () => ({ hasSearched: true }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: () => ({ download }),
    },
  },
}));

function wrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

function resumoBlob(id: string) {
  return {
    text: async () => JSON.stringify([{ Id: id, TipoOrigem: 'DUPLICATA' }]),
  } as Blob;
}

describe('useResumoData query state', () => {
  beforeEach(() => {
    download.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('separates a cached-data refetch from blocking initial loading', async () => {
    download.mockResolvedValueOnce({ data: resumoBlob('cached'), error: null });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useResumoData(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.records).toHaveLength(1));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);

    let finishRefetch: ((value: { data: Blob; error: null }) => void) | undefined;
    download.mockImplementationOnce(() => new Promise((resolve) => {
      finishRefetch = resolve;
    }));

    act(() => {
      void result.current.refetch();
    });

    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.records).toHaveLength(1);

    finishRefetch?.({ data: resumoBlob('fresh'), error: null });
    await waitFor(() => expect(result.current.isFetching).toBe(false));
  });
});
