import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  ecommerceQueryKeys,
  useEcommerceData,
} from './useEcommerceData';
import type { EcommerceService } from '@/modules/ecommerce/ecommerceService';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createService(): EcommerceService {
  return {
    getConnectionStatus: vi.fn().mockResolvedValue({
      state: 'not_configured',
      connection: { status: 'not_configured', message: 'Integração ainda não configurada.' },
      integration: {
        provider: 'mercado_livre',
        configured: false,
        clientIdConfigured: false,
        redirectUri: null,
        scopes: [],
        canConnect: false,
        canDisconnect: false,
      },
    }),
    getOverview: vi.fn().mockResolvedValue({
      state: 'not_configured',
      metrics: { activeListings: null, pendingOrders: null, syncedOrders: null },
      sync: { health: 'not_configured', lastSyncAt: null },
    }),
    getListings: vi.fn().mockResolvedValue({ state: 'not_configured', rows: [] }),
    getOrders: vi.fn().mockResolvedValue({ state: 'not_configured', rows: [] }),
  };
}

describe('useEcommerceData', () => {
  it('keeps all ecommerce queries disabled outside the Chevrolet branch', async () => {
    const service = createService();
    const { result } = renderHook(
      () => useEcommerceData({ branch: 'transmissao', companyCode: '1004', service }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.connection.fetchStatus).toBe('idle'));

    expect(service.getConnectionStatus).not.toHaveBeenCalled();
    expect(service.getOverview).not.toHaveBeenCalled();
    expect(service.getListings).not.toHaveBeenCalled();
    expect(service.getOrders).not.toHaveBeenCalled();
    expect(result.current.state).toBe('disabled');
  });

  it('uses stable branch-scoped keys and exposes the not-configured state', async () => {
    const service = createService();
    const { result } = renderHook(
      () => useEcommerceData({ branch: 'chevrolet', companyCode: '10041', service }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.state).toBe('not_configured'));

    expect(result.current.connection.data?.state).toBe('not_configured');
    expect(result.current.overview.data?.metrics.activeListings).toBeNull();
    expect(result.current.listings.data?.rows).toEqual([]);
    expect(result.current.orders.data?.rows).toEqual([]);
    expect(result.current.queryKeys).toEqual({
      connection: ecommerceQueryKeys.connection('10041', 'chevrolet'),
      overview: ecommerceQueryKeys.overview('10041', 'chevrolet'),
      listings: ecommerceQueryKeys.listings('10041', 'chevrolet'),
      orders: ecommerceQueryKeys.orders('10041', 'chevrolet'),
    });
  });
});
