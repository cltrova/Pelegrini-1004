import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useComercialData } from '@/hooks/useComercialData';
import { useComercialProdutos } from '@/hooks/useComercialProdutos';
import { ComercialDataViewport } from '@/components/comercial/compact';
import ProdutosPage from './ProdutosPage';

const empresaAtivaMock = vi.hoisted(() => ({
  current: { codEmpresaAtiva: '1004' as string | null, isLoading: false },
}));

const filialAtivaMock = vi.hoisted(() => ({
  current: { filialAtiva: 'transmissao', filialNome: 'Casa da Transmissao' },
}));

const refetchQueries = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...await importOriginal<typeof import('@tanstack/react-query')>(),
  useQueryClient: () => ({ refetchQueries }),
}));

vi.stubGlobal('requestAnimationFrame', () => 1);
vi.stubGlobal('cancelAnimationFrame', () => undefined);
vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network disabled in focused UI tests')));

vi.mock('@/hooks/useComercialData', () => ({
  useComercialData: vi.fn(),
}));

vi.mock('@/hooks/useComercialProdutos', () => ({
  useComercialProdutos: vi.fn(),
}));

vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: () => empresaAtivaMock.current,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isMaster: false }),
}));

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => filialAtivaMock.current,
}));

vi.mock('@/components/comercial/PremiumMarcasView', () => ({
  PremiumMarcasView: ({
    onSelectMarca,
    showInsights,
    embedded,
  }: {
    onSelectMarca: (marca: string) => void;
    showInsights?: boolean;
    embedded?: boolean;
  }) => (
    <button type="button" data-show-insights={String(showInsights)} data-embedded={String(embedded)} onClick={() => onSelectMarca('EATON')}>Selecionar EATON</button>
  ),
}));

vi.mock('@/components/comercial/PremiumTopProdutos', () => ({
  PremiumTopProdutos: ({ showInsights, mode, produtos }: { showInsights?: boolean; mode?: string; produtos: Array<{ descricao: string }> }) => (
    <div data-show-insights={String(showInsights)} data-mode={mode}>
      Conteudo Premium Top Produtos
      {produtos.map((produto) => <span key={produto.descricao}>{produto.descricao}</span>)}
    </div>
  ),
}));

vi.mock('@/components/comercial/PremiumCategoriasView', () => ({
  PremiumCategoriasView: ({ showInsights, embedded }: { showInsights?: boolean; embedded?: boolean }) => (
    <div data-show-insights={String(showInsights)} data-embedded={String(embedded)}>Conteudo Premium Categorias</div>
  ),
}));

const topProdutos = [
  { cod_produto: 10, descricao: 'Cambio completo', marca: 'EATON', faturamento: 80_000, quantidade: 8 },
  { cod_produto: 20, descricao: 'Kit diferencial', marca: 'ZF', faturamento: 20_000, quantidade: 2 },
];

const topDevolucoes = [
  { cod_produto: 30, descricao: 'Produto devolvido', marca: 'EATON', faturamento: 5_000, quantidade: 1 },
];

const porMarca = [
  { marca: 'EATON', faturamento: 80_000, quantidade: 8 },
  { marca: 'ZF', faturamento: 20_000, quantidade: 2 },
];

const produtosSemGiro = [
  {
    cod_produto: 30,
    descricao: 'Engrenagem parada',
    marca: 'MWM',
    categoria: 'Transmissao',
    ultimaVenda: '2026-01-10',
    diasSemVenda: 120,
  },
];

const resumoVendas = [
  {
    data: '2026-09-01',
    num_nf: 1234,
    descricao: 'Cambio completo',
    marca: 'EATON',
    cliente_razao: 'Oficina Central',
    receita: 10_000,
    custo: 7_000,
    lucro: 3_000,
    margem: 30,
    vendedor_nome: 'Marina Alves',
    nome_interno: 'Ana',
    nome_externo: 'Carlos',
    tipo: 'PEDIDO',
  },
  {
    data: '2026-09-02',
    num_nf: 5678,
    descricao: 'Produto devolvido',
    marca: 'EATON',
    cliente_razao: 'Auto Pecas Retorno',
    receita: -500,
    custo: -350,
    lucro: -150,
    margem: -30,
    vendedor_nome: 'Paulo Lima',
    nome_interno: 'Ana',
    nome_externo: 'Carlos',
    tipo: 'DEVOLUCAO',
  },
];

