import { describe, expect, it } from 'vitest';
import {
  getPelegriniModuleVisual,
  getPelegriniThemeKey,
  resolvePelegriniTheme,
  resolvePelegriniVisual,
} from './pelegriniTheme';

describe('pelegriniTheme', () => {
  it('uses Casa da Transmissão as the visual fallback when no branch is active', () => {
    const theme = resolvePelegriniTheme(null);

    expect(getPelegriniThemeKey(null)).toBe('transmissao');
    expect(theme.name).toBe('Casa da Transmissão');
    expect(theme.logoSrc).toBe('/brand/casa-transmissao.png');
  });

  it('resolves Casa da Transmissão with heavy parts vocabulary', () => {
    const theme = resolvePelegriniTheme('transmissao');

    expect(getPelegriniThemeKey('transmissao')).toBe('transmissao');
    expect(theme.name).toBe('Casa da Transmissão');
    expect(theme.businessWords).toEqual(expect.arrayContaining(['Câmbio', 'Diferencial', 'Motor']));
    expect(theme.motion).toBe('transmission');
    expect(theme.industry).toBe('heavy-parts');
    expect(theme.motif).toBe('gearbox-blueprint');
    expect(theme.surfacePattern).toBe('technical-grid');
    expect(theme.chartPalette).toEqual(expect.arrayContaining(['#073F73', '#49D2FF']));
    expect(theme.navigation.activeIndicator).toBe('#49D2FF');
    expect(theme.data.valueScale).toBe('fluid');
    expect(theme.density.cardGap).toBe('1rem');
  });

  it('maps ERP company codes to their branch themes', () => {
    expect(getPelegriniThemeKey('1004')).toBe('transmissao');
    expect(resolvePelegriniTheme('1004').name).toBe('Casa da Transmissão');
    expect(getPelegriniThemeKey('10041')).toBe('chevrolet');
    expect(resolvePelegriniTheme('10041').name).toBe('Casa do Chevrolet');
  });

  it('resolves Casa do Chevrolet with original parts vocabulary', () => {
    const theme = resolvePelegriniTheme('chevrolet');

    expect(getPelegriniThemeKey('chevrolet')).toBe('chevrolet');
    expect(theme.name).toBe('Casa do Chevrolet');
    expect(theme.businessWords).toEqual(expect.arrayContaining(['Peças originais', 'Freio', 'Arrefecimento']));
    expect(theme.motion).toBe('chevrolet');
    expect(theme.industry).toBe('original-chevrolet-parts');
    expect(theme.motif).toBe('catalog-seal');
    expect(theme.surfacePattern).toBe('parts-catalog');
    expect(theme.chartPalette).toEqual(expect.arrayContaining(['#034E99', '#E8B923']));
    expect(theme.navigation.activeIndicator).toBe('#E8B923');
    expect(theme.status.attention).toBe('#E8B923');
  });

  it('returns visual tokens that keep CT and CCH clearly different', () => {
    const ct = resolvePelegriniVisual('transmissao');
    const cch = resolvePelegriniVisual('chevrolet');

    expect(ct.blueprintLabel).toContain('Cambio');
    expect(ct.panelMicrocopy).toContain('ZF');
    expect(ct.backgroundMotifs).toEqual(expect.arrayContaining(['gear-ratio', 'differential-lines']));
    expect(cch.blueprintLabel).toContain('Original GM');
    expect(cch.panelMicrocopy).toContain('1992');
    expect(cch.backgroundMotifs).toEqual(expect.arrayContaining(['catalog-tabs', 'delivery-route']));
    expect(ct.backgroundMotifs).not.toEqual(cch.backgroundMotifs);
  });

  it('returns module-specific labels for each branch visual language', () => {
    const ctComercial = getPelegriniModuleVisual('comercial', 'transmissao');
    const cchComercial = getPelegriniModuleVisual('comercial', 'chevrolet');

    expect(ctComercial.kpiPrefix).toBe('Pedidos tecnicos');
    expect(ctComercial.chartLabel).toContain('cambio');
    expect(cchComercial.kpiPrefix).toBe('Pedidos originais');
    expect(cchComercial.chartLabel).toContain('Chevrolet');
  });
});
