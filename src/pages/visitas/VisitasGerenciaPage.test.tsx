import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

it('consulta a Transmissão quando é a filial ativa e autorizada', async () => {
  contexto.filialAtiva = 'transmissao';
  const fetcher = vi.fn(async (url: string, _init: RequestInit) => url.endsWith('/sessao')
    ? Response.json({ id: 'gerente-portal', nome: 'Gerente', perfil: 'gerencial', filiais: [
      { cod_empresa_bi: '1004', filial_id: 'transmissao' },
    ] })
    : Response.json({ relatorios: [], total: 0 }));
  vi.stubGlobal('fetch', fetcher);
  render(<QueryClientProvider client={new QueryClient()}><VisitasGerenciaPage /></QueryClientProvider>);

  expect(await screen.findByText('Nenhum relatório encontrado.')).toBeVisible();
  const params = new URL(fetcher.mock.calls[1][0], 'http://localhost').searchParams;
  expect([params.get('escopo'), params.get('cod_empresa_bi'), params.get('filial_id')]).toEqual(['gerencia', '1004', 'transmissao']);
});

it('busca oficinas na filial ativa, separa os status e aplica os filtros de localidade e CNPJ', async () => {
  const fetcher = vi.fn(async (url: string, _init: RequestInit) => {
    if (url.endsWith('/sessao')) return Response.json({
      id: 'gerente-portal', nome: 'Gerente', perfil: 'gerencial', filiais: [{ cod_empresa_bi: '10041', filial_id: 'chevrolet' }],
    });
    if (!url.includes('/oficinas?')) return Response.json({ relatorios: [], total: 0 });
    const params = new URL(url, 'http://localhost').searchParams;
    const catalogo = { uf: 'MG', cidade: 'Uberlândia', competencia: '2026-11', fonte: 'https://dados.gov.br/' };
    const visitada = {
      id: '01234567000189', cnpj: '01234567000189', nome: 'Oficina Visitada',
      bairro: 'Centro', status: 'visitada', ultima_visita: '2026-11-25', origem: 'receita',
    };
    const semVisita = {
      id: '01012345000199', cnpj: '01012345000199', nome: 'Oficina Horizonte',
      bairro: 'Martins', status: 'sem_visita', ultima_visita: null, origem: 'receita',
    };
    const oficinas = params.get('status') === 'sem_visita' ? [semVisita] : [visitada, semVisita];
    return Response.json({ catalogo, oficinas, total: oficinas.length });
  });
  vi.stubGlobal('fetch', fetcher);
  render(<QueryClientProvider client={new QueryClient()}><VisitasGerenciaPage /></QueryClientProvider>);

  expect(await screen.findByText('Nenhum relatório encontrado.')).toBeVisible();
  expect(fetcher.mock.calls.some(([url]) => url.includes('/oficinas?'))).toBe(false);
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Oficinas' }), { button: 0, ctrlKey: false });
  const row = await screen.findByRole('row', { name: /Oficina Visitada/ });
  expect(within(row).getByText('25/11/2026')).toBeVisible();
  expect(within(row).getByText('01.234.567/0001-89')).toBeVisible();
  expect(screen.getByText(/Uberlândia.*MG/)).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: 'Sem visita registrada', exact: true }));
  await waitFor(() => expect(screen.queryByRole('row', { name: /Oficina Visitada/ })).not.toBeInTheDocument());
  expect(await screen.findByRole('row', { name: /Oficina Horizonte/ })).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: 'Filtros', exact: true }));
  expect(screen.getByRole('combobox', { name: 'UF' })).toHaveValue('MG');
  expect(screen.getByRole('combobox', { name: 'Cidade' })).toHaveValue('Uberlândia');
  fireEvent.change(screen.getByRole('searchbox', { name: 'Nome ou CNPJ' }), { target: { value: '01.012.345/0001-99' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
  await waitFor(() => {
    const [url, init] = fetcher.mock.lastCall!;
    const params = new URL(url, 'http://localhost').searchParams;
    expect([params.get('cod_empresa_bi'), params.get('filial_id'), params.get('uf'), params.get('cidade'),
      params.get('status'), params.get('busca')]).toEqual(['10041', 'chevrolet', 'MG', 'Uberlândia', 'sem_visita', '01.012.345/0001-99']);
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token-do-portal');
    expect(init.credentials).toBe('omit');
  });
});
