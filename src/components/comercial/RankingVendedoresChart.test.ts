import { describe, expect, it } from 'vitest';
import { getRankingVendedoresChartLayout } from './rankingVendedoresChartLayout';

describe('RankingVendedoresChart label hierarchy', () => {
  it('mantem o grafico fluido dentro do card', () => {
    expect(getRankingVendedoresChartLayout(5)).toMatchObject({
      chartMinWidth: 0,
      sellerFontSize: 11,
      sellerFontWeight: 700,
      valueFontSize: 13,
      valueFontWeight: 750,
    });
  });

  it('reduz a tipografia quando ha muitos vendedores sem criar largura fixa', () => {
    expect(getRankingVendedoresChartLayout(10)).toMatchObject({
      chartMinWidth: 0,
      sellerFontSize: 10,
      valueFontSize: 11,
    });
  });
});
