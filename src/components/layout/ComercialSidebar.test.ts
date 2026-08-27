import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement, type ComponentType } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/contexts/AuthContext';
import { useVendasPerdidas } from '@/hooks/useCotacoesComerciais';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useMotivosPerda10041, useSalvarMotivoPerda10041 } from '@/hooks/useMotivosPerda';
import { ComercialSidebar } from './ComercialSidebar';
import * as ComercialSidebarModule from './ComercialSidebar';
import { ComercialMobileBottomNav } from './ComercialMobileBottomNav';
import * as AppModule from '@/App';

vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: vi.fn(() => ({ filialAtiva: '1004' })),
}));

vi.mock('@/hooks/useCotacoesComerciais', () => ({
  useVendasPerdidas: vi.fn(),
}));

vi.mock('@/hooks/useMotivosPerda', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/hooks/useMotivosPerda')>();
  return {
    ...original,
    useMotivosPerda10041: vi.fn(),
    useSalvarMotivoPerda10041: vi.fn(),
  };
});

type ComercialMenuItem = { path: string };
type ComercialSidebarExports = typeof ComercialSidebarModule & {
  getComercialMenuItems?: (codEmpresa: string) => ComercialMenuItem[];
};

type AppExports = typeof AppModule & {
  VENDAS_PERDIDAS_ROUTE?: {
    path: string;
    Component: ComponentType;
  };
};

function mockCompany(codEmpresaAtiva: string) {
  vi.mocked(useEmpresaAtiva).mockReturnValue({ codEmpresaAtiva, isLoading: false } as never);
  vi.mocked(useAuth).mockReturnValue({ isLoading: false } as never);
}

function mockLostSalesQueries() {
  vi.mocked(useVendasPerdidas).mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useMotivosPerda10041).mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useSalvarMotivoPerda10041).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as never);
}

describe('commercial sidebar menu access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLostSalesQueries();
  });

  afterEach(() => {
    cleanup();
  });

  it('activates open and lost quotes for Pelegrini companies 1004 and 10041', () => {
    const getComercialMenuItems = (ComercialSidebarModule as ComercialSidebarExports).getComercialMenuItems;

    expect(getComercialMenuItems).toBeTypeOf('function');
    if (!getComercialMenuItems) return;

    expect(getComercialMenuItems('10041').map((item) => item.path)).toContain('/comercial/cotacoes');
    expect(getComercialMenuItems('10041').map((item) => item.path)).toContain('/comercial/perdidas');
    expect(getComercialMenuItems('1004').map((item) => item.path)).toContain('/comercial/cotacoes');
    expect(getComercialMenuItems('1004').map((item) => item.path)).toContain('/comercial/perdidas');
    expect(getComercialMenuItems('9999').map((item) => item.path)).not.toContain('/comercial/cotacoes');
    expect(getComercialMenuItems('9999').map((item) => item.path)).not.toContain('/comercial/perdidas');
  });

  it('shows the active quotes link and removes future items for 1004', () => {
    mockCompany('1004');
    render(createElement(MemoryRouter, { initialEntries: ['/comercial/dashboard'], future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(ComercialSidebar)));

    expect(screen.getByRole('link', { name: 'Cotações Abertas' })).toHaveAttribute('href', '/comercial/cotacoes');
    expect(screen.getByRole('link', { name: 'Vendas Perdidas' })).toHaveAttribute('href', '/comercial/perdidas');
    expect(screen.queryByText('Em breve')).not.toBeInTheDocument();
    expect(screen.queryByText('BREVE')).not.toBeInTheDocument();
  });

  it('keeps both disabled future items for other companies', () => {
    mockCompany('9999');
    render(createElement(MemoryRouter, { initialEntries: ['/comercial/dashboard'], future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(ComercialSidebar)));

    expect(screen.queryByRole('link', { name: 'Cotações Abertas' })).not.toBeInTheDocument();
    expect(screen.getByText('Em breve')).toBeInTheDocument();
    expect(screen.getAllByText('BREVE')).toHaveLength(2);
  });

  it('exposes both quote routes in the 1004 mobile secondary navigation', () => {
    mockCompany('1004');
    render(createElement(
      MemoryRouter,
      { initialEntries: ['/comercial/dashboard'], future: { v7_startTransition: true, v7_relativeSplatPath: true } },
      createElement(ComercialMobileBottomNav),
    ));

    const mobileButtons = ['Início', 'Dashboard', 'Diárias', 'Clientes', 'Mais']
      .map((name) => screen.getByRole('button', { name }));
    mobileButtons.forEach((button) => {
      expect(button).toHaveClass('h-14', 'min-w-0', 'flex-1');
    });
    fireEvent.click(mobileButtons[4]);
    expect(screen.getByRole('link', { name: 'Cotações Abertas' })).toHaveAttribute('href', '/comercial/cotacoes');
    expect(screen.getByRole('link', { name: 'Vendas Perdidas' })).toHaveAttribute('href', '/comercial/perdidas');

    cleanup();
    mockCompany('9999');
    render(createElement(
      MemoryRouter,
      { initialEntries: ['/comercial/dashboard'], future: { v7_startTransition: true, v7_relativeSplatPath: true } },
      createElement(ComercialMobileBottomNav),
    ));
    expect(screen.queryByRole('button', { name: 'Mais' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.queryByRole('link', { name: 'Cotações Abertas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Vendas Perdidas' })).not.toBeInTheDocument();
  });

  it('renders the App-registered lost-sales route for company 1004', () => {
    const route = (AppModule as AppExports).VENDAS_PERDIDAS_ROUTE;

    expect(route).toMatchObject({ path: 'perdidas', Component: expect.any(Function) });
    if (!route) return;

    mockCompany('1004');
    const productionRoutes = createElement(
      Routes,
      undefined,
      createElement(Route, {
        path: '/comercial',
      }, createElement(Route, route)),
      createElement(Route, { path: '/comercial/dashboard', element: createElement('p', undefined, 'Dashboard comercial') }),
    );
    render(createElement(MemoryRouter, { initialEntries: ['/comercial/perdidas'], future: { v7_startTransition: true, v7_relativeSplatPath: true } }, productionRoutes));
    expect(screen.getByRole('heading', { name: 'Vendas perdidas' })).toBeInTheDocument();

    mockCompany('9999');
    cleanup();
    render(createElement(MemoryRouter, { initialEntries: ['/comercial/perdidas'], future: { v7_startTransition: true, v7_relativeSplatPath: true } }, productionRoutes));
    expect(screen.getByText('Dashboard comercial')).toBeInTheDocument();
  });
});
