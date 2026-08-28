import { describe, expect, it } from 'vitest';
import { readJsonOrFallback } from './safeJsonResponse';

describe('readJsonOrFallback', () => {
  it('returns the fallback when a successful response contains HTML instead of JSON', async () => {
    const response = new Response('<!DOCTYPE html><html></html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });

    await expect(readJsonOrFallback(response, [])).resolves.toEqual([]);
  });

  it('returns the fallback when HTML is mislabeled as JSON', async () => {
    const response = new Response('<!DOCTYPE html><html></html>', {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });

    await expect(readJsonOrFallback(response, [])).resolves.toEqual([]);
  });

  it('returns the fallback when a JSON response body is malformed', async () => {
    const response = new Response('{"pedidos":', {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });

    await expect(readJsonOrFallback(response, [])).resolves.toEqual([]);
  });
});
