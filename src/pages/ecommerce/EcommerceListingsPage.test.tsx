import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}));

vi.mock('@/hooks/useEcommerceData', () => ({
  useEcommerceData: () => testState.value,
}));

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({ filialAtiva: 'chevrolet', codEmpresaContexto: '1004' }),
}));

import EcommerceListingsPage from './EcommerceListingsPage';

function setState(overrides: Record<string, unknown> = {}) {
  testState.value = {
    state: 'ready',
    listings: {
      isPending: false,
      isError: false,
      data: { state: 'ready', rows: [] },
      refetch: vi.fn(),
    },
    ...overrides,
  };
}

describe('EcommerceListingsPage', () => {
  beforeEach(() => setState());

  it('renders the standard loading state', () => {
    setState({ state: 'loading', listings: { isPending: true, isError: false, data: undefined, refetch: vi.fn() } });

    render(<EcommerceListingsPage />);

    expect(screen.getByRole('status', { name: 'Carregando anúncios do Mercado Livre' })).toBeInTheDocument();
  });

  it('explains that the integration is not configured without inventing listings', () => {
    setState({ state: 'not_configured', listings: { isPending: false, isError: false, data: { state: 'not_configured', rows: [] }, refetch: vi.fn() } });

    render(<EcommerceListingsPage />);

    expect(screen.getByText('Integração do Mercado Livre não configurada')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Título' })).not.toBeInTheDocument();
  });

  it('renders an explicit empty state after a successful empty response', () => {
    render(<EcommerceListingsPage />);

    expect(screen.getByText('Nenhum anúncio encontrado')).toBeInTheDocument();
  });

  it('renders an error state with retry', () => {
    const refetch = vi.fn();
    setState({ state: 'error', listings: { isPending: false, isError: true, data: undefined, refetch } });

    render(<EcommerceListingsPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar os anúncios');
    screen.getByRole('button', { name: 'Tentar novamente' }).click();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders configured listing rows with status, price, stock, and date', () => {
    setState({
      listings: {
        isPending: false,
        isError: false,
        data: {
          state: 'ready',
          rows: [{
            id: 'MLB-123',
            title: 'Filtro de óleo Chevrolet',
            sku: 'FILTRO-001',
            status: 'active',
            price: 149.9,
            stock: 12,
            updatedAt: '2026-10-01T12:00:00.000Z',
          }],
        },
        refetch: vi.fn(),
      },
    });

    render(<EcommerceListingsPage />);

    expect(screen.getByRole('columnheader', { name: 'Título' })).toBeInTheDocument();
    expect(screen.getByText('Filtro de óleo Chevrolet')).toBeInTheDocument();
    expect(screen.getByText('FILTRO-001')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByText('R$ 149,90')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('01/10/2026')).toBeInTheDocument();
  });
});
