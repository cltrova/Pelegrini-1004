import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getCorParticipacaoVendedor, VisaoGeralRapida1004 } from './VisaoGeralRapida1004';

vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: () => ({ codEmpresaAtiva: '1004', empresa: { nome: 'Casa da Transmissao' } }),
}));
vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({ filialAtiva: 'transmissao', filialNome: 'Casa da Transmissao' }),
}));
vi.mock('./RankingVendedoresChart', () => ({
  RankingVendedoresChart: () => React.createElement('div', null, 'Ranking de vendedores'),
}));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  ComposedChart: () => React.createElement('div'),
  Area: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
  BarChart: () => React.createElement('div'),
  Bar: () => null,
  PieChart: () => React.createElement('div'),
  Pie: () => React.createElement('div'),
  Cell: () => null,
  Legend: () => null,
  LineChart: () => React.createElement('div'),
}));

describe('getCorParticipacaoVendedor', () => {
  it('usa rosa de alto contraste para Elielton em qualquer posicao', () => {
    expect(getCorParticipacaoVendedor('ELIELTON', 0)).toBe('#db2777');
    expect(getCorParticipacaoVendedor('Elielton', 5)).toBe('#db2777');
  });
});

describe('VisaoGeralRapida1004 dashboard structure', () => {
  const props = {
    vendedoresComMeta: [{ codigo: 1, nome: 'MARIA', faturamentoMesAtual: 1000, metaMensal: 2000 }],
    kpisGerais: {
      totalFaturado: 1000,
      totalMeta: 2000,
      totalDevolucoes: 0,
      qtdPedidos: 1,
      clientesAtendidos: 1,
      acimaMeta: 0,
      proximoMeta: 0,
      abaixoMeta: 1,
    },
    pedidos: [{
      vendedor_codigo: 1,
      vendedor_nome: 'MARIA',
      cliente_codigo: 10,
      data_faturamento: '2026-06-05',
      valor_liquido_final: 1000,
      tipo: 'PEDIDO',
    }],
    evolucaoDiaria: [],
    evolucaoMensal: [],
    periodoFiltros: { ano: 2026, mes: 6 },
    diasUteisNoMes: 22,
    diasUteisDecorridos: 5,
  };

  it('marca indicadores, paineis e graficos com classes semanticas', () => {
    const { container } = render(React.createElement(VisaoGeralRapida1004, props));

    expect(screen.getByLabelText('Indicadores do dashboard comercial')).toHaveClass('commercial-metric-strip');
    expect(container.querySelector('.commercial-dashboard-panel')).toBeInTheDocument();
    expect(container.querySelector('.commercial-chart-frame')).toBeInTheDocument();
  });

  it('fecha o detalhe do heatmap ao retirar o mouse', () => {
    render(React.createElement(VisaoGeralRapida1004, props));
    const cell = screen.getByRole('button', { name: /^MARIA, dia 5, R\$/ });

    fireEvent.mouseEnter(cell);
    expect(screen.getByText('MARIA - dia 5')).toBeInTheDocument();

    fireEvent.mouseLeave(cell);
    expect(screen.queryByText('MARIA - dia 5')).not.toBeInTheDocument();
    expect(screen.getByText('Passe nos quadrados para ver o dia')).toBeInTheDocument();
  });
});
