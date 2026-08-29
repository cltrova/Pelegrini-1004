import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('RankingVendedoresLabels', () => {
  it('renderiza nome e valor como HTML em tamanho destacado', async () => {
    const modulePath = './RankingVendedoresLabels';
    const labelsModule = await import(/* @vite-ignore */ modulePath).catch(() => ({}));
    const RankingVendedoresLabels = Reflect.get(labelsModule, 'RankingVendedoresLabels');

    expect(RankingVendedoresLabels).toBeTypeOf('function');

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
  });
});
