import { describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../functions/api-proxy';

describe('api-proxy response handling', () => {
  it('returns an empty JSON payload when a data endpoint responds with HTML', async () => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!DOCTYPE html><html></html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })));

    try {
      const request = new Request(
        'https://rsys.test/api-proxy?endpoint=http%3A%2F%2F187.77.203.16&path=%2Fpelegrini%2Fcomercial%2Fprodutos',
      );

      const response = await onRequest({ request });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(response.headers.get('x-proxy-upstream-error')).toBe('true');
      expect(await response.text()).toBe('[]');
    } finally {
      vi.stubGlobal('fetch', originalFetch);
    }
  });
});
