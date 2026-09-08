import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from './AuthContext';

const supabaseAuth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: supabaseAuth,
    from: vi.fn(),
  },
}));

function AuthProbe() {
  const { isAuthenticated, login, logout } = useAuth();

  return (
    <div>
      <span>{isAuthenticated ? 'autenticado' : 'desconectado'}</span>
      <button type="button" onClick={() => login('preview@pelegrini.local', 'senha-errada')}>Login inválido</button>
      <button type="button" onClick={() => login('preview@pelegrini.local', 'preview123')}>Login válido</button>
      <button type="button" onClick={() => logout()}>Sair</button>
    </div>
  );
}

function renderAuthProbe() {
  return render(<AuthProvider><AuthProbe /></AuthProvider>);
}

describe('AuthProvider no ambiente local', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_LOCAL_PREVIEW', 'true');
    localStorage.clear();
    Object.values(supabaseAuth).forEach((mock) => mock.mockReset());
  });

  it('exige credenciais locais válidas, persiste a sessão e não consulta o Supabase', async () => {
    const firstRender = renderAuthProbe();

    expect(screen.getByText('desconectado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Login inválido' }));
    await waitFor(() => expect(screen.getByText('desconectado')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Login válido' }));
    await waitFor(() => expect(screen.getByText('autenticado')).toBeInTheDocument());

    firstRender.unmount();
    renderAuthProbe();
    expect(screen.getByText('autenticado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(screen.getByText('desconectado')).toBeInTheDocument());

    expect(supabaseAuth.getSession).not.toHaveBeenCalled();
    expect(supabaseAuth.onAuthStateChange).not.toHaveBeenCalled();
    expect(supabaseAuth.signInWithPassword).not.toHaveBeenCalled();
    expect(supabaseAuth.signOut).not.toHaveBeenCalled();
  });
});
