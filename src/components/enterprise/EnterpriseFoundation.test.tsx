import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  EnterpriseBadge,
  EnterpriseDataPanel,
  EnterpriseMetricCard,
  EnterprisePageHeader,
  EnterpriseTable,
  EnterpriseTbody,
  EnterpriseTd,
  EnterpriseTh,
  EnterpriseThead,
  EnterpriseTr,
  VarianceIndicator,
} from './index';

describe('enterprise visual foundation', () => {
  it('renders a compact page header with metadata and actions', () => {
    render(
      <EnterprisePageHeader
        title="Resumo Financeiro"
        subtitle="Liquidez e contas a receber"
        metadata={<span>Set/2026</span>}
        actions={<button type="button">Atualizar</button>}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Resumo Financeiro' })).toBeInTheDocument();
    expect(screen.getByText('Liquidez e contas a receber')).toBeInTheDocument();
    expect(screen.getByText('Set/2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atualizar' })).toBeInTheDocument();
  });

  it('keeps metric cards dense and contextual', () => {
    render(
      <EnterpriseMetricCard
        label="Faturamento"
        value="R$ 428.540"
        context="Faturamento no periodo"
        comparison={<VarianceIndicator value={8.4} label="vs periodo anterior" />}
        target="82% da meta mensal"
      />,
    );

    const card = screen.getByTestId('enterprise-metric-card');
    expect(card).toHaveClass('rounded-lg', 'border');
    expect(card).not.toHaveClass('rounded-2xl');
    expect(screen.getByText('82% da meta mensal')).toBeInTheDocument();
  });

  it('renders neutral panels without nested decorative card classes', () => {
    render(<EnterpriseDataPanel title="Evolucao"><div>Grafico</div></EnterpriseDataPanel>);

    const panel = screen.getByTestId('enterprise-data-panel');
    expect(panel).toHaveClass('min-w-0', 'rounded-lg', 'border');
    expect(panel).not.toHaveClass('premium-card');
    expect(screen.getByText('Grafico')).toBeInTheDocument();
  });

  it('exposes dense numeric table primitives', () => {
    render(
      <EnterpriseTable>
        <EnterpriseThead>
          <EnterpriseTr>
            <EnterpriseTh>Cliente</EnterpriseTh>
            <EnterpriseTh numeric>Valor</EnterpriseTh>
          </EnterpriseTr>
        </EnterpriseThead>
        <EnterpriseTbody>
          <EnterpriseTr>
            <EnterpriseTd>Cliente A</EnterpriseTd>
            <EnterpriseTd numeric>R$ 1.200,00</EnterpriseTd>
          </EnterpriseTr>
        </EnterpriseTbody>
      </EnterpriseTable>,
    );

    expect(screen.getByText('Valor')).toHaveClass('text-right', 'tabular-nums');
    expect(screen.getByText('R$ 1.200,00')).toHaveClass('text-right', 'tabular-nums');
  });

  it('renders restrained badges and variance indicators', () => {
    render(
      <>
        <EnterpriseBadge tone="warning">A vencer</EnterpriseBadge>
        <VarianceIndicator value={-3.2} label="vs meta" />
      </>,
    );

    expect(screen.getByText('A vencer')).toHaveClass('rounded-md');
    expect(screen.getByText('-3,2%')).toBeInTheDocument();
    expect(screen.getByText('vs meta')).toBeInTheDocument();
  });
});
