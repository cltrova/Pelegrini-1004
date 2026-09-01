import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import HomePage from '@/pages/HomePage';
import HomeMobilePage from '@/pages/HomeMobilePage';
import { PelegriniDataPanel } from './PelegriniDataPanel';
import { PelegriniFilterBar } from './PelegriniFilterBar';
import { PelegriniOperationalCard } from './PelegriniOperationalCard';
import { PelegriniPageHeader } from './PelegriniPageHeader';

const testState = vi.hoisted(() => ({
  isMobile: false,
  filialAtiva: 'transmissao',
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isVendedor: false,
    canAccessSettings: true,
    isMaster: true,
    codEmpresa: '1004',
    user: { email: 'operacao@example.com' },
    logout: vi.fn(),
  }),
}));

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({ filialAtiva: testState.filialAtiva, setFilialAtivaForEmpresa: vi.fn() }),
}));

vi.mock('@/contexts/EmpresaSelecionadaContext', () => ({
  useEmpresaSelecionada: () => ({ setEmpresaSelecionada: vi.fn() }),
}));

vi.mock('@/hooks/useEmpresaConfig', () => ({
  useEmpresaConfig: () => ({ isMaster: true, hasModulo: () => true }),
}));

vi.mock('@/hooks/useUserModulePermissions', () => ({
  useUserModulePermissions: () => ({
    permissions: { modulo_resumo: true, modulo_dre: true, modulo_variacao: true },
    hasUserModuleAccess: () => true,
  }),
}));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => testState.isMobile }));
vi.mock('@/components/common/ThemeToggle', () => ({ ThemeToggle: () => <button type="button">Tema</button> }));
vi.mock('@/components/auth/LoginDialog', () => ({ LoginDialog: () => null }));
vi.mock('@/components/common/ModuleDetailsDialog', () => ({ ModuleDetailsDialog: () => null }));
vi.mock('@/components/common/FilialSelectorDialog', () => ({ FilialSelectorDialog: () => null }));
vi.mock('@/components/layout/MobileBottomNav', () => ({ MobileBottomNav: () => null }));

function expectRestrainedSurface(element: HTMLElement) {
  expect(element).toHaveClass('min-w-0');
  expect(element).not.toHaveClass('premium-card');
  expect(element.className).not.toMatch(/gradient/i);
}

