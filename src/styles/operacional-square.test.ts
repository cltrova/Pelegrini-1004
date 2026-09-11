import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('operational square visual scope', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles/operacional-square.css'), 'utf8');
  const sidebarSource = readFileSync(
    join(process.cwd(), 'src/components/pelegrini/PelegriniModuleSidebar.tsx'),
    'utf8',
  );

  it('scopes structural rules to the operational shell', () => {
    expect(css).toContain("[data-module-shell='operacional']");
    expect(css).not.toMatch(/^\s*\.(?:rounded|bg-card|premium-card)\b/m);
  });

  it('defines stable radii and reduced motion', () => {
    expect(css).toContain('--operational-panel-radius: 2px');
    expect(css).toContain('--operational-control-radius: 4px');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('removes the shared decorative grid from the operational sidebar', () => {
    expect(css).toMatch(
      /\[data-module-shell='operacional'\] \.pelegrini-sidebar::before\s*{[^}]*background-image:\s*none;/,
    );
  });

  it('caps the operational mobile sidebar transition at 220ms', () => {
    expect(css).toMatch(
      /\[data-module-shell='operacional'\] \.pelegrini-sidebar\s*{[^}]*transition-duration:\s*220ms;/,
    );
  });

  it('caps both operational mobile menu controls at a 4px radius', () => {
    expect(sidebarSource.match(/sidebar-mobile-control/g) ?? []).toHaveLength(2);
    expect(css).toMatch(
      /\[data-module-shell='operacional'\] \.sidebar-mobile-control\s*{[^}]*border-radius:\s*4px;/,
    );
  });

  it('neutralizes decorative descendant transforms without targeting loading animations', () => {
    expect(css).toMatch(
      /\[data-module-shell='operacional'\] \.transition-transform\s*{[^}]*transition-property:\s*color, background-color, border-color, opacity;/,
    );
    expect(css).toMatch(
      /\[data-module-shell='operacional'\] \.group:hover \[class\*='group-hover:translate'\]\s*{[^}]*transform:\s*none !important;/,
    );
    expect(css).not.toMatch(/animate-spin/);
  });
});
