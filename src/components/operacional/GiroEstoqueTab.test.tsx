import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { estoqueFixtureComTresItens, giroFixture } from './estoque/estoqueFixtures';
import { GiroEstoqueTab } from './GiroEstoqueTab';
import type { GiroRecord } from '@/types/estoque';

const filters = {
  periodoMeses: 3,
  statusFilter: [],
  empresas: [],
  marcas: [],
  grupos: [],
  searchTerm: '',
} as const;

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class ResizeObserverMock {
    observe() {}
    disconnect() {}
    unobserve() {}
  });
});

afterAll(() => vi.unstubAllGlobals());

describe('GiroEstoqueTab', () => {
  it('renderiza acao recomendada e tooltip visivel no foco com descricao estavel', () => {
    render(<GiroEstoqueTab estoqueData={estoqueFixtureComTresItens} filters={{ ...filters, statusFilter: [] }} giroData={giroFixture} onStatusFilterChange={vi.fn()} />);

    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Acao recomendada' })).toBeInTheDocument();
    expect(within(table).getAllByText(/Manter|Monitorar|Repor|Revisar excesso/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Regra: sem estoque ou cobertura inferior a 1 mes/i).length).toBeGreaterThan(0);
    const statusHelp = within(table).getAllByRole('button', { name: /Explicar status/i })[0];
    const descriptionId = statusHelp.getAttribute('aria-describedby')!;
    expect(document.getElementById(descriptionId)).toHaveTextContent(/Regra:/i);
    expect(statusHelp.tabIndex).toBe(0);
    fireEvent.focus(statusHelp);
    const visibleStatusHelp = screen.getByTestId(descriptionId.replace(/-description$/, '-tooltip'));
    expect(visibleStatusHelp).toBeVisible();
    expect(visibleStatusHelp).toHaveAttribute('role', 'tooltip');
    expect(visibleStatusHelp).toHaveTextContent(/Regra:/i);
  });

  it('expoe a ordenacao da tabela como controles acessiveis e anuncia a direcao', () => {
    render(<GiroEstoqueTab estoqueData={estoqueFixtureComTresItens} filters={{ ...filters, statusFilter: [] }} giroData={giroFixture} onStatusFilterChange={vi.fn()} />);

    const table = screen.getByRole('table');
    const valueHeader = within(table).getByRole('columnheader', { name: /Valor Estoque/i });
    const stockHeader = within(table).getByRole('columnheader', { name: /^Estoque/i });
    const stockSort = within(stockHeader).getByRole('button', { name: /Ordenar por estoque/i });

    expect(valueHeader).toHaveAttribute('aria-sort', 'descending');
    expect(stockHeader).toHaveAttribute('aria-sort', 'none');
    expect(stockSort.tabIndex).toBe(0);

    fireEvent.click(stockSort);
    expect(stockHeader).toHaveAttribute('aria-sort', 'descending');

    fireEvent.click(stockSort);
    expect(stockHeader).toHaveAttribute('aria-sort', 'ascending');
  });

  it('abre a analise com secoes gerenciais baseadas nos produtos', () => {
    render(<GiroEstoqueTab estoqueData={estoqueFixtureComTresItens} filters={{ ...filters, statusFilter: [] }} giroData={giroFixture} onStatusFilterChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Abrir analise de giro/i }));
    const dialog = screen.getByRole('dialog', { name: 'Analise de giro' });
    expect(within(dialog).getByText('Distribuicao por status')).toBeInTheDocument();
    expect(within(dialog).getByText('Estoque versus vendas')).toBeInTheDocument();
    expect(within(dialog).getByText(/Movimenta..o mensal/i)).toBeInTheDocument();
    expect(within(dialog).getByText('Faixas sem venda')).toBeInTheDocument();
    expect(within(dialog).getByText('Ranking de capital parado')).toBeInTheDocument();
  });

  it('permite filtrar a listagem pelos status exibidos na analise', () => {
    const onStatusFilterChange = vi.fn();
    render(<GiroEstoqueTab estoqueData={estoqueFixtureComTresItens} filters={{ ...filters, statusFilter: [] }} giroData={giroFixture} onStatusFilterChange={onStatusFilterChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Abrir analise de giro/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /Filtrar status/i })[0]);

    expect(onStatusFilterChange).toHaveBeenCalledWith([expect.stringMatching(/atendendo|alerta|faltando|excesso/)]);
  });

  it('usa somente movimentos dos produtos filtrados em toda a analise', () => {
    const zfStock = { ...estoqueFixtureComTresItens[0], cod_produto: 501, produto: 'ITEM ZF', marca: 'ZF' };
    const mwmStock = { ...estoqueFixtureComTresItens[0], cod_produto: 502, produto: 'ITEM MWM EXCLUIDO', marca: 'MWM' };
    const movement = (stock: typeof zfStock, date: string, sales: number): GiroRecord => ({
      ...giroFixture[0],
      cod_produto: stock.cod_produto,
      produto: stock.produto,
      marca: stock.marca,
      empresa: stock.empresa,
      data_movimento: date,
      saida_venda: sales,
      quantidade_movimentada: sales,
      tipo_movimento: 'Venda',
    });
    const movements = [
      movement(zfStock, '2026-06-01', 10),
      movement(mwmStock, '2026-06-01', 300),
      movement(mwmStock, '2026-07-01', 200),
      movement(mwmStock, '2026-08-01', 10),
    ];

    render(
      <GiroEstoqueTab
        estoqueData={[zfStock, mwmStock]}
        filters={{ ...filters, statusFilter: [], marcas: ['ZF'] }}
        giroData={movements}
        onStatusFilterChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Abrir analise de giro/i }));
    const dialog = screen.getByRole('dialog', { name: 'Analise de giro' });
    expect(within(dialog).getByText(/Movimentacao filtrada: 10 vendas/i)).toBeInTheDocument();
    expect(within(dialog).queryByText('ITEM MWM EXCLUIDO')).not.toBeInTheDocument();
  });

  it('mantem produtos e tendencias separados quando empresas compartilham o mesmo codigo', () => {
    const stockA = { ...estoqueFixtureComTresItens[0], cod_produto: 909, produto: 'ITEM EMPRESA A', empresa: 'EMPRESA A', marca: 'ZF' };
    const stockB = { ...estoqueFixtureComTresItens[0], cod_empresa_bi: 10041, cod_produto: 909, produto: 'ITEM EMPRESA B', empresa: 'EMPRESA B', marca: 'ZF', quantidade_estoque: 20 };
    const movement = (stock: typeof stockA, date: string, sales: number): GiroRecord => ({
      ...giroFixture[0],
      cod_empresa_bi: stock.cod_empresa_bi,
      cod_empresa: stock.cod_empresa,
      cod_produto: stock.cod_produto,
      produto: stock.produto,
      empresa: stock.empresa,
      marca: stock.marca,
      quantidade_estoque: stock.quantidade_estoque,
      data_movimento: date,
      saida_venda: sales,
      quantidade_movimentada: sales,
      tipo_movimento: 'Venda',
    });
    const movements = [
      movement(stockA, '2026-06-01', 300), movement(stockA, '2026-07-01', 200), movement(stockA, '2026-08-01', 10),
      movement(stockB, '2026-06-01', 10), movement(stockB, '2026-07-01', 20), movement(stockB, '2026-08-01', 31),
    ];
    const { rerender } = render(
      <GiroEstoqueTab estoqueData={[stockA, stockB]} filters={{ ...filters, statusFilter: [] }} giroData={movements} onStatusFilterChange={vi.fn()} />,
    );

    const allRows = screen.getAllByRole('row');
    const rowA = allRows.find(row => within(row).queryByText('ITEM EMPRESA A'))!;
    const rowB = allRows.find(row => within(row).queryByText('ITEM EMPRESA B'))!;
    expect(within(rowA).getByText('510')).toBeInTheDocument();
    expect(within(rowA).getByLabelText(/Tendencia de queda/i)).toBeInTheDocument();
    expect(within(rowB).getByText('61')).toBeInTheDocument();
    expect(within(rowB).getByLabelText(/Tendencia de crescimento/i)).toBeInTheDocument();

    rerender(
      <GiroEstoqueTab estoqueData={[stockA, stockB]} filters={{ ...filters, statusFilter: [], empresas: ['EMPRESA B'] }} giroData={movements} onStatusFilterChange={vi.fn()} />,
    );
    expect(within(screen.getByRole('table')).queryByText('ITEM EMPRESA A')).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('ITEM EMPRESA B')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Abrir analise de giro/i }));
    expect(screen.getByText(/Movimentacao filtrada: 61 vendas/i)).toBeInTheDocument();
  });

  it('soma saldos de localizacoes do mesmo produto e vincula movimentos pelo codigo BI', () => {
    const base = estoqueFixtureComTresItens[0];
    const locations = [
      { ...base, cod_empresa_bi: 1004, cod_empresa: 1, empresa: 'CT MATRIZ', cod_produto: 808, produto: 'ITEM LOCALIZADO', localizacao_produto: 'A-01', quantidade_estoque: 4, valor_estoque: 400 },
      { ...base, cod_empresa_bi: 1004, cod_empresa: 1, empresa: 'Casa da Transmissao', cod_produto: 808, produto: 'ITEM LOCALIZADO', localizacao_produto: 'B-02', quantidade_estoque: 6, valor_estoque: 600 },
    ];
    const movements = [{
      ...giroFixture[0], cod_empresa_bi: 1004, cod_empresa: 77, empresa: 'CASA DA TRANSMISSAO LTDA', cod_produto: 808,
      produto: 'ITEM LOCALIZADO', data_movimento: '2026-09-01', saida_venda: 5, quantidade_movimentada: 5, tipo_movimento: 'Venda',
    }];

    render(<GiroEstoqueTab estoqueData={locations} filters={{ ...filters, statusFilter: [] }} giroData={movements} onStatusFilterChange={vi.fn()} />);

    const row = screen.getAllByRole('row').find(candidate => within(candidate).queryByText('ITEM LOCALIZADO'))!;
    expect(within(row).getByText('10')).toBeInTheDocument();
    expect(within(row).getByText('5')).toBeInTheDocument();
  });

  it('usa a filial ativa para vincular movimentos que chegam sem codigo BI', () => {
    const stock = { ...estoqueFixtureComTresItens[0], cod_empresa_bi: 1004, cod_empresa: 1, cod_produto: 707, produto: 'ITEM SEM CODIGO NO GIRO' };
    const movement = {
      ...giroFixture[0],
      cod_empresa_bi: 0,
      cod_empresa: 99,
      cod_produto: 707,
      produto: 'ITEM SEM CODIGO NO GIRO',
      data_movimento: '2026-09-01',
      saida_venda: 7,
      quantidade_movimentada: 7,
      tipo_movimento: 'Venda',
    } as GiroRecord;

    render(
      <GiroEstoqueTab
        activeCompanyCode={1004}
        estoqueData={[stock]}
        filters={{ ...filters, statusFilter: [] }}
        giroData={[movement]}
        onStatusFilterChange={vi.fn()}
      />,
    );

    const productRows = screen.getAllByRole('row').filter(row => within(row).queryByText('ITEM SEM CODIGO NO GIRO'));
    expect(productRows).toHaveLength(1);
    expect(within(productRows[0]).getByText('7')).toBeInTheDocument();
  });

  it('exibe data de venda ausente como desconhecida', () => {
    const stock = { ...estoqueFixtureComTresItens[0], cod_produto: 818, produto: 'SEM DATA', data_ultima_venda: null };
    render(<GiroEstoqueTab estoqueData={[stock]} filters={{ ...filters, statusFilter: [] }} giroData={[]} onStatusFilterChange={vi.fn()} />);
    const row = screen.getAllByRole('row').find(candidate => within(candidate).queryByText('SEM DATA'))!;
    expect(within(row).getByText('Desconhecido')).toBeInTheDocument();
    expect(within(row).queryByText('9999d')).not.toBeInTheDocument();
  });

  it('mostra estados vazios para tabela, graficos e rankings', () => {
    render(<GiroEstoqueTab estoqueData={[]} filters={{ ...filters, statusFilter: [] }} giroData={[]} onStatusFilterChange={vi.fn()} />);

    expect(screen.getByText('Nenhum produto corresponde aos filtros.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Abrir analise de giro/i }));
    const dialog = screen.getByRole('dialog', { name: 'Analise de giro' });
    expect(within(dialog).getByText('Sem dados para distribuicao por status.')).toBeInTheDocument();
    expect(within(dialog).getByText('Sem dados para comparar estoque e vendas.')).toBeInTheDocument();
    expect(within(dialog).getByText('Sem movimentacoes no periodo filtrado.')).toBeInTheDocument();
    expect(within(dialog).getByText('Sem dados de tempo sem venda.')).toBeInTheDocument();
    expect(within(dialog).getByText('Nenhum capital parado identificado.')).toBeInTheDocument();
    expect(within(dialog).getByText('Nenhum produto para o ranking de giro.')).toBeInTheDocument();
    expect(within(dialog).getByText('Nenhuma venda conhecida para o ranking.')).toBeInTheDocument();
  });
});
