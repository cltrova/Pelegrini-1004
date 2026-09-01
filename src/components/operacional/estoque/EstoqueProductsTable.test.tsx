import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/dropdown-menu', async () => {
  const React = await import('react');

  interface MenuContextValue {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }

  const MenuContext = React.createContext<MenuContextValue>({
    open: false,
    onOpenChange: () => undefined,
  });

  function DropdownMenu({
    children,
    open = false,
    onOpenChange = () => undefined,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) {
    return <MenuContext.Provider value={{ open, onOpenChange }}>{children}</MenuContext.Provider>;
  }

  function DropdownMenuTrigger({
    asChild,
    children,
  }: {
    asChild?: boolean;
    children: React.ReactElement<{ onClick?: React.MouseEventHandler }>;
  }) {
    const { open, onOpenChange } = React.useContext(MenuContext);
    if (!asChild) return <button type="button">{children}</button>;

    return React.cloneElement(children, {
      onClick: (event: React.MouseEvent) => {
        children.props.onClick?.(event);
        onOpenChange(!open);
      },
    });
  }

  function DropdownMenuContent({ children, className }: { children: React.ReactNode; className?: string }) {
    const { open } = React.useContext(MenuContext);
    return open ? <div className={className} role="menu">{children}</div> : null;
  }

  function DropdownMenuLabel({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>;
  }

  function DropdownMenuCheckboxItem({
    checked,
    children,
    disabled,
    onCheckedChange,
    onSelect,
  }: {
    checked?: boolean;
    children: React.ReactNode;
    disabled?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    onSelect?: (event: { preventDefault: () => void }) => void;
  }) {
    return (
      <button
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        onClick={() => {
          onSelect?.({ preventDefault: () => undefined });
          onCheckedChange?.(!checked);
        }}
        role="menuitemcheckbox"
        type="button"
      >
        {children}
      </button>
    );
  }

  return {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuTrigger,
  };
});

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

import { buildStockInsights } from './estoqueIntelligence';
import { estoqueFixture, giroFixture, NOW } from './estoqueFixtures';
import { EstoqueProductsTable } from './EstoqueProductsTable';

const criticalInsight = buildStockInsights(estoqueFixture, giroFixture, NOW)[0];

const baseProps = {
  products: [criticalInsight],
  sortMode: 'stock-desc' as const,
  branchKey: 'CT',
  onSortChange: vi.fn(),
  onSelectProduct: vi.fn(),
  onVisibleColumnsChange: vi.fn(),
};

function openColumnsMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Escolher colunas' }));
}

