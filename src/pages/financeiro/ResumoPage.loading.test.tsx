import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ResumoPage from './ResumoPage';

const state = vi.hoisted(() => ({ isLoading: false }));

vi.mock('@/hooks/useResumoData', () => ({
  useResumoComputed: () => ({
    duplicatas: [],
    pedidos: [],
    kpis: {},
    clientesAnalytics: [],
    aging: [],
    projecao: [],
    pdd: {},
    alertas: [],
    filtradas: [],
    empresasDisponiveis: [],
    funil: [],
    isLoading: state.isLoading,
    error: null,
    offlineError: null,
    hasSource: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/contexts/FinanceiroSearchContext', () => ({
  useFinanceiroSearch: () => ({ hasSearched: true, markSearched: vi.fn(), resetSearch: vi.fn() }),
}));
vi.mock('@/hooks/useEmpresaAtiva', () => ({ useEmpresaAtiva: () => ({ empresa: null }) }));
vi.mock('@/hooks/useCobrancaIntervencoes', () => ({ useCobrancaIntervencoes: () => ({ pendentes: [] }) }));
vi.mock('@/components/enterprise', () => ({
  EnterpriseBadge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  EnterprisePageHeader: ({ actions }: { actions: React.ReactNode }) => <header>{actions}</header>,
}));

describe('ResumoPage loading action footprint', () => {
  beforeEach(() => {
    state.isLoading = false;
  });

  it('keeps the refresh icon slot unchanged when rerendered busy', () => {
    const view = render(<ResumoPage />);
    const idleButton = screen.getByRole('button', { name: 'Atualizar' });
    expect(idleButton.querySelector('svg')).toHaveClass('h-4', 'w-4', 'mr-2');

    state.isLoading = true;
    view.rerender(<ResumoPage />);

    const busyButton = screen.getByRole('button', { name: 'Atualizar' });
    expect(within(busyButton).getByTestId('loading-indicator')).toHaveClass('h-4', 'w-4', 'mr-2');
  });
});
