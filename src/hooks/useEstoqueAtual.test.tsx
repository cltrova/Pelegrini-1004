import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Empresa } from './useEmpresaConfig';
import { payload } from '@/test/estoqueAtualFixture';
import { fetchEstoqueAtual, useEstoqueAtual } from './useEstoqueAtual';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'test-session' } } }) } },
}));

const empresa = { cod_empresa_bi: '1004', modulo_operacional: true, usar_vps_intermediaria: true,
  vps_base_url: 'http://187.77.203.16', vps_cliente_identificador: 'pelegrini',
  json_path_estoque_consolidado: 'storage:estoque-antigo.json' } as Empresa;

beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {status: 200}))));

describe('consulta do estoque atual', () => {
  it('consulta o novo endpoint pela configuracao real sem datas ou arquivo historico', async () => {
    const report = await fetchEstoqueAtual(empresa);
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    const params = new URL(String(url), 'https://local.test').searchParams;
    expect(params.get('endpoint')).toBe('http://187.77.203.16');
    expect(params.get('path')).toBe('/pelegrini/operacional/estoque/atual?cod_empresa_bi=1004');
    expect(options?.cache).toBe('no-store');
    expect(report.stockTotal).toBe(3812529.3842);
  });
  it.each([503, 504])('mostra falha HTTP %s em vez de estoque zero', async status => {
    vi.mocked(fetch).mockResolvedValue(new Response('[]', {status}));
    await expect(fetchEstoqueAtual(empresa)).rejects.toThrow();
  });
  it('rejeita fallback vazio do proxy mesmo com HTTP 200', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('[]', {status: 200, headers: {'x-proxy-upstream-error': 'true'}}));
    await expect(fetchEstoqueAtual(empresa)).rejects.toThrow();
  });
  it('atualizar faz nova leitura SQL e muda os totais apresentados', async () => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    const wrapper = ({children}: {children: ReactNode}) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const {result, unmount} = renderHook(() => useEstoqueAtual(empresa, true), {wrapper});
    await waitFor(() => expect(result.current.data?.stockTotal).toBe(3812529.3842));
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({...payload, totais_estoque: {...payload.totais_estoque, ValorEstoque: 4000000}}), {status: 200}));
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.data?.stockTotal).toBe(4000000));
    unmount(); client.clear();
  });
  it('nao consulta CT quando outra filial esta selecionada', async () => {
    const client = new QueryClient();
    const wrapper = ({children}: {children: ReactNode}) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const {unmount} = renderHook(() => useEstoqueAtual(empresa, false), {wrapper});
    expect(fetch).not.toHaveBeenCalled();
    unmount(); client.clear();
  });
});
