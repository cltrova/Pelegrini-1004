import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  estoqueFixture,
  estoqueFixtureComTresItens,
  giroFixture,
} from '@/components/operacional/estoque/estoqueFixtures';
import { PelegriniBranchSwitcher } from '@/components/pelegrini/PelegriniBranchSwitcher';
import { AuthProvider } from '@/contexts/AuthContext';
import { EmpresaSelecionadaProvider } from '@/contexts/EmpresaSelecionadaContext';
import { FilialSelecionadaProvider } from '@/contexts/FilialSelecionadaContext';

const testState = vi.hoisted(() => ({
  hookResult: {} as Record<string, unknown>,
}));

vi.mock('@/hooks/useEstoqueData', () => ({
  useEstoqueData: () => testState.hookResult,
}));

import EstoquePage from './EstoquePage';

const detalhadoData = [
  {
    ...estoqueFixture[0],
    cod_produto: 404,
    produto: 'PRODUTO DETALHADO CCH',
    empresa: 'CASA DA CHEVROLET',
    localizacao_produto: 'A-01-02',
    tipo_relatorio: 'FILIAL SEPARADA',
  },
];

function createHookResult(overrides: Record<string, unknown> = {}) {
  return {
    consolidadoData: estoqueFixtureComTresItens,
    detalhadoData,
    giroData: giroFixture,
    isLoading: false,
    isError: false,
    empresa: {
      cod_empresa_bi: 1004,
      modulo_operacional: true,
    },
    isMasterDemo: false,
    ...overrides,
  };
}

