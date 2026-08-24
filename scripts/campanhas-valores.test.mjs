import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ts from 'typescript';

const source = await readFile(resolve('src/utils/campanhasValores.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});

const { valorReceitaCampanha } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

const itens = [
  { valor_venda_item: 100, valor_devolucao_item: 0, valor_desconto: 30 },
  { valor_venda_item: 0, valor_devolucao_item: 20, valor_desconto: 0 },
  { valor_venda_item: 50, valor_devolucao_item: 0, valor_desconto: 5 },
];

const total = itens.reduce((acc, item) => acc + valorReceitaCampanha(item), 0);

assert.equal(total, 130, 'campanhas devem usar ValorVenda - ValorDevolucao sem somar desconto');
assert.equal(valorReceitaCampanha({ tipo: 'DEVOLUCAO', valor_total: 42 }), -42);
assert.equal(valorReceitaCampanha({ tipo: 'PEDIDO', valor_total: 75 }), 75);

console.log('campanhas-valores: ok');