function mockData(
  hasSource = true,
  overrides: Partial<ReturnType<typeof useComercialProdutos>> = {},
) {
  vi.mocked(useComercialData).mockReturnValue({
    periodoDisponivel: null,
    vendedoresDisponiveis: [],
    isLoading: false,
  } as ReturnType<typeof useComercialData>);

  vi.mocked(useComercialProdutos).mockReturnValue({
    topProdutos,
    topDevolucoes: overrides.topDevolucoes ?? (overrides.topProdutos ? [] : topDevolucoes),
    porMarca,
    porCategoria: [{ categoria: 'Transmissao', faturamento: 100_000, quantidade: 10 }],
    produtosSemGiro,
    resumoVendas,
    hasSource,
    isLoading: false,
    isFetching: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useComercialProdutos>);
}

function renderPage() {
  return render(
    <main aria-label="Modulo comercial">
      <ProdutosPage />
    </main>,
  );
}

const COMMERCIAL_PANEL_SELECTOR = [
  '.commercial-table-frame',
  '.commercial-chart-frame',
  '.commercial-detail-panel',
].join(', ');

function expectNoNestedCommercialPanels(container: ParentNode) {
  container.querySelectorAll(COMMERCIAL_PANEL_SELECTOR).forEach((panel) => {
    expect(panel.querySelector(COMMERCIAL_PANEL_SELECTOR)).toBeNull();
  });
}

describe('ProdutosPage compacta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    empresaAtivaMock.current = { codEmpresaAtiva: '1004', isLoading: false };
    filialAtivaMock.current = { filialAtiva: 'transmissao', filialNome: 'Casa da Transmissao' };
    mockData();
  });

  it('compoe shell, busca, filtros e indicadores compactos sem cabecalho redundante', () => {
    renderPage();

    expect(screen.getAllByRole('main')).toHaveLength(1);
    const page = screen.getByRole('main', { name: 'Modulo comercial' }).querySelector('.comercial-compact-page');
    expect(page).toHaveProperty('tagName', 'DIV');
    expect(page).toHaveClass('commercial-products');
    expect(page).toHaveClass('commercial-products-columns-centered');
    expect(screen.getByRole('heading', { name: 'Produtos' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Buscar produtos' })).toBeVisible();
    const navigation = screen.getByTestId('produtos-navigation');
    expect(navigation).toContainElement(screen.getByRole('tablist'));
    expect(navigation).toContainElement(screen.getByRole('searchbox', { name: 'Buscar produtos' }));
    expect(screen.getByLabelText('Indicadores de produtos')).toHaveAttribute('data-density', 'compact');
    expect(screen.getByText('Receita dos itens')).toBeInTheDocument();
    expect(screen.getByText('Marcas ativas')).toBeInTheDocument();
    expect(screen.getByText('SKUs vendidos')).toBeInTheDocument();
    expect(screen.getByText('Quantidade total')).toBeInTheDocument();
    expect(screen.queryByText('Produtos & Marcas')).not.toBeInTheDocument();
    expect(document.querySelector('.premium-card')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-show-insights="false"]')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Selecionar EATON' })).toHaveAttribute('data-embedded', 'true');
  });

  it('preserva a selecao de marca e recalcula os indicadores', () => {
    renderPage();

    expect(screen.getByText('R$ 100,0K')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar EATON' }));

    expect(screen.getByText('EATON')).toBeInTheDocument();
    expect(screen.getByText('R$ 80,0K')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('mantem abas compactas rolaveis e somente o painel ativo no layout', () => {
    renderPage();

    const tabs = screen.getByRole('tablist');
    const tabpanels = Array.from(document.querySelectorAll<HTMLElement>('[role="tabpanel"]'));

    expect(tabs).toHaveClass('max-w-full', 'overflow-x-auto');
    expect(tabpanels).toHaveLength(5);
    tabpanels.forEach((tabpanel) => expect(tabpanel).toHaveClass('data-[state=inactive]:hidden'));
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Top Produtos' }), { button: 0, ctrlKey: false });
    expect(screen.getByText('Conteudo Premium Top Produtos')).toHaveAttribute('data-show-insights', 'false');

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Categorias' }), { button: 0, ctrlKey: false });
    expect(screen.getByText('Conteudo Premium Categorias')).toHaveAttribute('data-show-insights', 'false');
    expect(screen.getByText('Conteudo Premium Categorias')).toHaveAttribute('data-embedded', 'true');

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Sem Giro/ }), { button: 0, ctrlKey: false });
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.getByRole('tabpanel', { name: /Sem Giro/ })).toHaveAttribute('data-state', 'active');
  });

  it('mostra Sem Giro como tabela compacta diretamente na viewport', () => {
    renderPage();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Sem Giro/ }), { button: 0, ctrlKey: false });

    const viewport = screen.getByRole('region', { name: 'Produtos sem giro' });
    const table = within(viewport).getByRole('table', { name: 'Produtos sem giro' });

    expect(viewport).toHaveClass('h-full', 'max-h-full', 'overflow-auto');
    expect(viewport.firstElementChild).toBe(table);
    expect(within(table).getByText('Engrenagem parada')).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Produto' })).toHaveClass('text-left');
    expect(within(table).getByText('Engrenagem parada').closest('td')).toHaveClass('text-left');
    expect(viewport.querySelector('.premium-card')).not.toBeInTheDocument();
  });

  it('mantem Top Produtos dedicado ao ranking de receitas', () => {
    renderPage();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Top Produtos' }), { button: 0, ctrlKey: false });

    expect(screen.getByText('Cambio completo')).toBeInTheDocument();
    expect(screen.queryByText('Produto devolvido')).not.toBeInTheDocument();
    expect(screen.getByText('Conteudo Premium Top Produtos')).toHaveAttribute('data-mode', 'receitas');
    expect(screen.queryByRole('tab', { name: 'Receitas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Devoluções' })).not.toBeInTheDocument();
  });

  it('separa receitas e devolucoes em subabas dentro de Resumo NF', () => {
    renderPage();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Resumo NF' }), { button: 0, ctrlKey: false });

    expect(screen.getByRole('tab', { name: 'Receitas' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByText('Cambio completo')).toBeInTheDocument();
    expect(screen.queryByText('Produto devolvido')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Receita' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '% Margem' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Vendedor' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Interno' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Externo' })).not.toBeInTheDocument();
    expect(screen.getByText('Marina Alves')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Data' })).toHaveClass('text-left');
    for (const header of ['NF', 'Produto', 'Marca', 'Cliente', 'Receita', 'Custo', 'Lucro', '% Margem', 'Vendedor']) {
      expect(screen.getByRole('columnheader', { name: header })).toHaveClass('text-center');
    }
    for (const value of ['1234', 'Cambio completo', 'EATON', 'Oficina Central', 'Marina Alves']) {
      expect(screen.getByText(value)).toHaveClass('text-center');
    }

    fireEvent.click(screen.getByRole('tab', { name: 'Devoluções' }));

    expect(screen.getByText('Produto devolvido')).toBeInTheDocument();
    expect(screen.queryByText('Cambio completo')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Valor devolvido' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Lucro' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '% Margem' })).not.toBeInTheDocument();
    expect(screen.getByText('R$ 500,00')).toBeInTheDocument();
    expect(screen.queryByText('-R$ 500,00')).not.toBeInTheDocument();
    expect(screen.getByText('Paulo Lima')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Valor devolvido' })).toHaveClass('text-center');
    expect(screen.getByText('R$ 500,00')).toHaveClass('text-center');
  });

  it('destaca os valores da coluna Custo em vermelho', () => {
    renderPage();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Resumo NF' }), { button: 0, ctrlKey: false });

    expect(screen.getByText('R$ 7.000,00')).toHaveClass('text-destructive');
  });

  it('mostra Resumo NF como tabela compacta diretamente na viewport e preserva a busca', () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar produtos' }), { target: { value: 'Oficina' } });
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Resumo NF' }), { button: 0, ctrlKey: false });

    const viewport = screen.getByRole('region', { name: 'Resumo de vendas por nota fiscal' });
    const table = within(viewport).getByRole('table', { name: 'Resumo de vendas por nota fiscal' });

    expect(viewport.firstElementChild).toBe(table);
    expect(within(table).getByText('Oficina Central')).toBeInTheDocument();
    expect(within(table).getByText('1234')).toBeInTheDocument();
    expect(viewport.querySelector('.premium-card')).not.toBeInTheDocument();
    expect(viewport).toHaveClass('overflow-x-hidden', 'overflow-y-auto');
    expect(table).toHaveClass('table-fixed', 'min-w-0');
    expect(table).not.toHaveClass('min-w-max');
    expect(table.querySelector('colgroup')).toBeInTheDocument();
    expect(within(table).getByText('Cambio completo').closest('td')).toHaveClass('truncate');
    expect(within(table).getByText('Oficina Central').closest('td')).toHaveClass('truncate');
  });

  it('mantem o estado sem fonte dentro do shell compacto', () => {
    mockData(false);
    renderPage();

    const compactPage = screen.getByRole('main').querySelector('.comercial-compact-page');
    expect(compactPage).toBeInTheDocument();
    expect(compactPage).toHaveClass('min-h-0', 'overflow-x-hidden');
    expect(screen.getByText('Fonte de produtos não configurada')).toBeInTheDocument();
    expect(document.querySelector('.enterprise-page-shell')).not.toBeInTheDocument();
    expect(document.querySelector('.premium-card')).not.toBeInTheDocument();
  });

  it('mantem o carregamento dentro do shell compacto', () => {
    vi.mocked(useComercialProdutos).mockReturnValue({
      topProdutos: [], porMarca: [], porCategoria: [], produtosSemGiro: [], resumoVendas: [],
      hasSource: true, isLoading: true,
    } as ReturnType<typeof useComercialProdutos>);

    renderPage();

    expect(screen.getByRole('main').querySelector('.comercial-compact-page')).toBeInTheDocument();
    const status = screen.getByRole('status', { name: 'Carregando produtos' });
    expect(status).toBeInTheDocument();
    expect(screen.queryByText('Carregando produtos...')).not.toBeInTheDocument();
    expect(screen.queryByText('Carregando dados')).not.toBeInTheDocument();
    expect(within(status).getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('prioriza a hidratacao da empresa antes do estado sem fonte', () => {
    empresaAtivaMock.current = { codEmpresaAtiva: null, isLoading: true };
    mockData(false);

    renderPage();

    expect(screen.getByRole('status', { name: 'Carregando produtos' })).toBeInTheDocument();
    expect(screen.queryByText('Carregando produtos...')).not.toBeInTheDocument();
    expect(screen.queryByText('Fonte de produtos não configurada')).not.toBeInTheDocument();
  });

  it('bloqueia os produtos resolvidos de transmissao enquanto chevrolet esta pendente', () => {
    const view = renderPage();

    expect(screen.getByRole('button', { name: 'Selecionar EATON' })).toBeInTheDocument();

    filialAtivaMock.current = { filialAtiva: 'chevrolet', filialNome: 'Chevrolet' };
    mockData(true, {
      topProdutos: [],
      porMarca: [],
      porCategoria: [],
      produtosSemGiro: [],
      resumoVendas: [],
      isLoading: true,
      isFetching: true,
    });
    view.rerender(<main aria-label="Modulo comercial"><ProdutosPage /></main>);

    expect(screen.getByRole('status', { name: 'Carregando produtos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Selecionar EATON' })).not.toBeInTheDocument();
    expect(screen.queryByText('Nenhum produto encontrado no período.')).not.toBeInTheDocument();
  });

  it('preserva os dados durante refetch e distingue erro de vazio', () => {
    const refetch = renderPage();
    mockData(true, { isFetching: true });
    refetch.rerender(
      <main aria-label="Modulo comercial">
        <ProdutosPage />
      </main>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Expandir filtros' }));
    const searchButton = screen.getByRole('button', { name: 'Buscar' });
    expect(searchButton).toBeVisible();
    expect(searchButton).toBeDisabled();
    expect(searchButton).toHaveAttribute('aria-busy', 'true');
    expect(within(searchButton).getByTestId('loading-indicator')).toHaveClass('h-4', 'w-4');
    expect(screen.queryByRole('status', { name: 'Atualizando produtos' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Indicadores de produtos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Selecionar EATON' })).toBeInTheDocument();

    refetch.unmount();
    mockData(true, {
      topProdutos: [], porMarca: [], porCategoria: [], produtosSemGiro: [], resumoVendas: [],
      error: new Error('Falha na consulta'),
    });
    const failed = renderPage();

    expect(screen.getByText('Erro ao carregar produtos')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Falha ao carregar produtos' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Carregando produtos' })).not.toBeInTheDocument();
    expect(screen.queryByText('Nenhum produto encontrado no período.')).not.toBeInTheDocument();

    failed.unmount();
    mockData(true, {
      topProdutos: [], porMarca: [], porCategoria: [], produtosSemGiro: [], resumoVendas: [],
    });
    renderPage();

    expect(screen.getByText('Nenhum produto encontrado no período.')).toBeInTheDocument();
    expect(screen.queryByText('Erro ao carregar produtos')).not.toBeInTheDocument();
  });

  it('preserva o resultado vazio resolvido durante um novo refetch', () => {
    const emptyResult = {
      topProdutos: [], porMarca: [], porCategoria: [], produtosSemGiro: [], resumoVendas: [],
    };
    mockData(true, emptyResult);
    const { rerender } = render(<ProdutosPage />);

    expect(screen.getByText('Nenhum produto encontrado no período.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expandir filtros' }));

    mockData(true, { ...emptyResult, isLoading: true, isFetching: true });
    rerender(<ProdutosPage />);

    const searchButton = screen.getByRole('button', { name: 'Buscar' });
    expect(screen.getByText('Nenhum produto encontrado no período.')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Carregando produtos' })).not.toBeInTheDocument();
    expect(searchButton).toBeDisabled();
    expect(within(searchButton).getByTestId('loading-indicator')).toHaveClass('h-4', 'w-4');
  });

  it.each(['produtos', 'base'] as const)('exibe falha de %s com linhas e KPIs preservados ate a recuperacao', (source) => {
    const { rerender } = render(<ProdutosPage />);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Resumo NF' }), { button: 0, ctrlKey: false });
    const table = screen.getByRole('table');
    const indicators = screen.getByLabelText('Indicadores de produtos');
    const values = indicators.textContent;
    const error = new Error('Falha no refresh');
    const fail = (isFetching = false) => {
      mockData(true, { error: source === 'produtos' ? error : null, isFetching: source === 'produtos' && isFetching });
      if (source === 'base') {
        vi.mocked(useComercialData).mockReturnValue({
          periodoDisponivel: null, vendedoresDisponiveis: [], isLoading: false, isFetching, error,
        } as ReturnType<typeof useComercialData>);
      }
    };

    fail();
    rerender(<ProdutosPage />);
    expect(screen.getByRole('status', { name: 'Falha ao atualizar produtos' })).toBeVisible();
    expect(screen.getByRole('table')).toBe(table);
    expect(within(table).getByText('Oficina Central')).toBeVisible();
    expect(indicators.textContent).toBe(values);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar atualizar produtos novamente' }));
    expect(refetchQueries).toHaveBeenCalledTimes(3);
    for (const queryKey of [
      ['comercial-produtos', '1004'],
      ['comercial-receita-comissao-1004', '1004'],
      ['comercial', 'raw', '1004'],
    ]) {
      expect(refetchQueries).toHaveBeenCalledWith({ queryKey, type: 'active' });
    }

    fail(true);
    rerender(<ProdutosPage />);
    const retryButton = screen.getByRole('button', { name: 'Tentar atualizar produtos novamente' });
    expect(retryButton).toBeDisabled();
    expect(within(retryButton).getByTestId('loading-indicator')).toHaveClass('h-4', 'w-4');
    expect(screen.getByRole('table')).toBe(table);
    mockData();
    rerender(<ProdutosPage />);
    expect(screen.queryByRole('status', { name: 'Falha ao atualizar produtos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar atualizar produtos novamente' })).not.toBeInTheDocument();
    expect(screen.getByRole('table')).toBe(table);
  });

  it('mantem um unico dono da moldura nas views premium e nos overlays', async () => {
    renderPage();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Top Produtos' }), { button: 0, ctrlKey: false });
    const rankingViewport = screen.getByRole('region', { name: 'Ranking de receitas por produto' });
    expect(rankingViewport).toHaveClass('commercial-data-viewport', 'overflow-auto');
    expect(rankingViewport).not.toHaveClass('commercial-table-frame');

    const { PremiumTopProdutos } = await vi.importActual<typeof import('@/components/comercial/PremiumTopProdutos')>(
      '@/components/comercial/PremiumTopProdutos',
    );
    const productView = render(
      <ComercialDataViewport ariaLabel="Composição real do ranking de produtos">
        <PremiumTopProdutos
          produtos={[{ ...topProdutos[0], custo: 60_000, lucro: 20_000, margem: 25 }]}
          resumoVendas={resumoVendas}
          selectedMarca={null}
          onSelectMarca={vi.fn()}
          showInsights={false}
        />
      </ComercialDataViewport>,
    );
    expect(within(productView.container).getByRole('region')).not.toHaveClass('commercial-table-frame');
    expect(productView.container.querySelectorAll('.commercial-table-frame')).toHaveLength(1);
    expect(productView.container.querySelector('.commercial-table-frame')).toHaveProperty('tagName', 'DIV');
    expectNoNestedCommercialPanels(productView.container);
    fireEvent.click(screen.getAllByRole('button', { name: /Cambio completo/ })[0]);
    expect(screen.getByRole('dialog')).toHaveClass('commercial-overlay', 'commercial-detail-panel');
    productView.unmount();

    const { PremiumCategoriasView } = await vi.importActual<typeof import('@/components/comercial/PremiumCategoriasView')>(
      '@/components/comercial/PremiumCategoriasView',
    );
    const categoryView = render(
      <ComercialDataViewport ariaLabel="Composição real das categorias">
        <PremiumCategoriasView
          porCategoria={[{
            chave: 'Transmissao', categoria: 'Transmissao', faturamento: 100_000,
            quantidade: 10, produtos: 2, participacao: 100,
          }]}
          selectedCategoria={null}
          onSelectCategoria={vi.fn()}
          showInsights={false}
        />
      </ComercialDataViewport>,
    );
    expect(within(categoryView.container).getByRole('region')).not.toHaveClass('commercial-table-frame');
    expect(categoryView.container.querySelectorAll('.commercial-table-frame')).toHaveLength(1);
    expectNoNestedCommercialPanels(categoryView.container);
    fireEvent.click(screen.getByText('Ver'));
    expect(screen.getByRole('dialog')).toHaveClass('commercial-overlay', 'commercial-detail-panel');
    categoryView.unmount();

    const { PremiumMarcasView } = await vi.importActual<typeof import('@/components/comercial/PremiumMarcasView')>(
      '@/components/comercial/PremiumMarcasView',
    );
    const brandView = render(
      <ComercialDataViewport ariaLabel="Composição real das marcas">
        <PremiumMarcasView
          porMarca={[{
            marca: 'EATON', faturamento: 80_000, custo: 60_000, lucro: 20_000,
            margem: 25, quantidade: 8, produtos: 1, participacao: 80,
          }]}
          selectedMarca={null}
          onSelectMarca={vi.fn()}
          showInsights={false}
          embedded
        />
      </ComercialDataViewport>,
    );
    expect(within(brandView.container).getByRole('region')).not.toHaveClass('commercial-table-frame');
    expect(brandView.container.querySelectorAll('.commercial-table-frame')).toHaveLength(1);
    expectNoNestedCommercialPanels(brandView.container);
    brandView.unmount();

    const { ClienteDetalheDrilldown } = await import('@/components/comercial/ClienteDetalheDrilldown');
    mockData(true, { produtos: [] });
    render(
      <ClienteDetalheDrilldown
        open
        onOpenChange={vi.fn()}
        cliente={{ codigo: '101', nome: 'Oficina Central' }}
        periodo={{ inicio: '2026-09-01', fim: '2026-09-11' }}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('commercial-overlay', 'commercial-detail-panel');
    expect(dialog.querySelectorAll('.commercial-kpi-cell')).toHaveLength(4);
    expectNoNestedCommercialPanels(document.body);
  });

  it('preserva a superficie escura do drilldown durante o carregamento', async () => {
    const { ClienteDetalheDrilldown } = await import('@/components/comercial/ClienteDetalheDrilldown');
    mockData(true, { produtos: [], isLoading: true });

    render(
      <ClienteDetalheDrilldown
        open
        onOpenChange={vi.fn()}
        cliente={{ codigo: '101', nome: 'Oficina Central' }}
        periodo={{ inicio: '2026-09-01', fim: '2026-09-11' }}
      />,
    );

    const loading = screen.getByRole('status', { name: 'Carregando itens do cliente' });
    expect(loading).toHaveClass('bg-transparent');
    expect(loading).not.toHaveClass('bg-background');
  });

  it('mostra estados vazios nas tabelas de Sem Giro e Resumo NF', () => {
    vi.mocked(useComercialProdutos).mockReturnValue({
      topProdutos: [], porMarca, porCategoria: [], produtosSemGiro: [], resumoVendas: [],
      hasSource: true, isLoading: false,
    } as ReturnType<typeof useComercialProdutos>);

    renderPage();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Sem Giro/ }), { button: 0, ctrlKey: false });
    expect(screen.getByText('Todos os produtos movimentaram no período.')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Resumo NF' }), { button: 0, ctrlKey: false });
    expect(screen.getByText('Nenhuma receita encontrada no recorte atual.')).toBeInTheDocument();
  });
});
