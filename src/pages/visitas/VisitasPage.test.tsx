import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VisitasPage from './VisitasPage';
import type { SessaoVisitas } from './visitasApi';

const mock = vi.hoisted(() => ({
  fetch: vi.fn(),
  logout: vi.fn(),
}));

const chevrolet = { cod_empresa_bi: '10041', filial_id: 'chevrolet' };
const transmissao = { cod_empresa_bi: '1004', filial_id: 'transmissao' };

function renderPage(gerencial = false, filiais: SessaoVisitas['filiais'] = [chevrolet], filialAtiva?: string) {
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><VisitasPage logout={mock.logout} filialAtiva={filialAtiva} sessao={{
    id: 'usuario-1', nome: 'Visitador de teste', perfil: gerencial ? 'gerencial' : 'visitador',
    filiais,
  }} /></QueryClientProvider>);
}

describe('Relatórios de visitas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mock.fetch);
    mock.fetch.mockImplementation(async (_url, init) => init.method === 'POST'
      ? Response.json({ id: '1' }, { status: 201 })
      : Response.json({ total: 1, relatorios: [{
        id: '1', nome_cliente: 'Oficina Central', data_visita: '2026-11-23',
        cod_empresa_bi: '10041', filial_id: 'chevrolet', cidade: 'Uberlândia', cnpj: '01234567000189',
        visitador_nome: 'Visitador da equipe', avaliacoes: { Atendimento: ['Solicitou retorno', '', ''] },
      }] }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('registra a visita no escopo do visitador e abre seu histórico', async () => {
    renderPage(false, [transmissao, chevrolet]);
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Filial' }), { target: { value: 'chevrolet' } });
    expect(screen.getByRole('button', { name: 'Sair' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Nome do cliente'), { target: { value: ' Oficina Central ' } });
    fireEvent.change(screen.getByLabelText('CNPJ'), { target: { value: '01.234.567/0001-89' } });
    const atendimento = screen.getByRole('group', { name: 'Atendimento' });
    fireEvent.change(within(atendimento).getByLabelText('Ações'), { target: { value: 'Enviar orçamento' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar relatório' }));
    expect(await screen.findByText('Oficina Central')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Meus relatórios' })).toHaveAttribute('aria-selected', 'true');
    const [url, post] = mock.fetch.mock.calls.find(([, init]) => init.method === 'POST')!;
    expect(url).toBe('/operacional/visitas/relatorios');
    expect(post.credentials).toBe('same-origin');
    const payload = JSON.parse(post.body);
    expect(payload).toEqual(expect.objectContaining({
      cod_empresa_bi: '10041', filial_id: 'chevrolet', nome_cliente: 'Oficina Central',
      cnpj: '01.234.567/0001-89',
      avaliacoes: { Atendimento: ['', 'Enviar orçamento', ''], Entrega: ['', '', ''], 'Preço': ['', '', ''], Prazo: ['', '', ''] },
    }));
    expect(payload).not.toHaveProperty('visitador_id');
    expect(mock.fetch.mock.calls.some(([path]) => path.includes('escopo=meus'))).toBe(true);
    fireEvent.click(screen.getByText('Oficina Central'));
    expect(screen.getByText('01.234.567/0001-89')).toBeVisible();
  });

  it('formata o CNPJ durante a digitação e ao colar um CNPJ alfanumérico', () => {
    renderPage();
    const campo = screen.getByLabelText<HTMLInputElement>('CNPJ');

    fireEvent.change(campo, { target: { value: '012' } });
    expect(campo).toHaveValue('01.2');
    fireEvent.change(campo, { target: { value: '012345670001890' } });
    expect(campo).toHaveValue('01.234.567/0001-89');
    fireEvent.change(campo, { target: { value: ' 12abc34501de67 ' } });
    expect(campo).toHaveValue('12.ABC.345/01DE-67');

    fireEvent.input(campo, {
      inputType: 'deleteContentForward',
      target: { value: '12ABC.345/01DE-67', selectionStart: 2, selectionEnd: 2 },
    });
    expect(campo).toHaveValue('12.ABC.345/01DE-67');
    expect(campo.selectionStart).toBe(3);
  });

  it('aguarda a liberação de Visitas quando a sessão não inclui a filial ativa', async () => {
    renderPage(true, [transmissao], 'chevrolet');
    expect(await screen.findByRole('alert')).toHaveTextContent('Seu acesso a Visitas precisa ser liberado.');
    expect(mock.fetch).not.toHaveBeenCalled();
  });

  it('atualiza Meus relatórios pelo botão ao lado dos filtros e mantém o filtro aplicado', async () => {
    renderPage();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Meus relatórios' }), { button: 0, ctrlKey: false });
    expect(await screen.findByText('Oficina Central')).toBeVisible();

    const filtros = screen.getByRole('button', { name: 'Filtros' });
    const atualizar = screen.getByRole('button', { name: 'Atualizar relatórios' });
    expect(filtros.nextElementSibling).toBe(atualizar);

    fireEvent.click(filtros);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Cliente' }), { target: { value: 'Central' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    await waitFor(() => expect(atualizar).toBeEnabled());
    const [consultaFiltrada] = mock.fetch.mock.lastCall!;
    expect(consultaFiltrada).toContain('escopo=meus');
    expect(consultaFiltrada).toContain('cliente=Central');

    mock.fetch.mockResolvedValueOnce(Response.json({ total: 1, relatorios: [{
      id: '2', nome_cliente: 'Oficina Central Peças', data_visita: '2026-11-23', avaliacoes: {},
    }] }));
    fireEvent.click(atualizar);

    expect(await screen.findByText('Oficina Central Peças')).toBeVisible();
    expect(mock.fetch.mock.lastCall?.[0]).toBe(consultaFiltrada);
    expect(filtros).toHaveAttribute('aria-expanded', 'true');
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
    fireEvent.click(screen.getByText('Oficina Central'));
    expect(screen.getByText('01.234.567/0001-89')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Enviar relatório' })).not.toBeInTheDocument();
    const query = new URL(mock.fetch.mock.calls[0][0], 'http://localhost').searchParams;
    expect(query.get('escopo')).toBe('gerencia');
    expect(query.get('filial_id')).toBe('chevrolet');
    expect(query.get('cod_empresa_bi')).toBe('10041');
    expect(query.has('visitador_id')).toBe(false);
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
