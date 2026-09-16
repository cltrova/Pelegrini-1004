import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement, type ComponentType } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/contexts/AuthContext';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useVendasPerdidas } from '@/hooks/useCotacoesComerciais';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMotivosPerda10041, useSalvarMotivoPerda10041 } from '@/hooks/useMotivosPerda';
import { ComercialLayout } from './ComercialLayout';
import { ComercialSidebar } from './ComercialSidebar';
import * as ComercialSidebarModule from './ComercialSidebar';
import { ComercialMobileBottomNav } from './ComercialMobileBottomNav';

vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: vi.fn(),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: vi.fn(),
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

type AppExports = typeof import('@/App') & {
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
    vi.mocked(useIsMobile).mockReturnValue(false);
    vi.mocked(useFilialSelecionada).mockReturnValue({
      filialAtiva: 'transmissao',
      codEmpresaContexto: '1004',
      setFilialAtivaForEmpresa: vi.fn(),
    } as never);
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

  it('uses the active branch as the visible brand instead of generic module chrome', () => {
    mockCompany('1004');
    render(createElement(MemoryRouter, { initialEntries: ['/comercial/dashboard'], future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(ComercialSidebar)));

    expect(screen.getAllByRole('img', { name: 'Logo Casa da Transmissão' })).toHaveLength(2);
    expect(screen.queryByText('Pelegrini - operacao automotiva integrada')).not.toBeInTheDocument();
    expect(screen.queryByText(/BI Reports/i)).not.toBeInTheDocument();
  });

  it('renders compact navigation without the descriptive sidebar plate', () => {
    mockCompany('1004');
    render(createElement(MemoryRouter, { initialEntries: ['/comercial/dashboard'], future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(ComercialSidebar)));

    expect(screen.getByRole('complementary')).not.toHaveTextContent(/Leitura tecnica/i);
    expect(screen.queryByText(/Pedidos e carteira/i)).not.toBeInTheDocument();
  });

  it('keeps branch selection out of the module sidebar', () => {
    mockCompany('1004');
    render(createElement(MemoryRouter, { initialEntries: ['/comercial/dashboard'], future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(ComercialSidebar)));

    expect(screen.queryByRole('radiogroup', { name: /Filial ativa/i })).not.toBeInTheDocument();
  });

  it('starts compact on desktop and expands through hover styles', () => {
    mockCompany('1004');
    render(createElement(MemoryRouter, { initialEntries: ['/comercial/dashboard'], future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(ComercialSidebar)));

    expect(screen.getByRole('complementary')).toHaveClass('pelegrini-sidebar-collapsible');
    expect(screen.getByRole('complementary')).toHaveAttribute('data-desktop-state', 'collapsed');
  });

  it('uses icon navigation without numeric indexes', () => {
    mockCompany('1004');
    render(createElement(MemoryRouter, { initialEntries: ['/comercial/dashboard'], future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(ComercialSidebar)));

    expect(screen.getByRole('complementary')).toHaveAttribute('data-navigation-style', 'default');
    expect(screen.queryByText('01')).not.toBeInTheDocument();
  });

  it('respects reduced motion for the mobile sidebar transition', () => {
    mockCompany('1004');
    render(createElement(MemoryRouter, { initialEntries: ['/comercial/dashboard'], future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(ComercialSidebar)));

    expect(screen.getByRole('complementary')).toHaveClass('motion-reduce:transition-none', 'motion-reduce:duration-0');
  });

  it('keeps both disabled future items for other companies', () => {
    mockCompany('9999');
    render(createElement(MemoryRouter, { initialEntries: ['/comercial/dashboard'], future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(ComercialSidebar)));

    expect(screen.queryByRole('link', { name: 'Cotações Abertas' })).not.toBeInTheDocument();
    expect(screen.getByText('Em breve')).toBeInTheDocument();
    expect(screen.getAllByText('BREVE')).toHaveLength(2);
  });

  it('labels the commercial mobile navigation and exposes its visual hook', () => {
    mockCompany('1004');
    render(createElement(
      MemoryRouter,
      { initialEntries: ['/comercial/dashboard'], future: { v7_startTransition: true, v7_relativeSplatPath: true } },
      createElement(ComercialMobileBottomNav),
    ));

    expect(screen.getByRole('navigation', { name: 'Navegacao comercial mobile' }))
      .toHaveClass('commercial-mobile-navigation');
  });

  it('keeps the blocked mobile branch placeholder inside the commercial shell', () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    vi.mocked(useFilialSelecionada).mockReturnValue({
      filialAtiva: null,
      codEmpresaContexto: '1004',
      clearFilial: vi.fn(),
      setFilialAtivaForEmpresa: vi.fn(),
      empresaPossuiFiliaisAtiva: true,
    } as never);
    vi.mocked(useAuth).mockReturnValue({ isMaster: false, profile: null } as never);

    render(createElement(MemoryRouter, undefined, createElement(ComercialLayout)));

    expect(screen.getByText('Selecione uma filial para continuar').closest('[data-module-shell]'))
      .toHaveAttribute('data-module-shell', 'comercial');
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
    expect(screen.getByRole('dialog')).toHaveClass('commercial-overlay');
    expect(screen.getByRole('navigation')).not.toContainElement(screen.getByRole('dialog'));
    const openQuotesLink = screen.getByRole('link', { name: 'Cotações Abertas' });
    const lostSalesLink = screen.getByRole('link', { name: 'Vendas Perdidas' });

    expect(openQuotesLink).toHaveAttribute('href', '/comercial/cotacoes');
    expect(openQuotesLink).toHaveClass('h-11');
    expect(lostSalesLink).toHaveAttribute('href', '/comercial/perdidas');
    expect(lostSalesLink).toHaveClass('h-11');

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

  it('renders the App-registered lost-sales route for company 1004', async () => {
    const AppModule = await import('@/App');
    const route = (AppModule as AppExports).VENDAS_PERDIDAS_ROUTE!;

    expect(route).toMatchObject({ path: 'perdidas', Component: expect.any(Function) });

    const renderLostSalesRoute = (codEmpresa: string) => {
      mockCompany(codEmpresa);
      render(createElement(
        MemoryRouter,
        { initialEntries: ['/comercial/perdidas'], future: { v7_startTransition: true, v7_relativeSplatPath: true } },
        createElement(
          Routes,
          undefined,
          createElement(Route, { path: '/comercial' }, createElement(Route, route)),
          createElement(Route, { path: '/comercial/dashboard', element: createElement('p', undefined, 'Dashboard comercial') }),
        ),
      ));
    };

    renderLostSalesRoute('1004');
    expect(await screen.findByRole(
      'heading',
      { name: 'Vendas perdidas' },
      { timeout: 10_000 },
    )).toBeInTheDocument();

    cleanup();
    renderLostSalesRoute('9999');
    expect(screen.getByText('Dashboard comercial')).toBeInTheDocument();
  }, 30_000);
});
