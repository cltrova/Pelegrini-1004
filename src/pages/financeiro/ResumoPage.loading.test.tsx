import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ResumoPage from './ResumoPage';

const state = vi.hoisted(() => ({ isLoading: false, isFetching: false }));

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
    isFetching: state.isFetching,
    error: null,
    offlineError: null,
    hasSource: true,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/contexts/FinanceiroSearchContext', () => ({
  useFinanceiroSearch: () => ({ hasSearched: true, markSearched: vi.fn(), resetSearch: vi.fn() }),
}));
vi.mock('@/hooks/useEmpresaAtiva', () => ({ useEmpresaAtiva: () => ({ empresa: null }) }));
vi.mock('@/hooks/useCobrancaIntervencoes', () => ({ useCobrancaIntervencoes: () => ({ pendentes: [] }) }));
vi.mock('@/components/resumo/ResumoVitalsKPIs', () => ({ ResumoVitalsKPIs: () => <div /> }));
vi.mock('@/components/resumo/FunilCarteiraBar', () => ({ FunilCarteiraBar: () => <div /> }));
vi.mock('@/components/resumo/ProjecaoRecebimentosChart', () => ({ ProjecaoRecebimentosChart: () => <div /> }));
vi.mock('@/components/resumo/AgingDetalhado', () => ({ AgingDetalhado: () => <div /> }));
vi.mock('@/components/resumo/TopRiscoTable', () => ({ TopRiscoTable: () => <div /> }));
vi.mock('@/components/resumo/PDDBreakdown', () => ({ PDDBreakdown: () => <div /> }));
vi.mock('@/components/resumo/ResumoFiltersBar', () => ({ ResumoFiltersBar: () => <div /> }));
vi.mock('@/components/enterprise', () => ({
  EnterpriseBadge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  EnterprisePageHeader: ({ actions }: { actions: React.ReactNode }) => <header>{actions}</header>,
}));

describe('ResumoPage loading action footprint', () => {
  beforeEach(() => {
    state.isLoading = false;
    state.isFetching = false;
  });

  it('keeps cached content mounted and marks only Atualizar busy during refetch', () => {
    const view = render(<ResumoPage />);
    const idleButton = screen.getByRole('button', { name: 'Atualizar' });
    expect(idleButton.querySelector('svg')).toHaveClass('h-4', 'w-4', 'mr-2');
    expect(document.querySelector('.financial-metric-strip')).toBeInTheDocument();

    state.isFetching = true;
    view.rerender(<ResumoPage />);

    const busyButton = screen.getByRole('button', { name: 'Atualizar' });
    expect(busyButton).toBeDisabled();
    expect(busyButton).toHaveAttribute('aria-busy', 'true');
    expect(within(busyButton).getByTestId('loading-indicator')).toHaveClass('h-4', 'w-4', 'mr-2');
    expect(screen.queryByRole('status', { name: 'Carregando resumo financeiro' })).not.toBeInTheDocument();
    expect(document.querySelector('.financial-metric-strip')).toBeInTheDocument();
  });
});
