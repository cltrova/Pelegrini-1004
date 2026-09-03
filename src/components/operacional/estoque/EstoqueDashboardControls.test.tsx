import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EstoqueAttentionPanel } from './EstoqueAttentionPanel';
import { EstoqueMovementHighlights } from './EstoqueMovementHighlights';
import { EstoqueSmartFilters } from './EstoqueSmartFilters';
import { EstoqueSummaryCards } from './EstoqueSummaryCards';
import { buildStockInsights, type StockProductInsight } from './estoqueIntelligence';
import { estoqueFixture, estoqueFixtureComTresItens, giroFixture, NOW } from './estoqueFixtures';

const baseInsight = buildStockInsights(estoqueFixture, giroFixture, NOW)[0];

function product(
  codProduto: number,
  produto: string,
  overrides: Partial<StockProductInsight> = {},
): StockProductInsight {
  return {
    ...baseInsight,
    cod_produto: codProduto,
    produto,
    valor_estoque: codProduto * 10,
    ...overrides,
  };
}

const insightsFixture: StockProductInsight[] = [
  product(1, 'Produto critico', { status: 'critical', quantidade_estoque: 4, stagnantDays: 2 }),
  product(2, 'Produto sem estoque', {
    status: 'out',
    quantidade_estoque: 0,
    movementDataAvailable: false,
    totalMovement: 0,
    stagnantDays: 120,
  }),
  product(3, 'Produto baixo', { status: 'low', quantidade_estoque: 18, stagnantDays: 20 }),
  product(4, 'Produto parado', { status: 'available', quantidade_estoque: 30, stagnantDays: 140 }),
  product(5, 'Produto disponivel', { status: 'available', quantidade_estoque: 40, stagnantDays: 5 }),
];

describe('EstoqueSummaryCards', () => {
  it('mantem quatro indicadores compactos e valores contidos', () => {
    const { container } = render(
      <EstoqueSummaryCards products={insightsFixture} activeFilter="all" onFilterChange={vi.fn()} />,
    );

    const grid = screen.getByLabelText('Resumo do estoque');
    expect(grid).toHaveClass('enterprise-grid-metrics');
    expect(container.querySelectorAll('[data-stock-summary]')).toHaveLength(4);
    container.querySelectorAll('[data-stock-summary]').forEach((card) => {
      expect(card).toHaveClass('min-w-0');
    });
  });

  it('aplica e remove o filtro de atencao pelo mesmo indicador', () => {
    const onFilterChange = vi.fn();
    const { rerender } = render(
      <EstoqueSummaryCards products={insightsFixture} activeFilter="all" onFilterChange={onFilterChange} />,
    );

    const attention = screen.getByRole('button', { name: /Exigem atencao.*4/i });
    expect(attention).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(attention);
    expect(onFilterChange).toHaveBeenLastCalledWith('attention');

    rerender(
      <EstoqueSummaryCards products={insightsFixture} activeFilter="attention" onFilterChange={onFilterChange} />,
    );
    expect(screen.getByRole('button', { name: /Exigem atencao.*4/i })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Exigem atencao.*4/i }));
    expect(onFilterChange).toHaveBeenLastCalledWith('all');
  });

  it('agrupa criticos, estoque baixo e parados no indicador de atencao', () => {
    const onFilterChange = vi.fn();
    render(<EstoqueSummaryCards products={insightsFixture} activeFilter="all" onFilterChange={onFilterChange} />);

    const attention = screen.getByRole('button', { name: /Exigem atencao.*4/i });
    fireEvent.click(attention);
    expect(onFilterChange).toHaveBeenCalledWith('attention');
  });

  it('mantem valor estimado informativo sem aplicar filtro', () => {
    const onFilterChange = vi.fn();
    render(<EstoqueSummaryCards products={insightsFixture} activeFilter="all" onFilterChange={onFilterChange} />);

    const value = screen.getByText('Valor estimado').closest('[data-stock-summary]');
    expect(value?.tagName).toBe('ARTICLE');
    expect(within(value as HTMLElement).getByText(/R\$/)).toBeInTheDocument();
    expect(within(value as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
    expect(onFilterChange).not.toHaveBeenCalled();
  });
});

