import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { EstoqueRecord } from '@/types/estoque';
import { EstoqueOverview } from './EstoqueOverview';

vi.mock('recharts', () => ({
  Area: () => null,
  AreaChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  Cell: () => null,
  Pie: ({ children, onMouseEnter }: { children: ReactNode; onMouseEnter?: (data: unknown, index: number) => void }) => (
    <button data-testid="brand-slice" onMouseEnter={() => onMouseEnter?.({}, 0)} type="button">
      {children}
    </button>
  ),
  PieChart: ({ children, onMouseLeave }: { children: ReactNode; onMouseLeave?: () => void }) => (
    <div data-testid="brand-pie-chart" onMouseLeave={onMouseLeave}>{children}</div>
  ),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tooltip: ({ active }: { active?: boolean }) => <output data-testid="chart-tooltip-active">{String(Boolean(active))}</output>,
  XAxis: () => null,
  YAxis: () => null,
}));

const stock: EstoqueRecord[] = [{
  cod_empresa_bi: 1004,
  cod_empresa: 1,
  empresa: 'Casa da Transmissão',
  cod_produto: 1,
  produto: 'TRANSMISSÃO',
  cod_fabricante: '1',
  cod_fornecedor: '1',
  cod_grupo_produto: 1,
  grupo: 'CÂMBIO',
  cod_marca_produto: '1',
  marca: 'EATON',
  cod_linha: '1',
  linha: null,
  nr_fabricante: 'FS-6306B',
  nr_original: '',
  aplicacao_produto: '',
  classe_abc: 'A',
  quantidade_estoque: 1,
  data_ultima_compra: null,
  operacao_ultima_compra: null,
  data_ultima_transferencia: null,
  operacao_ultima_transferencia: null,
  data_ultima_venda: null,
  cod_cliente_ultima_venda: '',
  cliente_ultima_venda: '',
  quantidade_compra_produto: 0,
  valor_estoque: 100,
  custo: 100,
  custo_fornecedor: 100,
  custo_medio: 100,
  custo_ultima_compra: 100,
  tipo_relatorio: 'FILIAL CONSOLIDADA',
}];

describe('EstoqueOverview', () => {
  it('fecha o tooltip de marcas quando o mouse sai do gráfico', () => {
    render(
      <EstoqueOverview
        activeCompanyCode={1004}
        movementData={[]}
        onOpenCentral={vi.fn()}
        stockData={stock}
      />,
    );

    const tooltip = screen.getAllByTestId('chart-tooltip-active').at(-1);
    expect(tooltip).toHaveTextContent('false');

    fireEvent.mouseEnter(screen.getByTestId('brand-slice'));
    expect(tooltip).toHaveTextContent('true');

    fireEvent.mouseLeave(screen.getByTestId('brand-pie-chart'));
    expect(tooltip).toHaveTextContent('false');
  });
});
