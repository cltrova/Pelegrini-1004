import { chmodSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface EcommerceDatabase {
  connection: DatabaseSync;
  transaction<T>(operation: () => T): T;
  close(): void;
}

export function createDatabase(path: string): EcommerceDatabase {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });

  const connection = new DatabaseSync(path);
  if (path !== ':memory:') chmodSync(path, 0o600);
  connection.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      company_code TEXT NOT NULL UNIQUE CHECK (company_code = '10041'),
      seller_id TEXT NOT NULL,
      nickname TEXT,
      status TEXT NOT NULL CHECK (status IN ('connected', 'error', 'disconnected')),
      access_token_ciphertext TEXT NOT NULL,
      access_token_nonce TEXT NOT NULL,
      access_token_tag TEXT NOT NULL,
      refresh_token_ciphertext TEXT NOT NULL,
      refresh_token_nonce TEXT NOT NULL,
      refresh_token_tag TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      scopes TEXT NOT NULL DEFAULT '[]',
      connected_at TEXT NOT NULL,
      last_sync_at TEXT,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS oauth_states (
      state_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      company_code TEXT NOT NULL CHECK (company_code = '10041'),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      pkce_verifier_ciphertext TEXT,
      pkce_verifier_nonce TEXT,
      pkce_verifier_tag TEXT
    ) STRICT;

    CREATE INDEX IF NOT EXISTS oauth_states_expires_at_idx ON oauth_states(expires_at);

    CREATE TABLE IF NOT EXISTS notification_inbox (
      event_key TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      resource TEXT NOT NULL,
      seller_id TEXT,
      application_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      received_at TEXT NOT NULL,
      processed_at TEXT,
      attempts INTEGER NOT NULL DEFAULT 0
    ) STRICT;
  `);

  return {
    connection,
    transaction<T>(operation: () => T): T {
      connection.exec('BEGIN IMMEDIATE');
      try {
        const result = operation();
        connection.exec('COMMIT');
        return result;
      } catch (error) {
        connection.exec('ROLLBACK');
        throw error;
      }
    },
    close: () => connection.close(),
  };
}
