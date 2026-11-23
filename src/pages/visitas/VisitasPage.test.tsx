import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VisitasPage from './VisitasPage';

const mock = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  in: vi.fn(),
  ilike: vi.fn(),
  order: vi.fn(),
  range: vi.fn(),
  abortSignal: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => mock },
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usuario-1' }, logout: mock.logout, codEmpresa: '10041',
    profile: { filiais_permitidas: ['chevrolet'] },
  }),
}));
vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({
    filialAtiva: 'chevrolet', codEmpresaContexto: '10041', filialNome: 'Casa da Chevrolet',
  }),
}));

function renderPage(gerencial = false) {
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><VisitasPage gerencial={gerencial} /></QueryClientProvider>);
}

describe('Relatórios de visitas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    [mock.select, mock.eq, mock.in, mock.ilike, mock.order, mock.range].forEach(fn => fn.mockReturnValue(mock));
    mock.insert.mockResolvedValue({ error: null });
    mock.abortSignal.mockResolvedValue({
      error: null, count: 1,
      data: [{
        id: '1', nome_cliente: 'Oficina Central', data_visita: '2026-11-23',
        cod_empresa_bi: '10041', filial_id: 'chevrolet', cidade: 'Uberlândia',
        visitador_nome: 'Visitador da equipe', avaliacoes: { Atendimento: ['Solicitou retorno', '', ''] },
      }],
    });
  });

  it('registra a visita no escopo do visitador e abre seu histórico', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Nome do cliente'), { target: { value: ' Oficina Central ' } });
    const atendimento = screen.getByRole('group', { name: 'Atendimento' });
    fireEvent.change(within(atendimento).getByLabelText('Ações'), { target: { value: 'Enviar orçamento' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar relatório' }));
    expect(await screen.findByText('Oficina Central')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Meus relatórios' })).toHaveAttribute('aria-selected', 'true');
    expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({
      cod_empresa_bi: '10041', filial_id: 'chevrolet', nome_cliente: 'Oficina Central',
      avaliacoes: { Atendimento: ['', 'Enviar orçamento', ''], Entrega: ['', '', ''], 'Preço': ['', '', ''], Prazo: ['', '', ''] },
    }));
    expect(mock.insert.mock.calls[0][0]).not.toHaveProperty('visitador_id');
    expect(mock.eq).toHaveBeenCalledWith('visitador_id', 'usuario-1');
  });

  it('preserva o formulário quando o envio falha', async () => {
    mock.insert.mockResolvedValueOnce({ error: { message: 'offline' } });
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
    expect(mock.eq).toHaveBeenCalledWith('filial_id', 'chevrolet');
    expect(mock.in).toHaveBeenCalledWith('cod_empresa_bi', ['1004', '10041']);
    await waitFor(() => expect(mock.eq).not.toHaveBeenCalledWith('visitador_id', expect.anything()));
  });

  it('expande os filtros, aplica o cliente e volta à lista completa ao limpar', async () => {
    renderPage(true);
    const botao = screen.getByRole('button', { name: 'Filtros' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Cliente' }), { target: { value: 'Central' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    await waitFor(() => expect(mock.ilike).toHaveBeenCalledWith('nome_cliente', '%Central%'));
    expect(botao).toHaveTextContent('1 ativo');
    fireEvent.reset(screen.getByRole('button', { name: 'Limpar' }).closest('form')!);
    expect(botao).not.toHaveTextContent('1 ativo');
  });
});
