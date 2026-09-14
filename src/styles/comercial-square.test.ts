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

describe('commercial square visual scope', () => {
  const cssPath = join(process.cwd(), 'src/styles/comercial-square.css');
  const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : '';
  const mainSource = readFileSync(join(process.cwd(), 'src/main.tsx'), 'utf8');

  it('scopes structural rules to the commercial shell', () => {
    expect(css).toContain("[data-module-shell='comercial']");
    expect(css).not.toMatch(/^\s*\.(?:pelegrini-page-surface|pelegrini-surface-pattern|rounded|bg-card|premium-card)\b/m);
  });

  it('keeps panel geometry away from generic elements and utility surfaces', () => {
    const panelGeometrySelectors = selectorsApplying(
      css,
      'border-radius: var(--commercial-panel-radius)',
    ).join('\n');

    expect(panelGeometrySelectors).not.toMatch(
      /(^|[\s,(>+~])(?:section|table|th|td|\.bg-card)(?=$|[\s,.#:[\]()>+~])/,
    );
  });

  it('defines the commercial geometry and motion tokens', () => {
    expect(css).toContain('--commercial-panel-radius: 2px');
    expect(css).toContain('--commercial-control-radius: 4px');
    expect(css).toMatch(/--commercial-motion-fast:\s*(?:120|1[3-7]0|180)ms/);
    expect(css).toMatch(/--commercial-motion-sidebar:\s*(?:1[2-9]0|20[0-9]|210|220)ms/);
  });

  it('applies compact geometry through commercial semantic primitives', () => {
    const panelGeometrySelectors = selectorsApplying(
      css,
      'border-radius: var(--commercial-panel-radius)',
    ).join('\n');
    const controlGeometrySelectors = selectorsApplying(
      css,
      'border-radius: var(--commercial-control-radius)',
    ).join('\n');

    expect(panelGeometrySelectors).toContain('.commercial-workspace');
    expect(panelGeometrySelectors).toContain('.commercial-toolbar');
    expect(panelGeometrySelectors).toContain('.commercial-metric-strip');
    expect(panelGeometrySelectors).toContain('.commercial-data-viewport');
    expect(controlGeometrySelectors).toContain('.commercial-filter-control');
    expect(controlGeometrySelectors).toContain('.commercial-overlay');
  });

  it('styles drilldown KPI cells as neutral descendants instead of nested panels', () => {
    expect(css).toMatch(
      /\.commercial-overlay \.commercial-kpi-cell\s*\{[^}]*border-radius:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s,
    );
  });

  it('limits compact primitive motion to color and opacity', () => {
    expect(css).toMatch(
      /\.commercial-(?:toolbar|filter-control)[^{}]*\{[^}]*transition-property:\s*color, background-color, border-color, opacity;/s,
    );
  });

  it('neutralizes active tab shadows only inside the commercial shell', () => {
    const shadowlessSelectors = selectorsApplying(css, 'box-shadow: none !important').join('\n');

    expect(shadowlessSelectors).toContain(
      "[data-module-shell='comercial'] [role='tab'][data-state='active']",
    );
    expect(shadowlessSelectors).not.toMatch(
      /(^|\n)\s*\[role='tab'\]\[data-state='active'\]/,
    );
  });

  it('limits reduced motion overrides to the commercial shell and its overlay', () => {
    const reducedMotion = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));

    expect(reducedMotion).toContain("[data-module-shell='comercial']");
    expect(reducedMotion).toContain('.commercial-overlay');
    expect(reducedMotion).not.toMatch(/^\s*\*[,\s{]/m);
  });

  it('loads the commercial stylesheet after the shared and operational styles', () => {
    const indexImport = mainSource.indexOf('"./index.css"');
    const operationalImport = mainSource.indexOf('"./styles/operacional-square.css"');
    const commercialImport = mainSource.indexOf('"./styles/comercial-square.css"');
    const cssImports = [...mainSource.matchAll(/^import ["'](.+\.css)["'];$/gm)];

    expect(indexImport).toBeGreaterThanOrEqual(0);
    expect(operationalImport).toBeGreaterThan(indexImport);
    expect(commercialImport).toBeGreaterThan(operationalImport);
    expect(cssImports.at(-1)?.[1]).toBe('./styles/comercial-square.css');
  });
});