describe('EstoqueAttentionPanel', () => {
  it('identifica status com texto, icone acessivel e marcador', () => {
    render(<EstoqueAttentionPanel products={insightsFixture} onSelectProduct={vi.fn()} />);

    expect(screen.getByText('Sem estoque')).toBeInTheDocument();
    expect(screen.getByLabelText('Situacao: sem estoque')).toBeInTheDocument();
    expect(screen.getByText('Sem estoque').closest('[data-stock-status]')).toHaveAttribute('data-stock-status', 'out');
  });

  it('prioriza sem estoque, critico, baixo e parado e limita a seis itens', () => {
    const products = [
      product(30, 'Parado B', { status: 'available', stagnantDays: 130 }),
      product(20, 'Baixo A', { status: 'low', stagnantDays: 2 }),
      product(11, 'Sem estoque B', { status: 'out', quantidade_estoque: 0, stagnantDays: 2 }),
      product(40, 'Parado A', { status: 'available', stagnantDays: 180 }),
      product(10, 'Sem estoque A', { status: 'out', quantidade_estoque: 0, stagnantDays: 2 }),
      product(21, 'Baixo B', { status: 'low', stagnantDays: 2 }),
      product(31, 'Parado C', { status: 'available', stagnantDays: 100 }),
      product(15, 'Critico A', { status: 'critical', stagnantDays: 2 }),
    ];

    render(<EstoqueAttentionPanel products={products} onSelectProduct={vi.fn()} />);

    const panel = screen.getByLabelText('Produtos que precisam de atencao');
    const rows = within(panel).getAllByRole('button');
    expect(rows).toHaveLength(6);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Sem estoque A'),
      expect.stringContaining('Sem estoque B'),
      expect.stringContaining('Critico A'),
      expect.stringContaining('Baixo A'),
      expect.stringContaining('Baixo B'),
      expect.stringContaining('Parado A'),
    ]);
  });

  it('seleciona o produto e mostra estado positivo sem alertas', () => {
    const onSelectProduct = vi.fn();
    const { rerender } = render(
      <EstoqueAttentionPanel products={insightsFixture} onSelectProduct={onSelectProduct} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Produto sem estoque/i }));
    expect(onSelectProduct).toHaveBeenCalledWith(insightsFixture[1]);

    rerender(<EstoqueAttentionPanel products={[insightsFixture[4]]} onSelectProduct={onSelectProduct} />);
    expect(screen.getByText('Estoque sem alertas prioritarios')).toBeInTheDocument();
  });
});

