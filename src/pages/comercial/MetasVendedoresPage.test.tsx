import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useIsFetching } from '@tanstack/react-query';
import { useComercialData } from '@/hooks/useComercialData';
import { CampanhasTab } from '@/components/comercial/CampanhasTab';
import { InsightsIATab } from '@/components/comercial/InsightsIATab';
import { PremiumMetasView } from '@/components/comercial/PremiumMetasView';
import { getMesesDoFiltro, getPeriodoReferencia, preservarPeriodoExplicito } from '@/utils/metasFilterPeriod';
import MetasVendedoresPage from './MetasVendedoresPage';

const {
  campanhasState,
  empresaState,
  fetchingState,
  insightsQueryState,
  produtosState,
  produtosTotalizadoresState,
  produtosFiltroState,
  totaisState,
  supabaseInvoke,
} = vi.hoisted(() => ({
  campanhasState: {
    value: {
      campanhas: [],
      isLoading: false,
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      isMutating: false,
    },
  },
  empresaState: {
    value: {
      empresa: { nome: 'Casa da Transmissao', possui_meta_vendedor: true },
      codEmpresaAtiva: '1004',
      isLoading: false,
    },
  },
  fetchingState: { value: 0 },
  insightsQueryState: { value: { data: [], isFetching: false } },
  produtosState: {
    value: {
      produtos: [],
      receitaTotalizada: 0,
      pedidosDistintosTotalizados: 0,
      receitaPorVendedor1004: new Map(),
      isLoading: false,
      isFetching: false,
      error: null,
    },
  },
  produtosTotalizadoresState: { value: {} as Record<string, unknown> },
  produtosFiltroState: { value: {} as Record<string, unknown> },
  totaisState: { value: {} as Record<string, unknown> },
  supabaseInvoke: vi.fn(),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useIsFetching: vi.fn(),
    useQuery: vi.fn(() => insightsQueryState.value),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/hooks/useComercialData', () => ({ useComercialData: vi.fn() }));
vi.mock('@/hooks/useCampanhas', () => ({ useCampanhas: () => campanhasState.value }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/hooks/useComercialProdutos', () => ({
  useComercialProdutos: (filters?: Record<string, unknown>, options?: { enabled?: boolean }) => {
    if (options?.enabled !== undefined) return produtosFiltroState.value;
    if (filters?.ignorarEquipePadrao) return produtosTotalizadoresState.value;
    return produtosState.value;
  },
}));
vi.mock('@/hooks/useComercialTotais', () => ({
  useComercialTotaisIdeal: () => totaisState.value,
}));
vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: () => empresaState.value,
}));
vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({ filialAtiva: 'transmissao', filialNome: 'Casa da Transmissao' }),
}));
vi.mock('@/components/comercial/VisaoGeralRapida1004', () => ({
  VisaoGeralRapida1004: () => <section aria-label="Indicadores do dashboard comercial" className="commercial-metric-strip">Conteudo preservado</section>,
}));
vi.mock('@/components/comercial/ReceitaDetalheDialog', () => ({ ReceitaDetalheDialog: () => null }));
vi.mock('@/components/comercial/VendedorDetailsDialog', () => ({ VendedorDetailsDialog: () => null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: supabaseInvoke } },
}));
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: () => null,
  };
});

const comercialData = {
  vendedoresPerformance: [],
  pedidos: [],
  devolucoes: [],
  evolucaoDiaria: [],
  evolucaoMensal: [],
  clientesPerformance: [],
  insights: [],
  kpis: {},
  periodoDisponivel: { inicio: '2026-06-01', fim: '2026-06-30', ultimoAno: '2026', ultimoMes: '06' },
  vendedoresDisponiveis: [],
  isLoading: false,
  error: null,
};

