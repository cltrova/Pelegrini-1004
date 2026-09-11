import type { ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryState = vi.hoisted(() => ({
  data: [
    { mes: '2026-07', marca: 'ZF', cod_marca: '11', cod_grupo: '1', grupo: 'ZF Pesado', classe: '1', valor_estoque: 100, percentual_estoque: 50, duracao_estoque: 30, valor_vendas: 40, percentual_vendas: 50, percentual_acumulado_vendas: 50, margem_venda: 20, prazo_medio_venda: 10, valor_devolucoes: 2, valor_compras: 25, percentual_compras: 100, prazo_medio_compra: 8, percentual_diferenca_compra_cmv: 5 },
    { mes: '2026-08', marca: 'ZF', cod_marca: '11', cod_grupo: '1', grupo: 'ZF Pesado', classe: '1', valor_estoque: 120, percentual_estoque: 60, duracao_estoque: 28, valor_vendas: 50, percentual_vendas: 60, percentual_acumulado_vendas: 60, margem_venda: 22, prazo_medio_venda: 9, valor_devolucoes: 1, valor_compras: 30, percentual_compras: 100, prazo_medio_compra: 7, percentual_diferenca_compra_cmv: 4 },
  ],
  isLoading: false,
  isFetching: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const productsState = vi.hoisted(() => ({
  produtos: [] as Record<string, unknown>[],
  isLoading: false,
  isFetching: false,
}));

vi.mock('@/hooks/useDistributorEvolution', () => ({
  useDistributorEvolution: () => queryState,
}));

vi.mock('@/hooks/useComercialProdutos', () => ({
  useComercialProdutos: () => productsState,
}));

vi.mock('recharts', () => ({
  Area: () => null,
  AreaChart: ({ children }: { children: ReactNode }) => <svg data-testid="sales-purchases-chart">{children}</svg>,
  CartesianGrid: () => null,
  Legend: () => null,
  Line: () => null,
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

import { DistributorEvolutionTab } from './DistributorEvolutionTab';

describe('DistributorEvolutionTab', () => {
  beforeEach(() => {
    queryState.data = [
      { mes: '2026-07', marca: 'ZF', cod_marca: '11', cod_grupo: '1', grupo: 'ZF Pesado', classe: '1', valor_estoque: 100, percentual_estoque: 50, duracao_estoque: 30, valor_vendas: 40, percentual_vendas: 50, percentual_acumulado_vendas: 50, margem_venda: 20, prazo_medio_venda: 10, valor_devolucoes: 2, valor_compras: 25, percentual_compras: 100, prazo_medio_compra: 8, percentual_diferenca_compra_cmv: 5 },
      { mes: '2026-08', marca: 'ZF', cod_marca: '11', cod_grupo: '1', grupo: 'ZF Pesado', classe: '1', valor_estoque: 120, percentual_estoque: 60, duracao_estoque: 28, valor_vendas: 50, percentual_vendas: 60, percentual_acumulado_vendas: 60, margem_venda: 22, prazo_medio_venda: 9, valor_devolucoes: 1, valor_compras: 30, percentual_compras: 100, prazo_medio_compra: 7, percentual_diferenca_compra_cmv: 4 },
    ];
    queryState.error = null;
    productsState.produtos = [];
    productsState.isLoading = false;
  });

  it('mostra resumo, comparativo mensal e detalhamento do grupo', () => {
    render(<DistributorEvolutionTab active />);

    expect(screen.getByRole('region', { name: 'Evolução dos distribuidores' })).toBeInTheDocument();
    const filterButton = screen.getByRole('button', { name: 'Abrir filtros dos distribuidores' });
    expect(filterButton).toHaveClass('h-7', 'w-7');
    expect(filterButton).toHaveAttribute('title', 'Filtros');
    expect(screen.queryByLabelText('Data inicial')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Marcas analisadas' })).not.toBeInTheDocument();
    fireEvent.click(filterButton);
    expect(screen.getByLabelText('Data inicial')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Marcas analisadas' })).toBeInTheDocument();
    const filterPanel = screen.getByRole('dialog', { name: 'Filtros dos distribuidores' });
    expect(filterPanel).toHaveClass('z-40');
    expect(filterPanel).toHaveClass('operational-overlay');
    expect(filterPanel).not.toHaveClass('z-50');
    expect(screen.getAllByText(/R\$\s*120/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Evolução mensal' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Comparativo de vendas e compras' })).toBeInTheDocument();
    expect(screen.getByTestId('sales-purchases-chart')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Expandir ZF/i }));
    expect(screen.getByText('ZF Pesado')).toBeInTheDocument();

    const table = screen.getByRole('table', { name: 'Comparativo mensal dos distribuidores' });
    expect(table).toHaveClass('w-full', 'table-fixed');
    expect(table.parentElement?.parentElement).toHaveClass(
      'operational-comparison-matrix',
      'overflow-hidden',
    );
    expect(table).not.toHaveClass('min-w-[760px]');
    expect(screen.getByRole('region', { name: 'Comparativo de vendas e compras' }))
      .toHaveClass('operational-chart-panel', 'operational-panel');
    fireEvent.click(within(table).getByRole('button', { name: /ZF em agosto de 2026/i }));
    expect(screen.getByRole('dialog', { name: /ZF.*agosto de 2026/i }))
      .toHaveClass('operational-overlay');
    expect(screen.getByText('Margem de venda')).toBeInTheDocument();
  });

  it('explica quando o endpoint ainda nao esta publicado', () => {
    queryState.data = [];
    queryState.error = new Error('O endpoint de evolução de distribuidores ainda não está disponível na API.');
    render(<DistributorEvolutionTab active />);

    expect(screen.getByText(/endpoint de evolução de distribuidores ainda não está disponível/i)).toBeInTheDocument();
  });

  it('usa Produtos como visualizacao provisoria quando o relatorio oficial falha', () => {
    queryState.data = [];
    queryState.error = new Error('Endpoint indisponível');
    productsState.produtos = [
      { tipo: 'PEDIDO', data_faturamento: '2026-08-05', marca: 'ZF', grupo: 'ZF Pesado', valor_total: 120 },
      { tipo: 'DEVOLUCAO', data_faturamento: '2026-08-06', marca: 'ZF', grupo: 'ZF Pesado', valor_total: -20 },
    ];

    render(<DistributorEvolutionTab active />);

    expect(screen.getByText(/Visualização provisória/i)).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s*120/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Indisponível').length).toBeGreaterThan(0);
    expect(screen.getByText(/Compras aguardando fonte oficial/i)).toBeInTheDocument();
    expect(screen.queryByText('Endpoint indisponível')).not.toBeInTheDocument();
  });
});
