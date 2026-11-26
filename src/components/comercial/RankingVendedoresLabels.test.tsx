import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RankingVendedoresLabels } from './RankingVendedoresLabels';

describe('RankingVendedoresLabels', () => {
  it('renderiza nome e valor como HTML em tamanho destacado', () => {

    render(
      <RankingVendedoresLabels
        data={[{ codigo: 1, nome: 'DANIEL', mes: 443711.1, pctMeta: 88 }]}
        modo="faturamento"
        variant="pelegriniBlue"
      />,
    );

    const nome = screen.getByText(/DANIEL/);
    const valor = screen.getByText('R$ 443.711,10');

    expect(nome.closest('svg')).toBeNull();
    expect(valor.closest('svg')).toBeNull();
    expect(nome).toHaveStyle({ fontSize: '11px', fontWeight: '700' });
    expect(valor).toHaveStyle({ fontSize: '13px', fontWeight: '750' });
    expect(nome).toHaveClass('truncate');
    expect(nome.parentElement).toHaveAttribute('title', 'DANIEL');
  });

  it('exibe os valores completos mesmo com mais de seis vendedores', () => {
    render(
      <RankingVendedoresLabels
        data={[
          { codigo: 1, nome: 'Fernando M', mes: 182345.67, pctMeta: 88 },
          { codigo: 2, nome: 'Maria', mes: 1234567.89, pctMeta: 110 },
          { codigo: 3, nome: 'Paulo', mes: -1578.21, pctMeta: 0 },
          ...Array.from({ length: 4 }, (_, i) => ({ codigo: i + 4, nome: `Vendedor ${i + 4}`, mes: 0, pctMeta: 0 })),
        ]}
        modo="faturamento"
        variant="pelegriniBlue"
      />,
    );

    expect(screen.getByText('R$ 182.345,67')).toBeVisible();
    expect(screen.getByText('R$ 1.234.567,89')).toBeVisible();
    expect(screen.getByText('-R$ 1.578,21')).toBeVisible();
    expect(screen.queryByText(/R\$\s*\d+(?:\.\d+)?[KM]$/i)).not.toBeInTheDocument();
    expect(screen.getByText('R$ 182.345,67')).not.toHaveClass('truncate');
  });
});
