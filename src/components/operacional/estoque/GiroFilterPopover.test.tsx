import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GiroFilterPopover } from './GiroFilterPopover';

describe('GiroFilterPopover', () => {
  it('fecha o popover ao aplicar e limpar sem ciclo de estado externo', () => {
    const onApply = vi.fn();
    const onClear = vi.fn();
    render(
      <GiroFilterPopover
        appliedCount={1}
        appliedSummary="3 meses · Alerta"
        onApply={onApply}
        onClear={onClear}
        pendingCount={1}
      >
        <span>Controles pendentes</span>
      </GiroFilterPopover>,
    );

    const trigger = screen.getByRole('button', { name: /Filtros:.*Alerta/i });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Pesquisar' }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(onClear).toHaveBeenCalledOnce();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('mantem trigger e badge baseados somente nos filtros aplicados', () => {
    render(
      <GiroFilterPopover
        appliedCount={0}
        appliedSummary="3 meses"
        onApply={vi.fn()}
        onClear={vi.fn()}
        pendingCount={2}
      >
        <span>Dois filtros pendentes</span>
      </GiroFilterPopover>,
    );

    const trigger = screen.getByRole('button', { name: 'Filtros do giro' });
    expect(trigger).toHaveTextContent('Filtros');
    expect(trigger).not.toHaveTextContent('(2)');
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument();
  });
});
