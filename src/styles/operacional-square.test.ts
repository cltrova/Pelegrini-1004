import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function extractBlock(source: string, marker: string): string {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) throw new Error(`Missing CSS marker: ${marker}`);

  const openIndex = source.indexOf('{', markerIndex + marker.length);
  if (openIndex === -1) throw new Error(`Missing opening brace after: ${marker}`);

  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(openIndex + 1, index);
  }

  throw new Error(`Unclosed CSS block after: ${marker}`);
}

function assertPortableOverlayReducedMotion(source: string) {
  const reducedMotion = extractBlock(source, '@media (prefers-reduced-motion: reduce)');
  const overlayRuleStart = reducedMotion.indexOf('.operational-overlay');
  if (overlayRuleStart === -1) throw new Error('Missing portable overlay reduced-motion rule');

  const selectorStart = reducedMotion.lastIndexOf('}', overlayRuleStart) + 1;
  const ruleOpen = reducedMotion.indexOf('{', overlayRuleStart);
  const selectorList = new Set(
    reducedMotion
      .slice(selectorStart, ruleOpen)
      .split(',')
      .map(selector => selector.trim()),
  );
  const ruleBody = extractBlock(reducedMotion, '.operational-overlay');

  [
    '.operational-overlay',
    '.operational-overlay::before',
    '.operational-overlay::after',
    '.operational-overlay *',
    '.operational-overlay *::before',
    '.operational-overlay *::after',
  ].forEach(selector => expect(selectorList).toContain(selector));

  expect(ruleBody).toContain('transition-duration: 0.01ms !important');
  expect(ruleBody).toContain('animation-duration: 0.01ms !important');
  expect(ruleBody).toContain('animation-iteration-count: 1 !important');
}

describe('operational square visual scope', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles/operacional-square.css'), 'utf8');
  const sharedCss = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');
  const mainSource = readFileSync(join(process.cwd(), 'src/main.tsx'), 'utf8');
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

  it('neutralizes motion for operational overlays rendered outside the shell', () => {
    assertPortableOverlayReducedMotion(css);

    const withoutPseudoElement = css.replace(/^[ \t]*\.operational-overlay::before,\r?\n/m, '');
    expect(() => assertPortableOverlayReducedMotion(withoutPseudoElement)).toThrow();

    const movedOutsideMedia = `${css.replace(/^[ \t]*\.operational-overlay[^\n]*\r?\n/gm, '')}\n${[
      '.operational-overlay,',
      '.operational-overlay::before,',
      '.operational-overlay::after,',
      '.operational-overlay *,',
      '.operational-overlay *::before,',
      '.operational-overlay *::after {',
      '  transition-duration: 0.01ms !important;',
      '  animation-duration: 0.01ms !important;',
      '  animation-iteration-count: 1 !important;',
      '}',
    ].join('\n')}`;
    expect(() => assertPortableOverlayReducedMotion(movedOutsideMedia)).toThrow();
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

  it('keeps the only non-none shadow on the operational overlay', () => {
    const nonNoneShadows = [...css.matchAll(/box-shadow:\s*([^;]+);/g)]
      .filter(([, value]) => !/^none(?:\s*!important)?$/.test(value.trim()));

    expect(nonNoneShadows).toHaveLength(1);

    const shadowIndex = nonNoneShadows[0].index ?? -1;
    const ruleStart = css.lastIndexOf('}', shadowIndex) + 1;
    const ruleOpen = css.lastIndexOf('{', shadowIndex);
    expect(css.slice(ruleStart, ruleOpen).trim()).toBe('.operational-overlay');
  });

  it('neutralizes the shared active-item shadow without moving the visible marker', () => {
    const operationalActiveItem = extractBlock(
      css,
      "[data-module-shell='operacional'] .sidebar-item-active",
    );
    const operationalMarker = extractBlock(
      css,
      "[data-module-shell='operacional'] .sidebar-item-active::before",
    );

    expect(sharedCss).toMatch(
      /\.sidebar-item-active\s*{[^}]*box-shadow:\s*inset\s+3px\s+0\s+0[^}]*}/,
    );
    expect(operationalActiveItem).toMatch(/box-shadow:\s*none(?:\s*!important)?;/);
    expect(mainSource.indexOf('"./index.css"')).toBeLessThan(
      mainSource.indexOf('"./styles/operacional-square.css"'),
    );
    expect(operationalMarker).toMatch(/position:\s*absolute;/);
    expect(operationalMarker).toMatch(/width:\s*3px;/);
    expect(operationalMarker).toMatch(/content:\s*'';/);
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
