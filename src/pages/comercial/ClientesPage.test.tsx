import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useComercialData } from '@/hooks/useComercialData';
import ClientesPage from './ClientesPage';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

vi.mock('@/hooks/useComercialData', () => ({
  useComercialData: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isMaster: false }),
}));

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({ filialAtiva: 'transmissao', filialNome: 'Casa da Transmissao' }),
}));

vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: () => ({ codEmpresaAtiva: '1004', empresa: { nome: 'Casa da Transmissao' } }),
}));

const clientesBase = [
  {
    codigo: '101',
    razao: 'Oficina Central Ltda',
    fantasia: 'Oficina Central',
    cidade: 'Sao Paulo',
    uf: 'SP',
    faturamentoLiquido: 125_000,
    totalPedidos: 10,
    totalDevolucoes: 0,
    ticketMedio: 12_500,
    participacao: 62.5,
    ultimaCompra: '2026-09-01',
    primeiraCompra: '2026-08-20',
  },
  {
    codigo: '202',
    razao: 'Auto Pecas Norte Ltda',
    fantasia: 'Auto Pecas Norte',
    cidade: 'Campinas',
    uf: 'SP',
    faturamentoLiquido: 75_000,
    totalPedidos: 5,
    totalDevolucoes: 0,
    ticketMedio: 15_000,
    participacao: 37.5,
    ultimaCompra: '2026-05-01',
    primeiraCompra: '2025-04-10',
  },
];

const clientes = [
  ...clientesBase,
  ...Array.from({ length: 58 }, (_, index) => {
    const ranking = index + 3;
    return {
      codigo: String(300 + ranking),
      razao: `Cliente Ranking ${ranking} Ltda`,
      fantasia: `Cliente Ranking ${ranking}`,
      cidade: `Cidade ${ranking}`,
      uf: ranking % 2 === 0 ? 'MG' : 'PR',
      faturamentoLiquido: 70_000 - ranking * 1_000,
      totalPedidos: ranking,
      totalDevolucoes: 0,
      ticketMedio: 1_000,
      participacao: 1,
      ultimaCompra: '2026-08-15',
      primeiraCompra: '2025-01-10',
    };
  }),
];

