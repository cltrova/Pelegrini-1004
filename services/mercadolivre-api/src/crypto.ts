import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface EncryptedValue {
  ciphertext: string;
  nonce: string;
  tag: string;
  keyVersion: 1;
}

const TOKEN_AAD = Buffer.from('pelegrini-mercadolivre-token-v1');

function decodeKey(key: string): Buffer {
  const decoded = Buffer.from(key, 'base64');
  if (decoded.length !== 32 || decoded.toString('base64') !== key) {
    throw new Error('Encryption key must encode 32 bytes');
  }
  return decoded;
}

export function encryptToken(plaintext: string, key: string): EncryptedValue {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', decodeKey(key), nonce);
  cipher.setAAD(TOKEN_AAD);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  return {
    ciphertext: ciphertext.toString('base64'),
    nonce: nonce.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    keyVersion: 1,
  };
}

export function decryptToken(value: EncryptedValue, key: string): string {
  if (value.keyVersion !== 1) throw new Error('Unsupported encryption key version');

  const decipher = createDecipheriv(
    'aes-256-gcm',
    decodeKey(key),
    Buffer.from(value.nonce, 'base64'),
  );
  decipher.setAAD(TOKEN_AAD);
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
