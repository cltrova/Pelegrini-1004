import type {
  EcommerceBranch,
  EcommerceConnectionResponse,
  EcommerceIntegrationMetadata,
  EcommerceListingsResponse,
  EcommerceOrdersResponse,
  EcommerceOverviewResponse,
} from './ecommerceTypes';

export interface EcommerceServiceContext {
  branch: EcommerceBranch;
  companyCode?: string | null;
}

export interface EcommerceService {
  getConnectionStatus(context: EcommerceServiceContext): Promise<EcommerceConnectionResponse>;
  getOverview(context: EcommerceServiceContext): Promise<EcommerceOverviewResponse>;
  getListings(context: EcommerceServiceContext): Promise<EcommerceListingsResponse>;
  getOrders(context: EcommerceServiceContext): Promise<EcommerceOrdersResponse>;
}

export type EcommerceTransport = Partial<EcommerceService>;

const notConfiguredIntegration: EcommerceIntegrationMetadata = {
  provider: 'mercado_livre',
  configured: false,
  clientIdConfigured: false,
  redirectUri: null,
  scopes: [],
  canConnect: false,
  canDisconnect: false,
  message: 'A integração com o Mercado Livre ainda não foi configurada.',
};

export function createEcommerceService(transport: EcommerceTransport = {}): EcommerceService {
  return {
    getConnectionStatus: (context) =>
      transport.getConnectionStatus?.(context) ?? Promise.resolve({
        state: 'not_configured',
        connection: {
          status: 'not_configured',
          lastSyncAt: null,
          message: 'A integração com o Mercado Livre ainda não foi configurada.',
        },
        integration: { ...notConfiguredIntegration },
      }),
    getOverview: (context) =>
      transport.getOverview?.(context) ?? Promise.resolve({
        state: 'not_configured',
        metrics: {
          activeListings: null,
          pendingOrders: null,
          syncedOrders: null,
        },
        sync: {
          health: 'not_configured',
          lastSyncAt: null,
          message: 'Os dados estarão disponíveis após a configuração da integração.',
        },
      }),
    getListings: (context) =>
      transport.getListings?.(context) ?? Promise.resolve({
        state: 'not_configured',
        rows: [],
      }),
    getOrders: (context) =>
      transport.getOrders?.(context) ?? Promise.resolve({
        state: 'not_configured',
        rows: [],
      }),
  };
}

export const ecommerceService = createEcommerceService();
