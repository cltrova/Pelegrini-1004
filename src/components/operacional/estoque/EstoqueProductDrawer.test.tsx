import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { GiroRecord } from '@/types/estoque';

import { EstoqueEvolutionChart } from './EstoqueEvolutionChart';
import { EstoqueMovementTimeline } from './EstoqueMovementTimeline';
import { EstoqueProductDrawer } from './EstoqueProductDrawer';
import { estoqueFixture, giroEvolucaoFixture, giroFixture, NOW } from './estoqueFixtures';
import { buildStockEvolution, buildStockInsights } from './estoqueIntelligence';

const criticalInsight = buildStockInsights(estoqueFixture, giroEvolucaoFixture, NOW)[0];
const insightWithoutMovement = buildStockInsights(estoqueFixture, [], NOW)[0];

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class ResizeObserverMock {
    private readonly callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element) {
      this.callback([
        {
          contentRect: { height: 224, width: 640 },
          target,
        } as ResizeObserverEntry,
      ], this as unknown as ResizeObserver);
    }

    disconnect() {}
    unobserve() {}
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function movement(overrides: Partial<GiroRecord>): GiroRecord {
  return {
    ...giroFixture[0],
    entrada_compra: 0,
    entrada_transferencia: 0,
    entrada_outras: 0,
    entrada_devolucao: 0,
    saida_venda: 0,
    saida_transferencia: 0,
    saida_outras: 0,
    saida_devolucao: 0,
    quantidade_movimentada: 0,
    ...overrides,
  };
}