function mockClientesData(overrides: Partial<ReturnType<typeof useComercialData>> = {}) {
  vi.mocked(useComercialData).mockReturnValue({
    pedidos: [],
    devolucoes: [],
    kpis: { qtdClientes: clientes.length },
    vendedoresPerformance: [],
    clientesPerformance: clientes,
    evolucaoDiaria: [],
    evolucaoMensal: [],
    insights: [],
    vendedoresUnicos: [],
    vendedoresDisponiveis: [],
    clientesUnicos: [],
    ufsUnicas: ['SP', 'MG', 'PR'],
    periodoDisponivel: null,
    isLoading: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useComercialData>);
}

function renderClientesPage() {
  return render(
    <main aria-label="Modulo comercial">
      <ClientesPage />
    </main>,
  );
}

describe('ClientesPage compacta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClientesData();
  });

  it('compoe o shell compacto com busca visivel e indicadores da carteira', () => {
    renderClientesPage();

    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('main', { name: 'Modulo comercial' }).querySelector('.comercial-compact-page')).toHaveProperty('tagName', 'DIV');
    expect(screen.getByRole('searchbox', { name: 'Buscar clientes' })).toBeVisible();
    expect(screen.getByLabelText('Indicadores da carteira')).toHaveAttribute('data-density', 'compact');
    expect(screen.getByText('Total de clientes')).toBeInTheDocument();
    expect(screen.getByText('Novos em 30 dias')).toBeInTheDocument();
  });

  it('mantem um unico ranking dentro da viewport e restringe a busca a ele', () => {
    renderClientesPage();

    expect(screen.queryByText('Concentração Top 10 Clientes')).not.toBeInTheDocument();
    expect(screen.queryByText('Líder')).not.toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Ranking completo de clientes' })).toContainElement(screen.getByRole('table'));
    expect(screen.getAllByRole('row')).toHaveLength(51);
    expect(within(screen.getByRole('table')).getByText('Cliente Ranking 50')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText('Cliente Ranking 51')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar clientes' }), {
      target: { value: 'norte' },
    });

    const ranking = screen.getByRole('table');
    expect(within(ranking).getByText('Auto Pecas Norte')).toBeInTheDocument();
    expect(within(ranking).queryByText('Oficina Central')).not.toBeInTheDocument();
  });

  it('pagina todo o ranking em lotes de 50, volta a viewport ao topo e reinicia ao buscar', () => {
    renderClientesPage();

    const previous = screen.getByRole('button', { name: 'Página anterior' });
    const next = screen.getByRole('button', { name: 'Próxima página' });
    const firstViewport = screen.getByRole('region', { name: 'Ranking completo de clientes' });

    expect(screen.getByText('1–50 de 60')).toBeInTheDocument();
    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();

    firstViewport.scrollTop = 420;
    fireEvent.click(next);
    const secondViewport = screen.getByRole('region', { name: 'Ranking completo de clientes' });

    expect(screen.getByText('51–60 de 60')).toBeInTheDocument();
    expect(secondViewport).not.toBe(firstViewport);
    expect(secondViewport.scrollTop).toBe(0);
    expect(within(screen.getByRole('table')).getByText('Cliente Ranking 51')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText('Cliente Ranking 50')).not.toBeInTheDocument();
    expect(previous).toBeEnabled();
    expect(next).toBeDisabled();

    fireEvent.click(previous);
    expect(screen.getByText('1–50 de 60')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Oficina Central')).toBeInTheDocument();

    fireEvent.click(next);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar clientes' }), {
      target: { value: 'Cliente Ranking 5' },
    });

    expect(screen.getByText('1–11 de 11')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Cliente Ranking 5')).toBeInTheDocument();
    expect(previous).toBeDisabled();
  }, 15_000);

  it('limita a viewport ativa a altura do tabpanel que controla a rolagem', () => {
    renderClientesPage();

    const compactPage = screen.getByRole('main').querySelector('.clientes-page');
    const tabpanel = screen.getByRole('tabpanel');
    const viewport = screen.getByRole('region', { name: 'Ranking completo de clientes' });
    const table = screen.getByRole('table');
    const header = screen.getAllByRole('rowgroup')[0];

    expect(compactPage).toHaveClass(
      'h-[calc(100dvh-9.5rem)]',
      'max-h-[calc(100dvh-9.5rem)]',
      'md:h-full',
      'md:max-h-full',
    );
    expect(tabpanel).toHaveClass('flex', 'h-full', 'max-h-full', 'min-h-0', 'flex-col', 'overflow-hidden');
    expect(tabpanel).toContainElement(viewport);
    expect(viewport).toHaveClass('h-full', 'max-h-full', 'min-h-0', 'overflow-auto');
    expect(viewport.firstElementChild).toBe(table);
    expect(header).toHaveClass('sticky', 'top-0');
  });

  it('mantem somente o TabsContent ativo participando do layout', () => {
    renderClientesPage();

    const tabpanels = Array.from(document.querySelectorAll<HTMLElement>('[role="tabpanel"]'));

    expect(tabpanels).toHaveLength(4);
    tabpanels.forEach((tabpanel) => {
      expect(tabpanel).toHaveClass('data-[state=inactive]:hidden');
    });
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.getByRole('tabpanel', { name: 'Ranking' })).toHaveAttribute('data-state', 'active');

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Evolução' }), { button: 0, ctrlKey: false });

    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.getByRole('tabpanel', { name: 'Evolução' })).toHaveAttribute('data-state', 'active');
    expect(screen.queryByRole('tabpanel', { name: 'Ranking' })).not.toBeInTheDocument();
  });

  it('usa linguagem operacional nas abas e paineis', () => {
    renderClientesPage();

    expect(screen.getByRole('tab', { name: 'Carteira' })).toBeInTheDocument();
    expect(screen.queryByText(/Insights IA|Analisado por IA|Insights Inteligentes|Inteligencia Artificial/i)).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Carteira' }), { button: 0, ctrlKey: false });
    expect(screen.getByText('Alertas e oportunidades')).toBeInTheDocument();
    expect(screen.queryByText(/Insights IA|Analisado por IA|Insights Inteligentes|Inteligencia Artificial/i)).not.toBeInTheDocument();
  });

  it('mantem contratos responsivos no shell, indicadores, abas e viewport', () => {
    renderClientesPage();

    const compactPage = screen.getByRole('main').querySelector('.comercial-compact-page');
    const indicators = screen.getByLabelText('Indicadores da carteira');
    const tabs = screen.getByRole('tablist');
    const viewport = screen.getByRole('region', { name: 'Ranking completo de clientes' });

    expect(compactPage).toHaveClass('min-w-0', 'max-w-full', 'overflow-x-hidden', 'sm:px-4');
    expect(indicators).toHaveClass('comercial-metric-strip');
    expect(tabs).toHaveClass('max-w-full', 'overflow-x-auto');
    expect(viewport).toHaveClass('min-w-0', 'max-w-full', 'overflow-auto');
  });

  it('nao apresenta totais nem ranking durante loading ou erro', () => {
    mockClientesData({ isLoading: true });
    const loading = renderClientesPage();

    expect(screen.getByText('Carregando clientes...')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Clientes' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Estado da carteira de clientes' })).toBeInTheDocument();
    expect(screen.getByRole('main').querySelector('.comercial-compact-page')).toBeInTheDocument();
    expect(screen.queryByLabelText('Indicadores da carteira')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    loading.unmount();
    mockClientesData({ isLoading: false, error: new Error('Falha na consulta') });
    renderClientesPage();

    expect(screen.getByText('Erro ao carregar clientes')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Clientes' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Indicadores da carteira')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('aplica filtros pendentes somente ao buscar e restaura o periodo inicial ao limpar', () => {
    renderClientesPage();
    const currentYear = String(new Date().getFullYear());
    const initialFilters = vi.mocked(useComercialData).mock.calls.at(-1)?.[0];

    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(screen.getByText('51–60 de 60')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expandir filtros' }));
    const yearField = screen.getByText('Ano').parentElement;
    expect(yearField).not.toBeNull();

    const yearTrigger = within(yearField as HTMLElement).getByRole('button', { name: currentYear });
    fireEvent.click(yearTrigger);

    const yearOptionsId = yearTrigger.getAttribute('aria-controls');
    expect(yearOptionsId).toBeTruthy();
    const yearOptions = document.getElementById(yearOptionsId as string);
    expect(yearOptions).not.toBeNull();

    fireEvent.click(within(yearOptions as HTMLElement).getByRole('button', { name: currentYear }));
    fireEvent.click(within(yearOptions as HTMLElement).getByRole('button', { name: '2025' }));

    expect(yearTrigger).toHaveTextContent('2025');
    expect(vi.mocked(useComercialData).mock.calls.at(-1)?.[0]).toEqual(initialFilters);

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(vi.mocked(useComercialData).mock.calls.at(-1)?.[0]).toMatchObject({ anos: ['2025'] });
    expect(screen.getByText('1–50 de 60')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(screen.getByText('51–60 de 60')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(yearTrigger).toHaveTextContent(currentYear);
    expect(vi.mocked(useComercialData).mock.calls.at(-1)?.[0]).toEqual(initialFilters);
    expect(screen.getByText('1–50 de 60')).toBeInTheDocument();
  }, 15_000);
});
