import { describe, expect, it } from 'vitest';
import {
  COMERCIAL_COMPRAS_ROUTE,
  getComprasComercialMenuItem,
  isComprasComercialEnabled,
} from './comercialCompras';

describe('comercial compras', () => {
  it('libera Compras somente para a Casa da Transmissão', () => {
    expect(isComprasComercialEnabled('1004')).toBe(true);
    expect(isComprasComercialEnabled(1004)).toBe(true);
    expect(isComprasComercialEnabled('10041')).toBe(false);
    expect(isComprasComercialEnabled(null)).toBe(false);
  });

  it('expõe o item de navegação comercial para 1004', () => {
    expect(getComprasComercialMenuItem('1004')).toMatchObject({
      label: 'Compras',
      path: COMERCIAL_COMPRAS_ROUTE,
    });
    expect(getComprasComercialMenuItem('10041')).toBeNull();
  });
});