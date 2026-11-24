import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import VisitasPage from './VisitasPage';
import VisitasRoute from './VisitasRoute';

const mock = vi.hoisted(() => ({
  fetch: vi.fn(),
  logout: vi.fn(),
  getSession: vi.fn(),
  filialAtiva: 'chevrolet',
  roles: ['gerencial'],
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usuario-1' }, roles: mock.roles, logout: mock.logout, mustChangePassword: false,
  }),
}));
vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({ codEmpresaContexto: '1004', filialAtiva: mock.filialAtiva }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: mock.getSession } },
}));

function renderPage(gerencial = false) {
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><VisitasPage logout={mock.logout} sessao={{
    id: 'usuario-1', perfil: gerencial ? 'gerencial' : 'visitador',
    filiais: [{ cod_empresa_bi: '10041', filial_id: 'chevrolet' }],
  }} /></QueryClientProvider>);
}

describe('Relatórios de visitas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.filialAtiva = 'chevrolet';
    mock.roles = ['gerencial'];
    vi.stubGlobal('fetch', mock.fetch);
    mock.getSession.mockResolvedValue({ data: { session: { access_token: 'token-portal', user: { id: 'usuario-1' } } } });
    mock.fetch.mockImplementation(async (_url, init) => init.method === 'POST'
      ? Response.json({ id: '1' }, { status: 201 })
      : Response.json({ total: 1, relatorios: [{
        id: '1', nome_cliente: 'Oficina Central', data_visita: '2026-11-23',
        cod_empresa_bi: '10041', filial_id: 'chevrolet', cidade: 'Uberlândia',
        visitador_nome: 'Visitador da equipe', avaliacoes: { Atendimento: ['Solicitou retorno', '', ''] },
      }] }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('registra a visita no escopo do visitador e abre seu histórico', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Nome do cliente'), { target: { value: ' Oficina Central ' } });
    const atendimento = screen.getByRole('group', { name: 'Atendimento' });
    fireEvent.change(within(atendimento).getByLabelText('Ações'), { target: { value: 'Enviar orçamento' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar relatório' }));
    expect(await screen.findByText('Oficina Central')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Meus relatórios' })).toHaveAttribute('aria-selected', 'true');
    const [url, post] = mock.fetch.mock.calls.find(([, init]) => init.method === 'POST')!;
    expect(url).toBe('/operacional/visitas/relatorios');
    expect(post.headers.get('Authorization')).toBe('Bearer token-portal');
    expect(post.credentials).toBe('omit');
    const payload = JSON.parse(post.body);
    expect(payload).toEqual(expect.objectContaining({
      cod_empresa_bi: '10041', filial_id: 'chevrolet', nome_cliente: 'Oficina Central',
      avaliacoes: { Atendimento: ['', 'Enviar orçamento', ''], Entrega: ['', '', ''], 'Preço': ['', '', ''], Prazo: ['', '', ''] },
    }));
    expect(payload).not.toHaveProperty('visitador_id');
    expect(mock.fetch.mock.calls.some(([path]) => path.includes('escopo=meus'))).toBe(true);
  });

  it('preserva o formulário quando o envio falha', async () => {
    mock.fetch.mockRejectedValueOnce(new Error('Não foi possível enviar o relatório.'));
    renderPage();
    fireEvent.change(screen.getByLabelText('Nome do cliente'), { target: { value: 'Oficina Central' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar relatório' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível enviar');
    expect(screen.getByLabelText('Nome do cliente')).toHaveValue('Oficina Central');
  });

  it('consulta os relatórios e mostra a autoria no Comercial sem liberar o formulário', async () => {
    renderPage(true);
    expect(await screen.findByText(/Visitador da equipe/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Enviar relatório' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument();
    const query = new URL(mock.fetch.mock.calls[0][0], 'http://localhost').searchParams;
    expect(query.get('escopo')).toBe('gerencia');
    expect(query.get('filial_id')).toBe('chevrolet');
    expect(query.get('cod_empresa_bi')).toBe('10041');
    expect(query.has('visitador_id')).toBe(false);
    expect(mock.fetch.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer token-portal');
  });

  it('abre a gerência com a sessão existente e consulta apenas a filial ativa do Comercial', async () => {
    mock.filialAtiva = 'transmissao';
    mock.fetch.mockResolvedValueOnce(Response.json({
      id: 'usuario-1', perfil: 'gerencial', filiais: [
        { cod_empresa_bi: '10041', filial_id: 'chevrolet' },
        { cod_empresa_bi: '1004', filial_id: 'transmissao' },
      ],
    }));
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><MemoryRouter>
      <VisitasRoute gerencial />
    </MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText(/Visitador da equipe/)).toBeVisible();
    expect(screen.getByText('Casa da Transmissão')).toBeVisible();
    expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Filial' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Conteúdo dos relatórios de visitas' })).toHaveClass('overflow-y-auto');
    const [[sessionPath, sessionRequest], [reportsPath]] = mock.fetch.mock.calls;
    expect(sessionPath).toBe('/operacional/visitas/sessao');
    expect(sessionRequest.headers.get('Authorization')).toBe('Bearer token-portal');
    expect(new URL(reportsPath, 'http://localhost').searchParams.get('filial_id')).toBe('transmissao');
  });

  it('bloqueia o envio se a conta mudou durante o preenchimento do relatório', async () => {
    mock.getSession.mockResolvedValueOnce({ data: { session: { access_token: 'novo-token', user: { id: 'usuario-2' } } } });
    renderPage();
    fireEvent.change(screen.getByLabelText('Nome do cliente'), { target: { value: 'Oficina Central' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar relatório' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sua sessão do Pelegrini expirou');
    expect(mock.fetch).not.toHaveBeenCalled();
  });

  it('expande os filtros, aplica o cliente e volta à lista completa ao limpar', async () => {
    renderPage(true);
    const botao = screen.getByRole('button', { name: 'Filtros' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Cliente' }), { target: { value: 'Central' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    await waitFor(() => expect(mock.fetch.mock.calls.some(([url]) => url.includes('cliente=Central'))).toBe(true));
    expect(botao).toHaveTextContent('1 ativo');
    fireEvent.reset(screen.getByRole('button', { name: 'Limpar' }).closest('form')!);
    expect(botao).not.toHaveTextContent('1 ativo');
  });
});
