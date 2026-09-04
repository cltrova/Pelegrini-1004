import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mapComissaoLinha, type ComissaoLinha } from '@/hooks/useComissaoVendedores';
import ComissaoPage from './ComissaoPage';

const linhas = vi.hoisted(() => [] as ComissaoLinha[]);

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({ filialAtiva: 'chevrolet' }),
}));

vi.mock('@/hooks/useComissaoVendedores', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/hooks/useComissaoVendedores')>();
  return {
    ...original,
    useComissaoVendedores: () => ({
      data: linhas,
      isLoading: false,
      isFetching: false,
      error: null,
    }),
  };
});

describe('ComissaoPage', () => {
  beforeEach(() => { linhas.length = 0; });

  it('abre o filtro de operacao fiscal com a faixa padrao de A faturar', () => {
    render(<ComissaoPage />);

    const inicial = screen.getByLabelText('Operação fiscal inicial');
    const final = screen.getByLabelText('Operação fiscal final');

    expect(inicial).toHaveValue('0');
    expect(final).toHaveValue('62');
  });

  it('exibe AFaturar como pedidos em aberto', () => {
    linhas.push(
      mapComissaoLinha({ Vendedor: 10, NomeVendedor: 'XEXEU', AFaturar: 53850.7 }),
      mapComissaoLinha({ Vendedor: 11, NomeVendedor: 'MARCIO', PedidosEmAberto: 100 }),
    );
    render(<ComissaoPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    const row = screen.getByText('XEXEU').closest('tr')!;
    expect(within(row).getAllByRole('cell')[8]).toHaveTextContent('53.850,70');
    const total = screen.getByText('Total', { exact: true }).closest('tr')!;
    expect(within(total).getAllByRole('cell')[7]).toHaveTextContent('53.950,70');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('mostra zero e total quando pedidos em aberto sao explicitamente retornados', () => {
    linhas.push(mapComissaoLinha({ Vendedor: 10, NomeVendedor: 'XEXEU', AFaturar: 53850.7, PedidosEmAberto: 0 }));
    render(<ComissaoPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.queryByText('Indisponível')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
