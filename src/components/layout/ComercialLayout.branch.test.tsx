import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ComercialLayout } from './ComercialLayout';

const filialState = vi.hoisted(() => ({
  clearFilial: vi.fn(),
  setFilialAtivaForEmpresa: vi.fn(),
}));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({
    filialAtiva: 'transmissao',
    codEmpresaContexto: '1004',
    clearFilial: filialState.clearFilial,
    setFilialAtivaForEmpresa: filialState.setFilialAtivaForEmpresa,
    empresaPossuiFiliaisAtiva: true,
  }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isMaster: false,
    profile: { filiais_permitidas: ['transmissao', 'chevrolet'], filial_id: null },
  }),
}));
vi.mock('./ComercialSidebar', () => ({ ComercialSidebar: () => <aside>Sidebar comercial</aside> }));
vi.mock('./ComercialMobileLayout', () => ({ ComercialMobileLayout: () => <div>Layout móvel</div> }));

describe('ComercialLayout branch lifecycle', () => {
  beforeEach(() => filialState.clearFilial.mockClear());

  it('preserves the active branch when leaving the commercial module', () => {
    const view = render(
      <MemoryRouter
        initialEntries={['/comercial/dashboard']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/comercial" element={<ComercialLayout />}>
            <Route path="dashboard" element={<p>Dashboard comercial</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Dashboard comercial')).toBeInTheDocument();
    view.unmount();

    expect(filialState.clearFilial).not.toHaveBeenCalled();
  });
});
