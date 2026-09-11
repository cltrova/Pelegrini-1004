import { act, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useIsFetching } from '@tanstack/react-query';
import { useComercialData } from '@/hooks/useComercialData';
import { CampanhasTab } from '@/components/comercial/CampanhasTab';
import { InsightsIATab } from '@/components/comercial/InsightsIATab';
import { PremiumMetasView } from '@/components/comercial/PremiumMetasView';
import MetasVendedoresPage from './MetasVendedoresPage';

const {
  campanhasState,
  empresaState,
  fetchingState,
  insightsQueryState,
  produtosState,
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
  useComercialProdutos: () => produtosState.value,
}));
vi.mock('@/hooks/useComercialTotais', () => ({
  useComercialTotaisIdeal: () => ({ pedidos: null, produtos: null }),
}));
vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: () => empresaState.value,
}));
vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({ filialAtiva: 'transmissao', filialNome: 'Casa da Transmissao' }),
}));
vi.mock('@/components/comercial/EnterpriseComercialFilters', () => ({
  EnterpriseComercialFilters: () => <div>Filtros comerciais</div>,
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
    vi.mocked(useComercialData).mockReturnValue(comercialData as ReturnType<typeof useComercialData>);
    vi.mocked(useIsFetching).mockImplementation(() => fetchingState.value);
  });

  it('aplica as classes semanticas ao dashboard e a faixa de abas', async () => {
    render(<MetasVendedoresPage />);

    expect(await screen.findByText('Conteudo preservado')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveClass('commercial-dashboard');
    expect(screen.getByRole('tablist')).toHaveClass('commercial-tab-strip');
    expect(screen.getByLabelText('Indicadores do dashboard comercial')).toHaveClass('commercial-metric-strip');
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
    expect(screen.getByText('Carregando visão comercial...')).toBeInTheDocument();

    vi.mocked(useComercialData).mockReturnValue(comercialData as ReturnType<typeof useComercialData>);
    await act(async () => rerender(<MetasVendedoresPage />));
    expect(await screen.findByText('Conteudo preservado')).toBeInTheDocument();

    fetchingState.value = 1;
    await act(async () => rerender(<MetasVendedoresPage />));

    expect(screen.getByText('Conteudo preservado')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Atualizando dados comerciais' })).toBeInTheDocument();
    expect(screen.queryByText('Carregando visão comercial...')).not.toBeInTheDocument();
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

    const title = await screen.findByText('Projeções por Cenário - Vai Bater a Meta?');
    const section = title.closest('.commercial-dashboard-panel');
    expect(section).not.toBeNull();
    expect(section?.querySelector('.commercial-scenario-panel')).toBeInTheDocument();
    expect(section?.querySelectorAll('.bg-card')).toHaveLength(0);
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

    expect(screen.getByRole('status', { name: 'Carregando campanhas comerciais' }))
      .toHaveClass('commercial-dashboard-panel');

    campanhasState.value = { ...campanhasState.value, campanhas: [], isLoading: false };
    await act(async () => rerender(<CampanhasTab />));
    expect(await screen.findByText('Nenhuma campanha ainda')).toBeInTheDocument();

    fetchingState.value = 1;
    await act(async () => rerender(<CampanhasTab />));
    expect(screen.getByText('Nenhuma campanha ainda')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Atualizando campanhas comerciais' })).toBeInTheDocument();
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

    const { rerender } = render(<CampanhasTab />);

    expect(await screen.findByText('Campanha EATON')).toBeInTheDocument();
    expect(screen.getAllByText(/1\.250,00/).length).toBeGreaterThan(0);

    produtosState.value = { ...produtosState.value, isFetching: true };
    await act(async () => rerender(<CampanhasTab />));

    expect(screen.getByText('Campanha EATON')).toBeInTheDocument();
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
});