describe('MetasVendedoresPage commercial dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    empresaState.value = {
      empresa: { nome: 'Casa da Transmissao', possui_meta_vendedor: true },
      codEmpresaAtiva: '1004',
      isLoading: false,
    };
    fetchingState.value = 0;
    produtosState.value = {
      produtos: [],
      receitaTotalizada: 0,
      pedidosDistintosTotalizados: 0,
      receitaPorVendedor1004: new Map(),
      isLoading: false,
      isFetching: false,
      error: null,
    };
    produtosTotalizadoresState.value = { ...produtosState.value };
    produtosFiltroState.value = { ...produtosState.value };
    totaisState.value = {
      pedidos: null,
      produtos: null,
      isLoading: false,
      isFetching: false,
      error: null,
    };
    vi.mocked(useComercialData).mockReturnValue(comercialData as ReturnType<typeof useComercialData>);
    vi.mocked(useIsFetching).mockImplementation(() => fetchingState.value);
  });

  it('aplica as classes semanticas ao dashboard e a faixa de abas', async () => {
    render(<main aria-label="Modulo comercial"><MetasVendedoresPage /></main>);

    expect(await screen.findByText('Conteudo preservado')).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('main').querySelector('.commercial-dashboard')).toHaveProperty('tagName', 'DIV');
    expect(screen.getByRole('tablist')).toHaveClass('commercial-tab-strip');
    expect(screen.getByLabelText('Indicadores do dashboard comercial')).toHaveClass('commercial-metric-strip');
    expect(screen.queryByText('Visão comercial')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Análises' })).not.toBeInTheDocument();
  });

  it('preserva um intervalo explicito e usa o ultimo mes como referencia', () => {
    const filters = {
      anos: ['2026'],
      meses: ['06'],
      periodo: { inicio: '2026-06-01', fim: '2026-09-15' },
    };

    expect(preservarPeriodoExplicito(filters, true)).toEqual(filters);
    expect(preservarPeriodoExplicito({
      anos: ['2026'],
      meses: ['06'],
      periodo: { inicio: '2026-06-10', fim: '2026-06-15' },
    }, true)?.periodo).toEqual({ inicio: '2026-06-10', fim: '2026-06-15' });
    expect(getPeriodoReferencia(filters, null, new Date('2026-09-15T12:00:00'))).toEqual({ ano: 2026, mes: 9 });
    expect(getMesesDoFiltro(filters)).toEqual(new Set(['2026-06', '2026-07', '2026-08', '2026-09']));
  });

  it('deixa a neutralizacao da sombra do trigger ativo a cargo do shell comercial', async () => {
    render(<MetasVendedoresPage />);

    const activeTab = await screen.findByRole('tab', { name: 'Visão geral' });
    expect(activeTab).toHaveAttribute('data-state', 'active');
    expect(activeTab).not.toHaveClass('data-[state=active]:shadow-none');
    expect(activeTab).toHaveClass('data-[state=active]:shadow-sm');
  });

  it('percorre disabled, loading e dados sem perder o conteudo no refetch', async () => {
    empresaState.value = {
      empresa: undefined,
      codEmpresaAtiva: undefined,
      isLoading: true,
    };
    vi.mocked(useComercialData).mockReturnValue({
      ...comercialData,
      periodoDisponivel: null,
      isLoading: false,
    } as ReturnType<typeof useComercialData>);

    const { rerender } = render(<MetasVendedoresPage />);
    await act(async () => undefined);

    expect(screen.getByRole('status', { name: 'Carregando visão comercial' })).toBeInTheDocument();
    expect(screen.queryByText('Conteudo preservado')).not.toBeInTheDocument();

    empresaState.value = {
      empresa: { nome: 'Casa da Transmissao', possui_meta_vendedor: true },
      codEmpresaAtiva: '1004',
      isLoading: false,
    };

    vi.mocked(useComercialData).mockReturnValue({
      ...comercialData,
      periodoDisponivel: null,
      isLoading: true,
    } as ReturnType<typeof useComercialData>);

    await act(async () => rerender(<MetasVendedoresPage />));
    const initialLoading = screen.getByRole('status', { name: 'Carregando visão comercial' });
    expect(initialLoading).toBeInTheDocument();
    expect(screen.queryByText('Carregando visão comercial...')).not.toBeInTheDocument();
    expect(within(initialLoading).getByTestId('loading-indicator')).toBeInTheDocument();

    vi.mocked(useComercialData).mockReturnValue(comercialData as ReturnType<typeof useComercialData>);
    await act(async () => rerender(<MetasVendedoresPage />));
    expect(await screen.findByText('Conteudo preservado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expandir filtros' }));
    const page = screen.getByRole('tablist').closest('.commercial-dashboard')!;

    fetchingState.value = 1;
    await act(async () => rerender(<MetasVendedoresPage />));

    const searchButton = screen.getByRole('button', { name: 'Buscar' });
    expect(screen.getByText('Conteudo preservado')).toBeInTheDocument();
    expect(searchButton).toBeVisible();
    expect(searchButton).toBeDisabled();
    expect(searchButton).toHaveAttribute('aria-busy', 'true');
    expect(within(searchButton).getByTestId('loading-indicator')).toHaveClass('h-4', 'w-4');
    expect(screen.queryByRole('status', { name: 'Atualizando dados comerciais' })).not.toBeInTheDocument();
    expect(screen.queryByText('Carregando visão comercial...')).not.toBeInTheDocument();

    fetchingState.value = 0;
    await act(async () => rerender(<MetasVendedoresPage />));
    expect(within(screen.getByRole('button', { name: 'Buscar' })).queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(page).toContainElement(screen.getByText('Conteudo preservado'));
  });

  it('bloqueia dados da empresa anterior durante hidratacao e troca de empresa', async () => {
    const { rerender } = render(<MetasVendedoresPage />);
    expect(await screen.findByText('Conteudo preservado')).toBeInTheDocument();

    empresaState.value = {
      empresa: undefined,
      codEmpresaAtiva: '2000',
      isLoading: true,
    };
    await act(async () => rerender(<MetasVendedoresPage />));

    expect(screen.getByRole('status', { name: 'Carregando visão comercial' })).toBeInTheDocument();
    expect(screen.queryByText('Conteudo preservado')).not.toBeInTheDocument();

    empresaState.value = {
      empresa: { nome: 'Empresa 2000', possui_meta_vendedor: true },
      codEmpresaAtiva: '2000',
      isLoading: false,
    };
    vi.mocked(useComercialData).mockReturnValue({
      ...comercialData,
      isLoading: true,
    } as ReturnType<typeof useComercialData>);
    await act(async () => rerender(<MetasVendedoresPage />));

    expect(screen.getByRole('status', { name: 'Carregando visão comercial' })).toBeInTheDocument();
    expect(screen.queryByText('Conteudo preservado')).not.toBeInTheDocument();
  });

  it('espera produtos e totalizadores quando a base da empresa resolve primeiro', async () => {
    empresaState.value = {
      empresa: { nome: 'Empresa 10041', possui_meta_vendedor: true },
      codEmpresaAtiva: '10041',
      isLoading: false,
    };
    produtosState.value = { ...produtosState.value, isFetching: true };
    produtosTotalizadoresState.value = { ...produtosTotalizadoresState.value, isFetching: true };
    totaisState.value = { ...totaisState.value, isFetching: true };

    const { rerender } = render(<MetasVendedoresPage />);

    expect(screen.getByRole('status', { name: 'Carregando visão comercial' })).toBeInTheDocument();

    produtosState.value = { ...produtosState.value, isFetching: false };
    await act(async () => rerender(<MetasVendedoresPage />));
    expect(screen.getByRole('status', { name: 'Carregando visão comercial' })).toBeInTheDocument();

    produtosTotalizadoresState.value = { ...produtosTotalizadoresState.value, isFetching: false };
    await act(async () => rerender(<MetasVendedoresPage />));
    expect(screen.getByRole('status', { name: 'Carregando visão comercial' })).toBeInTheDocument();

    totaisState.value = { ...totaisState.value, isFetching: false };
    await act(async () => rerender(<MetasVendedoresPage />));
    expect(await screen.findByText('Conteudo preservado')).toBeInTheDocument();
  });

  it('isola a empresa anterior ate o produto do filtro aberto resolver', async () => {
    const { rerender } = render(<MetasVendedoresPage />);
    expect(await screen.findByText('Conteudo preservado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expandir filtros' }));
    empresaState.value = {
      empresa: undefined,
      codEmpresaAtiva: '10041',
      isLoading: true,
    };
    await act(async () => rerender(<MetasVendedoresPage />));
    expect(screen.queryByText('Conteudo preservado')).not.toBeInTheDocument();

    empresaState.value = {
      empresa: { nome: 'Empresa 10041', possui_meta_vendedor: true },
      codEmpresaAtiva: '10041',
      isLoading: false,
    };
    produtosFiltroState.value = { ...produtosFiltroState.value, isFetching: true };
    await act(async () => rerender(<MetasVendedoresPage />));

    expect(screen.getByRole('status', { name: 'Carregando visão comercial' })).toBeInTheDocument();
    expect(screen.queryByText('Conteudo preservado')).not.toBeInTheDocument();

    produtosFiltroState.value = { ...produtosFiltroState.value, isFetching: false };
    await act(async () => rerender(<MetasVendedoresPage />));
    expect(await screen.findByText('Conteudo preservado')).toBeInTheDocument();
  });

  it('preserva metas possuidas quando o refresh de produtos falha', async () => {
    const { rerender } = render(<MetasVendedoresPage />);
    expect(await screen.findByText('Conteudo preservado')).toBeInTheDocument();

    produtosState.value = {
      ...produtosState.value,
      error: new Error('Falha ao atualizar produtos'),
    };
    await act(async () => rerender(<MetasVendedoresPage />));

    expect(screen.getByText('Conteudo preservado')).toBeInTheDocument();
    expect(screen.queryByText('Erro ao carregar dados comerciais')).not.toBeInTheDocument();
  });

  it('preserva metas possuidas quando as opcoes de filtro falham', async () => {
    const { rerender } = render(<MetasVendedoresPage />);
    expect(await screen.findByText('Conteudo preservado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expandir filtros' }));
    produtosFiltroState.value = {
      ...produtosFiltroState.value,
      error: new Error('Falha ao atualizar opcoes de vendedores'),
    };
    await act(async () => rerender(<MetasVendedoresPage />));

    expect(screen.getByText('Conteudo preservado')).toBeInTheDocument();
    expect(screen.queryByText('Erro ao carregar dados comerciais')).not.toBeInTheDocument();
  });

  it('mantem a falha inicial de dependencia acionavel', () => {
    produtosState.value = {
      ...produtosState.value,
      error: new Error('Falha inicial de produtos'),
    };

    render(<MetasVendedoresPage />);

    expect(screen.getByText('Erro ao carregar dados comerciais')).toBeInTheDocument();
    expect(screen.queryByText('Conteudo preservado')).not.toBeInTheDocument();
  });

  it('usa uma estrutura neutra para os cenarios dentro da secao premium', async () => {
    sessionStorage.setItem('comercial:metas:tab', 'comparativos');
    vi.mocked(useComercialData).mockReturnValue({
      ...comercialData,
      vendedoresPerformance: [{ codigo: 98, nome: 'DANIEL' }],
      pedidos: [{
        vendedor_codigo: 98,
        vendedor_nome: 'DANIEL',
        data_faturamento: '2026-06-05',
        valor_liquido_final: 1000,
        valor_bruto: 1000,
        meta_vendedor: 2000,
        tipo: 'PEDIDO',
      }],
    } as ReturnType<typeof useComercialData>);

    const { container } = render(<MetasVendedoresPage />);

    const section = (await screen.findByText(/Se mantiver ritmo atual/)).closest('.commercial-dashboard-panel');
    expect(section).not.toBeNull();
    expect(screen.queryByText('Projeções por Cenário - Vai Bater a Meta?')).not.toBeInTheDocument();
    expect(screen.queryByText('Análise de cada vendedor com base em diferentes cenários de performance')).not.toBeInTheDocument();
    expect(section?.querySelector('.commercial-scenario-panel')).toBeInTheDocument();
    expect(section?.querySelectorAll('.bg-card')).toHaveLength(0);
  });

  it('keeps only the metas filter when the metas tab is active', async () => {
    sessionStorage.setItem('comercial:metas:tab', 'metas-diarias');
    render(<MetasVendedoresPage />);

    await waitFor(() => expect(screen.queryByTestId('enterprise-filter-bar')).not.toBeInTheDocument());
    expect(await screen.findByRole('tab', { name: 'Metas' })).toHaveAttribute('data-state', 'active');
  });

  it('falls back to the overview when the removed analyses tab was persisted', async () => {
    sessionStorage.setItem('comercial:metas:tab', 'insights');
    render(<MetasVendedoresPage />);

    expect(await screen.findByRole('tab', { name: 'Visão geral' })).toHaveAttribute('data-state', 'active');
    expect(screen.queryByRole('tab', { name: 'Análises' })).not.toBeInTheDocument();
  });

  it('removes redundant ranking headings', async () => {
    render(<MetasVendedoresPage />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Ranking' }));

    expect(screen.queryByText('Ranking de Vendedores')).not.toBeInTheDocument();
    expect(screen.queryByText('Performance por vendedor ordenada por valor líquido')).not.toBeInTheDocument();
  });
});

