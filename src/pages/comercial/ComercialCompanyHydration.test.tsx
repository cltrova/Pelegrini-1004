import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useComercialData } from '@/hooks/useComercialData';
import MetasDiariasPage from './MetasDiariasPage';
import VendedoresPage from './VendedoresPage';

const { commercialState, empresaState } = vi.hoisted(() => ({
  commercialState: { value: {} as ReturnType<typeof useComercialData> },
  empresaState: {
    value: {
      empresa: undefined as { nome: string; possui_meta_vendedor: boolean } | undefined,
      codEmpresaAtiva: '2000' as string | undefined,
      isLoading: true,
    },
  },
}));

vi.mock('@/hooks/useComercialData', () => ({
  useComercialData: () => commercialState.value,
}));

vi.mock('@/hooks/useComercialProdutos', () => ({
  useComercialProdutos: () => ({ receitaPorVendedor1004: new Map() }),
}));

vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: () => empresaState.value,
}));

vi.mock('@/components/comercial/EnterpriseComercialFilters', () => ({
  EnterpriseComercialFilters: () => null,
}));

vi.mock('@/components/comercial/VendedorMetaDiariaCard', () => ({
  VendedorMetaDiariaCard: () => <div>Vendedor da empresa anterior</div>,
}));

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children?: ReactNode }) => <>{children}</>,
  };
});

const staleSeller = {
  codigo: 5,
  nome: 'Vendedor da empresa anterior',
  faturamentoLiquido: 1000,
  totalVendas: 1,
  totalDevolucoes: 0,
  pedidosPendentes: 0,
  ticketMedio: 1000,
  participacao: 100,
};

function comercialData(overrides: Partial<ReturnType<typeof useComercialData>> = {}) {
  return {
    vendedoresPerformance: [staleSeller],
    evolucaoMensal: [],
    evolucaoDiaria: [],
    pedidos: [],
    devolucoes: [],
    clientesPerformance: [],
    insights: [],
    kpis: { ticketMedio: 0 },
    periodoDisponivel: null,
    vendedoresDisponiveis: [],
    vendedoresUnicos: [],
    clientesUnicos: [],
    ufsUnicas: [],
    isLoading: false,
    isFetching: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useComercialData>;
}

describe('commercial company hydration ownership', () => {
  beforeEach(() => {
    empresaState.value = {
      empresa: undefined,
      codEmpresaAtiva: '2000',
      isLoading: true,
    };
    commercialState.value = comercialData();
  });

  it('bloqueia metas diarias ate a empresa nova resolver seus proprios dados', async () => {
    const { rerender } = render(<MetasDiariasPage />);

    expect(screen.getByRole('status', { name: 'Carregando metas diárias' })).toBeInTheDocument();
    expect(screen.queryByText('Vendedor da empresa anterior')).not.toBeInTheDocument();

    empresaState.value = {
      empresa: { nome: 'Empresa 2000', possui_meta_vendedor: true },
      codEmpresaAtiva: '2000',
      isLoading: false,
    };
    commercialState.value = comercialData({ isFetching: true });
    await act(async () => rerender(<MetasDiariasPage />));

    expect(screen.getByRole('status', { name: 'Carregando metas diárias' })).toBeInTheDocument();
    expect(screen.queryByText('Vendedor da empresa anterior')).not.toBeInTheDocument();

    commercialState.value = comercialData({ vendedoresPerformance: [], isFetching: false });
    await act(async () => rerender(<MetasDiariasPage />));

    expect(screen.queryByRole('status', { name: 'Carregando metas diárias' })).not.toBeInTheDocument();
    expect(screen.getByText('Nenhum dado encontrado para o período')).toBeInTheDocument();
  });

  it('bloqueia vendedores enquanto a empresa hidrata e a consulta esta desabilitada', () => {
    commercialState.value = comercialData({ error: new Error('Consulta anterior indisponível') });
    render(<VendedoresPage />);

    expect(screen.getByRole('status', { name: 'Carregando vendedores' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Painel de Vendedores' })).not.toBeInTheDocument();
  });
});
