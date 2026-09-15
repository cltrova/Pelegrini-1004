import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('financial active page composition', () => {
  const activePages = [
    'src/pages/financeiro/ResumoPage.tsx',
    'src/pages/financeiro/DrePage.tsx',
    'src/pages/financeiro/VariacaoPage.tsx',
    'src/pages/financeiro/SaldoAVencerPage.tsx',
  ];

  it.each(activePages)('%s uses the scoped financial workspace', (path) => {
    expect(read(path)).toContain('financial-workspace');
  });

  it.each(activePages)('%s keeps dense data inside an internal viewport', (path) => {
    expect(read(path)).toContain('financial-data-viewport');
  });

  it('marks the mobile DRE and cash-flow sheets as financial overlays', () => {
    for (const path of [
      'src/pages/financeiro/DrePage.tsx',
      'src/pages/financeiro/VariacaoPage.tsx',
    ]) {
      const source = read(path);
      expect(source).toMatch(/SheetContent[^>]+financial-overlay[^>]+flex-col/);
      expect(source).toMatch(/financial-filter-control[^"']*min-h-0[^"']*flex-1[^"']*overflow-y-auto/);
    }
  });

  it('stacks the variation header above its full-width workspace', () => {
    const source = read('src/pages/financeiro/VariacaoPage.tsx');
    const desktopLayout = source.slice(source.indexOf('// Desktop'));

    expect(desktopLayout).toMatch(/financial-workspace[^"']*flex-col/);
  });

  it('marks the active balance filters and details as financial overlays', () => {
    const sources = [
      read('src/pages/financeiro/SaldoAVencerPage.tsx'),
      read('src/components/financeiro/SaldoAVencerFiltros.tsx'),
      read('src/components/financeiro/SaldoAVencerKpis.tsx'),
    ].join('\n');

    expect(sources.match(/financial-overlay/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it('keeps DFC content readable on light cards', () => {
    const source = read('src/components/variacao/DFCDashboard.tsx');
    expect(source).not.toMatch(/text-slate-(?:100|200|300|400)/);
  });

  it('keeps balance KPIs flat and uses borders for interaction state', () => {
    const source = read('src/components/financeiro/SaldoAVencerKpis.tsx');
    expect(source).toContain("rounded-xl border border-border/60 bg-card");
    expect(source).not.toMatch(/hover:-translate|hover:shadow|shadow-md|transition-all/);
  });
});
