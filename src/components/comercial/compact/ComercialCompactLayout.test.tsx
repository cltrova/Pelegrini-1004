import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import postcss from 'postcss';
import { describe, expect, it, vi } from 'vitest';

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
    expect(screen.getByLabelText('Indicadores comerciais')).toHaveClass('commercial-metric-strip');
    expect(workspace).toHaveClass('commercial-workspace', 'min-h-0', 'min-w-0', 'max-w-full', 'overflow-x-hidden');
    expect(screen.getByRole('banner')).toHaveClass('commercial-toolbar');
    expect(viewport).toHaveClass('commercial-data-viewport', 'min-h-0', 'min-w-0', 'max-w-full', 'overflow-auto');
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
    expect(filters).toHaveClass('commercial-filter-control');
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

  it('sizes each textual metric intrinsically without widening the whole strip', () => {
    render(
      <ComercialMetricStrip
        metrics={[
          { label: 'Valor em aberto', value: 'R$ 1.234.567.890,12' },
          { label: 'Pedidos', value: '42' },
        ]}
      />,
    );

    const strip = screen.getByLabelText('Indicadores comerciais');
    const longMetric = screen.getByText('R$ 1.234.567.890,12').closest('article');
    const shortMetric = screen.getByText('42').closest('article');

    expect(longMetric).toHaveStyle({ minWidth: 'max(9rem, calc(19ch + 3rem))' });
    expect(shortMetric).toHaveStyle({ minWidth: 'max(9rem, calc(2ch + 3rem))' });
    expect(strip).not.toHaveAttribute('style');
  });

  it('marks the rendered metric tooltip portal as a commercial overlay', async () => {
    vi.useFakeTimers();
    try {
      render(
        <ComercialMetricStrip
          metrics={[{ label: 'Valor em aberto', value: 'R$ 1.000,00', tooltip: 'Total confirmado' }]}
        />,
      );

      const trigger = screen.getByText('R$ 1.000,00').closest('article');
      expect(trigger).not.toBeNull();
      fireEvent.focus(trigger!);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(screen.getByRole('tooltip')).toHaveClass('commercial-overlay');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps metric tracks intrinsic in one horizontally scrollable row', () => {
    const css = readFileSync(join(process.cwd(), 'src/components/comercial/compact/ComercialCompactLayout.css'), 'utf8');
    const stripRule = css.match(/\.comercial-metric-strip\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(stripRule).toMatch(/grid-auto-flow:\s*column/);
    expect(stripRule).toMatch(/grid-auto-columns:\s*minmax\(max-content,\s*1fr\)/);
    expect(stripRule).toMatch(/overflow-x:\s*auto/);
    expect(stripRule).not.toMatch(/grid-template-columns/);
  });

  it('keeps commission and dashboard metric strips on the square panel radius', () => {
    const css = readFileSync(join(process.cwd(), 'src/components/comercial/compact/ComercialCompactLayout.css'), 'utf8');
    const metricRadiusRules: Array<{ selector: string; value: string }> = [];

    postcss.parse(css).walkRules((rule) => {
      if (!rule.selector.includes('.comercial-metric-strip')) return;

      rule.walkDecls('border-radius', (declaration) => {
        metricRadiusRules.push({ selector: rule.selector, value: declaration.value });
      });
    });

    expect(metricRadiusRules).toEqual(expect.arrayContaining([
      expect.objectContaining({ selector: expect.stringContaining('.comissao-page .comercial-metric-strip') }),
      expect.objectContaining({ selector: expect.stringContaining('.dashboard-overview-grid .comercial-metric-strip') }),
    ]));
    expect(metricRadiusRules.every(({ value }) => value === 'var(--commercial-panel-radius, 2px)')).toBe(true);
  });

  it('keeps commission results and errors on the square panel radius', () => {
    const css = readFileSync(join(process.cwd(), 'src/components/comercial/compact/ComercialCompactLayout.css'), 'utf8');
    const commissionRadiusRules: Array<{ selector: string; value: string }> = [];

    postcss.parse(css).walkRules((rule) => {
      if (!rule.selector.includes('.comissao-results') && !rule.selector.includes('.comissao-error')) return;

      rule.walkDecls('border-radius', (declaration) => {
        commissionRadiusRules.push({ selector: rule.selector, value: declaration.value });
      });
    });

    expect(commissionRadiusRules).toEqual(expect.arrayContaining([
      expect.objectContaining({ selector: expect.stringContaining('.comissao-results') }),
      expect.objectContaining({ selector: expect.stringContaining('.comissao-error') }),
    ]));
    expect(commissionRadiusRules.every(({ value }) => value === 'var(--commercial-panel-radius, 2px)')).toBe(true);
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
