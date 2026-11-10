import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import EstoquePage from './EstoquePage';

const state = vi.hoisted(() => ({ filial: 'transmissao', codes: [] as string[] }));
vi.mock('@/hooks/useEmpresaAtiva', () => ({useEmpresaAtiva: () => ({empresa: {id: 'ct', cod_empresa_bi: '1004', modulo_operacional: true}, isLoading: false, codEmpresaAtiva: '1004'})}));
vi.mock('@/contexts/FilialSelecionadaContext', () => ({useFilialSelecionada: () => ({filialAtiva: state.filial, codEmpresaContexto: state.filial === 'chevrolet' ? '10041' : '1004'})}));
vi.mock('@/hooks/useEstoqueData', () => ({useEstoqueData: () => {
  state.codes.push(state.filial === 'chevrolet' ? '10041' : '1004');
  return {activeCompanyCode: state.codes.at(-1), consolidadoData: [], detalhadoData: [], giroData: [], isLoading: true, isInitialLoading: true, overviewStatus: 'loading', sourceErrors: {}, sourceStatus: {}, partialSources: {}, recoveredSources: {}, refetch: vi.fn(), empresa: {modulo_operacional: true}};
}}));
vi.mock('@/integrations/supabase/client', () => ({supabase: {auth: {getSession: async () => ({data: {session: {access_token: 'test-session'}}})}}}));

it.each([['transmissao', '1004'], ['chevrolet', '10041']])('abre a mesma visao de estoque para %s com a empresa %s', (filial, code) => {
  state.filial = filial; state.codes = [];
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  const {unmount} = render(<QueryClientProvider client={client}><EstoquePage /></QueryClientProvider>);
  expect(screen.getByRole('status', {name: 'Carregando dados da filial'})).toBeInTheDocument();
  expect(state.codes).toContain(code);
  unmount(); client.clear();
});
