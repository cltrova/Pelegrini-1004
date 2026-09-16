import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const reportState = vi.hoisted(() => ({
  analyze: vi.fn(() => new Promise(() => undefined)),
}));

vi.mock('@/hooks/useWhatsappReports', () => ({
  useWhatsappClientReports: () => ({
    data: [{
      contactId: 'contact-1',
      contactName: 'Cliente Teste',
      phoneNumber: '5511999999999',
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

describe('ClientsReportTab', () => {
  it('reserva o mesmo slot e largura para Avaliar e Analisando no desktop e mobile', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ClientsReportTab />
      </QueryClientProvider>,
    );

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
