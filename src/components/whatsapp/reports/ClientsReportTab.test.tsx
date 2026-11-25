import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const reportState = vi.hoisted(() => ({
  analyze: vi.fn(() => new Promise(() => undefined)),
  phoneNumber: '5511999999999',
}));

vi.mock('@/hooks/useWhatsappReports', () => ({
  useWhatsappClientReports: () => ({
    data: [{
      contactId: 'contact-1',
      contactName: 'Cliente Teste',
      phoneNumber: reportState.phoneNumber,
      conversationsCount: 1,
      lastContact: '2026-09-16T12:00:00.000Z',
      sentiment: 'neutral',
      satisfactionLevel: 'neutral',
      topics: [],
      resolutionStatus: 'pending',
      latestConversationId: 'conversation-1',
      hasAnalysis: false,
      summary: null,
    }],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useWhatsappData', () => ({
  useAnalyzeSentiment: () => ({ mutateAsync: reportState.analyze }),
}));

import { ClientsReportTab } from './ClientsReportTab';

function renderReport(phoneNumber = '5511999999999') {
  reportState.phoneNumber = phoneNumber;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <ClientsReportTab />
    </QueryClientProvider>,
  );
}

describe('ClientsReportTab', () => {
  it.each([
    ['+55 34 99999-1234', '(34) 99999-1234', '34999991234'],
    ['5532101234', '(55) 3210-1234', '5532101234'],
    ['+1 202 555 0100', '+1 202 555 0100', '12025550100'],
  ])('exibe e permite buscar o telefone %s na tabela e no celular', (telefone, exibicao, digitos) => {
    renderReport(telefone);
    expect(screen.getAllByText(exibicao)).toHaveLength(2);

    const busca = screen.getByRole('textbox');
    fireEvent.change(busca, { target: { value: exibicao } });
    expect(screen.getAllByText(exibicao)).toHaveLength(2);
    fireEvent.change(busca, { target: { value: digitos } });
    expect(screen.getAllByText(exibicao)).toHaveLength(2);
  });

  it('reserva o mesmo slot e largura para Avaliar e Analisando no desktop e mobile', () => {
    renderReport();

    const idleButtons = screen.getAllByRole('button', { name: 'Avaliar' });
    expect(idleButtons).toHaveLength(2);
    idleButtons.forEach(button => {
      expect(button).toHaveClass('min-w-[7.5rem]');
      expect(button.querySelector('span')).toHaveClass('inline-flex', 'h-4', 'w-4');
    });

    fireEvent.click(idleButtons[0]);

    const busyButtons = screen.getAllByRole('button', { name: 'Analisando' });
    busyButtons.forEach(button => {
      expect(button).toHaveClass('min-w-[7.5rem]');
      expect(button.querySelector('span')).toHaveClass('inline-flex', 'h-4', 'w-4');
    });
  });
});
