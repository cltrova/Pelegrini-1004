import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { estoqueFixture, giroFixture } from '@/components/operacional/estoque/estoqueFixtures';

const context = vi.hoisted(() => ({ filial: 'chevrolet' }));
vi.mock('@/hooks/useEmpresaAtiva', () => ({ useEmpresaAtiva: () => ({
  empresa: { cod_empresa_bi: '1004', modulo_operacional: true, endpoint_url: 'https://api.test',
    endpoint_path_estoque_consolidado: '/consolidado', endpoint_path_estoque_detalhado: '/detalhado',
    endpoint_path_estoque_giro: '/giro' },
  codEmpresaAtiva: '1004', isLoading: false,
}) }));
vi.mock('@/contexts/FilialSelecionadaContext', () => ({ useFilialSelecionada: () => ({ filialAtiva: context.filial }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock('@/utils/apiEndpointResolver', () => ({ buildApiProxyUrl: (_: unknown, path: string) => `https://api.test${path}` }));

import { useEstoqueData } from './useEstoqueData';

function renderStock() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const rendered = renderHook(useEstoqueData, { wrapper: ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  ) });
  return { ...rendered, client };
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

beforeEach(() => { context.filial = 'chevrolet'; });
afterEach(() => { vi.unstubAllGlobals(); });

describe('useEstoqueData integration', () => {
  it('reports every successful source as ready and exposes the latest successful update', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => json(url.includes('/giro')
      ? [{ ...giroFixture[0], cod_empresa_bi: 10041, empresa: 'CASA DO CHEVROLET' }]
      : [{ ...estoqueFixture[0], cod_empresa_bi: 10041 }])));

    const { result, rerender, client } = renderStock();

    expect(result.current.lastSuccessfulUpdate).toBeNull();
    expect(result.current.sourceStatus).toEqual({
      consolidado: 'loading',
      detalhado: 'loading',
      giro: 'loading',
    });

    await waitFor(() => expect(result.current.sourceStatus).toEqual({
      consolidado: 'ready',
      detalhado: 'ready',
      giro: 'ready',
    }));
    expect(result.current.lastSuccessfulUpdate).toBeInstanceOf(Date);
    const latestDataUpdatedAt = Math.max(
      client.getQueryState(['estoque-consolidado', '10041'])?.dataUpdatedAt ?? 0,
      client.getQueryState(['estoque-detalhado', '10041'])?.dataUpdatedAt ?? 0,
      client.getQueryState(['estoque-giro', '10041'])?.dataUpdatedAt ?? 0,
    );
    expect(result.current.lastSuccessfulUpdate?.getTime()).toBe(latestDataUpdatedAt);

    const stableUpdate = result.current.lastSuccessfulUpdate;
    rerender();
    expect(result.current.lastSuccessfulUpdate).toBe(stableUpdate);
  });

  it('keeps healthy sources ready when one source fails without usable data', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/detalhado')
      ? json({}, 500)
      : json(url.includes('/giro') ? [] : [{ ...estoqueFixture[0], cod_empresa_bi: 10041 }])));

    const { result } = renderStock();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sourceStatus).toEqual({
      consolidado: 'ready',
      detalhado: 'error',
      giro: 'ready',
    });
  });

  it('libera a Central quando o consolidado termina sem esperar detalhado e giro', async () => {
    let releaseSecondary!: () => void;
    const secondaryGate = new Promise<void>((resolve) => { releaseSecondary = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/consolidado')) return json([{ ...estoqueFixture[0], cod_empresa_bi: 10041 }]);
      await secondaryGate;
      return json([]);
    }));

    const { result } = renderStock();
    await waitFor(() => expect(result.current.consolidadoData).toHaveLength(1));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.sourceStatus.consolidado).toBe('ready');
    expect(result.current.sourceStatus.detalhado).toBe('loading');
    expect(result.current.sourceStatus.giro).toBe('loading');

    releaseSecondary();
  });

  it('exposes HTTP 504 instead of treating failure as zero stock, and supports retry', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => json({}, 504));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderStock();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(true);
    expect(result.current.sourceErrors.consolidado?.message).toContain('504');
    expect(fetchMock.mock.calls.every(([url]) => new URL(url).searchParams.get('cod_empresa_bi') === '10041')).toBe(true);
    fetchMock.mockImplementation(async () => json([]));
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.isError).toBe(false));
  });

  it('preserves a successful empty stock response without substituting movement data', async () => {
    const movement = { ...giroFixture[0], cod_empresa_bi: 10041, empresa: 'CASA DO CHEVROLET' };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => json(url.includes('/giro') ? [movement] : [])));
    const { result } = renderStock();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.giroData).toHaveLength(1);
    expect(result.current.consolidadoData).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  it('identifies stock recovered from giro as partial when the primary source fails', async () => {
    const movement = { ...giroFixture[0], cod_empresa_bi: 10041, empresa: 'CASA DO CHEVROLET' };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('data_ini=2000-01-01')) return json({}, 500);
      return url.includes('/giro') ? json([movement]) : json({}, 500);
    }));
    const { result } = renderStock();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.consolidadoData).toHaveLength(1);
    expect(result.current.partialSources.consolidado).toBe(true);
    expect(result.current.sourceErrors.consolidado?.message).toContain('500');
    expect(result.current.sourceStatus).toEqual({
      consolidado: 'ready',
      detalhado: 'ready',
      giro: 'ready',
    });
  });

  it('replaces the partial window with operational stock recovered from complete history', async () => {
    const recentMovement = {
      ...giroFixture[0],
      cod_empresa_bi: 10041,
      empresa: 'CASA DO CHEVROLET',
      cod_produto: 101,
      data_movimento: '2026-08-20T00:00:00',
    };
    const oldStock = {
      ...recentMovement,
      cod_produto: 202,
      data_movimento: '2024-01-10T00:00:00',
      quantidade_estoque: 7,
    };

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/consolidado') || url.includes('/detalhado')) return json({}, 500);
      if (url.includes('data_ini=2000-01-01')) return json([recentMovement, oldStock]);
      return json([recentMovement]);
    }));

    const { result } = renderStock();

    await waitFor(() => expect(result.current.recoveredSources.consolidado).toBe(true));
    expect(result.current.consolidadoData.map((row) => row.cod_produto)).toEqual([101, 202]);
    expect(result.current.partialSources.consolidado).toBe(false);
    expect(result.current.recoveryStatus).toBe('ready');
    expect(result.current.sourceLastUpdated.consolidado).toBeInstanceOf(Date);
  });

  it('recovers CCH from the shared giro payload when the API omits cod_empresa_bi', async () => {
    const sharedMovement = {
      ...giroFixture[0],
      cod_empresa_bi: null,
      empresa: 'CASA DA TRANSMISSAO MOTORES E PECAS LTDA',
      marca: 'MWM',
    };

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/consolidado') || url.includes('/detalhado')) return json({}, 500);
      return json([sharedMovement]);
    }));

    const { result } = renderStock();

    await waitFor(() => expect(result.current.recoveredSources.consolidado).toBe(true));
    expect(result.current.consolidadoData).toEqual([
      expect.objectContaining({ cod_empresa_bi: 10041, cod_produto: sharedMovement.cod_produto }),
    ]);
  });

  it('does not use CT movements as CCH fallback', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/giro')
      ? json([{ ...giroFixture[0], cod_empresa_bi: 1004, empresa: 'CASA DA TRANSMISSAO' }]) : json({}, 504)));
    const { result } = renderStock();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.consolidadoData).toEqual([]);
    expect(result.current.giroData).toEqual([]);
    expect(result.current.isError).toBe(true);
  });

  it('keeps available stock when only movement loading fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/giro') ? json({}, 504)
      : json([{ ...estoqueFixture[0], cod_empresa_bi: 10041 }])));
    const { result } = renderStock();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.consolidadoData).toHaveLength(1);
    expect(result.current.sourceErrors.consolidado).toBeNull();
    expect(result.current.sourceErrors.giro?.message).toContain('504');
  });

  it('rejects a proxy failure disguised as an empty HTTP 200 response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', {
      status: 200, headers: { 'x-proxy-upstream-error': 'true' },
    })));
    const { result } = renderStock();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(true);
    expect(result.current.sourceErrors.consolidado?.message).toContain('proxy');
  });

  it('keeps previously loaded stock if its refresh fails', async () => {
    const fetchMock = vi.fn(async () => json([{ ...estoqueFixture[0], cod_empresa_bi: 10041 }]));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderStock();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => { releaseRefresh = resolve; });
    fetchMock.mockImplementation(async () => {
      await refreshGate;
      return json({}, 504);
    });
    let refetchPromise: ReturnType<typeof result.current.refetch> | undefined;
    act(() => { refetchPromise = result.current.refetch(); });
    await waitFor(() => expect(result.current.sourceStatus).toEqual({
      consolidado: 'fetching',
      detalhado: 'fetching',
      giro: 'fetching',
    }));
    await act(async () => {
      releaseRefresh();
      await refetchPromise;
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.consolidadoData).toHaveLength(1);
    expect(result.current.partialSources.consolidado).toBe(false);
    expect(result.current.sourceStatus).toEqual({
      consolidado: 'ready',
      detalhado: 'ready',
      giro: 'ready',
    });
  });
});
