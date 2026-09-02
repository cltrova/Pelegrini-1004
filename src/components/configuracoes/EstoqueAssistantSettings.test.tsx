import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const supabaseState = vi.hoisted(() => ({
  prompt: 'Responda de forma objetiva e priorize itens críticos.',
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { custom_prompt: supabaseState.prompt } }),
        }),
      }),
    }),
  },
}));

import { EstoqueAssistantSettings } from './EstoqueAssistantSettings';

describe('EstoqueAssistantSettings', () => {
  it('carrega o prompt salvo para a empresa selecionada', async () => {
    render(<EstoqueAssistantSettings codEmpresaBi="1004" />);

    expect(await screen.findByDisplayValue(supabaseState.prompt)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Configuração do Assistente de Estoque' })).toBeInTheDocument();
  });
});
