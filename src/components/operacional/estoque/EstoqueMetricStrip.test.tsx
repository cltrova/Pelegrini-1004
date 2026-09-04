import { fireEvent, render, screen } from '@testing-library/react';
import { CircleDollarSign, Package, TriangleAlert } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { EstoqueMetricStrip, type EstoqueMetric } from './EstoqueMetricStrip';

const metrics: EstoqueMetric[] = [
  {
    key: 'products',
    label: 'Produtos',
    value: '4.924',
    description: 'Quantidade de produtos retornados pela fonte de estoque.',
    icon: Package,
    tone: 'information',
    interactive: true,
  },
  {
    key: 'value',
    label: 'Valor do estoque',
    value: 'R$ 12.345.678.901,23',
    description: 'Soma do valor em estoque dos produtos retornados.',
    icon: CircleDollarSign,
    tone: 'neutral',
    interactive: false,
  },
  {
    key: 'critical',
    label: 'Criticos',
    value: '1.624',
    description: 'Cobertura menor que 15 dias.',
    icon: TriangleAlert,
    tone: 'danger',
    interactive: true,
  },
];

describe('EstoqueMetricStrip', () => {
  it('explica a metrica por foco sem recorte e aplica o filtro interativo', async () => {
    const onMetricClick = vi.fn();
    render(
      <EstoqueMetricStrip
        activeKey="critical"
        metrics={metrics}
        onMetricClick={onMetricClick}
      />,
    );

    const strip = screen.getByRole('region', { name: 'Indicadores de estoque' });
    const critical = screen.getByRole('button', { name: 'Criticos: 1.624' });
    expect(strip).toHaveClass('h-[52px]', 'shrink-0', 'overflow-x-auto');
    expect(critical).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.focus(critical);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Cobertura menor que 15 dias.');
    expect(strip).not.toContainElement(tooltip);
    expect(critical).toHaveAttribute('aria-describedby', tooltip.id);

    fireEvent.click(critical);
    expect(onMetricClick).toHaveBeenCalledOnce();
    expect(onMetricClick).toHaveBeenCalledWith('critical');
  });

  it('mantem metricas informativas focaveis sem acionar filtros', () => {
    const onMetricClick = vi.fn();
    render(<EstoqueMetricStrip metrics={metrics} onMetricClick={onMetricClick} />);

    const informative = screen.getByRole('article', { name: 'Valor do estoque: R$ 12.345.678.901,23' });
    const value = screen.getByText('R$ 12.345.678.901,23');

    expect(informative).toHaveAttribute('tabindex', '0');
    expect(value).toHaveClass(
      'min-w-0',
      'max-w-full',
      'whitespace-nowrap',
      'text-[clamp(0.95rem,1.25vw,1.2rem)]',
    );

    fireEvent.click(informative);
    expect(onMetricClick).not.toHaveBeenCalled();
  });

  it('marca somente a metrica ativa e ignora cliques quando nao ha callback', () => {
    render(<EstoqueMetricStrip activeKey="products" metrics={metrics} />);

    expect(screen.getByRole('button', { name: 'Produtos: 4.924' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Criticos: 1.624' })).toHaveAttribute('aria-pressed', 'false');

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Produtos: 4.924' }))).not.toThrow();
  });
});
