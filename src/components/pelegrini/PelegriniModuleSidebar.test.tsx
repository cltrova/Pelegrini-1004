import { render, screen, within } from '@testing-library/react';
import { LayoutDashboard, Package } from 'lucide-react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { PelegriniModuleSidebar } from './PelegriniModuleSidebar';

const items = [
  { label: 'Dashboard', path: '/comercial/dashboard', icon: LayoutDashboard },
  { label: 'Produtos', path: '/comercial/produtos', icon: Package },
];

function renderSidebar({ withFutureItem = false } = {}) {
  return render(
    <MemoryRouter
      initialEntries={['/comercial/dashboard']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <PelegriniModuleSidebar
        theme={resolvePelegriniTheme('transmissao')}
        items={items}
        futureItems={withFutureItem ? [{ ...items[1], label: 'Em análise', disabled: true }] : undefined}
        mobileOpen={false}
        onMobileOpenChange={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe('PelegriniModuleSidebar', () => {
  it('exposes the shared sidebar with the binding collapsed resting-state marker', () => {
    renderSidebar();

    expect(screen.getByTestId('module-sidebar')).toHaveAttribute('data-state', 'collapsed');
  });

  it('renders a dedicated compact brand alongside the expanded brand', () => {
    renderSidebar();

    const compactBrand = screen.getByTestId('sidebar-brand-compact');
    expect(compactBrand).toBeInTheDocument();
    expect(within(compactBrand).getByRole('img', { name: 'Logo Casa da Transmissão' })).toBeInTheDocument();
  });

  it('wraps every navigation label and the home label explicitly', () => {
    renderSidebar();

    const navigation = screen.getByRole('navigation', { name: 'Navegação do módulo' });
    const labels = within(navigation).getAllByTestId('sidebar-label');

    expect(labels).toHaveLength(items.length);
    labels.forEach((label) => expect(label).toHaveClass('sidebar-label'));
    expect(screen.getByTestId('sidebar-home-label')).toHaveClass('sidebar-label');
    expect(screen.getByTestId('sidebar-home-label')).toHaveTextContent('Voltar aos módulos');
  });

  it('keeps compact links accessible by name and exposes native tooltip titles', () => {
    renderSidebar();

    items.forEach((item) => {
      expect(screen.getByRole('link', { name: item.label })).toHaveAttribute('title', item.label);
    });

    expect(screen.getByRole('button', { name: 'Voltar aos módulos' })).toHaveAttribute(
      'title',
      'Voltar aos módulos',
    );
  });

  it('gives the future-section label an explicit zero-width styling hook', () => {
    renderSidebar({ withFutureItem: true });

    expect(screen.getByTestId('sidebar-future-label')).toHaveClass(
      'sidebar-label',
      'sidebar-section-label',
    );
  });
});
