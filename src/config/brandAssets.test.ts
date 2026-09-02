import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getFiliaisDaEmpresa } from './filiaisEmpresa';

describe('brand assets', () => {
  it('uses a Pelegrini mark as the app favicon instead of a branch logo', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

    expect(html).toContain('href="/brand/pelegrini-icon.svg"');
    expect(html).not.toContain('rel="icon" type="image/png" href="/brand/casa-transmissao.png"');
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
          logoSrc: '/brand/casa-chevrolet-wordmark.png',
        }),
      ]),
    );
  });

  it('changes the transparent Chevrolet wordmark color with the active theme', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');

    expect(css).toContain('.pelegrini-chevrolet-logo');
    expect(css).toContain('.dark .pelegrini-chevrolet-logo');
    expect(css).toContain('filter: brightness(0) invert(1)');
  });
});
