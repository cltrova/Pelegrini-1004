import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  EnterpriseBadge,
  EnterpriseDataPanel,
  EnterpriseFilterBar,
  EnterpriseMetricCard,
  EnterpriseMultiSelectFilter,
  EnterprisePageHeader,
  EnterpriseSearchFilter,
  EnterpriseSelectFilter,
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

  it('renders a compact filter bar with active count, results, clear and apply', () => {
    const onClear = vi.fn();
    const onApply = vi.fn();
    render(
      <EnterpriseFilterBar activeCount={2} resultCount={128} onClear={onClear} onApply={onApply} summary="Junho | 2 vendedores">
        <EnterpriseSearchFilter label="Busca" value="abc" onChange={() => undefined} />
      </EnterpriseFilterBar>,
    );

    expect(screen.getByText('2 ativos')).toBeInTheDocument();
    expect(screen.getByText('128 resultados')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /limpar filtros/i }));
    fireEvent.click(screen.getByRole('button', { name: /aplicar filtros/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('renders standard select and multi-select filters with counts', () => {
    render(
      <div>
        <EnterpriseSelectFilter
          label="Status"
          value="aberto"
          options={[{ value: 'aberto', label: 'Aberto' }, { value: 'fechado', label: 'Fechado' }]}
          onChange={() => undefined}
        />
        <EnterpriseMultiSelectFilter
          label="Marca"
          values={['gm', 'bosch']}
          options={[{ value: 'gm', label: 'GM' }, { value: 'bosch', label: 'Bosch' }]}
          onChange={() => undefined}
        />
      </div>,
    );

    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByText('2 selecionados')).toBeInTheDocument();
  });
});
