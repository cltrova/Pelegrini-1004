import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EcommerceOverviewPage from './EcommerceOverviewPage';
import { useEcommerceData } from '@/hooks/useEcommerceData';

vi.mock('@/hooks/useEcommerceData', () => ({
  useEcommerceData: vi.fn(),
}));

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({ filialAtiva: 'chevrolet' }),
}));

vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: () => ({ codEmpresaAtiva: '10041' }),
}));

const mockedUseEcommerceData = vi.mocked(useEcommerceData);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ecommerce']}>
      <EcommerceOverviewPage />
    </MemoryRouter>,
  );
}

function createQuery(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    error: null,
    isPending: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

describe('EcommerceOverviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseEcommerceData.mockReturnValue({
      state: 'not_configured',
      connection: createQuery(),
      overview: createQuery(),
      listings: createQuery(),
      orders: createQuery(),
      queryKeys: {
        connection: ['ecommerce', 'connection'],
        overview: ['ecommerce', 'overview'],
        listings: ['ecommerce', 'listings'],
        orders: ['ecommerce', 'orders'],
      },
    } as never);
  });

  it('uses the standard loading state while the overview is loading', () => {
    mockedUseEcommerceData.mockReturnValue({
      state: 'loading',
      connection: createQuery({ isPending: true }),
      overview: createQuery({ isPending: true }),
      listings: createQuery({ isPending: true }),
      orders: createQuery({ isPending: true }),
      queryKeys: {} as never,
    } as never);

    renderPage();

    expect(screen.getByRole('status', { name: 'Carregando visão geral do E-Commerce' })).toBeInTheDocument();
  });

  it('shows the disconnected state and links to integration setup', () => {
    mockedUseEcommerceData.mockReturnValue({
      state: 'not_configured',
      connection: createQuery({
        data: {
          state: 'not_configured',
          connection: { status: 'not_configured', lastSyncAt: null },
          integration: { configured: false, canConnect: false },
        },
      }),
      overview: createQuery({ data: { state: 'not_configured' } }),
      listings: createQuery(),
      orders: createQuery(),
      queryKeys: {} as never,
    } as never);

    renderPage();

    expect(screen.getByText('Mercado Livre não conectado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configurar integração' })).toHaveAttribute('href', '/ecommerce/configuracoes');
  });

  it('shows the error state and exposes retry', () => {
    const retry = vi.fn();
    mockedUseEcommerceData.mockReturnValue({
      state: 'error',
      connection: createQuery({ error: new Error('falha') }),
      overview: createQuery({ error: new Error('falha'), refetch: retry }),
      listings: createQuery(),
      orders: createQuery(),
      queryKeys: {} as never,
    } as never);

    renderPage();

    expect(screen.getByText('Não foi possível carregar a visão geral')).toBeInTheDocument();
    screen.getByRole('button', { name: 'Tentar novamente' }).click();
    expect(retry).toHaveBeenCalledOnce();
  });

  it('renders configured metrics, sync health, and connection status', () => {
    mockedUseEcommerceData.mockReturnValue({
      state: 'ready',
      connection: createQuery({
        data: {
          state: 'connected',
          connection: { status: 'connected', accountName: 'Casa do Chevrolet', lastSyncAt: '2026-10-02T12:30:00Z' },
          integration: { configured: true, canConnect: true },
        },
      }),
      overview: createQuery({
        data: {
          state: 'ready',
          metrics: { activeListings: 128, pendingOrders: 7, syncedOrders: 64 },
          sync: { health: 'healthy', lastSyncAt: '2026-10-02T12:30:00Z' },
        },
      }),
      listings: createQuery(),
      orders: createQuery(),
      queryKeys: {} as never,
    } as never);

    renderPage();

    expect(screen.getByText('Conectado')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('64')).toBeInTheDocument();
    expect(screen.getByText('Sincronização saudável')).toBeInTheDocument();
  });
});
