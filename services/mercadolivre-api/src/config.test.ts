import { describe, expect, it } from 'vitest';

import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('uses a safe local port and persistent database default', () => {
    const config = loadConfig({
      PUBLIC_APP_ORIGIN: 'https://www.pelegrini.t2a.ia.br',
    });

    expect(config.port).toBe(3000);
    expect(config.sqlitePath).toBe('/data/mercadolivre.sqlite');
  });

  it('rejects a token encryption key that is not 32 bytes', () => {
    expect(() => loadConfig({
      PUBLIC_APP_ORIGIN: 'https://www.pelegrini.t2a.ia.br',
      MELI_TOKEN_ENCRYPTION_KEY: Buffer.from('short').toString('base64'),
    })).toThrow('MELI_TOKEN_ENCRYPTION_KEY must encode 32 bytes');
  });

  it('rejects an invalid or non-HTTPS app origin', () => {
    expect(() => loadConfig({ PUBLIC_APP_ORIGIN: 'http://pelegrini.test' }))
      .toThrow('PUBLIC_APP_ORIGIN must be an HTTPS origin');
  });
});
