import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PremiumMarcasView } from './PremiumMarcasView';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke } },
}));

const marcas = [
  {
    marca: 'EATON',
    faturamento: 80_000,
    custo: 50_000,
    lucro: 30_000,
    margem: 37.5,
    quantidade: 8,
    produtos: 4,
    participacao: 80,
  },
];

describe('PremiumMarcasView embutida', () => {
  it('nao monta insights nem dispara IA quando desativada', () => {
    const { container } = render(
      <PremiumMarcasView
        porMarca={marcas}
        selectedMarca={null}
        onSelectMarca={vi.fn()}
        showInsights={false}
        embedded
      />,
    );

    expect(screen.queryByText(/Insights de IA/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ranking de Marcas' })).not.toBeInTheDocument();
    expect(container.querySelector('.premium-card')).not.toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
    const table = screen.getByRole('table');
    expect(table.parentElement).not.toHaveClass('max-h-[600px]', 'overflow-y-auto');
    expect(within(table).getByRole('columnheader', { name: 'Marca' })).toHaveClass('commercial-products-primary-column', 'text-left');
    const marcaCell = within(table).getByText('EATON').closest('td');
    expect(marcaCell).toHaveClass('commercial-products-primary-column', 'text-left');
    expect(marcaCell?.querySelector('[style*="background-color"]')).not.toBeInTheDocument();
  });

  it('permite selecionar a marca pelo teclado na tabela', () => {
    const onSelectMarca = vi.fn();
    render(
      <PremiumMarcasView
        porMarca={marcas}
        selectedMarca={null}
        onSelectMarca={onSelectMarca}
        showInsights={false}
        embedded
      />,
    );

    fireEvent.keyDown(screen.getByRole('row', { name: /Filtrar pela marca EATON/i }), { key: 'Enter' });
    expect(onSelectMarca).toHaveBeenCalledWith('EATON');
  });

  it('mantem os valores de SKUs legiveis no tema claro', () => {
    render(
      <PremiumMarcasView
        porMarca={marcas}
        selectedMarca={null}
        onSelectMarca={vi.fn()}
        showInsights={false}
        embedded
      />,
    );

    const skuCell = screen.getByText('4').closest('td');
    expect(skuCell).toHaveClass('text-foreground/80', 'dark:text-muted-foreground');
  });

  it('mostra um estado vazio quando nao existem marcas', () => {
    render(
      <PremiumMarcasView
        porMarca={[]}
        selectedMarca={null}
        onSelectMarca={vi.fn()}
        showInsights={false}
        embedded
      />,
    );

    expect(screen.getByText('Nenhuma marca encontrada no recorte atual.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('mantém o fallback local visível durante a análise remota', async () => {
    invoke.mockReturnValueOnce(new Promise(() => undefined));

    const { container } = render(
      <PremiumMarcasView
        porMarca={marcas}
        selectedMarca={null}
        onSelectMarca={vi.fn()}
        showInsights
      />,
    );

    expect(await screen.findByText('Líder receita')).toBeInTheDocument();
    expect(await screen.findByText('Analisando...')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Carregando análises por marca' })).not.toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
  });

  it('usa o estado compartilhado quando não existe fallback local válido', async () => {
    invoke.mockReturnValueOnce(new Promise(() => undefined));

    render(
      <PremiumMarcasView
        porMarca={marcas}
        selectedMarca="MARCA INEXISTENTE"
        onSelectMarca={vi.fn()}
        showInsights
      />,
    );

    expect(await screen.findByRole('status', { name: 'Carregando análises por marca' })).toBeInTheDocument();
    expect(screen.queryByText('Líder receita')).not.toBeInTheDocument();
  });
});
