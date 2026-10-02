import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequireEcommerceBranch } from './RequireEcommerceBranch';

const authState = { isAuthenticated: true, isLoading: false };
const empresaState = { codEmpresaAtiva: '1004', isLoading: false };
const filialState = { filialAtiva: 'chevrolet' };

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: () => empresaState,
}));

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => filialState,
}));

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/ecommerce']}>
      <Routes>
        <Route path="/ecommerce" element={<RequireEcommerceBranch><p>ecommerce ok</p></RequireEcommerceBranch>} />
        <Route path="/" element={<p>home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireEcommerceBranch', () => {
  beforeEach(() => {
    authState.isAuthenticated = true;
    authState.isLoading = false;
    empresaState.codEmpresaAtiva = '1004';
    empresaState.isLoading = false;
    filialState.filialAtiva = 'chevrolet';
  });

  it('allows authenticated users on the Chevrolet branch', () => {
    renderGuard();

    expect(screen.getByText('ecommerce ok')).toBeInTheDocument();
  });

  it('redirects unauthenticated users to the safe home route', () => {
    authState.isAuthenticated = false;
    renderGuard();

    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('redirects users from the Transmissao branch', () => {
    filialState.filialAtiva = 'transmissao';
    renderGuard();

    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('redirects when the active company is outside Pelegrini', () => {
    empresaState.codEmpresaAtiva = '9999';
    renderGuard();

    expect(screen.getByText('home')).toBeInTheDocument();
  });
});
