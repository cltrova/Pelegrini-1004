import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ComercialFilters } from '@/types/comercial';

vi.mock('@/components/ui/select', async () => {
  const React = await import('react');

  interface SelectContextValue {
    onValueChange: (value: string) => void;
    open: boolean;
    setOpen: (open: boolean) => void;
    value: string;
  }

  const SelectContext = React.createContext<SelectContextValue>({
    onValueChange: () => undefined,
    open: false,
    setOpen: () => undefined,
    value: '',
  });

  function Select({
    children,
    onValueChange,
    value,
  }: {
    children: React.ReactNode;
    onValueChange: (value: string) => void;
    value: string;
  }) {
    const [open, setOpen] = React.useState(false);
    return (
      <SelectContext.Provider value={{ onValueChange, open, setOpen, value }}>
        {children}
      </SelectContext.Provider>
    );
  }

  function SelectTrigger({
    'aria-label': ariaLabel,
    children,
    className,
  }: {
    'aria-label'?: string;
    children: React.ReactNode;
    className?: string;
  }) {
    const { open, setOpen } = React.useContext(SelectContext);
    return (
      <button
        aria-expanded={open}
        aria-label={ariaLabel}
        className={className}
        onClick={() => setOpen(!open)}
        role="combobox"
        type="button"
      >
        {children}
      </button>
    );
  }

  function SelectValue() {
    const { value } = React.useContext(SelectContext);
    return <span>{value}</span>;
  }

  function SelectContent({ children }: { children: React.ReactNode }) {
    const { open } = React.useContext(SelectContext);
    return open ? <div role="listbox">{children}</div> : null;
  }

  function SelectItem({ children, value }: { children: React.ReactNode; value: string }) {
    const context = React.useContext(SelectContext);
    return (
      <button
        aria-selected={context.value === value}
        onClick={() => {
          context.onValueChange(value);
          context.setOpen(false);
        }}
        role="option"
        type="button"
      >
        {children}
      </button>
    );
  }

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
});

import { EnterpriseComercialFilters } from './EnterpriseComercialFilters';

const baseFilters: ComercialFilters = {
  anos: ['2026'],
  meses: ['07'],
  status: 'todos',
  tipo: 'todos',
  cliente: 'A',
};

describe('EnterpriseComercialFilters', () => {
  it('troca o cliente singular de A para B diretamente', () => {
    const onPendingFiltersChange = vi.fn();

    render(
      <EnterpriseComercialFilters
        anos={['2026']}
        appliedFilters={baseFilters}
        clientes={[
          { codigo: 'A', nome: 'Cliente A' },
          { codigo: 'B', nome: 'Cliente B' },
        ]}
        hasChanges
        onApply={() => undefined}
        onClear={() => undefined}
        onPendingFiltersChange={onPendingFiltersChange}
        pendingFilters={baseFilters}
        showClienteFilter
      />,
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Cliente' }));
    fireEvent.click(screen.getByRole('option', { name: 'Cliente B' }));

    expect(onPendingFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ cliente: 'B' }),
    );
  });
});
