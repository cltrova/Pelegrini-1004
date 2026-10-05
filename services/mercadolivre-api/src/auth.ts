import { createClient } from '@supabase/supabase-js';
import type { FastifyRequest } from 'fastify';

import type { ApiConfig } from './app.js';

export interface AuthorizedChevroletUser {
  userId: string;
  companyCode: '10041';
}

export interface AuthorizationGateway {
  getUser(): Promise<{ user: { id: string } | null; error: unknown | null }>;
  getProfile(userId: string): Promise<{
    profile: { cod_empresa_bi: string | number } | null;
    error: unknown | null;
  }>;
  getRoles(userId: string): Promise<{ roles: string[]; error: unknown | null }>;
}

export type AuthorizationGatewayFactory = (
  config: ApiConfig,
  accessToken: string,
) => AuthorizationGateway;

export class AuthorizationError extends Error {
  constructor(
    message: string,
    readonly statusCode: 401 | 403 | 503,
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

function createSupabaseGateway(config: ApiConfig, accessToken: string): AuthorizationGateway {
  const client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });

  return {
    async getUser() {
      const { data, error } = await client.auth.getUser(accessToken);
      return { user: data.user ? { id: data.user.id } : null, error };
    },
    async getProfile(userId) {
      const { data, error } = await client
        .from('profiles')
        .select('cod_empresa_bi')
        .eq('user_id', userId)
        .maybeSingle();
      return { profile: data, error };
    },
    async getRoles(userId) {
      const { data, error } = await client
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      return { roles: (data ?? []).map((row) => String(row.role)), error };
    },
  };
}

export async function authorizeChevroletRequest(
  request: FastifyRequest,
  config: ApiConfig,
  gatewayFactory: AuthorizationGatewayFactory = createSupabaseGateway,
): Promise<AuthorizedChevroletUser> {
  const authorization = request.headers.authorization;
  const match = typeof authorization === 'string'
    ? authorization.match(/^Bearer\s+([^\s]+)$/i)
    : null;
  if (!match) throw new AuthorizationError('Authentication required', 401);

  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    throw new AuthorizationError('Authentication is not configured', 503);
  }

  const gateway = gatewayFactory(config, match[1]);
  const { user, error: userError } = await gateway.getUser();
  if (userError || !user?.id) throw new AuthorizationError('Invalid session', 401);

  const [{ profile, error: profileError }, { roles, error: rolesError }] = await Promise.all([
    gateway.getProfile(user.id),
    gateway.getRoles(user.id),
  ]);

  if (profileError || rolesError || !profile) {
    throw new AuthorizationError('Integration access denied', 403);
  }
  if (String(profile.cod_empresa_bi) !== '10041' || !roles.includes('master')) {
    throw new AuthorizationError('Integration access denied', 403);
  }

  return { userId: user.id, companyCode: '10041' };
}
