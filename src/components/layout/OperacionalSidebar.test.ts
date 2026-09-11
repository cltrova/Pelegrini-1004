import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildOperacionalMenuItems } from './operacionalSidebarItems';

describe('buildOperacionalMenuItems', () => {
  it('requests indexed navigation for the operational sidebar', () => {
    const source = readFileSync(join(process.cwd(), 'src', 'components', 'layout', 'OperacionalSidebar.tsx'), 'utf8');

    expect(source).toMatch(/<PelegriniModuleSidebar\s+indexed(?:\s|\/?>)/);
  });

  it('adds Distribuidores as a standalone sidebar destination for Casa da Transmissao', () => {
    const items = buildOperacionalMenuItems('1004', 'transmissao');

    expect(items.map((item) => item.label)).toEqual([
      'Estoque',
      'Estoque Retroativo',
      'Distribuidores',
    ]);
    expect(items[2]).toEqual(expect.objectContaining({
      path: '/operacional/distribuidores',
    }));
  });

  it.each([
    ['10041', 'chevrolet'],
    ['1004', 'chevrolet'],
    [null, 'transmissao'],
  ])('hides Distribuidores for company %s and branch %s', (companyCode, branchId) => {
    const items = buildOperacionalMenuItems(companyCode, branchId);

    expect(items.some((item) => item.path === '/operacional/distribuidores')).toBe(false);
  });
});
