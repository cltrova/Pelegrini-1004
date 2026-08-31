import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
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
  useFilialSelecionada: () => ({ filialAtiva: testState.filialAtiva }),
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

  it('composes desktop Home as a compact technical module grid', () => {
    const { container } = render(<MemoryRouter><HomePage /></MemoryRouter>);

    expect(screen.getByRole('heading', { level: 1, name: /^M[oó]dulos$/ })).toBeInTheDocument();
    expect(container.querySelector('[data-home-modules]')).toHaveClass('sm:grid-cols-2');
    expect(container.querySelectorAll('.home-module-card')).toHaveLength(4);
    expect(screen.getByRole('button', { name: /Configuracoes/i })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Pelegrini|Lovable|BI Reports/i);
    expect(container.querySelector('[class*="gradient"]')).not.toBeInTheDocument();
  });

  it('composes mobile Home as one contained column with 44 px controls', () => {
    const { container } = render(<MemoryRouter><HomeMobilePage /></MemoryRouter>);

    expect(container.querySelector('[data-home-modules]')).not.toHaveClass('sm:grid-cols-2');
    expect(container.querySelectorAll('.home-module-card')).toHaveLength(4);
    expect(container.querySelectorAll('.home-module-card')[0]).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: /Configuracoes/i })).toHaveClass('min-h-11');
    expect(container.textContent).not.toMatch(/Pelegrini|Lovable|BI Reports/i);
  });

  it('applies the active branch identity without rendering an inline branch selector', () => {
    testState.filialAtiva = 'chevrolet';

    const { container } = render(<MemoryRouter><HomePage /></MemoryRouter>);

    expect(container.firstElementChild).toHaveAttribute('data-pelegrini-theme', 'chevrolet');
    expect(screen.getByRole('img', { name: 'Logo Casa do Chevrolet' })).toBeInTheDocument();
    expect(screen.getByText('CCH')).toBeInTheDocument();
    expect(screen.queryByText('Escolha a unidade')).not.toBeInTheDocument();
  });
});
