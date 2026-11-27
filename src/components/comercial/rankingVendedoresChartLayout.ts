export const PELEGRINI_RANKING_PLOT = { left: 64, right: 14 } as const;

export function getRankingVendedoresChartLayout(vendedores: number) {
  const dense = vendedores > 6;
  return {
    chartMinWidth: 0,
    sellerFontSize: dense ? 10 : 11,
    sellerFontWeight: 700,
    valueFontSize: dense ? 11 : 13,
    valueFontWeight: 750,
  } as const;
}
