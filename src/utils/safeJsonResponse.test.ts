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
});
