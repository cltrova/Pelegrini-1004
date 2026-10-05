import type {
  EcommerceBranch,
  EcommerceConnectionResponse,
  EcommerceIntegrationMetadata,
  EcommerceListingsResponse,
  EcommerceOAuthStartResponse,
  EcommerceOrdersResponse,
  EcommerceOverviewResponse,
} from './ecommerceTypes';
import { supabase } from '@/integrations/supabase/client';

export interface EcommerceServiceContext {
  branch: EcommerceBranch;
  companyCode?: string | null;
}

export interface EcommerceService {
  getConnectionStatus(context: EcommerceServiceContext): Promise<EcommerceConnectionResponse>;
  startOAuth(context: EcommerceServiceContext): Promise<EcommerceOAuthStartResponse>;
  getOverview(context: EcommerceServiceContext): Promise<EcommerceOverviewResponse>;
  getListings(context: EcommerceServiceContext): Promise<EcommerceListingsResponse>;
  getOrders(context: EcommerceServiceContext): Promise<EcommerceOrdersResponse>;
}

export type EcommerceTransport = Partial<EcommerceService>;

export interface EcommerceServiceOptions {
  apiUrl?: string;
  fetch?: typeof fetch;
  getAccessToken?: () => Promise<string | null>;
}

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

function configuredApiUrl(apiUrl: string | undefined): string | null {
  if (!apiUrl) return null;
  try {
    const url = new URL(apiUrl);
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function assertSafeAuthorizationUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('URL de autorização inválida.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== 'https://auth.mercadolivre.com.br'
    || url.pathname !== '/authorization' || url.username || url.password) {
    throw new Error('Destino de autorização não permitido.');
  }
  return url.toString();
}

export function createEcommerceService(
  transport: EcommerceTransport = {},
  options: EcommerceServiceOptions = {},
): EcommerceService {
  const apiUrl = configuredApiUrl(options.apiUrl ?? import.meta.env.VITE_MERCADOLIVRE_API_URL);
  const fetchImpl = options.fetch ?? fetch;
  const getAccessToken = options.getAccessToken ?? (async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error('Não foi possível validar sua sessão.');
    return data.session?.access_token ?? null;
  });

  async function apiRequest(path: string, method: 'GET' | 'POST') {
    if (!apiUrl) throw new Error('API do Mercado Livre indisponível.');
    const token = await getAccessToken();
    if (!token) throw new Error('Sua sessão expirou. Entre novamente no sistema.');
    const response = await fetchImpl(`${apiUrl}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error('Sua sessão expirou. Entre novamente no sistema.');
      if (response.status === 403) throw new Error('Seu usuário não tem permissão para esta integração.');
      if (response.status === 503) throw new Error('A integração ainda não foi configurada no servidor.');
      throw new Error('Não foi possível comunicar com a integração do Mercado Livre.');
    }
    return response.json() as Promise<Record<string, unknown>>;
  }

  return {
    getConnectionStatus: async (context) => {
      if (transport.getConnectionStatus) return transport.getConnectionStatus(context);
      if (context.branch !== 'chevrolet' || context.companyCode !== '10041' || !apiUrl) {
        return {
          state: 'not_configured',
          connection: {
            status: 'not_configured',
            lastSyncAt: null,
            message: 'A integração com o Mercado Livre ainda não foi configurada.',
          },
          integration: { ...notConfiguredIntegration },
        };
      }
      const response = await apiRequest('/api/mercadolivre/connection', 'GET');
      const backendConnection = response.connection as Record<string, unknown> | null;
      const isConfigured = response.integration === 'configured';
      const state = response.state === 'connected' ? 'connected' : 'disconnected';
      return {
        state: isConfigured ? state : 'not_configured',
        connection: backendConnection ? {
          status: state,
          accountName: typeof backendConnection.nickname === 'string' ? backendConnection.nickname : undefined,
          connectedAt: typeof backendConnection.connectedAt === 'string' ? backendConnection.connectedAt : undefined,
          lastSyncAt: typeof backendConnection.lastSyncAt === 'string' ? backendConnection.lastSyncAt : null,
        } : {
          status: isConfigured ? 'disconnected' : 'not_configured',
          lastSyncAt: null,
          message: isConfigured ? undefined : 'A integração ainda não foi configurada no servidor.',
        },
        integration: {
          provider: 'mercado_livre',
          configured: isConfigured,
          clientIdConfigured: isConfigured,
          redirectUri: typeof response.redirectUri === 'string' ? response.redirectUri : null,
          scopes: Array.isArray(backendConnection?.scopes)
            ? backendConnection.scopes.filter((scope): scope is string => typeof scope === 'string') : [],
          canConnect: isConfigured,
          canDisconnect: false,
          message: isConfigured ? undefined : 'Cadastre as credenciais da aplicação no servidor.',
        },
      };
    },
    startOAuth: async (context) => {
      if (transport.startOAuth) {
        const result = await transport.startOAuth(context);
        return { authorizationUrl: assertSafeAuthorizationUrl(result.authorizationUrl) };
      }
      if (context.branch !== 'chevrolet' || context.companyCode !== '10041') {
        throw new Error('A conexão está disponível somente para a Casa do Chevrolet.');
      }
      const response = await apiRequest('/api/mercadolivre/oauth/start', 'POST');
      return { authorizationUrl: assertSafeAuthorizationUrl(response.authorizationUrl) };
    },
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