function renderEstoquePage({ withBranchSwitcher = false } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <EmpresaSelecionadaProvider>
          <FilialSelecionadaProvider>
            {withBranchSwitcher && <PelegriniBranchSwitcher />}
            <EstoquePage />
          </FilialSelecionadaProvider>
        </EmpresaSelecionadaProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class ResizeObserverMock {
    private readonly callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element) {
      this.callback([{
        contentRect: { height: 224, width: 640 },
        target,
      } as ResizeObserverEntry], this as unknown as ResizeObserver);
    }
    disconnect() {}
    unobserve() {}
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('bi-reports-empresa-selecionada', '1004');
  localStorage.setItem('bi-reports-filial-1004', 'transmissao');
  testState.hookResult = createHookResult();
  vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EstoquePage', () => {
  it('nao apresenta totalizadores zerados quando a API falha e permite tentar novamente', () => {
    const refetch = vi.fn();
    testState.hookResult = createHookResult({
      consolidadoData: [], detalhadoData: [], giroData: [], isError: true, refetch,
      sourceErrors: { consolidado: new Error('API indisponivel (HTTP 504)'), detalhado: new Error('HTTP 504'), giro: new Error('HTTP 504') },
    });
    renderEstoquePage();
    expect(screen.getByText('Estoque indisponivel')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Resumo do estoque' })).not.toBeInTheDocument();
    expect(screen.queryByText('0 itens · 0 movimentações')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('identifica a contingencia de giro como parcial sem esconder os produtos disponiveis', () => {
    testState.hookResult = createHookResult({
      isError: true,
      sourceErrors: { consolidado: new Error('HTTP 500'), detalhado: null, giro: null },
      partialSources: { consolidado: true, detalhado: false },
    });
    renderEstoquePage();
    expect(screen.getByRole('alert')).toHaveTextContent('Estoque parcial');
    expect(screen.getAllByText('KIT EMBREAGEM PESADA').length).toBeGreaterThan(0);
  });

  it('mantem estoque disponivel e bloqueia analises quando a consulta de giro falha', () => {
    testState.hookResult = createHookResult({
      giroData: [], isError: true,
      sourceErrors: { consolidado: null, detalhado: null, giro: new Error('HTTP 504') },
    });
    renderEstoquePage();
    expect(screen.getAllByText('KIT EMBREAGEM PESADA').length).toBeGreaterThan(0);
    expect(screen.getByRole('alert')).toHaveTextContent('Nao foi possivel atualizar as movimentacoes');
    fireEvent.click(screen.getByRole('tab', { name: 'Giro de Estoque' }));
    expect(screen.getByText('Estoque indisponivel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Assistente' }));
    expect(screen.getByText('Estoque indisponivel')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Assistente de estoque' })).not.toBeInTheDocument();
  });

  it('preserva o estado vazio quando a API retorna uma lista vazia com sucesso', () => {
    testState.hookResult = createHookResult({ consolidadoData: [], detalhadoData: [], giroData: [] });
    renderEstoquePage();
    expect(screen.getByRole('region', { name: 'Resumo do estoque' })).toBeInTheDocument();
    expect(screen.queryByText('Estoque indisponivel')).not.toBeInTheDocument();
  });

  it('abre a Central de Estoque e remove as abas legadas', () => {
    renderEstoquePage();

    expect(screen.getByRole('tab', { name: 'Central de Estoque' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Giro de Estoque' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Assistente' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Detalhes do Produto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Visão Geral' })).not.toBeInTheDocument();
  });

  it('renderiza a central real com os dados retornados por useEstoqueData', () => {
    renderEstoquePage();

    const central = screen.getByRole('region', { name: 'Central de estoque' });
    expect(within(central).getAllByText('KIT EMBREAGEM PESADA').length).toBeGreaterThan(0);
    expect(within(central).getByRole('searchbox', { name: 'Buscar no estoque' })).toBeInTheDocument();
  });

  it('troca o view mode e passa a usar a fonte detalhada do hook', () => {
    renderEstoquePage();

    expect(screen.queryByText('PRODUTO DETALHADO CCH')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Detalhado' }));

    expect(screen.getAllByText('PRODUTO DETALHADO CCH').length).toBeGreaterThan(0);
    expect(screen.queryByText('BOMBA D AGUA')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Detalhado' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('mantem busca de Giro pendente ate a aplicacao explicita', () => {
    renderEstoquePage();
    fireEvent.click(screen.getByRole('tab', { name: 'Giro de Estoque' }));

    const search = screen.getByPlaceholderText('Buscar produto, fabricante, marca...');
    const table = screen.getByRole('table');
    fireEvent.change(search, { target: { value: 'bomba' } });

    expect(within(table).getByText('KIT EMBREAGEM PESADA')).toBeInTheDocument();
    expect(within(table).getByText('BOMBA D AGUA')).toBeInTheDocument();

    fireEvent.keyDown(search, { key: 'Enter' });

    expect(within(table).queryByText('KIT EMBREAGEM PESADA')).not.toBeInTheDocument();
    expect(within(table).getByText('BOMBA D AGUA')).toBeInTheDocument();
    expect(screen.queryByText('Movimentação mensal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Abrir analise de giro/i }));
    expect(screen.getByRole('dialog', { name: 'Analise de giro' })).toBeInTheDocument();
    expect(screen.getByText('Movimentação mensal')).toBeInTheDocument();
    expect(screen.getByText('Maior giro')).toBeInTheDocument();
    expect(screen.getByText('Mais tempo sem venda')).toBeInTheDocument();
    expect(screen.getByText('6 meses')).toBeInTheDocument();
  });

  it('abre o Assistente de Estoque real', async () => {
    renderEstoquePage();

    fireEvent.click(screen.getByRole('tab', { name: 'Assistente' }));

    expect(await screen.findByText('Assistente de Estoque')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Assistente de estoque' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Pergunte sobre seu estoque...')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Insights' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Cérebro' })).not.toBeInTheDocument();
    expect(screen.queryByText('Qual produto gira mais?')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar sugestoes' }));
    expect(screen.getByText('Qual produto gira mais?')).toBeInTheDocument();
  });

  it('preserva o guard de carregamento', () => {
    testState.hookResult = createHookResult({ isLoading: true });

    renderEstoquePage();

    expect(screen.getByText('Carregando dados da filial')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Central de Estoque' })).not.toBeInTheDocument();
  });

  it('preserva o guard de modulo operacional desativado', () => {
    testState.hookResult = createHookResult({
      empresa: { cod_empresa_bi: 1004, modulo_operacional: false },
    });

    renderEstoquePage();

    expect(screen.getByText('O módulo Operacional não está ativado para esta empresa.')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Central de Estoque' })).not.toBeInTheDocument();
  });

  it('troca CT por CCH no contexto real e atualiza a branchKey da central', async () => {
    localStorage.setItem(
      'pelegrini:estoque:columns:1004:transmissao',
      JSON.stringify(['product', 'quantity', 'status', 'application']),
    );
    localStorage.setItem(
      'pelegrini:estoque:columns:1004:chevrolet',
      JSON.stringify(['product', 'quantity', 'status', 'brand']),
    );
    renderEstoquePage({ withBranchSwitcher: true });

    const transmissao = screen.getByRole('radio', { name: 'Casa da Transmissão' });
    const chevrolet = screen.getByRole('radio', { name: 'Casa do Chevrolet' });
    expect(transmissao).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('columnheader', { name: 'Aplicacao' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Marca' })).not.toBeInTheDocument();

    fireEvent.click(chevrolet);

    await waitFor(() => expect(chevrolet).toHaveAttribute('aria-checked', 'true'));
    expect(localStorage.getItem('bi-reports-filial-1004')).toBe('chevrolet');
    await waitFor(() => expect(screen.getByRole('columnheader', { name: 'Marca' })).toBeInTheDocument());
    expect(screen.queryByRole('columnheader', { name: 'Aplicacao' })).not.toBeInTheDocument();
  });

  it('exporta somente os registros filtrados pela central', async () => {
    const createObjectURL = vi.fn(() => 'blob:estoque');
    const revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderEstoquePage();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar no estoque' }), {
      target: { value: 'bomba' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar visao atual' }));

    const exportedBlob = createObjectURL.mock.calls[0][0] as Blob;
    const csv = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(exportedBlob);
    });

    expect(csv).toContain('BOMBA D AGUA');
    expect(csv).not.toContain('KIT EMBREAGEM PESADA');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:estoque');
  });
});
