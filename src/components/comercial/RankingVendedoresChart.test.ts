import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { getRankingVendedoresChartLayout } from './rankingVendedoresChartLayout';
import { RankingVendedoresChart } from './RankingVendedoresChart';

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ onResize }: { onResize?: (width: number, height: number) => void }) => {
      React.useEffect(() => onResize?.(350, 130), [onResize]);
      return null;
    },
  };
});

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

it('pagina os rótulos completos em telas estreitas e abre o vendedor escolhido', () => {
  const onClick = vi.fn();
  const data = [
    { codigo: 1, nome: 'Fernando M', mes: 182345.67, meta: 200000, _row: { codigo: 1 } },
    { codigo: 2, nome: 'Maria', mes: 170000, meta: 210000, _row: { codigo: 2 } },
    { codigo: 3, nome: 'Paulo', mes: 150000, meta: 180000, _row: { codigo: 3 } },
  ];
  render(React.createElement(RankingVendedoresChart, { data, onClick, variant: 'pelegriniBlue' }));

  expect(screen.getByRole('button', { name: /Abrir detalhes de Fernando M.*182\.345,67/ })).toBeVisible();
  expect(screen.queryByRole('button', { name: /Abrir detalhes de Paulo/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Próximos vendedores' }));
  fireEvent.click(screen.getByRole('button', { name: /Abrir detalhes de Paulo.*150\.000,00/ }));

  expect(onClick).toHaveBeenCalledWith({ codigo: 3 });
  expect(screen.getByText('3. Paulo')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Próximos vendedores' })).toBeDisabled();
});
