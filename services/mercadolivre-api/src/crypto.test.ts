import { describe, expect, it } from 'vitest';

import { decryptToken, encryptToken } from './crypto.js';

const key = Buffer.alloc(32).toString('base64');

describe('token encryption', () => {
  it('round-trips a token and generates a fresh nonce for each encryption', () => {
    const first = encryptToken('seller-token', key);
    const second = encryptToken('seller-token', key);

    expect(decryptToken(first, key)).toBe('seller-token');
    expect(first.nonce).not.toBe(second.nonce);
  });

  it('rejects ciphertext whose authentication tag or contents were tampered with', () => {
    const encrypted = encryptToken('seller-token', key);
    const tampered = { ...encrypted, ciphertext: `${encrypted.ciphertext.slice(0, -2)}AA` };

    expect(() => decryptToken(tampered, key)).toThrow();
  });

  it('rejects an encryption key that does not decode to 32 bytes', () => {
    expect(() => encryptToken('seller-token', Buffer.from('short').toString('base64')))
      .toThrow('Encryption key must encode 32 bytes');
  });
});
