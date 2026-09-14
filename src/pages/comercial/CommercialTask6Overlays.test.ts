import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

interface PortalContract {
  file: string;
  callsites: Readonly<Record<string, number>>;
}

const contracts: readonly PortalContract[] = [
  {
    file: 'src/pages/comercial/ComissaoPage.tsx',
    callsites: { SelectContent: 2, PopoverContent: 1 },
  },
  {
    file: 'src/components/comercial/ComissaoVendedorFilter.tsx',
    callsites: { PopoverContent: 1 },
  },
  {
    file: 'src/components/comercial/ComissaoOperacaoFilter.tsx',
    callsites: { PopoverContent: 1 },
  },
  {
    file: 'src/components/comercial/cotacoes/CotacoesFilters.tsx',
    callsites: { PopoverContent: 1, TooltipContent: 1 },
  },
  {
    file: 'src/components/comercial/cotacoes/CotacoesTable.tsx',
    callsites: { TooltipContent: 2 },
  },
  {
    file: 'src/components/comercial/cotacoes/CotacaoDetailDrawer.tsx',
    callsites: { SheetContent: 1 },
  },
  {
    file: 'src/components/comercial/cotacoes/MotivoPerdaDialog.tsx',
    callsites: { DialogContent: 1, SelectContent: 1 },
  },
  {
    file: 'src/components/comercial/compact/ComercialCompactLayout.tsx',
    callsites: { TooltipContent: 1 },
  },
];

function portalClasses(file: string): Map<string, string[]> {
  const source = ts.createSourceFile(
    file,
    readFileSync(join(process.cwd(), file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const classes = new Map<string, string[]>();

  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node)) {
      const type = node.tagName.getText(source);
      const className = node.attributes.properties.find((property) => (
        ts.isJsxAttribute(property) && property.name.getText(source) === 'className'
      ));
      if (className && ts.isJsxAttribute(className) && className.initializer && ts.isStringLiteral(className.initializer)) {
        classes.set(type, [...(classes.get(type) ?? []), className.initializer.text]);
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return classes;
}

describe('Task 6 commercial portal callsites', () => {
  it.each(contracts)('marks every indirect portal in $file with commercial-overlay', ({ file, callsites }) => {
    const classes = portalClasses(file);

    Object.entries(callsites).forEach(([type, expectedCount]) => {
      expect(classes.get(type), `${file}: ${type}`).toHaveLength(expectedCount);
      expect(classes.get(type), `${file}: ${type}`).toSatisfy(
        (values: string[]) => values.every((value) => value.split(/\s+/).includes('commercial-overlay')),
      );
    });
  });
});
