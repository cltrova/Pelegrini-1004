import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import VisitasGerenciaPage from './VisitasGerenciaPage';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'gerente-portal' } }) }));
vi.mock('@/contexts/FilialSelecionadaContext', () => ({ useFilialSelecionada: () => ({ filialAtiva: 'chevrolet' }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'token-do-portal', user: { id: 'gerente-portal' } } } }) } },
}));

afterEach(() => vi.unstubAllGlobals());

it('abre a gerência com a sessão do Comercial e consulta a filial ativa', async () => {
  const fetcher = vi.fn(async (url: string, _init: RequestInit) => url.endsWith('/sessao')
    ? Response.json({ id: 'gerente-portal', nome: 'Gerente', perfil: 'gerencial', filiais: [
      { cod_empresa_bi: '1004', filial_id: 'transmissao' }, { cod_empresa_bi: '10041', filial_id: 'chevrolet' },
    ] })
    : Response.json({ relatorios: [], total: 0 }));
  vi.stubGlobal('fetch', fetcher);
  render(<QueryClientProvider client={new QueryClient()}><VisitasGerenciaPage /></QueryClientProvider>);

  expect(await screen.findByText('Nenhum relatório encontrado.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Entrar no sistema' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Sair', exact: true })).not.toBeInTheDocument();
  const calls = fetcher.mock.calls;
  expect(calls).toHaveLength(2);
  for (const [, init] of calls) {
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token-do-portal');
    expect(init.credentials).toBe('omit');
  }
  const params = new URL(calls[1][0], 'http://localhost').searchParams;
  expect([params.get('escopo'), params.get('cod_empresa_bi'), params.get('filial_id')]).toEqual(['gerencia', '10041', 'chevrolet']);
});
