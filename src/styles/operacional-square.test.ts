import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('operational square visual scope', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles/operacional-square.css'), 'utf8');

  it('scopes structural rules to the operational shell', () => {
    expect(css).toContain("[data-module-shell='operacional']");
    expect(css).not.toMatch(/^\s*\.(?:rounded|bg-card|premium-card)\b/m);
  });

  it('defines stable radii and reduced motion', () => {
    expect(css).toContain('--operational-panel-radius: 2px');
    expect(css).toContain('--operational-control-radius: 4px');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
