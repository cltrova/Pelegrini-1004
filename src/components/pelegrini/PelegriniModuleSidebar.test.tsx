import { render, screen, within } from '@testing-library/react';
import { LayoutDashboard, Package } from 'lucide-react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { PelegriniModuleSidebar } from './PelegriniModuleSidebar';

const items = [
  { label: 'Dashboard', path: '/comercial/dashboard', icon: LayoutDashboard },
  { label: 'Produtos', path: '/comercial/produtos', icon: Package },
];

function renderSidebar({
  withFutureItem = false,
  branch = 'transmissao',
}: {
  withFutureItem?: boolean;
  branch?: 'transmissao' | 'chevrolet';
} = {}) {
  return render(
    <MemoryRouter
      initialEntries={['/comercial/dashboard']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <PelegriniModuleSidebar
        theme={resolvePelegriniTheme(branch)}
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

  it('keeps the Chevrolet brand empty while the sidebar is collapsed', () => {
    renderSidebar({ branch: 'chevrolet' });

    expect(screen.queryByTestId('sidebar-brand-compact')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Logo Casa do Chevrolet' })).toBeInTheDocument();
  });

  it('swaps the sidebar brands only after the width transition has settled', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');

    expect(css).toContain('.pelegrini-sidebar-collapsible .sidebar-brand-expanded');
    expect(css).toContain('transition-delay: 210ms');
    expect(css).not.toContain('focus-within .sidebar-brand-compact {\n      display: none;');
  });

  it('anchors each logo to the center of its final sidebar width', () => {
    renderSidebar();

    const compactBrand = screen.getByTestId('sidebar-brand-compact');
    const expandedBrand = compactBrand.nextElementSibling as HTMLElement;

    expect(within(compactBrand).getByRole('img')).toHaveClass('max-w-12');
    expect(within(expandedBrand).getByRole('img')).toHaveClass('max-w-24');

    const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');
    expect(css).toContain('left: 36px');
    expect(css).toContain('left: 124px');
    expect(css).toContain('translate(-50%, -50%)');
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
