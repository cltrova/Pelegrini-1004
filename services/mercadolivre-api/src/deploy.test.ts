import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const compose = readFileSync(fileURLToPath(new URL('../docker-compose.yml', import.meta.url)), 'utf8');

describe('isolated deployment configuration', () => {
  it('uses an independent project, persistent data volume, and internal-only container port', () => {
    expect(compose).toContain('name: pelegrini-mercadolivre-api');
    expect(compose).toContain('mercadolivre_data:/data');
    expect(compose).toContain('expose:');
    expect(compose).not.toMatch(/^\s+ports:/m);
    expect(compose).not.toContain('caspper');
  });

  it('defines a bounded resource profile and an HTTP health check', () => {
    expect(compose).toContain('mem_limit: 256m');
    expect(compose).toContain('cpus: 0.50');
    expect(compose).toContain("http://127.0.0.1:3000/health");
  });
});
