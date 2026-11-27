import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
    },
    pedidos: [{
      vendedor_codigo: 1,
      vendedor_nome: 'MARIA',
      cliente_codigo: 10,
      data_faturamento: '2026-06-05',
      valor_liquido_final: 1000,
      tipo: 'PEDIDO' as const,
    }],
    periodoFiltros: { ano: 2026, mes: 6 },
    diasUteisNoMes: 22,
    diasUteisDecorridos: 5,
  };

  it('marca indicadores, paineis e graficos com classes semanticas', () => {
    const { container } = render(React.createElement(VisaoGeralRapida1004, props));

    expect(screen.getByLabelText('Indicadores do dashboard comercial')).toHaveClass('commercial-metric-strip');
    expect(within(screen.getByRole('region', { name: 'Gráfico de ranking de vendedores' })).getByText('Ranking de vendedores')).toBeVisible();
    expect(container.querySelector('.commercial-dashboard-panel')).toBeInTheDocument();
    expect(container.querySelector('.commercial-chart-frame')).toBeInTheDocument();
  });

  it('filtra o ranking pela situação da meta e abre o vendedor da lista', () => {
    const onDetalheVendedor = vi.fn();
    const ana = { codigo: 2, nome: 'ANA', faturamentoMesAtual: 3200, metaMensal: 3000 };
    render(React.createElement(VisaoGeralRapida1004, {
      ...props,
      vendedoresComMeta: [...props.vendedoresComMeta, ana],
      kpisGerais: { ...props.kpisGerais, totalFaturado: 4200, totalMeta: 5000 },
      onDetalheVendedor,
    }));

    const ranking = within(screen.getByRole('region', { name: 'Metas por vendedor' }));
    expect(ranking.getByText('R$ 3.200,00')).toBeVisible();
    const risk = screen.getByRole('button', { name: /Abaixo da meta/ });
    fireEvent.click(risk);
    expect(risk).toHaveAttribute('aria-pressed', 'true');
    expect(ranking.queryByText('ANA')).not.toBeInTheDocument();
    fireEvent.click(ranking.getByRole('button', { name: 'Ver detalhes de MARIA no ranking' }));
    expect(onDetalheVendedor).toHaveBeenCalledWith(props.vendedoresComMeta[0], 2);
    fireEvent.click(risk);
    expect(ranking.getByText('ANA')).toBeInTheDocument();
  });

  it('cobre a ausência de meta e de vendedores sem exibir percentuais fictícios', () => {
    render(React.createElement(VisaoGeralRapida1004, {
      ...props,
      vendedoresComMeta: [],
      pedidos: [],
      kpisGerais: {},
    }));

    expect(within(screen.getByRole('region', { name: 'Ritmo da meta' })).getByText('Sem meta cadastrada')).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'Equipe por meta' })).getByText('Nenhum vendedor com meta no período.')).toBeVisible();
  });

  it('fecha o detalhe do heatmap ao retirar o mouse', () => {
    render(React.createElement(VisaoGeralRapida1004, props));
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Mapa diário' }), { button: 0 });
    const cell = screen.getByRole('button', { name: /^MARIA, dia 5, R\$/ });

    fireEvent.mouseEnter(cell);
    expect(screen.getByText('MARIA - dia 5')).toBeInTheDocument();

    fireEvent.mouseLeave(cell);
    expect(screen.queryByText('MARIA - dia 5')).not.toBeInTheDocument();
    expect(screen.getByText('Selecione um dia para ver o faturamento')).toBeInTheDocument();
  });

  it('mantém o dia escolhido no mapa e permite abrir os detalhes pela participação', () => {
    const onDetalheVendedor = vi.fn();
    render(React.createElement(VisaoGeralRapida1004, { ...props, onDetalheVendedor }));

    expect(screen.getByRole('tab', { name: 'Evolução' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Mapa diário' }), { button: 0 });
    const day = screen.getByRole('button', { name: /^MARIA, dia 5, R\$/ });
    fireEvent.click(day);
    fireEvent.mouseLeave(day);
    expect(day).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('MARIA - dia 5')).toBeVisible();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Participação' }), { button: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir detalhes de MARIA' }));
    expect(onDetalheVendedor).toHaveBeenCalledWith(props.vendedoresComMeta[0], 1);
  });
});
