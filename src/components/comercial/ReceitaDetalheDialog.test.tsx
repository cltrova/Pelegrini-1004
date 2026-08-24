import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReceitaDetalheDialog } from './ReceitaDetalheDialog';

const xlsxMock = vi.hoisted(() => ({
  aoaToSheet: vi.fn(() => ({})),
  encodeCell: vi.fn(({ r, c }: { r: number; c: number }) => `${String.fromCharCode(65 + c)}${r + 1}`),
  bookNew: vi.fn(() => ({})),
  bookAppendSheet: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: xlsxMock.aoaToSheet,
    encode_cell: xlsxMock.encodeCell,
    book_new: xlsxMock.bookNew,
    book_append_sheet: xlsxMock.bookAppendSheet,
  },
  writeFile: xlsxMock.writeFile,
}));

describe('ReceitaDetalheDialog', () => {
  it('mostra a receita detalhada sem comparar com o totalizador oficial', () => {
    render(
      <ReceitaDetalheDialog
        open
        onOpenChange={vi.fn()}
        totalEsperado={90}
        produtos={[
          {
            id: '1',
            cod_produto: 'P1',
            descricao: 'Produto teste',
            tipo: 'PEDIDO',
            quantidade: 1,
            valor_total: 100,
          },
        ] as any}
      />,
    );

    expect(screen.getByText('Receita bruta')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 100,00').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Diferença/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Bate com o card/i)).not.toBeInTheDocument();
  });
  it('usa layout simplificado no modal sem expor regra tecnica e colunas repetidas', () => {
    render(
      <ReceitaDetalheDialog
        open
        onOpenChange={vi.fn()}
        totalEsperado={90}
        produtos={[
          {
            id: '1',
            cod_pedido: 123,
            num_nf: 456,
            data_faturamento: '2026-08-18',
            data_pedido: '2026-08-17',
            data_movimento: '2026-08-18',
            tipo: 'PEDIDO',
            vendedor_nome: 'DANIEL',
            vendedor_codigo: 77,
            cliente_razao: 'Cliente teste',
            cliente_codigo: 'C001',
            filial_nome: 'CH',
            descricao: 'Produto teste',
            valor_total: 100,
          },
        ] as any}
      />,
    );

    expect(screen.getByText('Detalhamento da Receita')).toBeInTheDocument();
    expect(screen.queryByText(/Regra RSYS/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dt\. Pedido/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dt\. Movimento/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/CÃ³d\. Vend\./i)).not.toBeInTheDocument();
    expect(screen.queryByText(/CÃ³d\. Cliente/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Produto/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Valor/i)).toBeInTheDocument();
  });

  it('filtra rapidamente entre pedidos e devolucoes e permite limpar busca', () => {
    render(
      <ReceitaDetalheDialog
        open
        onOpenChange={vi.fn()}
        totalEsperado={90}
        produtos={[
          {
            id: '1',
            cod_pedido: 123,
            num_nf: 456,
            data_faturamento: '2026-08-18',
            tipo: 'PEDIDO',
            vendedor_nome: 'DANIEL',
            cliente_razao: 'Cliente pedido',
            filial_nome: 'CH',
            descricao: 'Produto pedido',
            valor_total: 100,
          },
          {
            id: '2',
            cod_pedido: 124,
            num_nf: 457,
            data_faturamento: '2026-08-18',
            tipo: 'DEVOLUCAO',
            vendedor_nome: 'DANIEL',
            cliente_razao: 'Cliente devolucao',
            filial_nome: 'CH',
            descricao: 'Produto devolucao',
            valor_total: -40,
            valor_devolucao_item: 40,
          },
        ] as any}
      />,
    );

    expect(screen.getByRole('button', { name: /pedidos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /devolu/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /devolu/i }));
    expect(screen.queryByText('Cliente pedido')).not.toBeInTheDocument();
    expect(screen.getByText('Cliente devolucao')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por pedido/i), { target: { value: 'sem resultado' } });
    expect(screen.getByRole('button', { name: /limpar busca/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /limpar busca/i }));
    expect(screen.getByText('Cliente devolucao')).toBeInTheDocument();
  });

  it('usa filtros compactos e scrollbar visualmente integrada ao tema', () => {
    render(
      <ReceitaDetalheDialog
        open
        onOpenChange={vi.fn()}
        totalEsperado={0}
        produtos={[
          {
            id: '1',
            cod_pedido: 123,
            num_nf: 456,
            data_faturamento: '2026-08-18',
            tipo: 'PEDIDO',
            vendedor_nome: 'DANIEL',
            cliente_razao: 'Cliente teste',
            filial_nome: 'CH',
            descricao: 'Produto teste',
            valor_total: 100,
          },
        ] as any}
      />,
    );

    expect(screen.getByTestId('receita-tipo-filtros')).toHaveClass('rounded-full');
    expect(screen.getByTestId('receita-tabela-scroll')).toHaveClass('[&::-webkit-scrollbar-thumb]:bg-primary/35');
  });

  it('exporta o Excel com as mesmas colunas simplificadas do modal', () => {
    xlsxMock.aoaToSheet.mockClear();
    xlsxMock.writeFile.mockClear();

    render(
      <ReceitaDetalheDialog
        open
        onOpenChange={vi.fn()}
        totalEsperado={0}
        produtos={[
          {
            id: '1',
            cod_pedido: 123,
            num_nf: 456,
            data_pedido: '2026-08-17',
            data_faturamento: '2026-08-18',
            data_movimento: '2026-08-18',
            tipo: 'PEDIDO',
            vendedor_nome: 'DANIEL',
            vendedor_codigo: 98,
            cliente_razao: 'Cliente teste',
            cliente_codigo: 'C001',
            filial_nome: 'CH',
            descricao: 'Produto teste',
            cod_produto: 'P1',
            marca: 'Marca teste',
            grupo: 'Grupo teste',
            cfop: '5.102',
            valor_total: 100,
          },
        ] as any}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /exportar excel/i }));

    const planilha = (xlsxMock.aoaToSheet.mock.calls as any[])[0][0] as unknown[][];
    const cabecalho = planilha[0];

    expect(cabecalho).toHaveLength(9);
    expect(cabecalho).toEqual(expect.arrayContaining(['NF', 'Tipo', 'Vendedor', 'Cliente', 'Filial', 'Produto', 'Valor']));
    expect(cabecalho).not.toEqual(expect.arrayContaining([
      'Dt. Pedido',
      'Dt. Movimento',
      'Cód. Vend.',
      'Cód. Cliente',
      'Cód. Produto',
      'Marca',
      'Grupo',
      'CFOP',
    ]));
    expect(xlsxMock.writeFile).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/^receita-1004-detalhamento-/));
  });

  it('exporta somente registros reais, sem linha artificial de totais', () => {
    xlsxMock.aoaToSheet.mockClear();

    render(
      <ReceitaDetalheDialog
        open
        onOpenChange={vi.fn()}
        totalEsperado={100}
        produtos={[
          {
            id: '1',
            cod_pedido: 123,
            num_nf: 456,
            data_faturamento: '2026-08-18',
            tipo: 'PEDIDO',
            vendedor_nome: 'DANIEL',
            cliente_razao: 'Cliente teste',
            filial_nome: 'CH',
            descricao: 'Produto teste',
            valor_total: 100,
          },
        ] as any}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /exportar excel/i }));

    const planilha = (xlsxMock.aoaToSheet.mock.calls as any[])[0][0] as unknown[][];
    expect(planilha).toHaveLength(2);
    expect(String(planilha.at(-1)?.[0] ?? '')).not.toMatch(/totais/i);
  });

  it('no contexto 10041 exporta somente vendedores do sintetico e remove servicos', () => {
    xlsxMock.aoaToSheet.mockClear();

    render(
      <ReceitaDetalheDialog
        open
        onOpenChange={vi.fn()}
        totalEsperado={100}
        isContextoChevrolet10041
        produtos={[
          {
            id: '1',
            cod_pedido: 123,
            num_nf: 456,
            data_faturamento: '2026-07-18',
            tipo: 'PEDIDO',
            vendedor_codigo: '47',
            vendedor_nome: 'RAFAEL',
            cliente_razao: 'Cliente valido',
            filial_nome: 'CH',
            descricao: 'Produto valido',
            valor_total: 100,
          },
          {
            id: '2',
            cod_pedido: 124,
            num_nf: 457,
            data_faturamento: '2026-07-18',
            tipo: 'PEDIDO',
            vendedor_codigo: '999',
            vendedor_nome: 'BRUNO B',
            cliente_razao: 'Cliente fora',
            filial_nome: 'CH',
            descricao: 'Produto fora',
            valor_total: 200,
          },
          {
            id: '3',
            cod_pedido: 125,
            num_nf: 458,
            data_faturamento: '2026-07-18',
            tipo: 'PEDIDO',
            vendedor_codigo: '99',
            vendedor_nome: 'ELIANE',
            cliente_razao: 'Cliente servico',
            filial_nome: 'CH',
            descricao: 'SERVICOS',
            valor_total: 177,
          },
        ] as any}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /exportar excel/i }));

    const planilha = (xlsxMock.aoaToSheet.mock.calls as any[])[0][0] as unknown[][];
    expect(planilha).toHaveLength(2);
    expect(String(planilha[1][4])).toBe('RAFAEL');
    expect(String(planilha)).not.toContain('BRUNO B');
    expect(String(planilha)).not.toContain('SERVICOS');
  });

  it('detecta escopo CCH pelos dados quando o prop de contexto nao vier ativo', () => {
    xlsxMock.aoaToSheet.mockClear();

    render(
      <ReceitaDetalheDialog
        open
        onOpenChange={vi.fn()}
        totalEsperado={100}
        produtos={[
          {
            id: '1',
            cod_pedido: 123,
            num_nf: 456,
            data_faturamento: '2026-07-18',
            tipo: 'PEDIDO',
            vendedor_codigo: '47',
            vendedor_nome: 'RAFAEL',
            cliente_razao: 'Cliente valido',
            filial_nome: 'CH',
            descricao: 'Produto valido',
            valor_total: 100,
          },
          {
            id: '2',
            cod_pedido: 124,
            num_nf: 457,
            data_faturamento: '2026-07-18',
            tipo: 'PEDIDO',
            vendedor_codigo: '999',
            vendedor_nome: 'BRUNO B',
            cliente_razao: 'Cliente fora',
            filial_nome: 'CH',
            descricao: 'Produto fora',
            valor_total: 200,
          },
          {
            id: '3',
            cod_pedido: 125,
            num_nf: 458,
            data_faturamento: '2026-07-18',
            tipo: 'PEDIDO',
            vendedor_codigo: '99',
            vendedor_nome: 'ELIANE',
            cliente_razao: 'Cliente servico',
            filial_nome: 'CH',
            descricao: 'SERVICOS',
            valor_total: 177,
          },
        ] as any}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /exportar excel/i }));

    const planilha = (xlsxMock.aoaToSheet.mock.calls as any[])[0][0] as unknown[][];
    expect(planilha).toHaveLength(2);
    expect(String(planilha[1][4])).toBe('RAFAEL');
    expect(String(planilha)).not.toContain('BRUNO B');
    expect(String(planilha)).not.toContain('SERVICOS');
  });
});
