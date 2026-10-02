export type EcommerceBranch = 'chevrolet' | 'transmissao';

export type MercadoLivreConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'not_configured'
  | 'error';

export type EcommerceSyncHealth = 'healthy' | 'stale' | 'error' | 'not_configured';

export type EcommerceResourceState = 'ready' | 'not_configured' | 'error';

export interface EcommerceConnection {
  status: MercadoLivreConnectionStatus;
  accountName?: string;
  connectedAt?: string;
  lastSyncAt?: string | null;
  message?: string;
}

export interface EcommerceSyncState {
  health: EcommerceSyncHealth;
  lastSyncAt: string | null;
  message?: string;
}

export interface EcommerceOverviewMetrics {
  activeListings: number | null;
  pendingOrders: number | null;
  syncedOrders: number | null;
}

export interface EcommerceIntegrationMetadata {
  provider: 'mercado_livre';
  configured: boolean;
  clientIdConfigured: boolean;
  redirectUri: string | null;
  scopes: readonly string[];
  canConnect: boolean;
  canDisconnect: boolean;
  message?: string;
}

export interface EcommerceConnectionResponse {
  state: MercadoLivreConnectionStatus;
  connection: EcommerceConnection;
  integration: EcommerceIntegrationMetadata;
}

export type EcommerceListingStatus = 'active' | 'paused' | 'closed' | 'unknown';

export interface EcommerceListingRow {
  id: string;
  title: string;
  sku: string | null;
  status: EcommerceListingStatus;
  price: number | null;
  stock: number | null;
  updatedAt: string | null;
}

export interface EcommerceOrderRow {
  id: string;
  buyerName: string | null;
  status: 'paid' | 'pending' | 'cancelled' | 'unknown';
  total: number | null;
  paymentStatus: 'approved' | 'pending' | 'refunded' | 'unknown';
  createdAt: string | null;
}

export interface EcommerceOverviewResponse {
  state: EcommerceResourceState;
  metrics: EcommerceOverviewMetrics;
  sync: EcommerceSyncState;
}

export interface EcommerceListingsResponse {
  state: EcommerceResourceState;
  rows: EcommerceListingRow[];
}

export interface EcommerceOrdersResponse {
  state: EcommerceResourceState;
  rows: EcommerceOrderRow[];
}
