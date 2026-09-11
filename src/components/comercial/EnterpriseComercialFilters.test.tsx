import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ComercialFilters } from '@/types/comercial';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isMaster: false }),
}));

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({ filialAtiva: null, filialNome: null }),
}));

vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: () => ({ codEmpresaAtiva: null, empresa: null }),
}));

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

  function SelectContent({ children, className }: { children: React.ReactNode; className?: string }) {
    const { open } = React.useContext(SelectContext);
    return open ? <div className={className} role="listbox">{children}</div> : null;
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

vi.mock('@/components/ui/popover', async () => {
  const React = await import('react');

  const PopoverContext = React.createContext({ open: false, setOpen: (_open: boolean) => undefined });

  function Popover({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = React.useState(false);
    return <PopoverContext.Provider value={{ open, setOpen }}>{children}</PopoverContext.Provider>;
  }

  function PopoverTrigger({ children }: { asChild?: boolean; children: React.ReactElement }) {
    const { open, setOpen } = React.useContext(PopoverContext);
    return React.cloneElement(children, { onClick: () => setOpen(!open) });
  }

  function PopoverContent({ children, className }: { children: React.ReactNode; className?: string }) {
    const { open } = React.useContext(PopoverContext);
    return open ? <div className={className} role="dialog">{children}</div> : null;
  }

  return { Popover, PopoverContent, PopoverTrigger };
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

  it('marks portalled filter content as a commercial overlay', () => {
    render(
      <EnterpriseComercialFilters
        anos={['2026']}
        appliedFilters={baseFilters}
        clientes={[{ codigo: 'A', nome: 'Cliente A' }]}
        hasChanges={false}
        onApply={() => undefined}
        onClear={() => undefined}
        onPendingFiltersChange={() => undefined}
        pendingFilters={baseFilters}
        showClienteFilter
      />,
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Cliente' }));

    expect(screen.getByRole('listbox')).toHaveClass('commercial-overlay');
  });

  it('marks portalled multi-select content as a commercial overlay', () => {
    const onPendingFiltersChange = vi.fn();

    render(
      <EnterpriseComercialFilters
        anos={['2026']}
        appliedFilters={baseFilters}
        hasChanges={false}
        onApply={() => undefined}
        onClear={() => undefined}
        onPendingFiltersChange={onPendingFiltersChange}
        pendingFilters={baseFilters}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Periodo:/ }));

    expect(screen.getByRole('dialog')).toHaveClass('commercial-overlay');
    const search = screen.getByPlaceholderText('Buscar...');
    search.focus();
    fireEvent.change(search, { target: { value: 'fev' } });
    expect(search).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Fevereiro' }));
    expect(onPendingFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ anos: ['2026'], meses: ['07', '02'] }),
    );
  });

  it('marks native popover and select portals as commercial overlays', () => {
    render(
      <EnterpriseComercialFilters
        anos={['2026']}
        appliedFilters={baseFilters}
        hasChanges={false}
        monthOnly
        onApply={() => undefined}
        onClear={() => undefined}
        onPendingFiltersChange={() => undefined}
        pendingFilters={baseFilters}
        useNativeControls
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '2026' }));
    expect(screen.getByRole('dialog')).toHaveClass('commercial-overlay');

    fireEvent.click(screen.getAllByRole('combobox')[0]);
    expect(screen.getByRole('listbox')).toHaveClass('commercial-overlay');
  });
});
