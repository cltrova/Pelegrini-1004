import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createEcommerceService,
  type EcommerceService,
  type EcommerceServiceContext,
} from './ecommerceService';

describe('ecommerce service', () => {
  const context: EcommerceServiceContext = {
    branch: 'chevrolet',
    companyCode: '10041',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an explicit not-configured state without network or browser storage access', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const storageGetSpy = vi.spyOn(Storage.prototype, 'getItem');
    const storageSetSpy = vi.spyOn(Storage.prototype, 'setItem');
    const service = createEcommerceService();

    const [connection, overview, listings, orders] = await Promise.all([
      service.getConnectionStatus(context),
      service.getOverview(context),
      service.getListings(context),
      service.getOrders(context),
    ]);

    expect(connection.state).toBe('not_configured');
    expect(connection.integration.provider).toBe('mercado_livre');
    expect(overview.state).toBe('not_configured');
    expect(listings).toEqual({ state: 'not_configured', rows: [] });
    expect(orders).toEqual({ state: 'not_configured', rows: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storageGetSpy).not.toHaveBeenCalled();
    expect(storageSetSpy).not.toHaveBeenCalled();
  });

  it('accepts an injected transport through the narrow backend boundary', async () => {
    const transport: EcommerceService = {
      getConnectionStatus: vi.fn().mockResolvedValue({
        state: 'connected',
        connection: {
          status: 'connected',
          accountName: 'Casa do Chevrolet',
          lastSyncAt: '2026-10-02T12:00:00.000Z',
        },
        integration: {
          provider: 'mercado_livre',
          configured: true,
          clientIdConfigured: true,
          redirectUri: 'https://app.example.com/ecommerce/integracao/callback',
          scopes: ['read', 'write'],
          canConnect: true,
          canDisconnect: true,
        },
      }),
      getOverview: vi.fn(),
      getListings: vi.fn(),
      getOrders: vi.fn(),
    };
    const service = createEcommerceService(transport);

    await expect(service.getConnectionStatus(context)).resolves.toMatchObject({
      state: 'connected',
    });
    expect(transport.getConnectionStatus).toHaveBeenCalledWith(context);
  });

  it('does not expose token-bearing methods in the service contract', () => {
    const service = createEcommerceService();

    expect(Object.keys(service)).toEqual([
      'getConnectionStatus',
      'getOverview',
      'getListings',
      'getOrders',
    ]);
  });
});
