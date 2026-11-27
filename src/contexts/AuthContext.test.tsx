import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from './AuthContext';

const supabaseAuth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
}));
const from = vi.hoisted(() => vi.fn());

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: supabaseAuth,
    from,
  },
}));
vi.mock('@/config/supabase', () => ({ isSupabaseConfigured: () => true }));

afterEach(() => vi.unstubAllEnvs());

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

it('consulta perfil e papel em paralelo e libera o portal após ambas as respostas', async () => {
  vi.stubEnv('VITE_LOCAL_PREVIEW', 'false');
  supabaseAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'gerente-teste' } } } });
  supabaseAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  let concluirPerfil!: (value: { data: { cod_empresa_bi: string }; error: null }) => void;
  const perfil = new Promise<Parameters<typeof concluirPerfil>[0]>((resolve) => { concluirPerfil = resolve; });
  const runRoles = vi.fn().mockResolvedValue({ data: [{ role: 'gerencial' }], error: null });
  from.mockImplementation((table) => ({
    select: () => ({ eq: table === 'profiles' ? () => ({ maybeSingle: () => perfil }) : runRoles }),
  }));

  function Permissoes() {
    const { isLoading, isGerencial, codEmpresa } = useAuth();
    return <span>{isLoading ? 'Carregando acesso' : `${codEmpresa} ${isGerencial ? 'gerencial' : ''}`}</span>;
  }

  render(<AuthProvider><Permissoes /></AuthProvider>);
  await waitFor(() => expect(runRoles).toHaveBeenCalledWith('user_id', 'gerente-teste'));
  expect(screen.getByText('Carregando acesso')).toBeVisible();
  concluirPerfil({ data: { cod_empresa_bi: '10041' }, error: null });
  expect(await screen.findByText('10041 gerencial')).toBeVisible();
});
