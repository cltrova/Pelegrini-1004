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
      'startOAuth',
      'getOverview',
      'getListings',
      'getOrders',
    ]);
  });

  it('sends the current session to the API and maps safe connection metadata', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      state: 'connected',
      integration: 'configured',
      redirectUri: 'https://ml-api.pelegrini.t2a.ia.br/api/mercadolivre/oauth/callback',
      connection: {
        sellerId: '123', nickname: 'CHEVROLET', scopes: ['read'],
        connectedAt: '2026-10-04T10:00:00.000Z', lastSyncAt: null,
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const service = createEcommerceService({}, {
      apiUrl: 'https://ml-api.pelegrini.t2a.ia.br',
      fetch: fetchImpl as typeof fetch,
      getAccessToken: vi.fn().mockResolvedValue('current-session-token'),
    });

    const connection = await service.getConnectionStatus(context);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://ml-api.pelegrini.t2a.ia.br/api/mercadolivre/connection',
      expect.objectContaining({ headers: expect.objectContaining({
        authorization: 'Bearer current-session-token',
      }) }),
    );
    expect(connection.connection.accountName).toBe('CHEVROLET');
    expect(connection.integration.canConnect).toBe(true);
    expect(JSON.stringify(connection)).not.toContain('session-token');
  });

  it('starts OAuth only for Chevrolet and accepts only Mercado Livre authorization URLs', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      authorizationUrl: 'https://auth.mercadolivre.com.br/authorization?state=opaque',
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const service = createEcommerceService({}, {
      apiUrl: 'https://ml-api.pelegrini.t2a.ia.br',
      fetch: fetchImpl as typeof fetch,
      getAccessToken: vi.fn().mockResolvedValue('session'),
    });

    await expect(service.startOAuth(context)).resolves.toMatchObject({
      authorizationUrl: 'https://auth.mercadolivre.com.br/authorization?state=opaque',
    });
    await expect(service.startOAuth({ branch: 'transmissao', companyCode: '1004' }))
      .rejects.toThrow('somente para a Casa do Chevrolet');

    const unsafeTransport = createEcommerceService({
      startOAuth: vi.fn().mockResolvedValue({ authorizationUrl: 'https://attacker.example/' }),
    });
    await expect(unsafeTransport.startOAuth(context)).rejects.toThrow('Destino de autorização não permitido');
  });

  it('rejects an insecure or path-scoped API base URL without making a request', async () => {
    const fetchImpl = vi.fn();
    const service = createEcommerceService({}, {
      apiUrl: 'http://ml-api.pelegrini.t2a.ia.br/api',
      fetch: fetchImpl as typeof fetch,
      getAccessToken: vi.fn().mockResolvedValue('session'),
    });

    const connection = await service.getConnectionStatus(context);
    expect(connection.state).toBe('not_configured');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
