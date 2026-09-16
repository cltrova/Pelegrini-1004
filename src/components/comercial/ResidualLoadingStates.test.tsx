import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ComposicaoVendasTab } from './ComposicaoVendasTab';
import { InsightsIATab } from './InsightsIATab';
import { RepresentatividadeMarcasList } from './RepresentatividadeMarcasList';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(() => new Promise(() => undefined)),
    },
  },
}));

describe('residual commercial loading states', () => {
  it('uses the shared content loader for the sales composition region', () => {
    render(<ComposicaoVendasTab produtos={[]} isLoading />);

    const status = screen.getByRole('status', { name: 'Carregando composicao de vendas' });
    expect(within(status).getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.queryByText('Carregando composição…')).not.toBeInTheDocument();
  });

  it('uses the shared content loader for the brand representation region', () => {
    render(<RepresentatividadeMarcasList marcas={[]} isLoading />);

    const status = screen.getByRole('status', { name: 'Carregando representatividade de marcas' });
    expect(within(status).getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.queryByText('Carregando marcas...')).not.toBeInTheDocument();
  });

  it('uses shared loading primitives for initial and refresh insight requests', () => {
    render(<InsightsIATab vendedores={[]} kpis={{}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Gerar análises' }));

    const status = screen.getByRole('status', { name: 'Carregando análises comerciais' });
    expect(within(status).getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.queryByText('Analisando dados comerciais...')).not.toBeInTheDocument();
  });
});
