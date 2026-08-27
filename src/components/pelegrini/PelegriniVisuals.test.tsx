import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { PelegriniBrandMark } from './PelegriniBrandMark';
import { PelegriniBranchBadge } from './PelegriniBranchBadge';
import { PelegriniBranchPanel } from './PelegriniBranchPanel';
import { PelegriniOperationalCard } from './PelegriniOperationalCard';

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
    expect(screen.getByRole('button', { name: /Casa da Transmissão/i })).toHaveClass('pelegrini-branch-panel');
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
    expect(screen.getByRole('button', { name: /Comercial/i })).toHaveClass('pelegrini-operational-card');
  });
});
