import { describe, expect, it, vi } from 'vitest';

import { authorizeChevroletRequest, type AuthorizationGateway } from './auth.js';
import type { ApiConfig } from './app.js';

const config: ApiConfig = {
  port: 3000,
  publicAppOrigin: 'https://www.pelegrini.t2a.ia.br',
  supabaseUrl: 'https://auth.example.test',
  supabasePublishableKey: 'publishable-test',
  meliClientId: '',
  meliClientSecret: '',
  meliTokenEncryptionKey: '',
  sqlitePath: ':memory:',
};

function request(authorization?: string) {
  return { headers: { authorization } } as never;
}

function gateway(overrides: Partial<AuthorizationGateway> = {}): AuthorizationGateway {
  return {
    getUser: vi.fn().mockResolvedValue({ user: { id: 'user-1' }, error: null }),
    getProfile: vi.fn().mockResolvedValue({ profile: { cod_empresa_bi: '10041' }, error: null }),
    getRoles: vi.fn().mockResolvedValue({ roles: ['master'], error: null }),
    ...overrides,
  };
}

describe('authorizeChevroletRequest', () => {
  it('rejects a missing bearer token before calling the gateway', async () => {
    const createGateway = vi.fn();

    await expect(authorizeChevroletRequest(request(), config, createGateway))
      .rejects.toMatchObject({ statusCode: 401 });
    expect(createGateway).not.toHaveBeenCalled();
  });

  it('rejects a token that Supabase does not resolve to a user', async () => {
    const fakeGateway = gateway({
      getUser: vi.fn().mockResolvedValue({ user: null, error: new Error('invalid') }),
    });

    await expect(authorizeChevroletRequest(
      request('Bearer expired-token'), config, () => fakeGateway,
    )).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects authenticated users without the master role', async () => {
    const fakeGateway = gateway({
      getRoles: vi.fn().mockResolvedValue({ roles: ['gerencial'], error: null }),
    });

    await expect(authorizeChevroletRequest(
      request('Bearer valid-token'), config, () => fakeGateway,
    )).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects a master user whose profile is not the Chevrolet company', async () => {
    const fakeGateway = gateway({
      getProfile: vi.fn().mockResolvedValue({ profile: { cod_empresa_bi: '1004' }, error: null }),
    });

    await expect(authorizeChevroletRequest(
      request('Bearer valid-token'), config, () => fakeGateway,
    )).rejects.toMatchObject({ statusCode: 403 });
  });

  it('returns the server-verified user and fixed company for an authorized master', async () => {
    const fakeGateway = gateway();

    await expect(authorizeChevroletRequest(
      request('Bearer valid-token'), config, () => fakeGateway,
    )).resolves.toEqual({ userId: 'user-1', companyCode: '10041' });
    expect(fakeGateway.getProfile).toHaveBeenCalledWith('user-1');
    expect(fakeGateway.getRoles).toHaveBeenCalledWith('user-1');
  });
});