describe('Pelegrini visual foundation', () => {
  beforeEach(() => {
    testState.isMobile = false;
    testState.filialAtiva = 'transmissao';
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
  });

  it('renders the page header as a contained title and action row', () => {
    render(
      <PelegriniPageHeader
        eyebrow="Operacao tecnica"
        title="Estoque"
        actions={<button type="button">Atualizar</button>}
      />,
    );

    const header = screen.getByTestId('pelegrini-page-header');
    expectRestrainedSurface(header);
    expect(screen.getByRole('heading', { name: 'Estoque' })).toBeInTheDocument();
    expect(screen.getByText('Operacao tecnica')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atualizar' })).toBeInTheDocument();
  });

  it('lays out filters and actions without introducing a panel inside a panel', () => {
    render(
      <PelegriniFilterBar actions={<button type="button">Limpar</button>}>
        <label>Periodo <input /></label>
      </PelegriniFilterBar>,
    );

    const filterBar = screen.getByTestId('pelegrini-filter-bar');
    expectRestrainedSurface(filterBar);
    expect(screen.getByRole('button', { name: 'Limpar' })).toBeInTheDocument();
    expect(screen.getByLabelText('Periodo')).toBeInTheDocument();
  });

  it('marks a data panel and contains both its heading action and content', () => {
    render(
      <PelegriniDataPanel title="Pedidos" action={<button type="button">Exportar</button>}>
        <div>Lista operacional</div>
      </PelegriniDataPanel>,
    );

    const panel = screen.getByText('Lista operacional').closest('[data-pelegrini-panel]');
    expect(panel).not.toBeNull();
    expectRestrainedSurface(panel as HTMLElement);
    expect(screen.getByRole('heading', { name: 'Pedidos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument();
  });

  it('keeps module cards concise with a stable icon and no more than two tags', () => {
    render(
      <PelegriniOperationalCard
        title="Comercial"
        label="Pedidos e carteira"
        description="Longa explicacao que nao pertence ao cartao operacional."
        tags={['Clientes', 'Produtos', 'Cotacoes']}
        accent="comercial"
        icon={ShoppingCart}
      />,
    );

    const card = screen.getByRole('button', { name: /Comercial.*Pedidos e carteira/i });
    expectRestrainedSurface(card);
    expect(card.querySelector('[data-pelegrini-card-icon]')).toBeInTheDocument();
    expect(screen.queryByText(/Longa explicacao/)).not.toBeInTheDocument();
    expect(screen.getByText('Clientes')).toBeInTheDocument();
    expect(screen.getByText('Produtos')).toBeInTheDocument();
    expect(screen.queryByText('Cotacoes')).not.toBeInTheDocument();
  });

  it('composes desktop Home as a branch choice followed by the technical module grid', () => {
    const { container } = render(<MemoryRouter><HomePage /></MemoryRouter>);

    expect(screen.getByRole('heading', { level: 1, name: 'Escolha a filial' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Casa da Transmissão/i }));
    expect(screen.getByRole('heading', { level: 2, name: /^M[oó]dulos$/ })).toBeInTheDocument();
    expect(container.querySelector('[data-home-modules]')).toHaveClass('pelegrini-home-module-grid');
    expect(container.querySelectorAll('.pelegrini-home-module-card')).toHaveLength(4);
    expect(screen.getByRole('button', { name: /Configuracoes/i })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Lovable|BI Reports/i);
    expect(container.querySelector('[class*="gradient"]')).not.toBeInTheDocument();
  });

  it('composes mobile Home as one contained column with 44 px controls', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });

    const { container } = render(<MemoryRouter><HomeMobilePage /></MemoryRouter>);

    const home = container.firstElementChild;

    expect(window.innerWidth).toBe(390);
    expect(home).toHaveClass('pelegrini-home', 'overflow-x-clip');
    fireEvent.click(screen.getByRole('button', { name: /Casa da Transmissão/i }));
    const moduleGrid = container.querySelector('[data-home-modules]');
    const moduleCards = container.querySelectorAll('.pelegrini-home-module-card');
    expect(moduleGrid).toHaveClass('pelegrini-home-module-grid');
    expect(moduleCards).toHaveLength(4);
    moduleCards.forEach((card) => {
      expect(card).toHaveClass('pelegrini-home-module-card');
    });
    expect(container.querySelector('[class*="w-screen"]')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Configuracoes/i })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Lovable|BI Reports/i);
  });

  it('starts with the group theme and installs distinct CT and CCH variables after branch choice', () => {
    const ctDesktop = render(<MemoryRouter><HomePage /></MemoryRouter>);
    const ctHome = ctDesktop.container.firstElementChild as HTMLElement;

    expect(ctHome).toHaveAttribute('data-pelegrini-theme', 'pelegrini');
    fireEvent.click(screen.getByRole('button', { name: /Casa da Transmissão/i }));
    expect(ctHome).toHaveAttribute('data-pelegrini-theme', 'transmissao');
    expect(ctHome.style.getPropertyValue('--pelegrini-primary')).toBe('#073F73');
    expect(ctHome.style.getPropertyValue('--pelegrini-secondary')).toBe('#0A5291');
    expect(ctHome.style.getPropertyValue('--pelegrini-accent')).toBe('#49D2FF');

    ctDesktop.unmount();
    const ctMobile = render(<MemoryRouter><HomeMobilePage /></MemoryRouter>);
    const ctMobileHome = ctMobile.container.firstElementChild as HTMLElement;

    fireEvent.click(screen.getByRole('button', { name: /Casa da Transmissão/i }));
    expect(ctMobileHome.style.getPropertyValue('--pelegrini-primary')).toBe('#073F73');
    expect(ctMobileHome.style.getPropertyValue('--pelegrini-secondary')).toBe('#0A5291');
    expect(ctMobileHome.style.getPropertyValue('--pelegrini-accent')).toBe('#49D2FF');

    ctMobile.unmount();
    const cchDesktop = render(<MemoryRouter><HomePage /></MemoryRouter>);
    const cchHome = cchDesktop.container.firstElementChild as HTMLElement;

    fireEvent.click(screen.getByRole('button', { name: /Casa do Chevrolet/i }));
    expect(cchHome).toHaveAttribute('data-pelegrini-theme', 'chevrolet');
    expect(cchHome.style.getPropertyValue('--pelegrini-primary')).toBe('#034E99');
    expect(cchHome.style.getPropertyValue('--pelegrini-secondary')).toBe('#0A67BF');
    expect(cchHome.style.getPropertyValue('--pelegrini-accent')).toBe('#E8B923');
    expect(cchHome.style.getPropertyValue('--pelegrini-accent')).not.toBe(ctHome.style.getPropertyValue('--pelegrini-accent'));
    expect(screen.getByRole('img', { name: 'Casa do Chevrolet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Trocar filial/i })).toBeInTheDocument();

    cchDesktop.unmount();
    const cchMobile = render(<MemoryRouter><HomeMobilePage /></MemoryRouter>);
    const cchMobileHome = cchMobile.container.firstElementChild as HTMLElement;

    fireEvent.click(screen.getByRole('button', { name: /Casa do Chevrolet/i }));
    expect(cchMobileHome.style.getPropertyValue('--pelegrini-primary')).toBe('#034E99');
    expect(cchMobileHome.style.getPropertyValue('--pelegrini-secondary')).toBe('#0A67BF');
    expect(cchMobileHome.style.getPropertyValue('--pelegrini-accent')).toBe('#E8B923');
  });

  it('keeps visual foundation value rules independent from viewport width', () => {
    const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');
    const valueRules = [
      ...css.matchAll(/\.(?:kpi-fluid-value|pelegrini-responsive-value(?:\[data-size='(?:sm|lg|hero)'\])?)\s*\{[^}]*\}/g),
    ].map(([rule]) => rule).join('\n');

    expect(valueRules).not.toBe('');
    expect(valueRules).not.toMatch(/\d(?:\.\d+)?vw\b/);
    expect(valueRules).toMatch(/font-size:\s*\d(?:\.\d+)?rem/);

    const filterCountRule = css.match(/\.pelegrini-filter-count\s*\{([^}]*)\}/)?.[1] ?? '';
    const filterCountRadius = Number(filterCountRule.match(/border-radius:\s*(\d+)px/)?.[1]);

    expect(filterCountRadius).toBeGreaterThan(0);
    expect(filterCountRadius).toBeLessThanOrEqual(8);
  });
});
