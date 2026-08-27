import { describe, expect, it } from 'vitest';
import { getRankingVendedoresChartLayout } from './rankingVendedoresChartLayout';

describe('RankingVendedoresChart label hierarchy', () => {
  it('destaca o valor sem permitir sobreposicao entre vendedores', () => {
    expect(getRankingVendedoresChartLayout(5)).toMatchObject({
      chartMinWidth: 1500,
      sellerFontSize: 22,
      sellerFontWeight: 700,
      valueFontSize: 36,
      valueFontWeight: 900,
    });
  });

  it('reserva largura adicional quando ha muitos vendedores', () => {
    expect(getRankingVendedoresChartLayout(10).chartMinWidth).toBe(3000);
  });
});
