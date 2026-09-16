import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AICopilot } from '@/components/comercial/AICopilot';
import AssistenteIAPage from '@/pages/financeiro/AssistenteIAPage';
import { DreAssistant } from './DreAssistant';
import { VariacaoAssistant } from './VariacaoAssistant';

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(() => new Promise(() => undefined)),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke } },
}));

vi.mock('@/contexts/FinanceiroSearchContext', () => ({
  useFinanceiroSearch: () => ({ markSearched: vi.fn() }),
}));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/useDreData', () => ({
  useDreData: () => ({ data: [] }),
  extractFilterOptions: () => ({}),
  calculateIndicators: () => [],
  calculateGroupSummary: () => [],
  filterDreData: () => [],
}));
vi.mock('@/hooks/useVariacaoData', () => ({ useVariacaoData: () => ({ data: [] }) }));
vi.mock('@/components/layout/Header', () => ({ Header: () => null }));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('assistant send action accessibility', () => {
  it('gives every icon-only send action the same stable command name', () => {
    const dre = render(
      <DreAssistant
        contasDespFixas={new Set()}
        contasDespVar={new Set()}
        dreData={[]}
        indicators={[]}
        onUpdateDespFixas={vi.fn()}
        onUpdateDespVar={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Enviar mensagem' })).toHaveAttribute('aria-busy', 'false');
    dre.unmount();

    const variacao = render(
      <VariacaoAssistant
        gruposAtivosOperacionais={new Set()}
        gruposInverterSinal={new Set()}
        onUpdateAtivosOperacionais={vi.fn()}
        onUpdateInverterSinal={vi.fn()}
        variacaoData={[]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Enviar mensagem' })).toHaveAttribute('aria-busy', 'false');
    variacao.unmount();

    const finance = render(<AssistenteIAPage />);
    expect(screen.getByRole('button', { name: 'Enviar mensagem' })).toHaveAttribute('aria-busy', 'false');
    finance.unmount();
  });

  it('keeps the Copilot name stable while its request is busy', async () => {
    render(<AICopilot contexto={{} as never} />);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir copiloto IA' }));
    fireEvent.change(screen.getByPlaceholderText('Pergunte ao copiloto...'), { target: { value: 'Resumo' } });

    const send = screen.getByRole('button', { name: 'Enviar mensagem' });
    expect(send).toHaveAttribute('aria-busy', 'false');
    fireEvent.click(send);
    expect(await screen.findByRole('button', { name: 'Enviar mensagem' })).toHaveAttribute('aria-busy', 'true');
  });
});
