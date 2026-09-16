import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VendedorDetailsDialog } from './VendedorDetailsDialog';

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(() => new Promise(() => undefined)),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke } },
}));

vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: () => ({ codEmpresaAtiva: '1005' }),
}));

describe('VendedorDetailsDialog', () => {
  it('usa a identidade visual compartilhada mesmo na empresa 1005', () => {
    render(
      <VendedorDetailsDialog
        vendedor={{
          codigo: 47,
          nome: 'RAFAEL',
          metaMensal: 255000,
          faturamentoMesAtual: 118078.27,
          valorPendente: 0,
          valorTotal: 118078.27,
          percentualMetaFaturado: 46.3,
          percentualMetaTotal: 46.3,
          diferenca: -9421.73,
          status: 'abaixo',
          metaDiaria: 11590.91,
          metaEsperada: 127500,
        }}
        ranking={1}
        pedidos={[]}
        devolucoes={[]}
        diasUteisNoMes={22}
        diasUteisDecorridos={11}
        open
        onOpenChange={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('commercial-vendedor-dialog', 'rounded-none');
    expect(dialog.getAttribute('style')).not.toContain('background');
    expect(screen.getByText('RAFAEL')).toBeInTheDocument();
  });

  it('preserva o slot de 14px e a margem do ícone durante a análise', async () => {
    render(
      <VendedorDetailsDialog
        vendedor={{
          codigo: 47,
          nome: 'RAFAEL',
          metaMensal: 255000,
          faturamentoMesAtual: 118078.27,
          valorPendente: 0,
          valorTotal: 118078.27,
          percentualMetaFaturado: 46.3,
          percentualMetaTotal: 46.3,
          diferenca: -9421.73,
          status: 'abaixo',
          metaDiaria: 11590.91,
          metaEsperada: 127500,
        }}
        ranking={1}
        pedidos={[]}
        devolucoes={[]}
        diasUteisNoMes={22}
        diasUteisDecorridos={11}
        open
        onOpenChange={vi.fn()}
      />,
    );

    const action = screen.getByRole('button', { name: 'Gerar análise' });
    expect(action.querySelector('svg')).toHaveClass('h-3.5', 'w-3.5', 'mr-2');

    fireEvent.click(action);

    const busyAction = await screen.findByRole('button', { name: 'Analisando...' });
    expect(within(busyAction).getByTestId('loading-indicator')).toHaveClass('h-3.5', 'w-3.5', 'mr-2');
  });
});
