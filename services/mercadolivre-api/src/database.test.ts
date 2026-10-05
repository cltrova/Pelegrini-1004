import { describe, expect, it } from 'vitest';

import { createDatabase } from './database.js';

describe('createDatabase', () => {
  it('creates isolated integration, OAuth state, and notification tables', () => {
    const database = createDatabase(':memory:');

    const tables = database.connection
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual(['connections', 'notification_inbox', 'oauth_states']);
    database.close();
  });

  it('rolls back all transaction writes when an operation throws', () => {
    const database = createDatabase(':memory:');

    expect(() => database.transaction(() => {
      database.connection.prepare(`
        INSERT INTO oauth_states (state_hash, user_id, company_code, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('hash-1', 'user-1', '10041', '2026-10-05T00:00:00Z', '2026-10-05T00:05:00Z');
      throw new Error('abort transaction');
    })).toThrow('abort transaction');

    expect(database.connection.prepare('SELECT count(*) as count FROM oauth_states').get())
      .toEqual({ count: 0 });
    database.close();
  });
});
