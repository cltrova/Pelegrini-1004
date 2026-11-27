import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ComposicaoVendasTab } from './ComposicaoVendasTab';
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
});
