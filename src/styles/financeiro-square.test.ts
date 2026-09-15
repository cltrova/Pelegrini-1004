import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function selectorsApplying(source: string, declaration: string): string[] {
  const selectors: string[] = [];
  let searchFrom = 0;

  while (searchFrom < source.length) {
    const declarationIndex = source.indexOf(declaration, searchFrom);
    if (declarationIndex === -1) break;

    const ruleOpen = source.lastIndexOf('{', declarationIndex);
    const ruleStart = source.lastIndexOf('}', ruleOpen) + 1;
    selectors.push(source.slice(ruleStart, ruleOpen).trim());
    searchFrom = declarationIndex + declaration.length;
  }

  return selectors;
}

function selectorsWithNonNoneShadows(source: string): string[] {
  const shadowRules = source.match(/[^{}]+\{[^{}]*box-shadow:(?!\s*none\b)\s*[^;]+;[^{}]*\}/g) ?? [];

  return shadowRules.flatMap((rule) =>
    rule
      .slice(0, rule.indexOf('{'))
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean),
  );
}

describe('financial square visual scope', () => {
  const cssPath = join(process.cwd(), 'src/styles/financeiro-square.css');
  const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : '';
  const mainSource = readFileSync(join(process.cwd(), 'src/main.tsx'), 'utf8');

  it('scopes all structural rules to the financial shell', () => {
    expect(css).toContain("[data-module-shell='financeiro']");
    expect(css).not.toMatch(/^\s*\.(?:pelegrini-page-surface|pelegrini-surface-pattern|rounded|bg-card)\b/m);
  });

  it('defines compact financial geometry and motion tokens', () => {
    expect(css).toContain('--financial-panel-radius: 2px');
    expect(css).toContain('--financial-control-radius: 4px');
    expect(css).toMatch(/--financial-motion-fast:\s*(?:120|1[3-7]0|180)ms/);
    expect(css).toContain('--financial-motion-sidebar: 220ms');
  });

  it('applies geometry through financial semantic primitives', () => {
    const panels = selectorsApplying(css, 'border-radius: var(--financial-panel-radius)').join('\n');
    const controls = selectorsApplying(css, 'border-radius: var(--financial-control-radius)').join('\n');

    expect(panels).toContain('.financial-workspace');
    expect(panels).toContain('.financial-toolbar');
    expect(panels).toContain('.financial-metric-strip');
    expect(panels).toContain('.financial-data-viewport');
    expect(controls).toContain('.financial-filter-control');
    expect(controls).toContain('.financial-overlay');
  });

  it('keeps non-none shadows exclusive to temporary overlays', () => {
    const shadowSelectors = selectorsWithNonNoneShadows(css);
    expect(shadowSelectors.every((selector) => selector.startsWith('.financial-overlay'))).toBe(true);
  });

  it('does not animate layout dimensions', () => {
    expect(css).not.toMatch(/transition(?:-property)?:[^;]*(?:all|width|height|padding|margin)/);
  });

  it('neutralizes active tab shadows only inside the financial shell', () => {
    const selectors = selectorsApplying(css, 'box-shadow: none !important').join('\n');
    expect(selectors).toContain("[data-module-shell='financeiro'] [role='tab'][data-state='active']");
    expect(selectors).not.toMatch(/(^|\n)\s*\[role='tab'\]\[data-state='active'\]/);
  });

  it('reserves mobile header space for the floating sidebar control', () => {
    expect(css).toMatch(/header\.safe-area-top\s*>\s*div[^}]*padding-inline-start:\s*3\.75rem/s);
  });

  it('limits reduced motion overrides to the financial shell and overlays', () => {
    const reducedMotion = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reducedMotion).toContain("[data-module-shell='financeiro']");
    expect(reducedMotion).toContain('.financial-overlay');
    expect(reducedMotion).not.toMatch(/^\s*\*[,\s{]/m);
  });

  it('loads the financial stylesheet after the other module styles', () => {
    const commercialImport = mainSource.indexOf('"./styles/comercial-square.css"');
    const financialImport = mainSource.indexOf('"./styles/financeiro-square.css"');
    const cssImports = [...mainSource.matchAll(/^import ["'](.+\.css)["'];$/gm)];

    expect(commercialImport).toBeGreaterThanOrEqual(0);
    expect(financialImport).toBeGreaterThan(commercialImport);
    expect(cssImports.at(-1)?.[1]).toBe('./styles/financeiro-square.css');
  });
});
