import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilialSelectorDialog } from './FilialSelectorDialog';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isMaster: true,
    profile: null,
  }),
}));

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({
    filialAtiva: null,
    setFilialAtivaForEmpresa: vi.fn(),
  }),
}));

describe('FilialSelectorDialog', () => {
  it('shows branch-specific operational indicators in the filial selector', () => {
    render(
      <FilialSelectorDialog
        open
        onOpenChange={() => undefined}
        codEmpresa="1004"
      />,
    );

    expect(screen.getByText('Cambio')).toBeInTheDocument();
    expect(screen.getByText('Diferencial')).toBeInTheDocument();
    expect(screen.getByText('Original GM')).toBeInTheDocument();
    expect(screen.getByText('Desde 1992')).toBeInTheDocument();
  });
});
