import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getFiliaisDaEmpresa } from './filiaisEmpresa';

describe('brand assets', () => {
  it('uses the CT mark as the app favicon', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

    expect(html).toContain('href="/brand/casa-transmissao.png"');
  });

  it('maps each Pelegrini branch to its own visual identity', () => {
    const filiais = getFiliaisDaEmpresa('1004');

    expect(filiais).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'transmissao',
          nome: 'Casa da Transmissão',
          logoSrc: '/brand/casa-transmissao.png',
        }),
        expect.objectContaining({
          id: 'chevrolet',
          nome: 'Casa da Chevrolet',
          logoSrc: '/brand/casa-chevrolet.png',
        }),
      ]),
    );
  });
});
