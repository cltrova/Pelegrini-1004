import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  estoqueFixture,
  estoqueFixtureComTresItens,
  giroFixture,
} from '@/components/operacional/estoque/estoqueFixtures';
import { PelegriniBranchSwitcher } from '@/components/pelegrini/PelegriniBranchSwitcher';
import { setAuthenticatedLocalPreviewUserAccount } from '@/config/localPreview';
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
    activeCompanyCode: '1004',
    consolidadoData: estoqueFixtureComTresItens,
    detalhadoData,
    giroData: giroFixture,
    isLoading: false,
    isInitialLoading: false,
    isFetching: false,
    isError: false,
    sourceErrors: { consolidado: null, detalhado: null, giro: null },
    sourceStatus: { consolidado: 'ready', detalhado: 'ready', giro: 'ready' },
    sourceLastUpdated: {
      consolidado: new Date('2026-09-03T13:45:00-03:00'),
      detalhado: new Date('2026-09-03T13:45:00-03:00'),
      giro: new Date('2026-09-03T13:45:00-03:00'),
    },
    lastSuccessfulUpdate: new Date('2026-09-03T13:45:00-03:00'),
    partialSources: { consolidado: false, detalhado: false },
    recoveredSources: { consolidado: false, detalhado: false },
    recoveryStatus: 'idle',
    refetch: vi.fn(),
    empresa: {
      cod_empresa_bi: 1004,
      modulo_operacional: true,
    },
    isMasterDemo: false,
    ...overrides,
  };
}

