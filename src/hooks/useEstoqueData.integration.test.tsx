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
  return renderHook(useEstoqueData, { wrapper: ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  ) });
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

beforeEach(() => { context.filial = 'chevrolet'; });
afterEach(() => { vi.unstubAllGlobals(); });

describe('useEstoqueData integration', () => {
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
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/giro') ? json([movement]) : json({}, 500)));
    const { result } = renderStock();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.consolidadoData).toHaveLength(1);
    expect(result.current.partialSources.consolidado).toBe(true);
    expect(result.current.sourceErrors.consolidado?.message).toContain('500');
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
    fetchMock.mockImplementation(async () => json({}, 504));
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.consolidadoData).toHaveLength(1);
    expect(result.current.partialSources.consolidado).toBe(false);
  });
});
