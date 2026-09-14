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
    expect(nome).toHaveClass('truncate', 'sm:whitespace-normal');
    expect(nome.parentElement).toHaveAttribute('title', 'DANIEL');
  });

  it('usa valor compacto no mobile e preserva o valor completo para leitores de tela', () => {
    render(
      <RankingVendedoresLabels
        data={[{ codigo: 1, nome: 'VENDEDOR COM NOME LONGO', mes: 223000, pctMeta: 88 }]}
        modo="faturamento"
      />,
    );

    expect(screen.getByText('R$ 223k')).toHaveClass('sm:hidden');
    expect(screen.getByLabelText('R$ 223.000,00')).toHaveTextContent('R$ 223k');
    expect(screen.getByText('R$ 223.000,00')).toHaveClass('hidden', 'sm:block');
  });
});
