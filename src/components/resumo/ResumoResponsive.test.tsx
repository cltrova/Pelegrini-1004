import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ResumoKPIs } from '@/types/resumo';
import { ResumoKPICards } from './ResumoKPICards';
import { ResumoVitalsKPIs } from './ResumoVitalsKPIs';

const kpis: ResumoKPIs = {
  totalAberto: 123456789.9,
  totalRecebido: 98765432.1,
  totalVencido: 45678912.34,
  totalAVencer: 76543210.98,
  totalPedidosEmAberto: 10000000,
  qtdDuplicatasAbertas: 1200,
  qtdDuplicatasPagas: 900,
  qtdDuplicatasVencidas: 300,
  qtdPedidosAbertos: 250,
  qtdClientesInadimplentes: 80,
  ticketMedio: 123456.78,
  diasMedioAtraso: 45,
  taxaInadimplencia: 18.5,
};

describe('Resumo financeiro responsivo', () => {
  it('mantem valores monetarios longos legiveis dentro dos cards', () => {
    const { container } = render(<ResumoKPICards kpis={kpis} />);
    const totalAberto = screen.getByText(/123\.456\.789,90/);

    expect(totalAberto).toHaveClass('pelegrini-responsive-value');
    expect(totalAberto).not.toHaveClass('truncate');
    expect(container.firstElementChild).toHaveClass('pelegrini-kpi-grid');
  });

  it('adapta a carteira completa sem truncar os totalizadores', () => {
    const { container } = render(
      <ResumoVitalsKPIs
        kpis={kpis}
        pdd={{ total: 12345678.9, percentual: 4.2, porFaixa: [] }}
      />,
    );

    const totalCarteira = screen.getByText(/230\.987\.555,42/);
    expect(totalCarteira).toHaveClass('pelegrini-responsive-value');
    expect(totalCarteira).not.toHaveClass('truncate');
    expect(container.querySelectorAll('.pelegrini-responsive-value').length).toBeGreaterThan(4);
  });
});