describe('CampanhasTab loading lifecycle', () => {
  beforeEach(() => {
    fetchingState.value = 0;
    insightsQueryState.value = { data: [], isFetching: false };
    produtosState.value = {
      produtos: [],
      receitaTotalizada: 0,
      pedidosDistintosTotalizados: 0,
      receitaPorVendedor1004: new Map(),
      isLoading: false,
      isFetching: false,
      error: null,
    };
    campanhasState.value = {
      campanhas: [],
      isLoading: false,
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      isMutating: false,
    };
    empresaState.value = {
      empresa: undefined,
      codEmpresaAtiva: undefined,
      isLoading: true,
    };
    vi.mocked(useIsFetching).mockImplementation(() => fetchingState.value);
  });

  it('marks both ported shadow dialogs as commercial overlays', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/comercial/CampanhasTab.tsx'),
      'utf8',
    );
    const portedDialogClasses = [...source.matchAll(/<DialogContent className="([^"]*shadow-xl[^"]*)">/g)]
      .map((match) => match[1]);

    expect(portedDialogClasses).toHaveLength(2);
    portedDialogClasses.forEach((className) => {
      expect(className).toContain('commercial-overlay');
    });
  });

  it('percorre disabled, loading e dados sem perder campanhas no refetch', async () => {
    const { rerender } = render(<CampanhasTab />);
    await act(async () => undefined);

    empresaState.value = {
      empresa: { nome: 'Casa da Transmissao', possui_meta_vendedor: true },
      codEmpresaAtiva: '1004',
      isLoading: false,
    };
    campanhasState.value = { ...campanhasState.value, isLoading: true };
    await act(async () => rerender(<CampanhasTab />));

    expect(screen.getByRole('status', { name: 'Carregando campanhas' }))
      .not.toHaveClass('commercial-dashboard-panel');

    campanhasState.value = { ...campanhasState.value, campanhas: [], isLoading: false };
    await act(async () => rerender(<CampanhasTab />));
    expect(await screen.findByText('Nenhuma campanha ainda')).toBeInTheDocument();

    const toolbar = screen.getByRole('region', { name: 'Filtros de campanhas' });
    const status = toolbar.querySelector('[role="status"]');
    expect(status).toHaveClass('h-5', 'w-5', 'shrink-0');
    const page = toolbar.parentElement!;
    const pageChildren = Array.from(page.children);

    fetchingState.value = 1;
    await act(async () => rerender(<CampanhasTab />));
    expect(screen.getByText('Nenhuma campanha ainda')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Atualizando campanhas comerciais' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Atualizando campanhas comerciais' })).toBe(status);
    expect(Array.from(page.children)).toEqual(pageChildren);

    fetchingState.value = 0;
    await act(async () => rerender(<CampanhasTab />));
    expect(toolbar.querySelector('[role="status"]')).toBe(status);
    expect(status).toBeEmptyDOMElement();
    expect(Array.from(page.children)).toEqual(pageChildren);
  });

  it('mantem os dados de produtos visiveis e sinaliza o refetch de campanhas', async () => {
    empresaState.value = {
      empresa: { nome: 'Casa da Transmissao', possui_meta_vendedor: true },
      codEmpresaAtiva: '1004',
      isLoading: false,
    };
    campanhasState.value = {
      ...campanhasState.value,
      campanhas: [{
        id: 'campanha-eaton',
        cod_empresa_bi: '1004',
        nome: 'Campanha EATON',
        marca: null,
        marcas: [{ marca: 'EATON', meta_mensal: 2500, percentual_premio: 1 }],
        data_inicio: '2026-08-01',
        data_fim: '2026-08-31',
        meta_valor: 2500,
        meta_geral_mensal: 2500,
        bonus_meta_geral: 0,
        premiacao: null,
        descricao: null,
        mensagem_equipe: null,
        observacoes: null,
        status: 'ativa',
        criado_por: 'user-1',
        created_at: '2026-08-01',
        updated_at: '2026-08-01',
      }],
    };
    produtosState.value = {
      ...produtosState.value,
      produtos: [{
        id: 'produto-eaton',
        cod_produto: 10,
        descricao: 'Kit EATON',
        data_faturamento: '2026-08-10',
        cod_empresa_bi: '1004',
        tipo: 'PEDIDO' as const,
        marca: 'EATON',
        vendedor_codigo: 98,
        vendedor_nome: 'DANIEL',
        quantidade: 1,
        valor_unitario: 1250,
        valor_total: 1250,
      }],
    };
    produtosTotalizadoresState.value = { ...produtosState.value };

    const { rerender } = render(<CampanhasTab />);

    expect((await screen.findAllByText('Campanha EATON')).length).toBeGreaterThan(0);
    expect(screen.getByText('Meta total da CT')).toBeInTheDocument();
    expect(screen.getByText('Campanha ativa')).toBeInTheDocument();
    expect(screen.getAllByText(/1\.250,00/).length).toBeGreaterThan(0);

    produtosState.value = { ...produtosState.value, isFetching: true };
    produtosTotalizadoresState.value = { ...produtosState.value };
    await act(async () => rerender(<CampanhasTab />));

    expect(screen.getAllByText('Campanha EATON').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1\.250,00/).length).toBeGreaterThan(0);
    expect(screen.getByRole('status', { name: 'Atualizando campanhas comerciais' })).toBeInTheDocument();
  });
});

