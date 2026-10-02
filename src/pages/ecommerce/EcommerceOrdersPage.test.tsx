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

import EcommerceOrdersPage from './EcommerceOrdersPage';

function setState(overrides: Record<string, unknown> = {}) {
  testState.value = {
    state: 'ready',
    orders: {
      isPending: false,
      isError: false,
      data: { state: 'ready', rows: [] },
      refetch: vi.fn(),
    },
    ...overrides,
  };
}

describe('EcommerceOrdersPage', () => {
  beforeEach(() => setState());

  it('renders the standard loading state', () => {
    setState({ state: 'loading', orders: { isPending: true, isError: false, data: undefined, refetch: vi.fn() } });

    render(<EcommerceOrdersPage />);

    expect(screen.getByRole('status', { name: 'Carregando pedidos do Mercado Livre' })).toBeInTheDocument();
  });

  it('explains that the integration is not configured without inventing orders', () => {
    setState({ state: 'not_configured', orders: { isPending: false, isError: false, data: { state: 'not_configured', rows: [] }, refetch: vi.fn() } });

    render(<EcommerceOrdersPage />);

    expect(screen.getByText('Integração do Mercado Livre não configurada')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Pedido' })).not.toBeInTheDocument();
  });

  it('renders an explicit empty state after a successful empty response', () => {
    render(<EcommerceOrdersPage />);

    expect(screen.getByText('Nenhum pedido encontrado')).toBeInTheDocument();
  });

  it('renders an error state with retry', () => {
    const refetch = vi.fn();
    setState({ state: 'error', orders: { isPending: false, isError: true, data: undefined, refetch } });

    render(<EcommerceOrdersPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar os pedidos');
    screen.getByRole('button', { name: 'Tentar novamente' }).click();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders configured order rows with status, payment, total, and date', () => {
    setState({
      orders: {
        isPending: false,
        isError: false,
        data: {
          state: 'ready',
          rows: [{
            id: '200000123',
            buyerName: 'Maria Chevrolet',
            status: 'paid',
            total: 289.5,
            paymentStatus: 'approved',
            createdAt: '2026-09-30T12:00:00.000Z',
          }],
        },
        refetch: vi.fn(),
      },
    });

    render(<EcommerceOrdersPage />);

    expect(screen.getByRole('columnheader', { name: 'Pedido' })).toBeInTheDocument();
    expect(screen.getByText('200000123')).toBeInTheDocument();
    expect(screen.getByText('Maria Chevrolet')).toBeInTheDocument();
    expect(screen.getByText('Pago')).toBeInTheDocument();
    expect(screen.getByText('R$ 289,50')).toBeInTheDocument();
    expect(screen.getByText('Aprovado')).toBeInTheDocument();
    expect(screen.getByText('30/09/2026')).toBeInTheDocument();
  });
});
