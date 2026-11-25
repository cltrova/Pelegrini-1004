import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import VisitasGerenciaPage from './VisitasGerenciaPage';

const contexto = vi.hoisted(() => ({ filialAtiva: 'chevrolet' }));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'gerente-portal' } }) }));
vi.mock('@/contexts/FilialSelecionadaContext', () => ({ useFilialSelecionada: () => contexto }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'token-do-portal', user: { id: 'gerente-portal' } } } }) } },
}));

afterEach(() => {
  contexto.filialAtiva = 'chevrolet';
  vi.unstubAllGlobals();
});

it('consulta a Chevrolet em largura integral, com os filtros no topo e sem cabeçalho', async () => {
  const fetcher = vi.fn(async (url: string, _init: RequestInit) => url.endsWith('/sessao')
    ? Response.json({ id: 'gerente-portal', nome: 'Gerente', perfil: 'gerencial', filiais: [
      { cod_empresa_bi: '1004', filial_id: 'transmissao' }, { cod_empresa_bi: '10041', filial_id: 'chevrolet' },
    ] })
    : Response.json({ relatorios: [], total: 0 }));
  vi.stubGlobal('fetch', fetcher);
  render(<QueryClientProvider client={new QueryClient()}><VisitasGerenciaPage /></QueryClientProvider>);

  expect(await screen.findByText('Nenhum relatório encontrado.')).toBeVisible();
  const area = screen.getByRole('region', { name: 'Conteúdo dos relatórios de visitas' });
  const filtros = screen.getByRole('region', { name: 'Filtros de visitas' });
  const resultados = screen.getByRole('region', { name: 'Resultados dos relatórios de visitas' });
  expect(area).toHaveClass('w-full', 'md:flex-1');
  expect(area.querySelector('.max-w-6xl')).toBeNull();
  expect(filtros).toContainElement(screen.getByRole('button', { name: 'Filtros' }));
  expect(filtros).toContainElement(screen.getByText('0 relatórios'));
  expect(filtros.compareDocumentPosition(resultados) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(resultados).toContainElement(screen.getByText('Nenhum relatório encontrado.'));
  expect(screen.queryByRole('heading', { name: 'Relatórios de visitas' })).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: 'Filial' })).not.toBeInTheDocument();
  expect(screen.queryByText('Casa da Chevrolet')).not.toBeInTheDocument();
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

it('redireciona da Transmissão sem consultar a API de visitas', async () => {
  contexto.filialAtiva = 'transmissao';
  const fetcher = vi.fn(async () => Response.json({ relatorios: [], total: 0 }));
  vi.stubGlobal('fetch', fetcher);
  render(<QueryClientProvider client={new QueryClient()}>
    <MemoryRouter initialEntries={['/comercial/visitas']}>
      <Routes>
        <Route path="/comercial/visitas" element={<VisitasGerenciaPage />} />
        <Route path="/comercial/dashboard" element={<span>Dashboard Comercial</span>} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>);

  expect(await screen.findByText('Dashboard Comercial')).toBeVisible();
  expect(fetcher).not.toHaveBeenCalled();
});