describe('InsightsIATab management actions', () => {
  beforeEach(() => {
    supabaseInvoke.mockReset();
  });

  it('marca os estados inicial e de carregamento como paineis do dashboard', async () => {
    supabaseInvoke.mockImplementationOnce(() => new Promise(() => undefined));
    const { container } = render(<InsightsIATab vendedores={[]} kpis={{}} />);

    expect(screen.getByText('Análises comerciais').closest('.commercial-dashboard-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gerar análises' }));

    expect(await screen.findByRole('status', { name: 'Carregando análises comerciais' }))
      .toHaveClass('commercial-dashboard-panel', 'commercial-insight-loading');
    expect(container.querySelector('.commercial-chart-frame')).toBeNull();
  });

  it('mantem a recomendacao completa montada enquanto atualiza', async () => {
    let finishRefresh: (value: unknown) => void = () => undefined;
    supabaseInvoke
      .mockResolvedValueOnce({
        data: {
          insights: [{
            tipo: 'oportunidade',
            titulo: 'Recuperar carteira prioritaria',
            descricao: 'Contatar todos os clientes sem recompra e revisar a proposta comercial ainda nesta semana.',
          }],
        },
        error: null,
      })
      .mockImplementationOnce(() => new Promise((resolve) => { finishRefresh = resolve; }));

    render(<InsightsIATab vendedores={[]} kpis={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gerar análises' }));

    const action = await screen.findByText(/Contatar todos os clientes/);
    expect(action).toHaveClass('commercial-insight-action');
    expect(action).not.toHaveClass('truncate', 'line-clamp-1', 'line-clamp-2');

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(screen.getByText(/Contatar todos os clientes/)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Atualizando análises comerciais' })).toBeInTheDocument();

    await act(async () => {
      finishRefresh({ data: { insights: [] }, error: null });
    });
  });
});

describe('PremiumMetasView management signals', () => {
  it('does not transition progress width or other layout dimensions', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/comercial/PremiumMetasView.tsx'), 'utf8');
    expect(source).not.toMatch(/transition-(?:all|\[[^\]]*(?:width|height|padding|margin)[^\]]*\])/);
  });
  it('mantem os numeros e completa cada sinal com uma acao gerencial', () => {
    const { container } = render(
      <PremiumMetasView
        vendedoresComMeta={[{
          codigo: 98,
          nome: 'DANIEL',
          metaMensal: 2000,
          faturamentoMesAtual: 1000,
          valorTotal: 1000,
          percentualMetaFaturado: 50,
          metaDiaria: 90.91,
          metaEsperada: 454.55,
        }]}
        pedidos={[]}
        kpisGerais={{
          totalMeta: 2000,
          totalFaturado: 1000,
          percentualFaturado: 50,
          faltaFaturado: 1000,
          acimaMeta: 0,
          abaixoMeta: 1,
          totalVendedores: 1,
          totalDevolucoes: 0,
          clientesAtendidos: 1,
          qtdPedidos: 1,
          ticketMedio: 1000,
        }}
        periodoFiltros={{ ano: 2026, mes: 6 }}
        diasUteisNoMes={22}
        diasUteisDecorridos={5}
      />,
    );

    const signals = Array.from(container.querySelectorAll('.commercial-insight-action'));
    expect(signals).toHaveLength(3);
    expect(signals.every((signal) => signal.textContent?.includes('Ação gerencial:'))).toBe(true);
    expect(screen.getByText(/Necessário R\$ 58,82\/dia em 17 dias úteis\./)).toBeInTheDocument();
    expect(screen.getByText(/Ritmo atual fecha em R\$ 4\.400,00/)).toBeInTheDocument();
    expect(container.querySelector('.commercial-chart-frame')).toBeInTheDocument();
  });

  it('limits both monthly panels and totals to the applied period', () => {
    render(
      <PremiumMetasView
        vendedoresComMeta={[{
          codigo: 98,
          nome: 'DANIEL',
          metaMensal: 2000,
          faturamentoMesAtual: 1000,
          valorTotal: 1000,
          percentualMetaFaturado: 50,
          metaDiaria: 90.91,
          metaEsperada: 454.55,
        }]}
        pedidos={[
          { vendedor_codigo: 98, data_faturamento: '2026-06-05', valor_liquido_final: 1000 },
          { vendedor_codigo: 98, data_faturamento: '2026-05-05', valor_liquido_final: 8000 },
        ]}
        kpisGerais={{
          totalMeta: 9999,
          totalFaturado: 9999,
          percentualFaturado: 100,
          faltaFaturado: 0,
          acimaMeta: 0,
          abaixoMeta: 1,
          totalVendedores: 1,
          totalDevolucoes: 0,
          clientesAtendidos: 1,
        }}
        periodoFiltros={{ ano: 2026, mes: 6 }}
        periodoAplicado={{ inicio: '2026-06-01', fim: '2026-06-30' }}
        diasUteisNoMes={22}
        diasUteisDecorridos={5}
      />,
    );

    const totalRealizado = screen.getByText('Total Realizado').parentElement!;
    expect(totalRealizado).toHaveTextContent('R$ 1.000,00');
    expect(screen.getByText('Junho')).toBeInTheDocument();
    expect(screen.queryByText('Maio')).not.toBeInTheDocument();
    expect(screen.queryByText('R$ 8.000,00')).not.toBeInTheDocument();
  });
});

describe('CampanhasTab commercial overlays', () => {
  it('marks every portalled content surface with the commercial overlay scope', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/comercial/CampanhasTab.tsx'),
      'utf8',
    );
    const portalledContents = source.match(
      /<(?:PopoverContent|SelectContent|DialogContent|AlertDialogContent|TooltipContent)\b[^>]*>/g,
    ) ?? [];

    expect(portalledContents.length).toBeGreaterThan(0);
    expect(portalledContents.every((tag) => tag.includes('commercial-overlay'))).toBe(true);
  });
});
