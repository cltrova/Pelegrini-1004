import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import EstoquePage from './EstoquePage';
import { payload } from '@/test/estoqueAtualFixture';

vi.mock('@/hooks/useEmpresaAtiva', () => ({useEmpresaAtiva: () => ({empresa: {id: 'ct', cod_empresa_bi: '1004', modulo_operacional: true, endpoint_url: 'https://api.test'}, isLoading: false, codEmpresaAtiva: '1004'})}));
vi.mock('@/contexts/FilialSelecionadaContext', () => ({useFilialSelecionada: () => ({filialAtiva: 'transmissao', codEmpresaContexto: '1004'})}));
vi.mock('@/hooks/useEstoqueData', () => ({useEstoqueData: () => { throw new Error('Estoque atual nao deve consultar recuperacao historica'); }}));
vi.mock('@/integrations/supabase/client', () => ({supabase: {auth: {getSession: async () => ({data: {session: {access_token: 'test-session'}}})}}}));

it('a entrada de estoque CT usa a procedure atual sem depender dos endpoints antigos', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {status: 200})));
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  const {unmount} = render(<QueryClientProvider client={client}><EstoquePage /></QueryClientProvider>);
  await screen.findByRole('heading', {name: 'Estoque atual'});
  expect(await screen.findAllByText('R$ 3.812.529,38')).toHaveLength(2);
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain(encodeURIComponent('/operacional/estoque/atual?cod_empresa_bi=1004'));
  unmount(); client.clear();
});
