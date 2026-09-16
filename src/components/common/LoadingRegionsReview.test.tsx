import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { QuedaGraficos } from '@/components/comercial/queda/QuedaGraficos';
import { QuedaKPIs } from '@/components/comercial/queda/QuedaKPIs';
import { SaldoAVencerKpis } from '@/components/financeiro/SaldoAVencerKpis';
import { EstoqueChartsPremium } from '@/components/operacional/EstoqueChartsPremium';
import { ConversationList } from '@/components/whatsapp/ConversationList';

const emptyTotals = {
  total: 0,
  parcelas: 0,
  clientes: 0,
  a_vencer: { valor: 0, qtd: 0 },
  vencido: { valor: 0, qtd: 0 },
};

const emptyStockFilters = {
  viewMode: 'consolidado' as const,
  empresas: [],
  marcas: [],
  grupos: [],
  curvasABC: [],
  searchTerm: '',
  diasSemVenda: 'todos',
  periodo: 'todos',
};

describe('Task 6 loading regions', () => {
  it('replaces financial and stock skeletons with shared content states', () => {
    const financial = render(
      <SaldoAVencerKpis
        contexto={{ periodo: '', filtrosAtivos: [], fonte: '' }}
        foco={null}
        isLoading
        onFocoChange={vi.fn()}
        registros={[]}
        totais={emptyTotals}
      />,
    );

    expect(screen.getByRole('status', { name: 'Carregando indicadores de saldo a vencer' })).toBeInTheDocument();
    expect(financial.container.querySelector('.animate-pulse')).not.toBeInTheDocument();
    financial.unmount();

    const stock = render(
      <EstoqueChartsPremium
        allData={[]}
        data={[]}
        filters={emptyStockFilters}
        isLoading
        setFilters={vi.fn()}
      />,
    );

    expect(screen.getByRole('status', { name: 'Carregando gráficos do estoque' })).toBeInTheDocument();
    expect(stock.container.querySelector('.animate-pulse')).not.toBeInTheDocument();
  });

  it('replaces commercial analysis skeletons with shared content states', () => {
    const kpis = render(<QuedaKPIs clientes={[]} isLoading />);
    expect(screen.getByRole('status', { name: 'Carregando indicadores de queda de clientes' })).toBeInTheDocument();
    expect(kpis.container.querySelector('.animate-pulse')).not.toBeInTheDocument();
    kpis.unmount();

    const charts = render(
      <QuedaGraficos clientes={[]} isLoading labelAnterior="Anterior" labelAtual="Atual" />,
    );
    expect(screen.getByRole('status', { name: 'Carregando gráficos de queda de clientes' })).toBeInTheDocument();
    expect(charts.container.querySelector('.animate-pulse')).not.toBeInTheDocument();
  });

  it('replaces the WhatsApp conversation list skeleton with a shared content state', () => {
    const { container } = render(
      <ConversationList
        conversations={[]}
        filters={{}}
        isLoading
        onFiltersChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole('status', { name: 'Carregando conversas do WhatsApp' })).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
  });
});