function renderEstoquePage({ withBranchSwitcher = false, initialTab = 'central' }: {
  withBranchSwitcher?: boolean;
  initialTab?: 'central' | 'overview';
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <EmpresaSelecionadaProvider>
          <FilialSelecionadaProvider>
            {withBranchSwitcher && <PelegriniBranchSwitcher />}
            <EstoquePage initialTab={initialTab} />
          </FilialSelecionadaProvider>
        </EmpresaSelecionadaProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );

  return result;
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
  setAuthenticatedLocalPreviewUserAccount('local-preview-user');
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
  it('mantem uma carga inicial unica ate todas as fontes do estoque terminarem', () => {
    testState.hookResult = createHookResult({
      consolidadoData: [],
      detalhadoData: [],
      giroData: [],
      isInitialLoading: true,
      sourceStatus: { consolidado: 'ready', detalhado: 'loading', giro: 'ready' },
    });

    renderEstoquePage();

    expect(screen.getByRole('status', { name: 'Carregando dados completos do estoque' })).toBeInTheDocument();
    expect(screen.getByText('Carregando dados da filial')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Central de Estoque' })).not.toBeInTheDocument();
    expect(screen.queryByText('Recuperando estoque completo')).not.toBeInTheDocument();
  });

  it('mostra filial, ultima atualizacao e estado da fonte no cabecalho compacto', () => {
    const refetch = vi.fn();
    testState.hookResult = createHookResult({ refetch });

    renderEstoquePage();

    expect(screen.queryByText(/Casa da Transmissao/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Atualizado.*13:45/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Estado da fonte de estoque: Dados atualizados/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Gestao de Estoque' })).not.toBeInTheDocument();
    expect(screen.queryByText('Dados atualizados')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar dados do estoque' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('mantem aviso, contagem e paginacao fixos fora do unico scroller de dados da Central', () => {
    testState.hookResult = createHookResult({
      sourceErrors: { consolidado: new Error('HTTP 500'), detalhado: null, giro: null },
      partialSources: { consolidado: true, detalhado: false },
    });
    renderEstoquePage();

    const viewport = screen.getByRole('region', { name: 'Dados do estoque' });
    const dataScroller = within(viewport).getByRole('region', { name: 'Rolagem dos produtos do estoque' });
    expect(viewport).toHaveClass('overflow-hidden');
    expect(within(dataScroller).getByRole('table')).toBeInTheDocument();
    expect(within(dataScroller).getByRole('rowgroup', { name: 'Cabecalho da tabela' })).toHaveClass('sticky', 'top-0');
    expect(within(dataScroller).queryByText('Estoque parcial')).not.toBeInTheDocument();
    expect(within(dataScroller).queryByRole('group', { name: 'Contagem e ordenacao dos produtos' })).not.toBeInTheDocument();
    expect(within(dataScroller).queryByLabelText('Paginacao dos produtos')).not.toBeInTheDocument();
    const sourceNotice = within(viewport).getByText('Estoque parcial').closest('[role="status"]');
    expect(sourceNotice).toBeInTheDocument();
    expect(sourceNotice?.parentElement).toHaveClass('shrink-0');
    expect(within(viewport).getByRole('group', { name: 'Contagem e ordenacao dos produtos' })).toHaveClass('shrink-0');
    expect(within(viewport).getByLabelText('Paginacao dos produtos')).toHaveClass('shrink-0');
  });

  it('desabilita a atualizacao e mostra feedback enquanto consulta', () => {
    testState.hookResult = createHookResult({ isFetching: true });

    renderEstoquePage();

    const refresh = screen.getByRole('button', { name: 'Atualizando dados do estoque' });
    expect(refresh).toBeDisabled();
    expect(refresh.querySelector('svg')).toHaveClass('animate-spin');
  });

  it('mantem dados anteriores montados durante uma nova consulta', () => {
    testState.hookResult = createHookResult({
      consolidadoData: [{
        ...estoqueFixtureComTresItens[0],
        produto: 'Produto preservado',
      }],
      isFetching: true,
      isLoading: true,
    });

    renderEstoquePage();

    expect(within(screen.getByRole('table')).getByText('Produto preservado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atualizando dados do estoque' }))
      .toBeDisabled();
  });

  it('nao apresenta totalizadores zerados quando a API falha e permite tentar novamente', () => {
    const refetch = vi.fn();
    testState.hookResult = createHookResult({
      consolidadoData: [], detalhadoData: [], giroData: [], isError: true, refetch,
      sourceErrors: { consolidado: new Error('API indisponivel (HTTP 504)'), detalhado: new Error('HTTP 504'), giro: new Error('HTTP 504') },
    });
    renderEstoquePage();
    expect(screen.getByLabelText(/Estado da fonte de estoque: Estoque indisponivel/i)).toHaveAttribute('data-issue', 'true');
    expect(screen.getByText('Estoque indisponivel')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Resumo do estoque' })).not.toBeInTheDocument();
    expect(screen.queryByText('0 itens · 0 movimentações')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('mantem a tela limpa enquanto consulta o historico completo', () => {
    testState.hookResult = createHookResult({
      consolidadoData: [],
      detalhadoData: [],
      giroData: [],
      isError: true,
      isFetching: true,
      isInitialLoading: true,
      recoveryStatus: 'loading',
      sourceErrors: {
        consolidado: new Error('Falha na consulta de estoque (HTTP 500).'),
        detalhado: new Error('HTTP 500'),
        giro: null,
      },
    });

    renderEstoquePage();

    expect(screen.getByRole('status', { name: 'Carregando dados completos do estoque' })).toBeInTheDocument();
    expect(screen.getByText('Carregando dados da filial')).toBeInTheDocument();
    expect(screen.queryByText('Recuperando estoque completo')).not.toBeInTheDocument();
    expect(screen.queryByText('Estoque indisponivel')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Resumo do estoque' })).not.toBeInTheDocument();
  });

  it('identifica a contingencia de giro como parcial sem esconder os produtos disponiveis', () => {
    testState.hookResult = createHookResult({
      isError: true,
      sourceErrors: { consolidado: new Error('HTTP 500'), detalhado: null, giro: null },
      partialSources: { consolidado: true, detalhado: false },
    });
    renderEstoquePage();
    const notice = screen.getByText('Estoque parcial').closest('[role="status"]');
    expect(notice).toBeInTheDocument();
    expect(notice).not.toHaveClass('sticky', 'top-0');
    expect(screen.getByRole('rowgroup', { name: 'Cabecalho da tabela' })).toHaveClass('sticky', 'top-0');
    expect(screen.getAllByText('KIT EMBREAGEM PESADA').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso da fonte' }));
    expect(screen.queryByText('Estoque parcial')).not.toBeInTheDocument();
  });

  it('reabre o aviso quando a origem da falha muda e depois de um estado saudavel', async () => {
    testState.hookResult = createHookResult({
      sourceErrors: { consolidado: new Error('Falha A'), detalhado: null, giro: null },
      partialSources: { consolidado: true, detalhado: false },
    });
    const { rerender } = renderEstoquePage();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso da fonte' }));
    expect(screen.queryByText('Estoque parcial')).not.toBeInTheDocument();

    testState.hookResult = createHookResult({
      sourceErrors: { consolidado: new Error('Falha B'), detalhado: null, giro: null },
      partialSources: { consolidado: true, detalhado: false },
    });
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider><EmpresaSelecionadaProvider><FilialSelecionadaProvider><EstoquePage /></FilialSelecionadaProvider></EmpresaSelecionadaProvider></AuthProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText('Estoque parcial')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso da fonte' }));
    testState.hookResult = createHookResult();
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider><EmpresaSelecionadaProvider><FilialSelecionadaProvider><EstoquePage /></FilialSelecionadaProvider></EmpresaSelecionadaProvider></AuthProvider>
      </QueryClientProvider>,
    );
    testState.hookResult = createHookResult({
      sourceErrors: { consolidado: new Error('Falha B'), detalhado: null, giro: null },
      partialSources: { consolidado: true, detalhado: false },
    });
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider><EmpresaSelecionadaProvider><FilialSelecionadaProvider><EstoquePage /></FilialSelecionadaProvider></EmpresaSelecionadaProvider></AuthProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText('Estoque parcial')).toBeInTheDocument());
  });

  it('indica estoque recuperado com giro pendente sem afirmar que o estoque esta atualizado', () => {
    testState.hookResult = createHookResult({
      recoveredSources: { consolidado: true, detalhado: false },
      sourceErrors: { consolidado: new Error('Fonte recuperada'), detalhado: null, giro: new Error('Giro indisponivel') },
    });
    renderEstoquePage();

    expect(screen.getByLabelText(/Estado da fonte de estoque: Estoque recuperado, giro pendente/i)).toHaveAttribute('data-issue', 'true');
    expect(screen.queryByLabelText(/Estado da fonte de estoque: Estoque atualizado, giro pendente/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Movimentacoes indisponiveis/i)).toBeInTheDocument();
  });

  it.each([
    {
      name: 'mantem Fonte parcial quando estoque parcial e giro falham',
      overrides: {
        isFetching: true,
        partialSources: { consolidado: true, detalhado: false },
        sourceErrors: { consolidado: new Error('Fonte parcial'), detalhado: null, giro: new Error('Giro indisponivel') },
      },
      label: 'Fonte parcial',
    },
    {
      name: 'mantem Ultimos dados preservados quando estoque e giro falham com dados em cache',
      overrides: {
        sourceErrors: { consolidado: new Error('Estoque indisponivel'), detalhado: null, giro: new Error('Giro indisponivel') },
      },
      label: 'Ultimos dados preservados',
    },
    {
      name: 'usa giro pendente quando apenas o giro falha e o estoque esta saudavel',
      overrides: {
        sourceErrors: { consolidado: null, detalhado: null, giro: new Error('Giro indisponivel') },
      },
      label: 'Estoque atualizado, giro pendente',
    },
  ])('$name', ({ overrides, label }) => {
    testState.hookResult = createHookResult(overrides);
    renderEstoquePage();

    expect(screen.getByLabelText(`Estado da fonte de estoque: ${label}`)).toHaveAttribute('data-issue', 'true');
  });

  it('transforma o Giro em mesa operacional sem compatibilidade temporaria de scroll', async () => {
    renderEstoquePage();
    fireEvent.click(screen.getByRole('tab', { name: 'Giro de Estoque' }));
    const giroPanel = screen.getByRole('tabpanel', { name: 'Giro de Estoque' });
    await within(giroPanel).findByRole('toolbar', { name: 'Comandos do giro de estoque' });
    expect(giroPanel).toHaveClass('min-h-0', 'flex-1', 'overflow-hidden');
    expect(giroPanel).not.toHaveClass('overflow-y-auto', 'p-3');
    expect(within(giroPanel).getByRole('toolbar', { name: 'Comandos do giro de estoque' })).toBeInTheDocument();
    expect(within(giroPanel).getByRole('region', { name: 'Indicadores de estoque' })).toBeInTheDocument();
    expect(within(giroPanel).getByRole('region', { name: 'Dados do giro de estoque' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Assistente' }));
    const assistantPanel = screen.getByRole('tabpanel', { name: 'Assistente' });
    expect(assistantPanel).toHaveClass('min-h-0', 'flex-1', 'overflow-hidden');
    expect(assistantPanel).not.toHaveClass('overflow-y-auto', 'p-3');
  });

  it('remove o alerta parcial quando o estoque operacional foi recuperado pelo historico', () => {
    testState.hookResult = createHookResult({
      isError: true,
      sourceErrors: { consolidado: new Error('HTTP 500'), detalhado: null, giro: null },
      recoveredSources: { consolidado: true, detalhado: false },
      recoveryStatus: 'ready',
    });

    renderEstoquePage();

    expect(screen.getByLabelText(/Estado da fonte de estoque: Estoque recuperado/i)).not.toHaveAttribute('data-issue');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('mantem estoque disponivel e bloqueia analises quando a consulta de giro falha', () => {
    testState.hookResult = createHookResult({
      giroData: [], isError: true,
      sourceErrors: { consolidado: null, detalhado: null, giro: new Error('HTTP 504') },
    });
    renderEstoquePage();
    expect(screen.getAllByText('KIT EMBREAGEM PESADA').length).toBeGreaterThan(0);
    expect(screen.getByText(/Movimentacoes indisponiveis/i).closest('[role="status"]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Giro de Estoque' }));
    expect(screen.getByText('Estoque indisponivel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Assistente' }));
    expect(screen.getByText('Estoque indisponivel')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Assistente de estoque' })).not.toBeInTheDocument();
  });

  it('mostra carregamento no Giro sem usar zeros nem horario de outra fonte', () => {
    testState.hookResult = createHookResult({
      giroData: [],
      sourceStatus: { consolidado: 'ready', detalhado: 'ready', giro: 'loading' },
      sourceLastUpdated: {
        consolidado: new Date('2026-09-03T13:45:00-03:00'),
        detalhado: new Date('2026-09-03T13:45:00-03:00'),
        giro: null,
      },
    });

    renderEstoquePage();
    fireEvent.click(screen.getByRole('tab', { name: 'Giro de Estoque' }));

    expect(screen.getByRole('status', { name: 'Carregando movimentacoes do estoque' })).toBeInTheDocument();
    expect(screen.getByText(/Aguardando primeira atualizacao/i)).toBeInTheDocument();
    expect(screen.queryByText(/produtos analisados/i)).not.toBeInTheDocument();
  });

  it('marca movimentos como indisponiveis quando a atualizacao falha mesmo preservando dados anteriores', () => {
    testState.hookResult = createHookResult({
      giroData: giroFixture,
      isError: true,
      sourceErrors: { consolidado: null, detalhado: null, giro: new Error('HTTP 504') },
    });

    renderEstoquePage();

    const excess = screen.getByText('Capital em excesso').closest('[data-stock-summary]') as HTMLElement;
    expect(within(excess).getByText('Dados insuficientes')).toBeInTheDocument();
    expect(excess.tagName).toBe('ARTICLE');
    expect(screen.getByText(/Movimentacoes indisponiveis/i).closest('[role="status"]')).toBeInTheDocument();
  });

  it('preserva o estado vazio quando a API retorna uma lista vazia com sucesso', () => {
    testState.hookResult = createHookResult({ consolidadoData: [], detalhadoData: [], giroData: [] });
    renderEstoquePage();
    expect(screen.getByRole('region', { name: 'Resumo do estoque' })).toBeInTheDocument();
    expect(screen.queryByText('Estoque indisponivel')).not.toBeInTheDocument();
  });

  it('abre a Visão geral por padrão ao entrar no módulo de estoque', () => {
    renderEstoquePage({ initialTab: 'overview' });

    expect(screen.getByRole('tab', { name: 'Visão geral' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Central de Estoque' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Giro de Estoque' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Assistente' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Detalhes do Produto' })).not.toBeInTheDocument();
  });

  it('oculta Distribuidores na empresa Casa da Chevrolet', () => {
    testState.hookResult = createHookResult({ activeCompanyCode: '10041' });
    renderEstoquePage();

    expect(screen.queryByRole('tab', { name: 'Distribuidores' })).not.toBeInTheDocument();
  });

  it('nao exibe Distribuidores entre as subabas da Casa da Transmissao', () => {
    testState.hookResult = createHookResult({ activeCompanyCode: '1004' });
    renderEstoquePage();

    expect(screen.queryByRole('tab', { name: 'Distribuidores' })).not.toBeInTheDocument();
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

  it('mostra carregamento ao alternar para a fonte detalhada sem apresentar estoque vazio', () => {
    testState.hookResult = createHookResult({
      detalhadoData: [],
      sourceStatus: { consolidado: 'ready', detalhado: 'loading', giro: 'ready' },
    });

    renderEstoquePage();
    fireEvent.click(screen.getByRole('button', { name: 'Detalhado' }));

    expect(screen.getByRole('status', { name: 'Carregando dados detalhados do estoque' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Resumo do estoque' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^0 produtos$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nenhum produto disponivel/i)).not.toBeInTheDocument();
  });

  it('mantem busca de Giro pendente ate a aplicacao explicita', async () => {
    renderEstoquePage();
    fireEvent.click(screen.getByRole('tab', { name: 'Giro de Estoque' }));

    const search = await screen.findByPlaceholderText('Buscar produto, fabricante, marca...');
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
    expect(screen.getByText('3 meses')).toBeInTheDocument();
    expect(screen.queryByText('6 meses')).not.toBeInTheDocument();
  });

  it('abre o Assistente de Estoque real', async () => {
    renderEstoquePage();

    fireEvent.click(screen.getByRole('tab', { name: 'Assistente' }));

    expect(screen.queryByRole('heading', { name: 'Assistente de Estoque' })).not.toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Assistente de estoque' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Pergunte sobre seu estoque...')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Insights' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Cérebro' })).not.toBeInTheDocument();
    expect(screen.getAllByTestId('stock-assistant-suggestion')).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Risco de ruptura' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resumo diario' })).toBeInTheDocument();
  });

  it('sincroniza filtro de status acionado pelo KPI com controles pendentes, aplicar e limpar', async () => {
    const alertaStock = {
      ...estoqueFixtureComTresItens[0],
      cod_produto: 707,
      produto: 'PRODUTO EM ALERTA',
      quantidade_estoque: 10,
    };
    const rupturaStock = {
      ...estoqueFixtureComTresItens[1],
      cod_produto: 708,
      produto: 'PRODUTO EM RUPTURA',
      quantidade_estoque: 0,
    };
    testState.hookResult = createHookResult({
      consolidadoData: [alertaStock, rupturaStock],
      giroData: [{
        ...giroFixture[0],
        cod_produto: 707,
        produto: 'PRODUTO EM ALERTA',
        quantidade_estoque: 10,
        quantidade_movimentada: 20,
        saida_venda: 20,
        tipo_movimento: 'Venda',
      }],
    });
    renderEstoquePage();
    fireEvent.click(screen.getByRole('tab', { name: 'Giro de Estoque' }));

    fireEvent.click(await screen.findByRole('button', { name: /Alerta: 1/i }));
    const filterBar = screen.getByRole('button', { name: /Filtros:.*Alerta/i });
    expect(filterBar).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('PRODUTO EM ALERTA')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText('PRODUTO EM RUPTURA')).not.toBeInTheDocument();

    fireEvent.click(filterBar);
    fireEvent.click(screen.getByRole('button', { name: /Pesquisar/i }));
    expect(within(screen.getByRole('table')).getByText('PRODUTO EM ALERTA')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText('PRODUTO EM RUPTURA')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Filtros:.*Alerta/i }));
    fireEvent.click(screen.getByRole('button', { name: /Limpar filtros/i }));
    expect(within(screen.getByRole('table')).getByText('PRODUTO EM RUPTURA')).toBeInTheDocument();
  });

  it('mantem a tabela filtrada ao limpar um chip individual ate pesquisar', async () => {
    const alertaStock = {
      ...estoqueFixtureComTresItens[0],
      cod_produto: 707,
      produto: 'PRODUTO EM ALERTA',
      quantidade_estoque: 10,
    };
    const rupturaStock = {
      ...estoqueFixtureComTresItens[1],
      cod_produto: 708,
      produto: 'PRODUTO EM RUPTURA',
      quantidade_estoque: 0,
    };
    testState.hookResult = createHookResult({
      consolidadoData: [alertaStock, rupturaStock],
      giroData: [{
        ...giroFixture[0],
        cod_produto: 707,
        produto: 'PRODUTO EM ALERTA',
        quantidade_estoque: 10,
        quantidade_movimentada: 20,
        saida_venda: 20,
        tipo_movimento: 'Venda',
      }],
    });
    renderEstoquePage();
    fireEvent.click(screen.getByRole('tab', { name: 'Giro de Estoque' }));
    fireEvent.click(await screen.findByRole('button', { name: /Alerta: 1/i }));
    fireEvent.click(screen.getByRole('button', { name: /Filtros:.*Alerta/i }));

    const statusChip = screen.getByText('Status:').closest('button');
    const clearIcon = statusChip?.querySelector('svg');
    expect(clearIcon).not.toBeNull();
    fireEvent.click(clearIcon as SVGElement);

    const table = screen.getByRole('table');
    expect(within(table).getByText('PRODUTO EM ALERTA')).toBeInTheDocument();
    expect(within(table).queryByText('PRODUTO EM RUPTURA')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Pesquisar/i }));
    expect(within(table).getByText('PRODUTO EM RUPTURA')).toBeInTheDocument();
  });

  it('preserva o guard de carregamento', () => {
    testState.hookResult = createHookResult({
      consolidadoData: [],
      detalhadoData: [],
      giroData: [],
      isLoading: true,
    });

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
      'pelegrini:estoque:columns:1004:transmissao:consolidado',
      JSON.stringify(['product', 'quantity', 'status', 'group']),
    );
    localStorage.setItem(
      'pelegrini:estoque:columns:1004:chevrolet:consolidado',
      JSON.stringify(['product', 'quantity', 'status', 'brand']),
    );
    renderEstoquePage({ withBranchSwitcher: true });

    const transmissao = screen.getByRole('radio', { name: 'Casa da Transmissão' });
    const chevrolet = screen.getByRole('radio', { name: 'Casa do Chevrolet' });
    expect(transmissao).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('columnheader', { name: 'Grupo' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Marca' })).not.toBeInTheDocument();

    fireEvent.click(chevrolet);

    await waitFor(() => expect(chevrolet).toHaveAttribute('aria-checked', 'true'));
    expect(localStorage.getItem('bi-reports-filial-1004')).toBe('chevrolet');
    await waitFor(() => expect(screen.getByRole('columnheader', { name: 'Marca' })).toBeInTheDocument());
    expect(screen.queryByRole('columnheader', { name: 'Grupo' })).not.toBeInTheDocument();
  });

  it('limpa filtros pendentes e aplicados do Giro ao trocar de filial', async () => {
    renderEstoquePage({ withBranchSwitcher: true });
    fireEvent.click(screen.getByRole('tab', { name: 'Giro de Estoque' }));

    const search = screen.getByPlaceholderText('Buscar produto, fabricante, marca...');
    fireEvent.change(search, { target: { value: 'bomba' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(within(screen.getByRole('table')).queryByText('KIT EMBREAGEM PESADA')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'pendente' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Casa do Chevrolet' }));

    await waitFor(() => expect(search).toHaveValue(''));
    expect(within(screen.getByRole('table')).getByText('KIT EMBREAGEM PESADA')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filtros do giro' })).toBeInTheDocument();
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
