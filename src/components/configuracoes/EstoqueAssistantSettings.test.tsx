import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseState = vi.hoisted(() => ({
  prompt: 'Responda de forma objetiva e priorize itens críticos.',
  resolveSave: null as null | (() => void),
  savePromise: Promise.resolve({}),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: (columns: string) => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: columns === 'id' ? { id: 'config-1' } : { custom_prompt: supabaseState.prompt },
          }),
        }),
      }),
      update: () => ({
        eq: () => supabaseState.savePromise,
      }),
    }),
  },
}));

import { EstoqueAssistantSettings } from './EstoqueAssistantSettings';

describe('EstoqueAssistantSettings', () => {
  beforeEach(() => {
    supabaseState.savePromise = new Promise(resolve => {
      supabaseState.resolveSave = () => resolve({});
    });
  });

  it('expõe o carregamento inicial como conteúdo bloqueante', async () => {
    render(<EstoqueAssistantSettings codEmpresaBi="1004" />);

    expect(screen.getByRole('status', { name: 'Carregando configuração do assistente' })).toBeInTheDocument();
    await screen.findByDisplayValue(supabaseState.prompt);
  });

  it('carrega o prompt salvo para a empresa selecionada', async () => {
    render(<EstoqueAssistantSettings codEmpresaBi="1004" />);

    expect(await screen.findByDisplayValue(supabaseState.prompt)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Configuração do Assistente de Estoque' })).toBeInTheDocument();
  });

  it('mantém um nome acessível no botão enquanto salva', async () => {
    render(<EstoqueAssistantSettings codEmpresaBi="1004" />);

    const prompt = await screen.findByLabelText('Instruções personalizadas');
    fireEvent.change(prompt, { target: { value: `${supabaseState.prompt} Seja breve.` } });

    const saveButton = screen.getByRole('button', { name: 'Salvar', exact: true });
    fireEvent.click(saveButton);

    await waitFor(() => expect(saveButton).toHaveAttribute('aria-busy', 'true'));
    expect(saveButton).toHaveAccessibleName('Salvando');
    expect(saveButton).toContainElement(screen.getByTestId('loading-indicator'));

    supabaseState.resolveSave?.();
    await waitFor(() => expect(saveButton).not.toHaveAttribute('aria-busy'));
  });
});
