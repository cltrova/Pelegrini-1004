import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mapComissaoLinha, type ComissaoLinha } from '@/hooks/useComissaoVendedores';
import ComissaoPage from './ComissaoPage';

const linhas = vi.hoisted(() => [] as ComissaoLinha[]);
const queryState = vi.hoisted(() => ({
  isLoading: false,
  isFetching: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({ filialAtiva: 'chevrolet' }),
}));

vi.mock('@/hooks/useComissaoVendedores', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/hooks/useComissaoVendedores')>();
  return {
    ...original,
    useComissaoVendedores: () => ({
      data: linhas,
      ...queryState,
    }),
  };
});

describe('ComissaoPage', () => {
  beforeEach(() => {
    linhas.length = 0;
    queryState.isLoading = false;
    queryState.isFetching = false;
    queryState.error = null;
    queryState.refetch.mockReset();
  });

  it('abre o filtro de operacao fiscal com a faixa padrao', () => {
    render(<ComissaoPage />);

    const maisFiltros = screen.getByRole('button', { name: 'Mais filtros' });
    fireEvent.click(maisFiltros);

    try {
      const inicial = screen.getByLabelText('Operação fiscal inicial');
      const final = screen.getByLabelText('Operação fiscal final');

      expect(inicial).toHaveValue('0');
      expect(final).toHaveValue('62');
      expect(screen.getByLabelText('Código da meta')).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Deduzir devolução' })).toBeInTheDocument();
      expect(screen.getByLabelText('Filtros avançados de comissão')).toHaveClass('max-h-[calc(100dvh-2rem)]', 'overflow-y-auto');
    } finally {
      fireEvent.keyDown(screen.getByLabelText('Filtros avançados de comissão'), { key: 'Escape' });
    }

    expect(screen.queryByLabelText('Filtros avançados de comissão')).not.toBeInTheDocument();
  });

  it('compoe a mesa compacta com os filtros principais visiveis', () => {
    render(<ComissaoPage />);

    expect(screen.getByRole('main')).toHaveClass('comercial-compact-page', 'comissao-page');
    expect(screen.getByLabelText('Filtros de comissão')).toHaveAttribute('data-density', 'compact');
    expect(screen.queryByText(/Metas e comissão de vendedores/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Operação fiscal inicial')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mais filtros' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeInTheDocument();
    expect(screen.getByTestId('comissao-vendedor-compact')).toHaveClass('[&>div>button]:h-9');
  });

  it('apresenta falha de carregamento sem mensagem tecnica e permite tentar novamente', () => {
    queryState.error = new DOMException('The user aborted a request.', 'AbortError');
    render(<ComissaoPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('A consulta demorou mais que o esperado');
    expect(screen.getByRole('alert')).not.toHaveTextContent('The user aborted a request');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(queryState.refetch).toHaveBeenCalledOnce();
  });

  it('mantem o estado vazio compacto depois de uma consulta sem resultados', () => {
    render(<ComissaoPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(screen.getByTestId('comissao-empty-state')).toHaveClass('min-h-44');
    expect(screen.getByTestId('comissao-results')).not.toHaveClass('flex-1');
  });

  it('mostra indicadores compactos depois da consulta e preserva zero monetario', () => {
    linhas.push(mapComissaoLinha({ Vendedor: 10, NomeVendedor: 'XEXEU', PedidosEmAberto: 0 }));
    render(<ComissaoPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    const indicadores = screen.getByLabelText('Indicadores comerciais');
    expect(indicadores).toHaveTextContent('Objetivo mensal');
    expect(indicadores).toHaveTextContent('Faturado até hoje');
    expect(indicadores).toHaveTextContent('Valor total');
    expect(indicadores).toHaveTextContent('Pedidos em aberto');
    expect(indicadores).toHaveTextContent('R$ 0,00');
    expect(indicadores).not.toHaveTextContent('Indisponível');
  });

  it('calcula o valor total como faturado mais pedidos em aberto', () => {
    linhas.push(mapComissaoLinha({
      Vendedor: 10,
      NomeVendedor: 'XEXEU',
      Acumulada: 100,
      PedidosEmAberto: 50,
    }));
    render(<ComissaoPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    const indicadores = screen.getByLabelText('Indicadores comerciais');
    expect(within(indicadores).getByText('Valor total').closest('article')).toHaveTextContent('R$ 150,00');
  });

  it('mantem a tabela resumida na viewport compartilhada apos buscar', () => {
    linhas.push(mapComissaoLinha({ Vendedor: 10, NomeVendedor: 'XEXEU' }));
    render(<ComissaoPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    const viewport = screen.getByRole('region', { name: 'Tabela de comissões por vendedor' });
    expect(viewport).toContainElement(screen.getByRole('table'));
    expect(screen.getByTestId('comissao-results')).toHaveClass('flex-1');
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Vendedor').closest('th')).toHaveClass('md:sticky');
    expect(table.getByText('Obj. mensal')).toBeInTheDocument();
    expect(table.getByText('Obj. diário')).toBeInTheDocument();
    expect(table.getByText('Pedidos em aberto')).toBeInTheDocument();
    expect(table.getByText('Faturado até hoje')).toBeInTheDocument();
    expect(table.getByText('Falta para a meta')).toBeInTheDocument();
    expect(table.getAllByText('Total')).toHaveLength(2);
    expect(table.queryByText('Nome')).not.toBeInTheDocument();
    expect(table.queryByText('PMV')).not.toBeInTheDocument();
    expect(screen.getByText('XEXEU').closest('td')).toHaveAttribute('title', 'XEXEU');
  });

  it('explica os indicadores sem adicionar textos auxiliares permanentes', () => {
    linhas.push(mapComissaoLinha({ Vendedor: 10, NomeVendedor: 'XEXEU' }));
    render(<ComissaoPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    const indicadores = screen.getByLabelText('Indicadores comerciais');
    expect(within(indicadores).getByText('Objetivo mensal').closest('article')).toHaveAttribute('tabindex', '0');
    expect(within(indicadores).getByText('Pedidos em aberto').closest('article')).toHaveAttribute('tabindex', '0');
  });

  it('nao exibe colunas tecnicas mesmo quando filtros avancados estao ativos', () => {
    linhas.push(mapComissaoLinha({ Vendedor: 10, NomeVendedor: 'XEXEU', STVenda: 120 }));
    render(<ComissaoPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Mais filtros' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Calcular ST' }));
    fireEvent.keyDown(screen.getByLabelText('Filtros avançados de comissão'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(within(screen.getByRole('table')).queryByText('ST')).not.toBeInTheDocument();
  });

  it('identifica o restante para atingir a meta com o rotulo correto', () => {
    linhas.push(mapComissaoLinha({
      Vendedor: 10,
      NomeVendedor: 'XEXEU',
      AFaturar: 53_850.70,
      PedidosEmAberto: 500,
    }));

    render(<ComissaoPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(screen.getByRole('columnheader', { name: 'Falta para a meta' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'A faturar' })).not.toBeInTheDocument();
  });

  it('exibe somente o valor explicito de pedidos em aberto', () => {
    linhas.push(
      mapComissaoLinha({ Vendedor: 10, NomeVendedor: 'XEXEU', AFaturar: 53850.7, PedidosEmAberto: 500 }),
      mapComissaoLinha({ Vendedor: 11, NomeVendedor: 'MARCIO', PedidosEmAberto: 100 }),
    );
    render(<ComissaoPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    const row = screen.getByText('XEXEU').closest('tr')!;
    expect(within(row).getAllByRole('cell')[3]).toHaveTextContent('500,00');
    const total = screen.getAllByText('Total', { exact: true }).at(-1)!.closest('tr')!;
    expect(within(total).getAllByRole('cell')[3]).toHaveTextContent('600,00');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('mostra zero e total quando pedidos em aberto sao explicitamente retornados', () => {
    linhas.push(mapComissaoLinha({ Vendedor: 10, NomeVendedor: 'XEXEU', AFaturar: 53850.7, PedidosEmAberto: 0 }));
    render(<ComissaoPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.queryByText('Indisponível')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
