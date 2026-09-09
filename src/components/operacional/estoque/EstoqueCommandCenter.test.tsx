import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ViewMode } from '@/types/estoque';

vi.mock('@/components/ui/select', async () => {
  const React = await import('react');

  interface SelectContextValue {
    onValueChange: (value: string) => void;
    open: boolean;
    setOpen: (open: boolean) => void;
    value: string;
  }

  const SelectContext = React.createContext<SelectContextValue>({
    onValueChange: () => undefined,
    open: false,
    setOpen: () => undefined,
    value: '',
  });

  function Select({ children, onValueChange, value }: {
    children: React.ReactNode;
    onValueChange: (value: string) => void;
    value: string;
  }) {
    const [open, setOpen] = React.useState(false);
    return (
      <SelectContext.Provider value={{ onValueChange, open, setOpen, value }}>
        {children}
      </SelectContext.Provider>
    );
  }

  function SelectTrigger({ 'aria-label': ariaLabel, children, className }: {
    'aria-label'?: string;
    children: React.ReactNode;
    className?: string;
  }) {
    const { open, setOpen } = React.useContext(SelectContext);
    return (
      <button
        aria-expanded={open}
        aria-label={ariaLabel}
        className={className}
        onClick={() => setOpen(!open)}
        role="combobox"
        type="button"
      >
        {children}
      </button>
    );
  }

  function SelectValue() {
    const { value } = React.useContext(SelectContext);
    return <span>{value}</span>;
  }

  function SelectContent({ children }: { children: React.ReactNode }) {
    const { open } = React.useContext(SelectContext);
    return open ? <div role="listbox">{children}</div> : null;
  }

  function SelectItem({ children, value }: { children: React.ReactNode; value: string }) {
    const context = React.useContext(SelectContext);
    return (
      <button
        aria-selected={context.value === value}
        onClick={() => {
          context.onValueChange(value);
          context.setOpen(false);
        }}
        role="option"
        type="button"
      >
        {children}
      </button>
    );
  }

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
});

import { EstoqueCommandCenter } from './EstoqueCommandCenter';
import {
  estoqueFixture,
  estoqueFixtureComTresItens,
  giroFixture,
  NOW,
} from './estoqueFixtures';
import { buildStockInsights } from './estoqueIntelligence';

