import { fireEvent, render, screen } from '@testing-library/react';
import { CircleDollarSign, Package, TriangleAlert } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { EstoqueMetricStrip, type EstoqueMetric } from './EstoqueMetricStrip';

const longCurrencyValue = 'R$ 123.456.789.012,90';

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
    value: longCurrencyValue,
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
    expect(strip).toHaveClass('h-11', 'shrink-0', 'overflow-x-auto');
    expect(critical).toHaveAttribute('aria-pressed', 'true');
    const descriptionId = critical.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId!)).toHaveTextContent('Cobertura menor que 15 dias.');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.focus(critical);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Cobertura menor que 15 dias.');
    expect(strip).not.toContainElement(tooltip);
    expect(critical).toHaveAttribute('aria-describedby', descriptionId);
    expect(document.querySelectorAll(`[id="${descriptionId}"]`)).toHaveLength(1);

    fireEvent.click(critical);
    expect(onMetricClick).toHaveBeenCalledOnce();
    expect(onMetricClick).toHaveBeenCalledWith('critical');
  });

  it('mantem metricas informativas focaveis sem acionar filtros', () => {
    const onMetricClick = vi.fn();
    render(<EstoqueMetricStrip metrics={metrics} onMetricClick={onMetricClick} />);

    const informative = screen.getByRole('article', { name: `Valor do estoque: ${longCurrencyValue}` });
    const value = screen.getByText(longCurrencyValue);

    expect(informative).toHaveAttribute('tabindex', '0');
    expect(informative.style.minWidth).toContain(`${longCurrencyValue.length}ch`);
    expect(value).toHaveClass(
      'min-w-0',
      'max-w-full',
      'whitespace-nowrap',
      'text-[0.95rem]',
    );
    expect(value).not.toHaveClass('truncate', 'overflow-hidden');

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
