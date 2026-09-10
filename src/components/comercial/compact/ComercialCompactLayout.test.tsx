import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  ComercialCommandBar,
  ComercialCompactPage,
  ComercialDataViewport,
  ComercialFilterBar,
  ComercialMetricStrip,
} from './ComercialCompactLayout';

describe('ComercialCompactLayout', () => {
  it('composes the commercial workspace with a compact command bar and scrollable data area', () => {
    render(
      <ComercialCompactPage>
        <ComercialCommandBar title="Cotacoes abertas" actions={<button type="button">Exportar</button>} />
        <ComercialMetricStrip metrics={[{ label: 'Valor em aberto', value: 'R$ 1.234.567,89' }]} />
        <ComercialDataViewport><table aria-label="Dados" /></ComercialDataViewport>
      </ComercialCompactPage>,
    );

    const workspace = screen.getByRole('main');
    const viewport = screen.getByTestId('comercial-data-viewport');

    expect(screen.getByRole('heading', { name: 'Cotacoes abertas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument();
    expect(screen.getByLabelText('Indicadores comerciais')).toHaveAttribute('data-density', 'compact');
    expect(workspace).toHaveClass('min-h-0', 'min-w-0', 'max-w-full', 'overflow-x-hidden');
    expect(viewport).toHaveClass('min-h-0', 'min-w-0', 'max-w-full', 'overflow-auto');
  });

  it('uses a neutral compact shell inside an existing main landmark', () => {
    render(
      <main aria-label="Modulo comercial">
        <ComercialCompactPage as="div">
          <ComercialCommandBar title="Clientes" />
        </ComercialCompactPage>
      </main>,
    );

    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { name: 'Clientes' }));
    expect(screen.getByRole('heading', { name: 'Clientes' }).closest('.comercial-compact-page')).toHaveProperty('tagName', 'DIV');
  });

  it('names and focuses only an explicitly operational data viewport', () => {
    render(
      <>
        <ComercialDataViewport ariaLabel="Ranking de clientes"><table /></ComercialDataViewport>
        <ComercialDataViewport><p>Resumo sem rolagem operacional</p></ComercialDataViewport>
      </>,
    );

    const operationalViewport = screen.getByRole('region', { name: 'Ranking de clientes' });
    const passiveViewport = screen.getByText('Resumo sem rolagem operacional').parentElement;

    expect(operationalViewport).toHaveAttribute('tabindex', '0');
    operationalViewport.focus();
    expect(operationalViewport).toHaveFocus();
    expect(passiveViewport).not.toHaveAttribute('tabindex');
    expect(passiveViewport).not.toHaveAttribute('role');
  });

  it('keeps visible filters in a compact labeled band', () => {
    render(
      <ComercialFilterBar
        actions={<button type="button">Aplicar</button>}
        primary={<label htmlFor="periodo">Periodo<input id="periodo" /></label>}
        search={<label htmlFor="busca">Buscar<input id="busca" /></label>}
      />,
    );

    const filters = screen.getByLabelText('Filtros comerciais');
    expect(filters).toHaveAttribute('data-density', 'compact');
    expect(screen.getByLabelText('Buscar')).toBeInTheDocument();
    expect(screen.getByLabelText('Periodo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeInTheDocument();
  });

  it('exposes complete metric values without text truncation', () => {
    render(<ComercialMetricStrip metrics={[{ label: 'Valor em aberto', value: 'R$ 1.234.567,89' }]} />);

    const value = screen.getByText('R$ 1.234.567,89');
    expect(value).toHaveAttribute('title', 'R$ 1.234.567,89');
    expect(value).toHaveClass('tabular-nums');
    expect(value).not.toHaveClass('truncate', 'overflow-hidden');
  });

  it('lets consumers specialize commercial filter and metric semantics', () => {
    render(
      <>
        <ComercialFilterBar ariaLabel="Filtros de cotacoes" mode="abertas" />
        <ComercialMetricStrip
          ariaLabel="Indicadores de cotacoes"
          metrics={[{ label: 'Valor perdido', value: 'R$ 12.345,67' }]}
          mode="perdidas"
        />
      </>,
    );

    expect(screen.getByLabelText('Filtros de cotacoes')).toHaveAttribute('data-mode', 'abertas');
    expect(screen.getByLabelText('Indicadores de cotacoes')).toHaveAttribute('data-mode', 'perdidas');
  });
});
