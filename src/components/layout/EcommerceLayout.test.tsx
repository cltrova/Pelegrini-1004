import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { EcommerceLayout } from './EcommerceLayout';

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({ filialAtiva: 'chevrolet' }),
}));

vi.mock('@/components/pelegrini/PelegriniModuleSidebar', () => ({
  PelegriniModuleSidebar: ({ items }: { items: Array<{ label: string; path: string }> }) => (
    <nav aria-label="Navegação do módulo">
      {items.map((item) => <a key={item.path} href={item.path}>{item.label}</a>)}
    </nav>
  ),
}));

vi.mock('@/components/pelegrini/PelegriniModuleShell', () => ({
  PelegriniModuleShell: ({ children, sidebar, moduleKey }: { children: ReactNode; sidebar: ReactNode; moduleKey?: string }) => (
    <div data-module-shell={moduleKey}>{sidebar}<main>{children}</main></div>
  ),
}));

describe('EcommerceLayout', () => {
  it('renders the four E-Commerce destinations and nested content', () => {
    render(
      <MemoryRouter initialEntries={['/ecommerce/anuncios']}>
        <Routes>
          <Route path="/ecommerce" element={<EcommerceLayout />}>
            <Route path="anuncios" element={<Outlet />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Visão geral' })).toHaveAttribute('href', '/ecommerce');
    expect(screen.getByRole('link', { name: 'Anúncios' })).toHaveAttribute('href', '/ecommerce/anuncios');
    expect(screen.getByRole('link', { name: 'Pedidos' })).toHaveAttribute('href', '/ecommerce/pedidos');
    expect(screen.getByRole('link', { name: 'Configurações' })).toHaveAttribute('href', '/ecommerce/configuracoes');
    expect(screen.getByTestId('ecommerce-route-outlet')).toBeInTheDocument();
  });
});
