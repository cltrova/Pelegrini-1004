import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useIsFetching } from '@tanstack/react-query';
import { useComercialData } from '@/hooks/useComercialData';
import { InsightsIATab } from '@/components/comercial/InsightsIATab';
import MetasVendedoresPage from './MetasVendedoresPage';

const { supabaseInvoke } = vi.hoisted(() => ({ supabaseInvoke: vi.fn() }));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useIsFetching: vi.fn(),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/hooks/useComercialData', () => ({ useComercialData: vi.fn() }));
vi.mock('@/hooks/useComercialProdutos', () => ({
  useComercialProdutos: () => ({
    produtos: [],
    receitaTotalizada: 0,
    pedidosDistintosTotalizados: 0,
    receitaPorVendedor1004: new Map(),
    isLoading: false,
    isFetching: false,
    error: null,
  }),
}));
vi.mock('@/hooks/useComercialTotais', () => ({
  useComercialTotaisIdeal: () => ({ pedidos: null, produtos: null }),
}));
vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: () => ({
    empresa: { nome: 'Casa da Transmissao', possui_meta_vendedor: true },
    codEmpresaAtiva: '1004',
    isLoading: false,
  }),
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
    vi.mocked(useComercialData).mockReturnValue(comercialData as ReturnType<typeof useComercialData>);
    vi.mocked(useIsFetching).mockReturnValue(0);
  });

  it('aplica as classes semanticas ao dashboard e a faixa de abas', async () => {
    render(<MetasVendedoresPage />);

    expect(await screen.findByText('Conteudo preservado')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveClass('commercial-dashboard');
    expect(screen.getByRole('tablist')).toHaveClass('commercial-tab-strip');
    expect(screen.getByLabelText('Indicadores do dashboard comercial')).toHaveClass('commercial-metric-strip');
  });

  it('preserva o conteudo renderizado e indica a atualizacao durante refetch', async () => {
    const { rerender } = render(<MetasVendedoresPage />);
    expect(await screen.findByText('Conteudo preservado')).toBeInTheDocument();

    vi.mocked(useComercialData).mockReturnValue({
      ...comercialData,
      isLoading: true,
    } as ReturnType<typeof useComercialData>);
    vi.mocked(useIsFetching).mockReturnValue(1);

    await act(async () => rerender(<MetasVendedoresPage />));

    expect(screen.getByText('Conteudo preservado')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Atualizando dados comerciais' })).toBeInTheDocument();
    expect(screen.queryByText('Carregando visão comercial...')).not.toBeInTheDocument();
  });
});

describe('InsightsIATab management actions', () => {
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