describe('EstoqueSmartFilters', () => {
  const defaultProps = {
    search: '',
    quickFilter: 'all' as const,
    brands: [] as string[],
    groups: [] as string[],
    lines: [] as string[],
    options: {
      brands: ['ZF', 'Spicer'],
      groups: ['Embreagem', 'Transmissao'],
      lines: ['Pesada', 'Leve'],
    },
    onSearchChange: vi.fn(),
    onQuickFilterChange: vi.fn(),
    onBrandsChange: vi.fn(),
    onGroupsChange: vi.fn(),
    onLinesChange: vi.fn(),
    onClearAll: vi.fn(),
  };

  it('mantem a busca visivel e envia cada alteracao imediatamente', () => {
    const onSearchChange = vi.fn();
    render(<EstoqueSmartFilters {...defaultProps} onSearchChange={onSearchChange} />);

    const search = screen.getByRole('searchbox', { name: 'Buscar no estoque' });
    expect(search).toBeVisible();
    fireEvent.change(search, { target: { value: 'embreagem' } });
    expect(onSearchChange).toHaveBeenCalledWith('embreagem');
  });

  it('altera marca, grupo e linha pelos seletores controlados', () => {
    const onBrandsChange = vi.fn();
    const onGroupsChange = vi.fn();
    const onLinesChange = vi.fn();
    render(
      <EstoqueSmartFilters
        {...defaultProps}
        onBrandsChange={onBrandsChange}
        onGroupsChange={onGroupsChange}
        onLinesChange={onLinesChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    fireEvent.click(screen.getByRole('button', { name: /Marca:.*Todas/i }));
    fireEvent.click(screen.getByRole('button', { name: 'ZF' }));
    expect(onBrandsChange).toHaveBeenCalledWith(['ZF']);

    fireEvent.click(screen.getByRole('button', { name: /Grupo:.*Todos/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Embreagem' }));
    expect(onGroupsChange).toHaveBeenCalledWith(['Embreagem']);

    fireEvent.click(screen.getByRole('button', { name: /Linha:.*Todas/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Pesada' }));
    expect(onLinesChange).toHaveBeenCalledWith(['Pesada']);
  });

  it('torna Disponiveis e Com estoque acessiveis como filtros compactos', () => {
    const onQuickFilterChange = vi.fn();
    const { rerender } = render(
      <EstoqueSmartFilters
        {...defaultProps}
        onQuickFilterChange={onQuickFilterChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    const available = screen.getByRole('button', { name: 'Disponiveis' });
    const withStock = screen.getByRole('button', { name: 'Com estoque' });
    expect(available).toHaveAttribute('aria-pressed', 'false');
    expect(withStock).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(available);
    fireEvent.click(withStock);
    expect(onQuickFilterChange).toHaveBeenNthCalledWith(1, 'available');
    expect(onQuickFilterChange).toHaveBeenNthCalledWith(2, 'with-stock');

    rerender(
      <EstoqueSmartFilters
        {...defaultProps}
        quickFilter="available"
        onQuickFilterChange={onQuickFilterChange}
      />,
    );
    expect(screen.getByRole('button', { name: 'Disponiveis' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Disponiveis' }));
    expect(onQuickFilterChange).toHaveBeenLastCalledWith('all');
  });

  it('remove chips individualmente e limpa todos os filtros', () => {
    const onSearchChange = vi.fn();
    const onQuickFilterChange = vi.fn();
    const onBrandsChange = vi.fn();
    const onClearAll = vi.fn();
    render(
      <EstoqueSmartFilters
        {...defaultProps}
        search="kit"
        quickFilter="critical"
        brands={['ZF']}
        groups={['Embreagem']}
        lines={['Pesada']}
        onSearchChange={onSearchChange}
        onQuickFilterChange={onQuickFilterChange}
        onBrandsChange={onBrandsChange}
        onClearAll={onClearAll}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remover busca kit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover filtro Criticos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover marca ZF' }));
    expect(onSearchChange).toHaveBeenCalledWith('');
    expect(onQuickFilterChange).toHaveBeenCalledWith('all');
    expect(onBrandsChange).toHaveBeenCalledWith([]);

    fireEvent.click(screen.getByRole('button', { name: /Filtros, 4 ativos/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar todos os filtros' }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});

describe('EstoqueMovementHighlights', () => {
  it('mostra dados insuficientes nos destaques sem esconder saldo e valor', () => {
    const withoutMovement = [
      product(1, 'Produto sem giro', {
        quantidade_estoque: 10,
        valor_estoque: 5000,
        movementDataAvailable: false,
        totalMovement: 0,
        movements: [],
      }),
    ];

    render(<EstoqueMovementHighlights products={withoutMovement} onSelectProduct={vi.fn()} />);

    expect(screen.getByText('Dados insuficientes para movimentacao')).toBeInTheDocument();
    expect(screen.getByText('10 em estoque')).toBeInTheDocument();
    expect(screen.getByText(/R\$.*5\.000/)).toBeInTheDocument();
  });

  it('limita cada ranking a cinco e seleciona o produto correto', () => {
    const onSelectProduct = vi.fn();
    const products = Array.from({ length: 7 }, (_, index) =>
      product(index + 1, `Produto ${index + 1}`, {
        totalMovement: 100 - index,
        movementDataAvailable: true,
        stagnantDays: 200 - index,
      }),
    );
    render(<EstoqueMovementHighlights products={products} onSelectProduct={onSelectProduct} />);

    const moved = screen.getByLabelText('Mais movimentados');
    const stagnant = screen.getByLabelText('Produtos parados');
    expect(within(moved).getAllByRole('button')).toHaveLength(5);
    expect(within(stagnant).getAllByRole('button')).toHaveLength(5);

    fireEvent.click(within(moved).getByRole('button', { name: /Produto 1/i }));
    expect(onSelectProduct).toHaveBeenCalledWith(products[0]);
  });

  it('mostra o tipo principal e alterna o ranking entre vendas e retiradas', () => {
    const cleanMovement = {
      ...giroFixture[0],
      entrada_compra: 0,
      entrada_transferencia: 0,
      entrada_outras: 0,
      entrada_devolucao: 0,
      saida_venda: 0,
      saida_transferencia: 0,
      saida_outras: 0,
      saida_devolucao: 0,
    };
    const products = buildStockInsights(
      estoqueFixtureComTresItens.slice(0, 2),
      [
        { ...cleanMovement, cod_produto: 101, saida_venda: 12 },
        { ...cleanMovement, cod_produto: 202, saida_transferencia: 40 },
      ],
      NOW,
    );

    render(<EstoqueMovementHighlights products={products} onSelectProduct={vi.fn()} />);

    const movementTypes = screen.getByRole('group', { name: 'Tipo de movimento' });
    expect(within(movementTypes).getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Principal: Venda')).toBeInTheDocument();
    expect(screen.getByText('Principal: Retirada')).toBeInTheDocument();

    fireEvent.click(within(movementTypes).getByRole('button', { name: 'Vendas' }));
    const sales = screen.getByLabelText('Mais movimentados');
    expect(within(sales).getByText('KIT EMBREAGEM PESADA')).toBeInTheDocument();
    expect(within(sales).queryByText('BOMBA D AGUA')).not.toBeInTheDocument();
    expect(within(sales).getByText('12 vendas')).toBeInTheDocument();

    fireEvent.click(within(movementTypes).getByRole('button', { name: 'Retiradas' }));
    const withdrawals = screen.getByLabelText('Mais movimentados');
    expect(within(withdrawals).getByText('BOMBA D AGUA')).toBeInTheDocument();
    expect(within(withdrawals).queryByText('KIT EMBREAGEM PESADA')).not.toBeInTheDocument();
    expect(within(withdrawals).getByText('40 retiradas')).toBeInTheDocument();
  });
});
