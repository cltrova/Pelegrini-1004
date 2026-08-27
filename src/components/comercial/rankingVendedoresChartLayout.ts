export function getRankingVendedoresChartLayout(vendedores: number) {
  return {
    chartMinWidth: Math.max(760, vendedores * 300),
    sellerFontSize: 22,
    sellerFontWeight: 700,
    valueFontSize: 36,
    valueFontWeight: 900,
  } as const;
}
