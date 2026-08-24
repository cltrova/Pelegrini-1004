import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ts from 'typescript';

const source = await readFile(resolve('src/utils/campanhasVendedores.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});

const { vendedorPertenceCampanha1004, codigoVendedorCampanha } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

const titulares = ['78', '98', '59', '63', '71'];
const extras = ['10041', '72', '75', '', undefined];

titulares.forEach(codigo => {
  assert.equal(vendedorPertenceCampanha1004({ cod_vendedor_externo: codigo }), true, `${codigo} deve entrar na campanha 1004`);
});

extras.forEach(codigo => {
  assert.equal(vendedorPertenceCampanha1004({ cod_vendedor_externo: codigo }), false, `${codigo} deve ficar fora da campanha 1004`);
});

assert.equal(codigoVendedorCampanha({ cod_vendedor_meta: 63 }), '63');

console.log('campanhas-vendedores: ok');