const fixtureProps = {
  stockData: estoqueFixtureComTresItens,
  movementData: giroFixture,
  branchKey: 'CT',
  viewMode: 'consolidado' as const,
  onViewModeChange: vi.fn(),
  onExport: vi.fn(),
};

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class ResizeObserverMock {
    private readonly callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element) {
      this.callback([{
        contentRect: { height: 224, width: 640 },
        target,
      } as ResizeObserverEntry], this as unknown as ResizeObserver);
    }

    disconnect() {}
    unobserve() {}
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('EstoqueCommandCenter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('busca, filtra por critico, abre produto e exporta exatamente a mesma visao', async () => {
    const onExport = vi.fn();
    render(<EstoqueCommandCenter {...fixtureProps} onExport={onExport} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar no estoque' }), {
      target: { value: 'embreagem' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Criticos.*1/i }));

    const products = screen.getByRole('region', { name: 'Produtos do estoque' });
    expect(within(products).getAllByText('KIT EMBREAGEM PESADA').length).toBeGreaterThan(0);
    expect(within(products).queryByText('BOMBA D AGUA')).not.toBeInTheDocument();

    fireEvent.click(within(products).getAllByRole('button', { name: 'Abrir KIT EMBREAGEM PESADA' })[0]);
    expect(screen.getByRole('dialog', { name: 'KIT EMBREAGEM PESADA' })).toBeInTheDocument();
    vi.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Exportar visao atual' }));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onExport).toHaveBeenCalledWith([
      expect.objectContaining({ cod_produto: 101, produto: 'KIT EMBREAGEM PESADA' }),
    ]);
  });

  it('abre o produto solicitado pelo Assistente', async () => {
    const onRequestedProductHandled = vi.fn();
    render(
      <EstoqueCommandCenter
        {...fixtureProps}
        onRequestedProductHandled={onRequestedProductHandled}
        requestedProductCode={101}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'KIT EMBREAGEM PESADA' })).toBeInTheDocument();
    expect(onRequestedProductHandled).toHaveBeenCalledOnce();
  });

  it('combina filtros de marca, grupo e linha antes de exportar', () => {
    const onExport = vi.fn();
    render(<EstoqueCommandCenter {...fixtureProps} onExport={onExport} />);

    expect(screen.queryByRole('button', { name: /Marca:.*Todas/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Filtros/i }));
    fireEvent.click(screen.getByRole('button', { name: /Marca:.*Todas/i }));
    fireEvent.click(screen.getByRole('button', { name: 'ZF' }));
    fireEvent.click(screen.getByRole('button', { name: /Grupo:.*Todos/i }));
    fireEvent.click(screen.getByRole('button', { name: 'EMBREAGEM' }));
    fireEvent.click(screen.getByRole('button', { name: /Linha:.*Todas/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Linha pesada' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: 'Exportar visao atual' }));
    expect(onExport).toHaveBeenCalledWith([
      expect.objectContaining({ cod_produto: 101, marca: 'ZF', grupo: 'EMBREAGEM', linha: 'Linha pesada' }),
    ]);
  });

  it('exporta os registros completos na ordem escolhida na tabela', () => {
    const onExport = vi.fn();
    const insights = buildStockInsights(estoqueFixtureComTresItens, giroFixture, NOW);
    const product202 = insights.find((product) => product.cod_produto === 202)!;
    const product101 = insights.find((product) => product.cod_produto === 101)!;
    const product303 = insights.find((product) => product.cod_produto === 303)!;
    render(<EstoqueCommandCenter {...fixtureProps} onExport={onExport} />);
    vi.useRealTimers();

    fireEvent.click(screen.getByRole('button', { name: 'Ordenar por Quantidade' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar visao atual' }));

    expect(onExport).toHaveBeenCalledWith([product202, product101, product303]);
  });

  it('posiciona o seletor de colunas ao lado de exportar e remove o seletor de maior estoque', () => {
    render(<EstoqueCommandCenter {...fixtureProps} />);

    expect(screen.getByRole('button', { name: 'Exportar visao atual' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Escolher colunas' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Ordenar produtos' })).not.toBeInTheDocument();
    expect(screen.queryByText('Maior estoque')).not.toBeInTheDocument();
  });

  it('preserva busca e filtros enquanto troca o modo pelo callback controlado', () => {
    const onViewModeChange = vi.fn();
    const onExport = vi.fn();

    function Harness() {
      const [viewMode, setViewMode] = useState<ViewMode>('consolidado');
      return (
        <EstoqueCommandCenter
          {...fixtureProps}
          onExport={onExport}
          onViewModeChange={(mode) => {
            onViewModeChange(mode);
            setViewMode(mode);
          }}
          viewMode={viewMode}
        />
      );
    }

    render(<Harness />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar no estoque' }), {
      target: { value: 'bomba' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sem estoque.*1/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Detalhado' }));

    expect(onViewModeChange).toHaveBeenCalledWith('detalhado');
    expect(screen.getByRole('searchbox', { name: 'Buscar no estoque' })).toHaveValue('bomba');
    expect(screen.getByRole('button', { name: /Sem estoque.*1/i })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Exportar visao atual' }));
    expect(onExport).toHaveBeenCalledWith([expect.objectContaining({ cod_produto: 202 })]);
  });

  it('limpa busca, filtros, pagina e drawer ao trocar de filial', () => {
    const manyProducts = Array.from({ length: 51 }, (_, index) => ({
      ...estoqueFixtureComTresItens[index % estoqueFixtureComTresItens.length],
      cod_produto: 10_000 + index,
      produto: `PRODUTO ${String(index).padStart(2, '0')}`,
    }));
    const { rerender } = render(
      <EstoqueCommandCenter {...fixtureProps} branchKey="1004:transmissao" stockData={manyProducts} />,
    );

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar no estoque' }), {
      target: { value: 'produto' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Proxima pagina' }));
    expect(screen.getByText('Pagina 2 de 2')).toBeInTheDocument();
    const lastPage = screen.getByRole('region', { name: 'Produtos do estoque' });
    fireEvent.click(within(lastPage).getAllByRole('button', { name: /^Abrir PRODUTO/i })[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    rerender(
      <EstoqueCommandCenter {...fixtureProps} branchKey="1004:chevrolet" stockData={manyProducts} />,
    );
    vi.runAllTimers();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Buscar no estoque' })).toHaveValue('');
    expect(screen.getByRole('button', { name: /Produtos/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Pagina 1 de 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Sem estoque/i }));
    rerender(
      <EstoqueCommandCenter {...fixtureProps} branchKey="1004:transmissao" stockData={manyProducts} />,
    );
    expect(screen.getByRole('button', { name: /Produtos/i })).toHaveAttribute('aria-pressed', 'true');
  }, 10_000);

  it('filtra a visao real por Disponiveis e Com estoque sem alterar os seis indicadores', () => {
    const onExport = vi.fn();
    render(<EstoqueCommandCenter {...fixtureProps} onExport={onExport} />);

    expect(document.querySelectorAll('[data-stock-summary]')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: /Filtros/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Disponiveis' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar visao atual' }));
    expect(onExport).toHaveBeenLastCalledWith([expect.objectContaining({ cod_produto: 303 })]);

    fireEvent.click(screen.getByRole('button', { name: /Filtros/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Disponiveis' }));
    fireEvent.click(screen.getByRole('button', { name: 'Com estoque' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    const products = screen.getByRole('region', { name: 'Produtos do estoque' });
    expect(within(products).getAllByText('KIT EMBREAGEM PESADA').length).toBeGreaterThan(0);
    expect(within(products).getAllByText('ROLAMENTO CARDAN').length).toBeGreaterThan(0);
    expect(within(products).queryByText('BOMBA D AGUA')).not.toBeInTheDocument();
  }, 10_000);

  it('mantem listagem e destaques informativos quando nao ha dados de giro', () => {
    render(
      <EstoqueCommandCenter
        {...fixtureProps}
        stockData={estoqueFixture}
        movementData={[]}
      />,
    );

    expect(screen.getAllByText('KIT EMBREAGEM PESADA').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Abrir painel de atencao/i }));
    expect(screen.getByText('Dados insuficientes para movimentacao')).toBeInTheDocument();
    expect(screen.getByText('10 em estoque')).toBeInTheDocument();
  });

  it('remove o filtro de excesso quando a fonte de movimentos fica indisponivel', () => {
    const { rerender } = render(
      <EstoqueCommandCenter {...fixtureProps} movementAvailable />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Capital em excesso:/i }));
    const activeExcess = screen.getByRole('button', { name: /^Capital em excesso:/i });
    expect(activeExcess).toHaveAttribute('aria-pressed', 'true');

    rerender(<EstoqueCommandCenter {...fixtureProps} movementAvailable={false} />);

    expect(screen.getByRole('button', { name: /Produtos/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('article', { name: /Capital em excesso/i })).toBeInTheDocument();
  });

  it('integra estados vazios distintos para a fonte e para a visao filtrada', () => {
    const { rerender } = render(
      <EstoqueCommandCenter
        {...fixtureProps}
        stockData={[]}
        movementData={[]}
      />,
    );
    expect(screen.getAllByText('Nenhum produto disponivel na fonte de estoque.')).toHaveLength(2);

    rerender(<EstoqueCommandCenter {...fixtureProps} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar no estoque' }), {
      target: { value: 'produto inexistente' },
    });
    expect(screen.getAllByText('Nenhum produto corresponde aos filtros atuais.')).toHaveLength(2);
  });

  it('prioriza a tabela e abre informacoes secundarias no painel de atencao', () => {
    render(<EstoqueCommandCenter {...fixtureProps} />);

    const commandCenter = screen.getByRole('region', { name: 'Central de estoque' });
    expect(commandCenter).toHaveClass('min-w-0', 'max-w-full');

    const orderedSections = [
      within(commandCenter).getByRole('toolbar', { name: 'Comandos do estoque' }),
      within(commandCenter).getByRole('region', { name: 'Resumo do estoque' }),
      within(commandCenter).getByRole('region', { name: 'Dados do estoque' }),
    ];

    orderedSections.slice(1).forEach((section, index) => {
      expect(orderedSections[index].compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    expect(screen.queryByText('Atencao no estoque')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Abrir painel de atencao/i }));
    expect(screen.getByRole('dialog', { name: 'Atencao no estoque' })).toBeInTheDocument();
    expect(screen.getByText('Mais movimentados')).toBeInTheDocument();
    expect(screen.getByText('Produtos parados')).toBeInTheDocument();
  });

  it('compoe toolbar, metricas e tabela no viewport compacto aprovado', () => {
    render(<EstoqueCommandCenter {...fixtureProps} />);

    const commandCenter = screen.getByRole('region', { name: 'Central de estoque' });
    const toolbar = within(commandCenter).getByRole('toolbar', { name: 'Comandos do estoque' });
    const metrics = within(commandCenter).getByRole('region', { name: 'Indicadores de estoque' });
    const viewport = within(commandCenter).getByRole('region', { name: 'Dados do estoque' });

    expect(commandCenter).toHaveClass('flex', 'min-h-0', 'overflow-hidden', 'estoque-manager-view');
    expect(toolbar).toHaveClass('h-10');
    expect(metrics).toHaveClass('h-11');
    expect(toolbar.compareDocumentPosition(metrics) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(metrics.compareDocumentPosition(viewport) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(viewport).getByRole('table')).toBeInTheDocument();
    expect(within(viewport).getByLabelText('Paginacao dos produtos')).toBeInTheDocument();
  });

  it('preserva filtros no Sheet ao trocar de modo sem criar uma segunda linha na toolbar', () => {
    const onExport = vi.fn();

    function Harness() {
      const [viewMode, setViewMode] = useState<ViewMode>('consolidado');
      return (
        <EstoqueCommandCenter
          {...fixtureProps}
          onExport={onExport}
          onViewModeChange={setViewMode}
          viewMode={viewMode}
        />
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Filtros/i }));
    fireEvent.click(screen.getByRole('button', { name: /Marca:.*Todas/i }));
    fireEvent.click(screen.getByRole('button', { name: 'ZF' }));
    fireEvent.click(screen.getByRole('button', { name: /Grupo:.*Todos/i }));
    fireEvent.click(screen.getByRole('button', { name: 'EMBREAGEM' }));
    fireEvent.click(screen.getByRole('button', { name: /Linha:.*Todas/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Linha pesada' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Detalhado' }));

    expect(screen.queryByLabelText('Filtros ativos')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filtros, 3 ativos' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Exportar visao atual' }));
    expect(onExport).toHaveBeenCalledWith([
      expect.objectContaining({ cod_produto: 101, marca: 'ZF', grupo: 'EMBREAGEM', linha: 'Linha pesada' }),
    ]);
  });

  it('informa quando o modo detalhado possui apenas granularidade de produto', () => {
    render(<EstoqueCommandCenter {...fixtureProps} stockData={estoqueFixture} viewMode="detalhado" />);

    expect(screen.queryByText('A fonte atual nao fornece filial ou localizacao para detalhar estes produtos.')).not.toBeInTheDocument();
  });

  it('consolida produtos repetidos e mantem registros separados no detalhado', () => {
    const duplicate = {
      ...estoqueFixture[0],
      cod_empresa: 2,
      empresa: 'FILIAL 2',
      quantidade_estoque: 7,
      valor_estoque: 3500,
    };
    const stockData = [estoqueFixture[0], duplicate];
    const { rerender } = render(
      <EstoqueCommandCenter {...fixtureProps} stockData={stockData} viewMode="consolidado" />,
    );

    expect(screen.getAllByText('17')).not.toHaveLength(0);
    expect(within(screen.getByLabelText('Tabela de produtos do estoque')).getAllByRole('row')).toHaveLength(2);

    rerender(<EstoqueCommandCenter {...fixtureProps} stockData={stockData} viewMode="detalhado" />);
    expect(within(screen.getByLabelText('Tabela de produtos do estoque')).getAllByRole('row')).toHaveLength(3);
    expect(screen.getAllByText('FILIAL 2')).not.toHaveLength(0);
  });
});
