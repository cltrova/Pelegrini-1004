import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useIsFetching, useQuery } from '@tanstack/react-query';
import { useComercialData } from '@/hooks/useComercialData';
import { CampanhasTab } from '@/components/comercial/CampanhasTab';
import { InsightsIATab } from '@/components/comercial/InsightsIATab';
import { PremiumMetasView } from '@/components/comercial/PremiumMetasView';
import { getMesesDoFiltro, getPeriodoReferencia, preservarPeriodoExplicito } from '@/utils/metasFilterPeriod';
import MetasVendedoresPage from './MetasVendedoresPage';

const {
  campanhasState,
  empresaState,
  filialState,
  fetchingState,
  insightsQueryState,
  dailyInsightsState,
  produtosState,
  produtosTotalizadoresState,
  produtosFiltroState,
  totaisState,
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
  dailyInsightsState: { data: null as {
    dia: string;
    periodo: { inicio: string; fim: string };
    insights: { tipo: string; titulo: string; descricao: string }[];
  } | null },
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
  filialState: {
    value: { filialAtiva: 'transmissao', filialNome: 'Casa da Transmissao' },
  },
  produtosTotalizadoresState: { value: {} as Record<string, unknown> },
  produtosFiltroState: { value: {} as Record<string, unknown> },
  totaisState: { value: {} as Record<string, unknown> },
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useIsFetching: vi.fn(),
    useQuery: vi.fn(({ queryKey }) => queryKey[0] === 'analises-comerciais-diarias' ? dailyInsightsState : insightsQueryState.value),
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
  useFilialSelecionada: () => filialState.value,
}));
vi.mock('@/components/comercial/VisaoGeralRapida1004', () => ({
  VisaoGeralRapida1004: () => <section aria-label="Indicadores do dashboard comercial" className="commercial-metric-strip">Conteudo preservado</section>,
}));
vi.mock('@/components/comercial/ReceitaDetalheDialog', () => ({ ReceitaDetalheDialog: () => null }));
vi.mock('@/components/comercial/VendedorDetailsDialog', () => ({ VendedorDetailsDialog: () => null }));
vi.mock('@/lib/aiApi', () => ({ getDailyCommercialInsights: vi.fn() }));
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

  it('abre o filtro ao lado das abas e aplica sem desmontar a visão geral', async () => {
    render(<MetasVendedoresPage />);

    const overview = await screen.findByText('Conteudo preservado');
    const tabs = screen.getByRole('tablist');
    const trigger = screen.getByRole('button', { name: 'Expandir filtros' });
    expect(tabs.parentElement?.parentElement).toContainElement(trigger);
    expect(tabs.compareDocumentPosition(trigger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(trigger).queryByText(/^\d+$/)).not.toBeInTheDocument();

    fireEvent.click(trigger);
    const panel = await screen.findByRole('dialog', { name: 'Filtros comerciais' });
    fireEvent.click(within(panel).getByRole('button', { name: '2026' }));
    fireEvent.click(await screen.findByRole('button', { name: '2025' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Buscar' }));

    await waitFor(() => expect(panel).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Expandir filtros' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Conteudo preservado')).toBe(overview);
    expect(vi.mocked(useComercialData).mock.lastCall?.[0]?.anos).toEqual(['2025', '2026']);
  });

  it.each(['Detalhes', 'Comparativos'])('mantém o filtro à direita das abas em %s', async (name) => {
    render(<MetasVendedoresPage />);

    const dashboard = await screen.findByRole('tablist', { name: 'Dashboard comercial' });
    fireEvent.mouseDown(within(dashboard).getByRole('tab', { name }), { button: 0 });

    const filter = await screen.findByRole('button', { name: 'Expandir filtros' });
    expect(dashboard.parentElement?.parentElement).toContainElement(filter);
    fireEvent.click(filter);
    expect(await screen.findByRole('dialog', { name: 'Filtros comerciais' })).toBeVisible();
  });

  it('bloqueia a visao resolvida de transmissao enquanto chevrolet esta pendente', async () => {
    const { rerender } = render(<MetasVendedoresPage />);

    expect(await screen.findByText('Conteudo preservado')).toBeInTheDocument();

    filialState.value = { filialAtiva: 'chevrolet', filialNome: 'Chevrolet' };
    vi.mocked(useComercialData).mockReturnValue({
      ...comercialData,
      isLoading: true,
      isFetching: true,
    } as ReturnType<typeof useComercialData>);
    await act(async () => rerender(<MetasVendedoresPage />));

    expect(screen.getByRole('status', { name: 'Carregando visão comercial' })).toBeInTheDocument();
    expect(screen.queryByText('Conteudo preservado')).not.toBeInTheDocument();
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

  it('destaca a aba ativa e mantém o indicador de foco pelo teclado', async () => {
    render(<MetasVendedoresPage />);

    const activeTab = await screen.findByRole('tab', { name: 'Visão geral' });
    expect(activeTab).toHaveAttribute('aria-selected', 'true');
    expect(activeTab).toHaveClass('data-[state=active]:bg-primary', 'focus-visible:ring-inset', 'focus-visible:ring-ring');
    expect(activeTab).not.toHaveClass('data-[state=active]:shadow-sm');
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
    expect(initialLoading).toHaveClass('flex-1', 'min-h-0');
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
    filialState.value = { filialAtiva: 'transmissao', filialNome: 'Casa da Transmissao' };
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

  it('bloqueia uma aba persistida quando uma dependencia ainda nao foi resolvida', () => {
    sessionStorage.setItem('comercial:metas:tab', 'comparativos');
    produtosState.value = {
      ...produtosState.value,
      error: new Error('Falha inicial de produtos'),
    };

    render(<MetasVendedoresPage />);

    expect(screen.getByText('Erro ao carregar dados comerciais')).toBeInTheDocument();
    expect(screen.queryByText('Análises executivas')).not.toBeInTheDocument();
  });

  it('mostra os três cenários de cada vendedor diretamente na lista', async () => {
    sessionStorage.setItem('comercial:metas:tab', 'comparativos');
    const vendedores = ['DANIEL', 'ELIANA', 'MARCOS', 'ANA', 'PEDRO', 'JULIA']
      .map((nome, index) => ({ nome, codigo: 90 + index }));
    vi.mocked(useComercialData).mockReturnValue({
      ...comercialData,
      vendedoresPerformance: vendedores,
      pedidos: vendedores.slice(0, 5).map(({ nome, codigo }) => ({
        vendedor_codigo: codigo,
        vendedor_nome: nome,
        data_faturamento: '2026-06-05',
        valor_liquido_final: 1000,
        valor_bruto: 1000,
        meta_vendedor: 2000,
        tipo: 'PEDIDO',
      })),
    } as ReturnType<typeof useComercialData>);

    render(<MetasVendedoresPage />);
    const section = await screen.findByRole('region', { name: 'Cenários' });
    expect(screen.queryByRole('tab', { name: 'Desempenho' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Cenários' })).not.toBeInTheDocument();
    expect(within(section).queryByRole('heading', { name: 'Cenários' })).not.toBeInTheDocument();
    expect(within(section).queryByText(/Projeção até o fim do mês pelo ritmo atual/)).not.toBeInTheDocument();
    expect(within(section).queryByRole('button')).not.toBeInTheDocument();
    expect(within(section).getByRole('list')).toHaveClass('dashboard-seller-list');
    expect(within(section).getAllByRole('listitem')).toHaveLength(6);
    for (const { nome } of vendedores) {
      const heading = within(section).getByRole('heading', { name: nome });
      expect(heading).toBeVisible();
      const seller = within(heading.closest('li')!);
      expect(seller.getByText('Ritmo atual', { exact: true })).toBeVisible();
      expect(seller.getByText('+5% no ritmo diário', { exact: true })).toBeVisible();
      expect(seller.getByText('+10% no ritmo diário', { exact: true })).toBeVisible();
    }
    const sellerWithoutGoal = within(section).getByRole('heading', { name: 'JULIA' }).closest('li')!;
    expect(within(sellerWithoutGoal).getAllByText('Sem meta', { exact: true })).toHaveLength(3);
  });

  it('exibe os detalhes e a situação da meta até hoje de cada vendedor', async () => {
    sessionStorage.setItem('comercial:metas:tab', 'metas-diarias');
    const vendedores = [
      { codigo: 90, nome: 'DANIEL', realizado: 1700, meta: 2000, aviso: 'Abaixo da meta' },
      { codigo: 91, nome: 'JULIA', realizado: 250, meta: 0, aviso: 'Sem meta cadastrada' },
      { codigo: 92, nome: 'ALINE', realizado: 2200, meta: 2000, aviso: 'Acima da meta' },
      { codigo: 93, nome: 'RAFAEL', realizado: 1900, meta: 2000, aviso: 'Próximo da meta' },
      { codigo: 94, nome: 'ELIANA', realizado: 2000, meta: 2000, aviso: 'Meta atingida' },
    ];
    vi.mocked(useComercialData).mockReturnValue({
      ...comercialData,
      vendedoresPerformance: vendedores.map(({ codigo, nome }) => ({ codigo, nome })),
      pedidos: vendedores.map(({ codigo, nome, realizado, meta }) => ({
        vendedor_codigo: codigo,
        vendedor_nome: nome,
        data_pedido: '2026-06-05',
        data_faturamento: '2026-06-05',
        valor_liquido: realizado,
        valor_liquido_final: realizado,
        valor_bruto: realizado,
        meta_vendedor: meta,
        status: 'faturado',
        tipo: 'PEDIDO',
      })),
    } as ReturnType<typeof useComercialData>);

    render(<MetasVendedoresPage />);

    const list = await screen.findByRole('region', { name: 'Metas por vendedor' });
    expect(screen.queryByRole('heading', { name: 'Metas diárias' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Resumo das metas diárias' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Indicadores de metas diárias' })).not.toBeInTheDocument();
    expect(within(list).queryByRole('button')).not.toBeInTheDocument();
    expect(within(list).getByRole('list')).toHaveClass('dashboard-seller-list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(vendedores.length);
    for (const { nome, aviso } of vendedores) {
      const heading = within(list).getByRole('heading', { name: nome });
      const row = within(heading.closest('li')!);
      expect(row.getByText(aviso)).toBeVisible();
      expect(row.getByText('Média por dia')).toBeVisible();
    }
  });

  it('keeps only the metas filter when the metas tab is active', async () => {
    sessionStorage.setItem('comercial:metas:tab', 'metas-diarias');
    render(<MetasVendedoresPage />);

    await waitFor(() => expect(screen.queryByTestId('enterprise-filter-bar')).not.toBeInTheDocument());
    expect(await screen.findByRole('tab', { name: 'Metas' })).toHaveAttribute('data-state', 'active');
    expect(await screen.findByRole('heading', { name: 'Nenhum dado encontrado para o período' }, { timeout: 10000 })).toBeVisible();
    const trigger = screen.getByRole('button', { name: 'Expandir filtros' });
    expect(screen.getByRole('tablist', { name: 'Dashboard comercial' }).parentElement?.parentElement).toContainElement(trigger);
    fireEvent.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Filtros comerciais' })).toBeVisible();
  }, 15000);

  it('abre os filtros específicos de Campanhas à direita das abas', async () => {
    sessionStorage.setItem('comercial:metas:tab', 'campanhas');
    render(<MetasVendedoresPage />);

    const filter = await screen.findByRole('button', { name: 'Expandir filtros' }, { timeout: 5000 });
    expect(screen.getByRole('heading', { name: 'Campanhas comerciais' })).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Nova campanha' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('tablist', { name: 'Dashboard comercial' }).parentElement?.parentElement).toContainElement(filter);
    fireEvent.click(filter);
    const dialog = await screen.findByRole('dialog', { name: 'Filtros comerciais' });
    expect(within(dialog).getByRole('combobox', { name: 'Status da campanha' })).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Todas as marcas' })).toBeVisible();
  });

  it('falls back to the overview when the removed analyses tab was persisted', async () => {
    sessionStorage.setItem('comercial:metas:tab', 'insights');
    render(<MetasVendedoresPage />);

    expect(await screen.findByRole('tab', { name: 'Visão geral' })).toHaveAttribute('data-state', 'active');
    expect(screen.queryByRole('tab', { name: 'Análises' })).not.toBeInTheDocument();
  });

  it('abre Metas quando a aba Ranking removida estava salva', async () => {
    sessionStorage.setItem('comercial:metas:tab', 'ranking');
    render(<MetasVendedoresPage />);

    expect(await screen.findByRole('tabpanel', { name: 'Metas' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Metas' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: 'Ranking' })).not.toBeInTheDocument();
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

describe('análises diárias em Detalhes', () => {
  it('mostra somente o título e abre a análise completa da filial ao clicar', async () => {
    const periodo = { inicio: '2026-06-01', fim: '2026-06-05' };
    const descricao = 'Priorize os pedidos próximos de faturar.';
    dailyInsightsState.data = {
      dia: '2026-06-06', periodo,
      insights: [{ tipo: 'oportunidade', titulo: 'Revisar carteira', descricao }],
    };
    const panel = (filtros: typeof periodo) => (
      <InsightsIATab filial="chevrolet" periodo={filtros}><p>Indicadores do período</p></InsightsIATab>
    );
    const { rerender } = render(panel({ ...periodo, fim: '2026-06-06' }));

    expect(useQuery).toHaveBeenLastCalledWith(expect.objectContaining({
      queryKey: ['analises-comerciais-diarias', 'user-1', 'chevrolet'], enabled: true,
    }));
    expect(screen.queryByText(descricao)).not.toBeInTheDocument();
    expect(screen.queryByText(/Comissões do RSYS até/)).not.toBeInTheDocument();
    expect(screen.queryByText('05/06/2026')).not.toBeInTheDocument();
    expect(screen.queryByText('Análises comerciais')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gerar análises' })).not.toBeInTheDocument();

    const card = screen.getByRole('button', { name: 'Revisar carteira' });
    expect(card).toHaveTextContent(/^Revisar carteira$/);
    card.focus();
    fireEvent.click(card);
    const dialog = screen.getByRole('dialog', { name: 'Revisar carteira' });
    expect(within(dialog).getByText(descricao)).toBeVisible();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(card).toHaveFocus();
    expect(screen.queryByText(descricao)).not.toBeInTheDocument();

    rerender(panel({ ...periodo, fim: '2026-06-04' }));
    expect(screen.queryByText('Revisar carteira')).not.toBeInTheDocument();
    expect(screen.getByText('Indicadores do período')).toBeVisible();
    dailyInsightsState.data = null;
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
        compactDashboard
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
    expect(screen.queryByRole('tablist', { name: 'Detalhes do Dashboard' })).not.toBeInTheDocument();
    const panels = screen.getAllByRole('heading');
    expect(panels.map((panel) => panel.textContent?.trim())).toEqual([
      'Resumo da meta',
      'Realizado vs Meta Diária',
      'Média Mensal por Vendedor',
      'Média Mensal Geral',
    ]);
    const signal = screen.getByText(/Faltam R\$ 1\.000,00 para a meta/);
    expect(signal.compareDocumentPosition(panels[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gerar análises' })).not.toBeInTheDocument();
    expect(screen.queryByText('Sinais do período')).not.toBeInTheDocument();
    const goal = within(screen.getByRole('region', { name: 'Resumo da meta' }));
    expect(goal.getByText('50,0%')).toBeVisible();
    expect(goal.getByRole('img', { name: '50,0% da meta atingida' })).toHaveClass('dashboard-meter');
    expect(goal.getByText('R$ 2.000,00')).toBeVisible();
    expect(goal.getByRole('combobox', { name: 'Destacar vendedor' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Mensal' }));
    expect(screen.getByRole('heading', { name: 'Realizado vs Meta Mensal' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Média Mensal Geral' })).toBeVisible();
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
    const portalledContents: string[] = source.match(
      /<(?:PopoverContent|SelectContent|DialogContent|AlertDialogContent|TooltipContent)\b[^>]*>/g,
    ) ?? [];

    expect(portalledContents.length).toBeGreaterThan(0);
    expect(portalledContents.every((tag) => tag.includes('commercial-overlay'))).toBe(true);
  });
});
