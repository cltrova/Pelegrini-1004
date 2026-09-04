import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { GiroProductSummary, GiroStatus } from '@/types/estoque';

import { GiroManagementPanel } from './GiroManagementPanel';

const products = [
  { cod_produto: 1, produto: 'Atendido', status: 'atendendo', quantidade_estoque: 10, valor_estoque: 100, total_vendas: 10, cobertura_meses: 1, dias_sem_venda: 10 },
  { cod_produto: 2, produto: 'Alerta', status: 'alerta', quantidade_estoque: 5, valor_estoque: 200, total_vendas: 5, cobertura_meses: 2, dias_sem_venda: 20 },
  { cod_produto: 3, produto: 'Ruptura', status: 'faltando', quantidade_estoque: 0, valor_estoque: 0, total_vendas: 5, cobertura_meses: 0, dias_sem_venda: 30 },
  { cod_produto: 4, produto: 'Excesso', status: 'excesso', quantidade_estoque: 50, valor_estoque: 400, total_vendas: 1, cobertura_meses: 8, dias_sem_venda: 100 },
].map(item => ({
  marca: 'Marca', grupo: 'Grupo', empresa: 'CT', total_compras: 0, giro: 1, ultima_venda: null,
  total_saida_venda: 0, total_entrada_compra: 0, total_saida_transferencia: 0, total_entrada_transferencia: 0,
  ...item,
})) as GiroProductSummary[];

describe('GiroManagementPanel', () => {
  it('usa o mesmo padrao responsivo dos totalizadores da central', () => {
    const { container } = render(
      <GiroManagementPanel activeStatuses={[]} onStatusFilterChange={vi.fn()} products={products} />,
    );

    const region = screen.getByRole('region', { name: 'Indicadores gerenciais de giro' });
    expect(region).toHaveClass(
      'grid-cols-1',
      'min-[480px]:grid-cols-2',
      'lg:grid-cols-3',
      'xl:grid-cols-6',
      'gap-2',
    );
    container.querySelectorAll('[data-stock-summary]').forEach((card) => {
      expect(card).toHaveClass('min-w-0', 'min-h-16', 'rounded-md', 'border', 'bg-card');
      expect(card.querySelector('.pelegrini-responsive-value')).toHaveAttribute('data-size', 'md');
    });
  });

  it('aplica e remove o filtro de status pelos KPIs', () => {
    const onStatusFilterChange = vi.fn();
    const { rerender } = render(
      <GiroManagementPanel activeStatuses={[]} onStatusFilterChange={onStatusFilterChange} products={products} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Alerta: 1/i }));
    expect(onStatusFilterChange).toHaveBeenLastCalledWith(['alerta']);

    rerender(<GiroManagementPanel activeStatuses={['alerta']} onStatusFilterChange={onStatusFilterChange} products={products} />);
    fireEvent.click(screen.getByRole('button', { name: /Alerta: 1/i }));
    expect(onStatusFilterChange).toHaveBeenLastCalledWith([]);
  });

  it('mantem capital e cobertura informativos e explica a estimativa', () => {
    render(<GiroManagementPanel activeStatuses={[] as GiroStatus[]} onStatusFilterChange={vi.fn()} products={products} />);

    const region = screen.getByRole('region', { name: 'Indicadores gerenciais de giro' });
    expect(within(region).getByText('Capital parado')).toBeInTheDocument();
    expect(within(region).getByText('Cobertura media')).toBeInTheDocument();
    expect(within(region).queryByRole('button', { name: /Capital parado/i })).not.toBeInTheDocument();
    expect(screen.getByText(/excesso ou com estoque e sem venda ha mais de 90 dias/i)).toBeInTheDocument();
  });

  it('associa cada controle ao texto de ajuda por aria-describedby', () => {
    render(<GiroManagementPanel activeStatuses={[]} onStatusFilterChange={vi.fn()} products={products} />);

    const alertButton = screen.getByRole('button', { name: /Alerta: 1/i });
    const helpId = alertButton.getAttribute('aria-describedby');
    expect(helpId).toBeTruthy();
    expect(document.getElementById(helpId!)).toHaveAttribute('role', 'tooltip');
    expect(document.getElementById(helpId!)).toHaveTextContent(/cobertura entre 1 e 2 meses/i);
  });
});