describe('EstoqueProductDrawer', () => {
  it('nomeia o dialogo pelo produto, ocupa a largura correta e mostra status com texto e icone', () => {
    render(<EstoqueProductDrawer product={criticalInsight} open onOpenChange={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'KIT EMBREAGEM PESADA' });
    expect(dialog).toHaveClass('w-full', 'sm:max-w-xl', 'lg:max-w-2xl', 'min-w-0');
    expect(within(dialog).getByText('Critico')).toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: 'Situacao: Critico' })).toBeInTheDocument();
  });

  it('mostra os dados completos existentes e o texto exato do minimo estimado', () => {
    render(<EstoqueProductDrawer product={criticalInsight} open onOpenChange={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    [
      'Codigo 101',
      'ZF',
      'EMBREAGEM',
      'Linha pesada',
      'CAMINHOES',
      'ZF-101',
      '101-A',
      'GM-101',
      '10 unidades',
      'Minimo operacional estimado',
      'CASA DA TRANSMISSAO',
      'Nao informada',
      '31/08/2026',
      '20/08/2026',
    ].forEach((text) => expect(within(dialog).getAllByText(text).length).toBeGreaterThan(0));

    expect(within(dialog).getByText(/R\$.*5\.000/)).toHaveClass('pelegrini-responsive-value');
    expect(within(dialog).getByText(/R\$.*500/)).toHaveClass('pelegrini-responsive-value');
    expect(within(dialog).getByText('10 unidades')).toHaveClass('pelegrini-responsive-value');
    expect(within(dialog).getByText('Entradas fisicas do periodo')).toBeInTheDocument();
    expect(within(dialog).getByText('Saidas fisicas do periodo')).toBeInTheDocument();
    expect(within(dialog).getByText('Giro fisico do periodo')).toBeInTheDocument();
    expect(within(dialog).getByText('Como este status foi calculado')).toBeInTheDocument();
    expect(within(dialog).getByText(/Cobertura calculada com as saidas dos ultimos tres meses-calendario/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Acao recomendada:/i)).toBeInTheDocument();
  });

  it('usa totais fisicos explicitos no resumo incluindo devolucoes', () => {
    const insight = buildStockInsights(estoqueFixture, [movement({
      data_movimento: '2026-08-31',
      entrada_compra: 4,
      saida_venda: 5,
      saida_devolucao: 7,
    })], NOW)[0];

    render(<EstoqueProductDrawer product={insight} open onOpenChange={vi.fn()} />);

    const summary = screen.getByRole('region', { name: 'Resumo do periodo' });
    expect(within(summary).getByText('4 unidades')).toBeInTheDocument();
    expect(within(summary).getByText('12 unidades')).toBeInTheDocument();
    expect(within(summary).getByText('16 unidades')).toBeInTheDocument();
  });

  it('mantem quantidade e valor sem exibir zeros artificiais quando o giro esta indisponivel', () => {
    render(<EstoqueProductDrawer product={insightWithoutMovement} open onOpenChange={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('10 unidades')).toBeInTheDocument();
    expect(within(dialog).getByText(/R\$.*5\.000/)).toBeInTheDocument();

    [
      'Minimo operacional estimado',
      'Cobertura',
      'Entradas fisicas do periodo',
      'Saidas fisicas do periodo',
      'Giro fisico do periodo',
    ].forEach((label) => {
      const metric = within(dialog).getByText(label).parentElement;
      expect(within(metric as HTMLElement).getByText('Dados insuficientes')).toBeInTheDocument();
      expect(within(metric as HTMLElement).queryByText(/^0(?:,0+)? unidades$/)).not.toBeInTheDocument();
    });
    expect(within(dialog).getByText('Historico indisponivel')).toBeInTheDocument();
  });

  it('fecha com Escape e devolve o foco ao acionador', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)} type="button">Abrir produto</button>
          <EstoqueProductDrawer product={criticalInsight} open={open} onOpenChange={setOpen} />
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Abrir produto' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});

describe('EstoqueMovementTimeline', () => {
  it('ordena por data decrescente, limita a 20 e respeita a precedencia dos movimentos', () => {
    const movements = Array.from({ length: 22 }, (_, index) => movement({
      data_movimento: `2026-08-${String(index + 1).padStart(2, '0')}`,
      entrada_compra: index === 21 ? 7 : 1,
      saida_venda: index === 21 ? 50 : 0,
      quantidade_movimentada: index === 21 ? 57 : 1,
      tipo_movimento: 'MISTO',
    }));

    render(<EstoqueMovementTimeline movements={movements} />);

    const history = screen.getByRole('list', { name: 'Historico recente' });
    const items = within(history).getAllByRole('listitem');
    expect(items).toHaveLength(20);
    expect(items[0]).toHaveTextContent('22/08/2026');
    expect(items[0]).toHaveTextContent('Compra');
    expect(items[0]).toHaveTextContent('Entrada +7');
    expect(items[19]).toHaveTextContent('03/08/2026');
  });

  it.each([
    [{ entrada_compra: 2 }, 'Compra', 'Entrada +2'],
    [{ entrada_transferencia: 3 }, 'Entrada por transferencia', 'Entrada +3'],
    [{ entrada_outras: 4 }, 'Outras entradas', 'Entrada +4'],
    [{ saida_venda: 5 }, 'Venda', 'Saida -5'],
    [{ saida_transferencia: 6 }, 'Saida por transferencia', 'Saida -6'],
    [{ saida_outras: 7 }, 'Outras saidas', 'Saida -7'],
  ])('classifica a precedencia de %s', (values, type, quantity) => {
    render(<EstoqueMovementTimeline movements={[movement({ data_movimento: '2026-08-31', ...values })]} />);

    expect(screen.getByText(type)).toBeInTheDocument();
    expect(screen.getByText(quantity)).toBeInTheDocument();
  });
});

describe('EstoqueEvolutionChart', () => {
  it('rotula a evolucao estimada construída a partir do saldo do produto', () => {
    render(
      <EstoqueEvolutionChart
        movementDataAvailable
        points={buildStockEvolution(criticalInsight)}
      />,
    );

    expect(screen.getByText('Evolucao estimada do saldo')).toBeInTheDocument();
    expect(screen.getByText('Tendencia decrescente')).toBeInTheDocument();
    expect(screen.queryByText('Dados insuficientes para estimar a evolucao.')).not.toBeInTheDocument();
  });

  it('mostra estado textual quando nao ha pontos suficientes', () => {
    render(<EstoqueEvolutionChart movementDataAvailable={false} points={[]} />);

    expect(screen.getByText('Evolucao estimada do saldo')).toBeInTheDocument();
    expect(screen.getByText('Dados insuficientes para estimar a evolucao.')).toBeInTheDocument();
  });
});
