import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useComercialData } from '@/hooks/useComercialData';
import { useComercialProdutos } from '@/hooks/useComercialProdutos';
import ProdutosPage from './ProdutosPage';

vi.stubGlobal('requestAnimationFrame', () => 1);
vi.stubGlobal('cancelAnimationFrame', () => undefined);

vi.mock('@/hooks/useComercialData', () => ({
  useComercialData: vi.fn(),
}));

vi.mock('@/hooks/useComercialProdutos', () => ({
  useComercialProdutos: vi.fn(),
}));

vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: () => ({ codEmpresaAtiva: '1004' }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isMaster: false }),
}));

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({ filialAtiva: 'transmissao', filialNome: 'Casa da Transmissao' }),
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
  PremiumTopProdutos: ({ showInsights }: { showInsights?: boolean }) => (
    <div data-show-insights={String(showInsights)}>Conteudo Premium Top Produtos</div>
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
    nome_interno: 'Ana',
    nome_externo: 'Carlos',
    tipo: 'VENDA',
  },
];

function mockData(hasSource = true) {
  vi.mocked(useComercialData).mockReturnValue({
    periodoDisponivel: null,
    vendedoresDisponiveis: [],
    isLoading: false,
  } as ReturnType<typeof useComercialData>);

  vi.mocked(useComercialProdutos).mockReturnValue({
    topProdutos,
    porMarca,
    porCategoria: [{ categoria: 'Transmissao', faturamento: 100_000, quantidade: 10 }],
    produtosSemGiro,
    resumoVendas,
    hasSource,
    isLoading: false,
  } as ReturnType<typeof useComercialProdutos>);
}

function renderPage() {
  return render(
    <main aria-label="Modulo comercial">
      <ProdutosPage />
    </main>,
  );
}

describe('ProdutosPage compacta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockData();
  });

  it('compoe shell, busca, filtros e indicadores compactos sem cabecalho redundante', () => {
    renderPage();

    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('main', { name: 'Modulo comercial' }).querySelector('.comercial-compact-page')).toHaveProperty('tagName', 'DIV');
    expect(screen.getByRole('heading', { name: 'Produtos' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Buscar produtos' })).toBeVisible();
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
    expect(viewport.querySelector('.premium-card')).not.toBeInTheDocument();
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
    expect(screen.getByRole('region', { name: 'Carregando produtos' })).toBeInTheDocument();
    expect(screen.getByText('Carregando produtos...')).toBeInTheDocument();
  });

  it('mostra estados vazios nas tabelas de Sem Giro e Resumo NF', () => {
    vi.mocked(useComercialProdutos).mockReturnValue({
      topProdutos: [], porMarca: [], porCategoria: [], produtosSemGiro: [], resumoVendas: [],
      hasSource: true, isLoading: false,
    } as ReturnType<typeof useComercialProdutos>);

    renderPage();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Sem Giro/ }), { button: 0, ctrlKey: false });
    expect(screen.getByText('Todos os produtos movimentaram no período.')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Resumo NF' }), { button: 0, ctrlKey: false });
    expect(screen.getByText('Nenhuma venda encontrada no recorte atual.')).toBeInTheDocument();
  });
});