describe('EstoqueProductsTable', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('prioriza produto, quantidade, situacao e marca na lista compacta', () => {
    render(<EstoqueProductsTable {...baseProps} />);

    const mobileList = screen.getByLabelText('Lista compacta de produtos');
    expect(mobileList).toHaveClass('md:hidden', 'min-w-0');

    const mobileItem = screen.getByTestId('stock-mobile-item-101');
    expect(within(mobileItem).getByText('KIT EMBREAGEM PESADA')).toBeInTheDocument();
    expect(within(mobileItem).getByText('10')).toBeInTheDocument();
    expect(within(mobileItem).getByText('Critico')).toBeInTheDocument();
    expect(within(mobileItem).getByText('ZF')).toBeInTheDocument();
    expect(within(mobileItem).getByLabelText('Situacao: Critico')).toBeInTheDocument();
  });

  it('abre o produto por um botao com nome acessivel', () => {
    const onSelectProduct = vi.fn();
    render(<EstoqueProductsTable {...baseProps} onSelectProduct={onSelectProduct} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Abrir KIT EMBREAGEM PESADA' })[0]);
    expect(onSelectProduct).toHaveBeenCalledWith(criticalInsight);
  });

  it('mostra as sete colunas padrao em tabela contida com cabecalho fixo', () => {
    render(<EstoqueProductsTable {...baseProps} />);

    const desktop = screen.getByLabelText('Tabela de produtos do estoque');
    expect(desktop).toHaveClass('hidden', 'md:block', 'min-w-0', 'overflow-x-auto');
    expect(within(desktop).getByRole('rowgroup', { name: 'Cabecalho da tabela' })).toHaveClass('sticky', 'top-0');

    expect(within(desktop).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Produto',
      'Marca',
      'Grupo',
      'Quantidade',
      'Minimo operacional estimado',
      'Ultima movimentacao',
      'Situacao',
    ]);
  });

  it('nao apresenta minimo operacional conhecido quando nao ha dados de giro', () => {
    const insightWithoutMovement = buildStockInsights(estoqueFixture, [], NOW)[0];
    render(<EstoqueProductsTable {...baseProps} products={[insightWithoutMovement]} />);

    const desktop = screen.getByLabelText('Tabela de produtos do estoque');
    expect(within(desktop).getByText('Dados insuficientes')).toBeInTheDocument();
    expect(within(desktop).queryByText('0')).not.toBeInTheDocument();
  });

  it('oferece as 15 colunas e impede remover produto, quantidade e situacao', () => {
    render(<EstoqueProductsTable {...baseProps} />);

    openColumnsMenu();
    expect(screen.getAllByRole('menuitemcheckbox')).toHaveLength(15);
    expect(screen.getByRole('menuitemcheckbox', { name: 'Produto' })).toBeDisabled();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Quantidade' })).toBeDisabled();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Situacao' })).toBeDisabled();
  });

  it('persiste colunas por filial e notifica a preferencia atualizada', () => {
    localStorage.setItem(
      'pelegrini:estoque:columns:CT',
      JSON.stringify(['product', 'brand', 'group', 'quantity', 'minimum', 'lastMovement', 'status', 'value']),
    );
    localStorage.setItem('pelegrini:estoque:columns:CCH', JSON.stringify(['product', 'quantity', 'status', 'abc']));
    const onVisibleColumnsChange = vi.fn();

    render(<EstoqueProductsTable {...baseProps} onVisibleColumnsChange={onVisibleColumnsChange} />);
    openColumnsMenu();
    const valueColumn = screen.getByRole('menuitemcheckbox', { name: 'Valor em estoque' });
    fireEvent.click(valueColumn);

    expect(JSON.parse(localStorage.getItem('pelegrini:estoque:columns:CT')!)).not.toContain('value');
    expect(JSON.parse(localStorage.getItem('pelegrini:estoque:columns:CCH')!)).toEqual([
      'product',
      'quantity',
      'status',
      'abc',
    ]);
    expect(onVisibleColumnsChange).toHaveBeenLastCalledWith([
      'product',
      'brand',
      'group',
      'quantity',
      'minimum',
      'lastMovement',
      'status',
    ]);
  });

  it('restaura preferencias independentes ao trocar entre CT e CCH', () => {
    localStorage.setItem('pelegrini:estoque:columns:CT', JSON.stringify(['product', 'quantity', 'status', 'value']));
    localStorage.setItem('pelegrini:estoque:columns:CCH', JSON.stringify(['product', 'quantity', 'status', 'abc']));

    const { rerender } = render(<EstoqueProductsTable {...baseProps} />);
    expect(screen.getByRole('columnheader', { name: 'Valor em estoque' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Curva ABC' })).not.toBeInTheDocument();

    rerender(<EstoqueProductsTable {...baseProps} branchKey="CCH" />);
    expect(screen.getByRole('columnheader', { name: 'Curva ABC' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Valor em estoque' })).not.toBeInTheDocument();
  });

  it('envia os cinco modos de ordenacao pelo seletor', () => {
    const onSortChange = vi.fn();
    render(<EstoqueProductsTable {...baseProps} onSortChange={onSortChange} />);

    const trigger = screen.getByRole('combobox', { name: 'Ordenar produtos' });
    fireEvent.click(trigger);
    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Maior estoque',
      'Menor estoque',
      'Produto',
      'Ultima movimentacao',
      'Marca',
    ]);
    fireEvent.click(screen.getByRole('option', { name: 'Produto' }));
    expect(onSortChange).toHaveBeenCalledWith('product');
  });

  it('renderiza valores monetarios com o valor responsivo Pelegrini', () => {
    localStorage.setItem(
      'pelegrini:estoque:columns:CT',
      JSON.stringify(['product', 'quantity', 'status', 'value', 'averageCost']),
    );
    render(<EstoqueProductsTable {...baseProps} />);

    const value = screen.getByText(/R\$.*5\.000/);
    const averageCost = screen.getByText(/R\$.*500/);
    expect(value).toHaveClass('pelegrini-responsive-value');
    expect(averageCost).toHaveClass('pelegrini-responsive-value');
  });

  it('diferencia fonte de estoque vazia de filtros sem resultado', () => {
    const { rerender } = render(
      <EstoqueProductsTable {...baseProps} products={[]} sourceEmpty />,
    );

    expect(screen.getAllByText('Nenhum produto disponivel na fonte de estoque.')).toHaveLength(2);
    expect(screen.queryByText('Nenhum produto corresponde aos filtros atuais.')).not.toBeInTheDocument();

    rerender(<EstoqueProductsTable {...baseProps} products={[]} sourceEmpty={false} />);
    expect(screen.getAllByText('Nenhum produto corresponde aos filtros atuais.')).toHaveLength(2);
    expect(screen.queryByText('Nenhum produto disponivel na fonte de estoque.')).not.toBeInTheDocument();
  });

  it('pagina grandes volumes sem reduzir o total disponivel', () => {
    const products = Array.from({ length: 51 }, (_, index) => ({
      ...criticalInsight,
      cod_produto: 1000 + index,
      produto: `PRODUTO ${index + 1}`,
    }));

    render(<EstoqueProductsTable {...baseProps} products={products} />);

    const desktop = screen.getByLabelText('Tabela de produtos do estoque');
    expect(within(desktop).getAllByRole('row')).toHaveLength(51);
    expect(screen.getByText('Pagina 1 de 2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir PRODUTO 51' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Proxima pagina' }));

    expect(within(desktop).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('Pagina 2 de 2')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Abrir PRODUTO 51' })).toHaveLength(3);
  });
});
