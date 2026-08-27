import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import {
  buildCotacoesPath,
  buildCotacoesQueryKey,
  CotacoesEndpointError,
  fetchCotacoes,
  useCotacoesAbertas,
} from './useCotacoesComerciais';

vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: vi.fn(),
}));

const filtros = {
  dataIni: '2026-08-01',
  dataFim: '2026-08-31',
};

const empresa = {
  cod_empresa_bi: '1004',
  endpoint_url: 'https://erp.example.test',
};

function mockEmpresaAtiva(overrides: Record<string, unknown> = {}) {
  vi.mocked(useEmpresaAtiva).mockReturnValue({
    empresa: {
      cod_empresa_bi: '1004',
      endpoint_url: 'https://erp.example.test',
      ...overrides,
    },
    codEmpresaAtiva: String(overrides.cod_empresa_bi ?? '1004'),
    isLoading: false,
  } as never);
}

function queryWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('buildCotacoesPath', () => {
  it('monta o endpoint de cotacoes abertas para o 1004', () => {
    expect(buildCotacoesPath('abertas', filtros, '1004')).toBe(
      '/comercial/cotacoes_abertas_ch?data_ini=2026-08-01&data_fim=2026-08-31&cod_empresa_bi=1004',
    );
  });

  it('rejeita empresas fora do grupo Pelegrini', () => {
    expect(() => buildCotacoesPath('perdidas', filtros, '9999')).toThrow(
      'Cotacoes comerciais disponiveis somente para Pelegrini',
    );
  });

  it('mescla filtros obrigatorios em um path configurado que ja possui query string', () => {
    expect(buildCotacoesPath('perdidas', {
      ...filtros,
      codVendedor: '59',
      codCliente: '88',
    }, '1004', '/erp/perdidas?source=erp&cliente=antigo')).toBe(
      '/erp/perdidas?source=erp&cliente=88&data_ini=2026-08-01&data_fim=2026-08-31&vendedor=59&cod_empresa_bi=1004',
    );
  });
});

describe('consultas de cotacoes comerciais', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockEmpresaAtiva();
  });

  it('exposes a retryable integration configuration error when 1004 has no direct endpoint or VPS route', async () => {
    mockEmpresaAtiva({
      endpoint_url: '',
      usar_vps_intermediaria: true,
      vps_cliente_identificador: '',
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, unmount } = renderHook(() => useCotacoesAbertas(filtros), {
      wrapper: queryWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toMatchObject({
      kind: 'configuration',
      message: expect.stringMatching(/configur/i),
    });
    expect(result.current.data).toBeUndefined();

    await act(async () => {
      await result.current.refetch();
    });
    expect(fetchMock).not.toHaveBeenCalled();

    unmount();
    queryClient.clear();
  });

  it('mantem o erro do upstream no hook sem expor lista vazia como resultado valido', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]', {
      status: 200,
      headers: { 'x-proxy-upstream-error': 'true' },
    }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, unmount } = renderHook(() => useCotacoesAbertas(filtros), {
      wrapper: queryWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(CotacoesEndpointError);
    expect(result.current.data).toBeUndefined();

    unmount();
    queryClient.clear();
    fetchMock.mockRestore();
  });

  it('remove uma lista vazia em cache quando o refetch falha no upstream', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ dados: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('[]', {
        status: 200,
        headers: { 'x-proxy-upstream-error': 'true' },
      }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, unmount } = renderHook(() => useCotacoesAbertas(filtros), {
      wrapper: queryWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);

    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(CotacoesEndpointError);
    expect(result.current.data).toBeUndefined();

    unmount();
    queryClient.clear();
    fetchMock.mockRestore();
  });

  it('rejeita a resposta de fallback do upstream em vez de retornar lista vazia', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]', {
      status: 200,
      headers: { 'x-proxy-upstream-error': 'true' },
    }));

    await expect(fetchCotacoes(empresa, 'abertas', filtros)).rejects.toThrow(
      'Cotacoes: falha no upstream',
    );

    fetchMock.mockRestore();
  });

  it('classifica falha de rede sem expor a mensagem bruta do navegador', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchCotacoes(empresa, 'abertas', filtros)).rejects.toMatchObject({
      kind: 'network',
      message: 'Cotacoes: falha de rede ao consultar o ERP',
    });

    fetchMock.mockRestore();
  });

  it('classifica o AbortError do limite de 60 segundos como timeout', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }));
        });
      })
    ));

    const request = fetchCotacoes(empresa, 'abertas', filtros);
    const capturedError = request.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(capturedError).resolves.toMatchObject({
      kind: 'timeout',
      message: 'Cotacoes: tempo limite de 60 segundos excedido',
    });

    fetchMock.mockRestore();
    vi.useRealTimers();
  });

  it('rejeita HTTP sem sucesso e payloads de sucesso malformados', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('indisponivel', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ dados: {} }), { status: 200 }));

    await expect(fetchCotacoes(empresa, 'perdidas', filtros)).rejects.toThrow('Cotacoes: HTTP 503');
    await expect(fetchCotacoes(empresa, 'perdidas', filtros)).rejects.toThrow(
      'Formato inesperado no endpoint de cotacoes',
    );

    fetchMock.mockRestore();
  });

  it('classifica como payload uma linha sem identificador canonico de cotacao', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      dados: [{ CodCotacao: ' \t ', DataCotacao: '2026-08-01', Status: 'ABERTA' }],
    }), { status: 200 }));

    await expect(fetchCotacoes(empresa, 'abertas', filtros)).rejects.toMatchObject({
      kind: 'payload',
      message: 'Cotacoes: payload invalido: Identificador de cotacao ausente',
    });

    fetchMock.mockRestore();
  });

  it('normaliza o alias dados e preserva uma lista vazia como resultado valido', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        dados: [{
          CodCotacao: '9012',
          DataCotacao: '2026-08-01',
          CodCliente: '88',
          NomeCliente: 'OFICINA CENTRAL',
          CodVendedor: '59',
          NomeVendedor: 'ERLAN C.CH',
          ValorTotal: '12.345,67',
          Status: 'ABERTA',
        }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ dados: [] }), { status: 200 }));

    await expect(fetchCotacoes(empresa, 'abertas', filtros)).resolves.toMatchObject([
      { idCotacao: '9012', status: 'aberta', valor: 12_345.67 },
    ]);
    await expect(fetchCotacoes(empresa, 'abertas', filtros)).resolves.toEqual([]);

    fetchMock.mockRestore();
  });

  it('invalidates the cache when any resolver routing field changes', () => {
    expect(buildCotacoesQueryKey('perdidas', empresa, {
      ...filtros,
      codVendedor: '59',
      codCliente: '88',
    }, '/comercial/vendas_perdidas_ch', '1004')).toEqual([
      'cotacoes-comerciais',
      'perdidas',
      'https://erp.example.test',
      false,
      '',
      '',
      '/comercial/vendas_perdidas_ch',
      '2026-08-01',
      '2026-08-31',
      '59',
      '88',
      '1004',
    ]);

    expect(buildCotacoesQueryKey('perdidas', {
      ...empresa,
      usar_vps_intermediaria: true,
      vps_base_url: 'https://vps.example.test',
      vps_cliente_identificador: 'cliente-teste',
    }, filtros, '/comercial/vendas_perdidas_ch')).not.toEqual(
      buildCotacoesQueryKey('perdidas', empresa, filtros, '/comercial/vendas_perdidas_ch'),
    );
  });
});
