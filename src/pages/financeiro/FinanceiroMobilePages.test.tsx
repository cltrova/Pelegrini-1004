import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceiroSearchProvider } from '@/contexts/FinanceiroSearchContext';
import DrePage from './DrePage';
import VariacaoPage from './VariacaoPage';

const { refetch } = vi.hoisted(() => ({ refetch: vi.fn() }));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock('@/contexts/FilialSelecionadaContext', () => ({ useFilialSelecionada: () => ({ filialAtiva: null }) }));
vi.mock('@/hooks/useEmpresaAtiva', () => ({ useEmpresaAtiva: () => ({ empresa: null, codEmpresaAtiva: '1004' }) }));
vi.mock('@/hooks/useDreData', () => ({
  useDreData: () => ({ data: undefined, isLoading: false, isError: false, refetch }),
}));
vi.mock('@/hooks/useDreExpenseAccountConfig', () => ({ useDreExpenseAccountConfig: () => ({}) }));
vi.mock('@/hooks/useDfcLineConfig', () => ({ useDfcLineConfig: () => ({ config: [] }) }));
vi.mock('@/hooks/useVariacaoData', () => ({
  DEFAULT_GRUPOS_ATIVOS_OPERACIONAIS: [],
  useDFCCrossYear: () => ({
    dfc: { linhas: [] },
    filterOptions: { anos: ['2025'], empresas: [] },
    isLoading: false,
    isError: false,
    refetch,
  }),
  useFluxoCaixaDashboard: () => ({ grupos: [] }),
  useVariacaoData: () => ({}),
}));

const pages = [
  { title: 'DRE', path: '/financeiro/dre', Page: DrePage },
  { title: 'Variação', path: '/financeiro/variacao', Page: VariacaoPage },
];

function renderRoute({ path, Page }: (typeof pages)[number], width: number) {
  vi.stubGlobal('innerWidth', width);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(max-width: 767px)' && width < 768,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));

  return render(
    <MemoryRouter initialEntries={[path]}>
      <FinanceiroSearchProvider>
        <div data-module-shell="financeiro"><Page /></div>
      </FinanceiroSearchProvider>
    </MemoryRouter>,
  );
}

describe('Financeiro layouts at the mobile breakpoint', () => {
  beforeEach(() => refetch.mockClear());
  afterEach(() => vi.unstubAllGlobals());

  it.each(pages)('$title styles the rendered mobile rail and keeps filters and refresh usable', async (route) => {
    renderRoute(route, 767);

    const heading = screen.getByRole('heading', { name: route.title, level: 1 });
    const workspace = heading.closest('.financial-workspace');
    expect(workspace).toHaveClass('financial-mobile-workspace', 'min-h-0', 'flex-1');

    const filter = screen.getByRole('button', { name: 'Abrir filtros' });
    const header = filter.closest('.safe-area-top');
    expect(header).toHaveClass('financial-mobile-header');
    expect(header?.parentElement).toBe(workspace);
    expect(screen.getByRole('navigation').parentElement).toBe(workspace);

    const refresh = screen.getByRole('button', { name: 'Atualizar dados' });
    expect(header).toContainElement(refresh);
    fireEvent.click(refresh);
    expect(refetch).toHaveBeenCalledOnce();
    fireEvent.click(filter);
    expect(await screen.findByRole('dialog', { name: 'Filtros' })).toBeInTheDocument();
  });

  it.each(pages)('$title uses the desktop layout starting at 768px', (route) => {
    renderRoute(route, 768);

    const heading = screen.getByRole('heading', { name: route.title, level: 1 });
    expect(heading.closest('.financial-workspace')).not.toHaveClass('financial-mobile-workspace');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('selects the mobile Dashboard tab by keyboard and keeps its panel tied to the trigger', () => {
    renderRoute(pages[1], 360);

    const tablist = screen.getByRole('tablist', { name: 'Visões da variação' });
    const demonstracao = within(tablist).getByRole('tab', { name: 'Demonstração' });
    const dashboard = within(tablist).getByRole('tab', { name: 'Dashboard' });
    expect(demonstracao).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(dashboard, { key: 'Enter' });

    const panel = screen.getByRole('tabpanel', { name: 'Dashboard' });
    expect(dashboard).toHaveAttribute('aria-selected', 'true');
    expect(dashboard).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveClass('financial-data-viewport');
  });
});
