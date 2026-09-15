import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('financial semantic layout contracts', () => {
  it.each([
    'src/pages/financeiro/DrePage.tsx',
    'src/pages/financeiro/VariacaoPage.tsx',
  ])('composes the compact workspace primitives in %s', (path) => {
    const source = read(path);

    expect(source).toContain('financial-workspace');
    expect(source).toContain('financial-toolbar');
    expect(source).toContain('financial-metric-strip');
    expect(source).toContain('financial-data-viewport');
    expect(source).toContain('financial-filter-control');
  });

  it.each([
    'src/pages/financeiro/DrePage.tsx',
    'src/pages/financeiro/VariacaoPage.tsx',
    'src/components/dre/DreFilters.tsx',
    'src/components/dre/DreComparativo.tsx',
    'src/components/dre/DreMobileView.tsx',
    'src/components/dre/DespesasFixasDialog.tsx',
    'src/components/dre/DespesasVariaveisDialog.tsx',
    'src/components/variacao/DFCFilters.tsx',
    'src/components/variacao/DFCTable.tsx',
    'src/components/variacao/DfcConfigTab.tsx',
    'src/components/variacao/VariacaoFilters.tsx',
  ])('marks every explicit portal in %s as a financial overlay', (path) => {
    const source = read(path);
    const portals = [...source.matchAll(/<(?:Dialog|Sheet|Popover|Select|Tooltip)Content\b[^>]*>/gs)]
      .map(([portal]) => portal);

    expect(portals.length).toBeGreaterThan(0);
    portals.forEach((portal) => expect(portal).toContain('financial-overlay'));
  });

  it.each([
    'src/components/dre/DreGroupedTable.tsx',
    'src/components/dre/DreComparativo.tsx',
    'src/components/variacao/DFCTable.tsx',
    'src/components/variacao/VariacaoTable.tsx',
  ])('keeps wide tables inside a financial data viewport in %s', (path) => {
    expect(read(path)).toContain('financial-data-viewport');
  });
});
