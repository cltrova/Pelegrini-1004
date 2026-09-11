import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FilterDropdownChip } from './FilterDropdownChip';

describe('FilterDropdownChip', () => {
  it('mantem o painel portado sem classe adicional por padrao', () => {
    render(
      <FilterDropdownChip label="Marca">
        <button type="button">ZF</button>
      </FilterDropdownChip>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Marca:/i }));

    expect(screen.getByRole('button', { name: 'ZF' }).parentElement)
      .not.toHaveClass('operational-overlay');
  });

  it('aplica a classe opcional somente ao painel portado', () => {
    render(
      <FilterDropdownChip contentClassName="operational-overlay" label="Marca">
        <button type="button">ZF</button>
      </FilterDropdownChip>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Marca:/i }));

    const panel = screen.getByRole('button', { name: 'ZF' }).parentElement;
    expect(panel).toHaveClass('operational-overlay');
    expect(panel?.parentElement).toBe(document.body);
  });
});
