import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { defaultStockPageQuery, type StockPageQuery } from '@/components/operacional/estoque/stockPagedApi';
import { estoqueFixtureComTresItens, giroFixture } from '@/components/operacional/estoque/estoqueFixtures';
const context = vi.hoisted(() => ({ filial: 'chevrolet' }));
vi.mock('@/hooks/useEmpresaAtiva', () => ({ useEmpresaAtiva: () => ({ empresa: { cod_empresa_bi: '1004', modulo_operacional: true, vps_cliente_identificador: 'pelegrini' }, codEmpresaAtiva: '1004', isLoading: false }) }));
vi.mock('@/contexts/FilialSelecionadaContext', () => ({ useFilialSelecionada: () => ({ filialAtiva: context.filial }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock('@/utils/apiEndpointResolver', () => ({ buildApiProxyUrl: (_: unknown, path: string) => `https://api.test${path}` }));
import { useEstoqueData } from './useEstoqueData';
afterEach(() => { vi.unstubAllGlobals(); context.filial = 'chevrolet'; });
const version = { release: 'pelegrini-estoque-colunas-20261109-r15', formatos_estoque: ['pagina'], ordenacoes_adicionais: ['grupo_marca_produto'], filtros_coluna: { multipla: ['grupo', 'marca', 'filial', 'localizacao', 'situacao'] } };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

it('uses global API filters and page totals, cancels stale requests and isolates company changes', async () => {
  const calls: { url: URL; signal?: AbortSignal }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input); calls.push({ url, signal: init?.signal as AbortSignal });
    if (url.pathname.endsWith('/versao')) return json(version);
    const company = Number(url.searchParams.get('cod_empresa_bi'));
    const row = { ...estoqueFixtureComTresItens[0], cod_empresa_bi: company, cod_empresa: company === 1004 ? 1 : 2, empresa: company === 1004 ? 'CT' : 'CHEVROLET', quantidade_consolidada: 7, valor_estoque_consolidado: 100, custo_medio_consolidado: 100 / 7, situacao: 'critical' };
    return json({ ...version, cod_empresa_bi: company, cod_empresas: company === 1004 ? [1] : [2, 3], pagina: Number(url.searchParams.get('pagina')), tamanho_pagina: 50, total_paginas: 2, total_itens: 70, total_registros: 140, totais: { quantidade_estoque: 900, valor_estoque: 10000 }, opcoes: { marcas: ['ZF'], grupos: ['MOTOR'], linhas: [] }, itens: [row, ...(company === 10041 ? [{ ...row, cod_empresa: 3 }] : [])] });
  }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const query: StockPageQuery = { ...defaultStockPageQuery(), groups: ['MOTOR'], columnFilters: { quantity: { min: '5' } } };
  const view = renderHook(({ filters }) => useEstoqueData(3, 'central', undefined, 'consolidado', filters), { initialProps: { filters: query }, wrapper: ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  await waitFor(() => expect(view.result.current.stockPage?.total_itens).toBe(70));
  expect(view.result.current.consolidadoData).toHaveLength(1);
  expect(view.result.current.consolidadoData[0].quantidade_estoque).toBe(7);
  const first = calls.find(call => call.url.searchParams.get('formato') === 'pagina')!;
  expect(first.url.searchParams.get('grupo')).toBe('MOTOR'); expect(first.url.searchParams.get('quantidade_min')).toBe('5');
  expect(first.signal).toBeInstanceOf(AbortSignal);
  view.rerender({ filters: { ...query, page: 2 } });
  await waitFor(() => expect(view.result.current.stockPage?.pagina).toBe(2));
  context.filial = 'transmissao'; view.rerender({ filters: defaultStockPageQuery() });
  expect(view.result.current.consolidadoData.every(row => row.cod_empresa_bi === 1004)).toBe(true);
  await waitFor(() => expect(view.result.current.consolidadoData[0]?.cod_empresa_bi).toBe(1004));
  expect(calls.every(call => call.url.pathname.endsWith('/versao') || call.url.searchParams.get('formato') === 'pagina')).toBe(true);
});

it('fails closed when capabilities cannot be read instead of downloading legacy stock or rebuilding giro', async () => {
  const fetcher = vi.fn(async (_input: string) => json({}, 503)); vi.stubGlobal('fetch', fetcher);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const { result } = renderHook(() => useEstoqueData(3, 'central'), { wrapper: ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  await waitFor(() => expect(result.current.sourceErrors.consolidado).toBeTruthy());
  expect(result.current.consolidadoData).toEqual([]);
  expect(fetcher).toHaveBeenCalled();
  expect(fetcher.mock.calls.every(call => String(call[0]).includes('/fontes/versao'))).toBe(true);
});

it('retries capabilities before requesting any page after a version failure', async () => {
  const calls: string[] = []; let versions = 0;
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    calls.push(input);
    if (input.includes('/fontes/versao')) return ++versions === 1 ? json({}, 503) : json(version);
    return json({ release: version.release, cod_empresa_bi: 10041, cod_empresas: [2, 3], pagina: 1, total_itens: 0, total_registros: 0, total_paginas: 0, tamanho_pagina: 50, totais: {}, opcoes: { marcas: [], grupos: [], linhas: [] }, itens: [] });
  }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const { result } = renderHook(() => useEstoqueData(3, 'central'), { wrapper: ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  await waitFor(() => expect(result.current.sourceErrors.consolidado).toBeTruthy());
  await act(async () => { await result.current.refetch(); });
  await waitFor(() => expect(result.current.stockPage?.total_itens).toBe(0));
  expect(versions).toBe(2); expect(calls[1]).toContain('/fontes/versao');
  expect(new URL(calls[2]).searchParams.get('ordem')).toBe('grupo_marca_produto');
  expect(result.current.sourceErrors.consolidado).toBeNull();
});

it('does not replace a failed filtered page with cached giro or recovery rows', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: string) => input.includes('/fontes/versao') ? json(version) : json({}, 503)));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const cached = { ...giroFixture[0], cod_empresa_bi: 10041, cod_empresa: 2, empresa: 'CHEVROLET' };
  client.setQueryData(['estoque-giro', '10041'], [cached]);
  client.setQueryData(['estoque-recuperacao', '10041'], [cached]);
  const { result } = renderHook(() => useEstoqueData(3, 'central', undefined, 'consolidado', { ...defaultStockPageQuery(), columnFilters: { quantity: { min: '999999' } } }), { wrapper: ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  await waitFor(() => expect(result.current.sourceErrors.consolidado).toBeTruthy());
  expect(result.current.consolidadoData).toEqual([]);
  expect(result.current.partialSources.consolidado).toBe(false);
  expect(result.current.recoveredSources.consolidado).toBe(false);
});
