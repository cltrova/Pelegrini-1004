import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { PelegriniBrandMark } from './PelegriniBrandMark';
import { PelegriniBranchBadge } from './PelegriniBranchBadge';
import { PelegriniBranchPanel } from './PelegriniBranchPanel';
import { PelegriniModuleHeader } from './PelegriniModuleHeader';
import { PelegriniOperationalCard } from './PelegriniOperationalCard';
import { LoadingState } from '@/components/common/LoadingState';

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({ filialAtiva: 'transmissao' }),
}));

describe('Pelegrini visual components', () => {
  it('renders a branch brand mark with logo and name', () => {
    const theme = resolvePelegriniTheme('transmissao');

    render(<PelegriniBrandMark theme={theme} />);

    expect(screen.getByAltText('Logo Casa da Transmissão')).toBeInTheDocument();
    expect(screen.getByText('Casa da Transmissão')).toBeInTheDocument();
  });

  it('renders branch trust signals', () => {
    const theme = resolvePelegriniTheme('chevrolet');

    render(<PelegriniBranchBadge theme={theme} active />);

    expect(screen.getByText('Casa do Chevrolet')).toBeInTheDocument();
    expect(screen.getByText('Desde 1992')).toBeInTheDocument();
  });

  it('renders a mechanical branch panel with filial indicators', () => {
    render(
      <PelegriniBranchPanel
        theme={resolvePelegriniTheme('transmissao')}
        active
        indicators={['Cambio', 'Diferencial', 'ZF']}
        description="Painel com foco em pecas tecnicas."
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText('Casa da Transmissão')).toBeInTheDocument();
    expect(screen.getByText('Cambio')).toBeInTheDocument();
    const panel = screen.getByRole('button', {
      name: /Casa da Transmissão.*Painel com foco em pecas tecnicas.*Cambio.*Diferencial.*ZF/i,
    });

    expect(panel).toHaveClass('pelegrini-branch-panel');
    expect(panel).toHaveAccessibleName(/Casa da Transmissão.*Painel com foco em pecas tecnicas.*Cambio.*Diferencial.*ZF/i);
  });

  it('renders an operational card without template effects', () => {
    render(
      <PelegriniOperationalCard
        title="Comercial"
        label="Pedidos e carteira"
        description="Clientes, produtos, cotacoes e vendas."
        tags={['Clientes', 'Produtos']}
        accent="comercial"
        onClick={() => undefined}
      />,
    );

    expect(screen.getByText('Pedidos e carteira')).toBeInTheDocument();
    const card = screen.getByRole('button', {
      name: /Comercial.*Pedidos e carteira.*Clientes, produtos, cotacoes e vendas.*Clientes.*Produtos/i,
    });

    expect(card).toHaveClass('pelegrini-operational-card');
    expect(card).toHaveAttribute('data-accent', 'comercial');
    expect(card).toHaveAccessibleName(/Comercial.*Pedidos e carteira.*Clientes, produtos, cotacoes e vendas.*Clientes.*Produtos/i);
  });

  it('renders module header with operational language', () => {
    render(<PelegriniModuleHeader title="Produtos" subtitle="Carteira de pecas" moduleKey="comercial" />);

    expect(screen.getByText('Produtos')).toBeInTheDocument();
    expect(screen.getByText(/Pedidos e carteira/i)).toBeInTheDocument();
  });

  it('stops the loading spinner when reduced motion is requested', () => {
    const { container } = render(<LoadingState />);

    expect(container.querySelector('svg')).toHaveClass('motion-reduce:animate-none');
  });
});
