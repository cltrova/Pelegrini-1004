import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { PelegriniBrandMark } from './PelegriniBrandMark';
import { PelegriniBranchBadge } from './PelegriniBranchBadge';

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
});
