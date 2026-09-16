import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PremiumTopProdutos } from './PremiumTopProdutos';

describe('PremiumTopProdutos em devolucoes', () => {
  it('usa linguagem de devolucao e nao exibe margem comercial', () => {
    render(
      <PremiumTopProdutos
        mode="devolucoes"
        produtos={[{
          cod_produto: '10',
          descricao: 'Produto devolvido',
          marca: 'EATON',
          quantidade: 2,
          faturamento: 150,
          pedidos: 1,
          participacao: 100,
        }]}
        resumoVendas={[{
          data: '2026-09-10',
          num_nf: '123',
          cod_produto: '10',
          descricao: 'Produto devolvido',
          marca: 'EATON',
          cliente_razao: 'Cliente teste',
          receita: -150,
          custo: -100,
          lucro: -50,
          margem: -33.33,
          tipo: 'DEVOLUCAO',
        }]}
        selectedMarca={null}
        onSelectMarca={vi.fn()}
        showInsights={false}
      />,
    );

    expect(screen.getByText('Ranking de Devoluções')).toBeInTheDocument();
    expect(screen.getByText('Qtd devolvida')).toBeInTheDocument();
    expect(screen.getByText('Valor devolvido')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Produto devolvido/ })[0]);
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText('Valor devolvido')).toBeInTheDocument();
    expect(within(dialog).getByText('Quantidade devolvida')).toBeInTheDocument();
    expect(within(dialog).queryByText('Margem')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Rentabilidade')).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/-R\$/)).not.toBeInTheDocument();
  });
});
