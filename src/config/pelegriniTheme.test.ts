import { describe, expect, it } from 'vitest';
import { getPelegriniThemeKey, resolvePelegriniTheme } from './pelegriniTheme';

describe('pelegriniTheme', () => {
  it('resolves the neutral Pelegrini theme when no branch is active', () => {
    const theme = resolvePelegriniTheme(null);

    expect(getPelegriniThemeKey(null)).toBe('pelegrini');
    expect(theme.name).toBe('Pelegrini');
    expect(theme.tagline).toContain('gestao');
    expect(theme.logoSrc).toBe('/brand/pelegrini-icon.svg');
  });

  it('resolves Casa da Transmissão with heavy parts vocabulary', () => {
    const theme = resolvePelegriniTheme('transmissao');

    expect(getPelegriniThemeKey('transmissao')).toBe('transmissao');
    expect(theme.name).toBe('Casa da Transmissão');
    expect(theme.businessWords).toEqual(expect.arrayContaining(['Câmbio', 'Diferencial', 'Motor']));
    expect(theme.motion).toBe('transmission');
  });

  it('resolves Casa do Chevrolet with original parts vocabulary', () => {
    const theme = resolvePelegriniTheme('chevrolet');

    expect(getPelegriniThemeKey('chevrolet')).toBe('chevrolet');
    expect(theme.name).toBe('Casa do Chevrolet');
    expect(theme.businessWords).toEqual(expect.arrayContaining(['Peças originais', 'Freio', 'Arrefecimento']));
    expect(theme.motion).toBe('chevrolet');
  });
});
