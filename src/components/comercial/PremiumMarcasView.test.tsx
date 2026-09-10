import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(screen.getByRole('table').parentElement).not.toHaveClass('max-h-[600px]', 'overflow-y-auto');
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
});
