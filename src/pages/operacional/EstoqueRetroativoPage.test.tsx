import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  codEmpresaBi: '1004',
  filialAtiva: 'transmissao',
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: () => ({ empresa: { cod_empresa_bi: 1004, api_url: 'https://api.example.com' } }),
}));

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({ filialAtiva: testState.filialAtiva }),
}));

vi.mock('@/utils/filialEndpoint', () => ({ resolveCodEmpresaBiParam: () => testState.codEmpresaBi }));
vi.mock('@/utils/apiEndpointResolver', () => ({ buildApiProxyUrl: () => '/api/estoque/retroativo' }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) } },
}));
vi.mock('sonner', () => ({
  toast: { error: testState.toastError, success: testState.toastSuccess },
}));

import EstoqueRetroativoPage from './EstoqueRetroativoPage';

describe('EstoqueRetroativoPage', () => {
  beforeEach(() => {
    testState.codEmpresaBi = '1004';
    testState.filialAtiva = 'transmissao';
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([
      {
        CodEmpresa_bi: 1004,
        empresa_codigo: 1,
        empresa_nome: 'Matriz',
        cod_produto: 12,
        descricao: 'KIT EMBREAGEM',
        marca: 'LUK',
        unidade: 'UN',
        saldo_estoque: 3,
        valor_unitario: 120,
        preco_venda_unitario: 180,
      },
    ]), { status: 200 })));
  });

  it('mostra resumo e resultados compactos depois da consulta', async () => {
    render(<EstoqueRetroativoPage />);

    fireEvent.change(screen.getByLabelText('Data do estoque'), { target: { value: '2026-08-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));

    await waitFor(() => expect(screen.getByText('1 produto')).toBeInTheDocument());
    expect(within(screen.getByRole('region', { name: 'Indicadores de estoque' })).getByText('3,00')).toBeInTheDocument();
    expect(screen.getAllByText('KIT EMBREAGEM').length).toBeGreaterThan(0);
    expect(screen.getByRole('searchbox', { name: 'Buscar nos resultados' })).toBeInTheDocument();
  });

  it('usa a mesa operacional compartilhada com comandos em uma unica barra', () => {
    render(<EstoqueRetroativoPage />);

    expect(screen.getByRole('region', { name: /estoque retroativo/i }))
      .toHaveClass('operational-retroactive');
    const toolbar = screen.getByRole('toolbar', { name: 'Comandos do estoque retroativo' });
    expect(within(toolbar).getByLabelText('Data do estoque')).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: 'Consultar' })).toBeInTheDocument();
    expect(within(toolbar).getByRole('searchbox', { name: 'Buscar nos resultados' })).toBeInTheDocument();
    expect(within(toolbar).getByLabelText('Base de valor')).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: 'Exportar' })).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: 'Exportar' })).toBeEnabled();
    expect(screen.queryByRole('heading', { name: 'Estoque Retroativo' })).not.toBeInTheDocument();
  });

  it('recua a toolbar em 56px no mobile para nao sobrepor o botao da sidebar', () => {
    render(<EstoqueRetroativoPage />);

    expect(screen.getByRole('toolbar', { name: 'Comandos do estoque retroativo' }))
      .toHaveClass('max-md:pl-14');
  });

  it('mantem resultados e tabela dentro de um unico viewport de dados', async () => {
    render(<EstoqueRetroativoPage />);

    fireEvent.change(screen.getByLabelText('Data do estoque'), { target: { value: '2026-08-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));

    await waitFor(() => expect(screen.getByText('1 produto')).toBeInTheDocument());
    const viewport = screen.getByRole('region', { name: 'Dados do estoque' });
    expect(within(viewport).getByRole('table')).toBeInTheDocument();
    expect(viewport.querySelector('.max-h-\\[65vh\\]')).not.toBeInTheDocument();
  });

  it('aborta a consulta e descarta a resposta antiga quando a filial muda', async () => {
    let resolveRequest!: (response: Response) => void;
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { CodEmpresa_bi: 1004, empresa_codigo: 1, empresa_nome: 'Matriz', cod_produto: 12, descricao: 'ITEM CT' },
        { CodEmpresa_bi: 1004, empresa_codigo: 2, empresa_nome: 'Filial', cod_produto: 13, descricao: 'OUTRO ITEM' },
      ]), { status: 200 }))
      .mockImplementationOnce((_input: RequestInfo | URL, init?: RequestInit) => {
        requestSignal = init?.signal ?? undefined;
        return new Promise<Response>(resolve => { resolveRequest = resolve; });
      }));
    const { rerender } = render(<EstoqueRetroativoPage />);

    fireEvent.change(screen.getByLabelText('Data do estoque'), { target: { value: '2026-08-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    await screen.findByText('2 produtos');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar nos resultados' }), { target: { value: 'ITEM CT' } });
    expect(screen.getByRole('searchbox', { name: 'Buscar nos resultados' })).toHaveValue('ITEM CT');

    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(within(screen.getByRole('region', { name: 'Dados do estoque' })).getByRole('status')).toHaveTextContent('Consultando estoque retroativo');
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    testState.codEmpresaBi = '10041';
    testState.filialAtiva = 'chevrolet';
    rerender(<EstoqueRetroativoPage />);

    expect(requestSignal?.aborted).toBe(true);
    expect(screen.getByLabelText('Data do estoque')).toHaveValue('');
    expect(screen.getByRole('searchbox', { name: 'Buscar nos resultados' })).toHaveValue('');
    expect(screen.getByLabelText('Filial')).toHaveTextContent('Todas as filiais');
    expect(screen.getByLabelText('Base de valor')).toHaveTextContent('Preço de venda');

    await act(async () => {
      resolveRequest(new Response(JSON.stringify([{ CodEmpresa_bi: 1004, cod_produto: 12, descricao: 'ITEM CT' }]), { status: 200 }));
      await Promise.resolve();
    });

    expect(screen.queryByText('ITEM CT')).not.toBeInTheDocument();
    expect(screen.getByText('Selecione uma data para consultar a posição do estoque.')).toBeInTheDocument();
  });

  it('mostra carregamento e erro com retry sem confundir falha com resultado vazio', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let resolveFailure!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => new Promise<Response>(resolve => { resolveFailure = resolve; }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 })));
    render(<EstoqueRetroativoPage />);

    fireEvent.change(screen.getByLabelText('Data do estoque'), { target: { value: '2026-08-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    const viewport = screen.getByRole('region', { name: 'Dados do estoque' });
    expect(within(viewport).getByRole('status')).toHaveTextContent('Consultando estoque retroativo');
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    await act(async () => {
      resolveFailure(new Response('falha', { status: 500 }));
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Erro 500');
    expect(screen.queryByText('Nenhum item encontrado para a data consultada.')).not.toBeInTheDocument();

    fireEvent.click(within(alert).getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Nenhum item encontrado para a data consultada.')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it('diferencia resultado sem correspondencia de uma consulta vazia', async () => {
    render(<EstoqueRetroativoPage />);

    fireEvent.change(screen.getByLabelText('Data do estoque'), { target: { value: '2026-08-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    await screen.findByText('1 produto');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar nos resultados' }), { target: { value: 'inexistente' } });

    const viewport = screen.getByRole('region', { name: 'Dados do estoque' });
    expect(within(viewport).getByText('Nenhum produto corresponde aos filtros.')).toBeInTheDocument();
    expect(within(viewport).queryByRole('table')).not.toBeInTheDocument();
  });

  it('informa quantos registros estao visiveis quando o resultado ultrapassa 500 itens', async () => {
    const items = Array.from({ length: 501 }, (_, index) => ({
      CodEmpresa_bi: 1004,
      empresa_codigo: 1,
      empresa_nome: 'Matriz',
      cod_produto: index + 1,
      descricao: `PRODUTO ${index + 1}`,
      marca: 'LUK',
      saldo_estoque: 1,
      valor_unitario: 10,
      preco_venda_unitario: 20,
    }));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(items), { status: 200 })));
    render(<EstoqueRetroativoPage />);

    fireEvent.change(screen.getByLabelText('Data do estoque'), { target: { value: '2026-08-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));

    expect(await screen.findByText('501 produtos')).toBeInTheDocument();
    expect(screen.getByText('Exibindo 500 de 501 registros. Refine os filtros ou exporte para consultar todos.'))
      .toBeInTheDocument();
  });

  it.each([
    { codEmpresaBi: '1004', filialAtiva: 'transmissao', esperado: 'ITEM CT', excluido: 'ITEM CCH' },
    { codEmpresaBi: '10041', filialAtiva: 'chevrolet', esperado: 'ITEM CCH', excluido: 'ITEM CT' },
  ])('isola estritamente os registros BI da filial $codEmpresaBi', async ({ codEmpresaBi, filialAtiva, esperado, excluido }) => {
    testState.codEmpresaBi = codEmpresaBi;
    testState.filialAtiva = filialAtiva;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([
      { CodEmpresa_bi: 1004, empresa_codigo: 1, cod_produto: 1, descricao: 'ITEM CT', marca: 'MWM' },
      { CodEmpresa_bi: 10041, empresa_codigo: 2, cod_produto: 2, descricao: 'ITEM CCH', marca: 'GM' },
      { empresa_codigo: 3, cod_produto: 3, descricao: 'SEM BI', marca: 'GM' },
    ]), { status: 200 })));
    render(<EstoqueRetroativoPage />);

    fireEvent.change(screen.getByLabelText('Data do estoque'), { target: { value: '2026-08-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));

    expect(await screen.findByText('1 produto')).toBeInTheDocument();
    expect(screen.getAllByText(esperado).length).toBeGreaterThan(0);
    expect(screen.queryByText(excluido)).not.toBeInTheDocument();
    expect(screen.queryByText('SEM BI')).not.toBeInTheDocument();
  });
});
