import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ComissaoPage from './ComissaoPage';

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({ filialAtiva: 'chevrolet' }),
}));

vi.mock('@/hooks/useComissaoVendedores', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/hooks/useComissaoVendedores')>();
  return {
    ...original,
    useComissaoVendedores: () => ({
      data: [],
      isLoading: false,
      isFetching: false,
      error: null,
    }),
  };
});

describe('ComissaoPage', () => {
  it('abre o filtro de operacao fiscal sem valor padrao', () => {
    render(<ComissaoPage />);

    const inicial = screen.getByLabelText('Operação fiscal inicial');
    const final = screen.getByLabelText('Operação fiscal final');

    expect(inicial).toHaveValue('');
    expect(final).toHaveValue('');
  });
});
