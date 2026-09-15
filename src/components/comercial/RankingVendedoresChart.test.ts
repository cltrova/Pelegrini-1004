import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

describe('RankingVendedoresChart reference labels', () => {
  it('keeps reference labels inside the chart area', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/comercial/RankingVendedoresChart.tsx'), 'utf8');
    expect(source).not.toContain("position: 'right'");
    expect(source).toContain("position: 'insideTopRight'");
  });
});
