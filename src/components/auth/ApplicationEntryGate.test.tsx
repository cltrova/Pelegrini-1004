import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PasswordGate } from '@/App';

const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: false,
  mustChangePassword: false,
  login: vi.fn(),
  signup: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('@/contexts/AuthContext')>('@/contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => authState,
  };
});

describe('Application entry gate', () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
    authState.isLoading = false;
    authState.mustChangePassword = false;
    authState.login.mockReset();
    authState.signup.mockReset();
  });

  it('shows the CT and CCH login experience before exposing the application', () => {
    render(
      <PasswordGate>
        <p>Conteudo protegido</p>
      </PasswordGate>,
    );

    expect(screen.getByRole('heading', { name: 'Acesse sua central' })).toBeInTheDocument();
    expect(screen.getByText('Casa da Transmissão')).toBeInTheDocument();
    expect(screen.getByText('Casa do Chevrolet')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.queryByText('Conteudo protegido')).not.toBeInTheDocument();
  });

  it('keeps the requested application content after authentication', () => {
    authState.isAuthenticated = true;

    render(
      <PasswordGate>
        <p>Conteudo protegido</p>
      </PasswordGate>,
    );

    expect(screen.getByText('Conteudo protegido')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Acesse sua central' })).not.toBeInTheDocument();
  });

  it('switches the institutional visual without selecting an operational branch', () => {
    render(<PasswordGate><p>Conteudo protegido</p></PasswordGate>);

    const transmissao = screen.getByRole('button', { name: 'Casa da Transmissão' });
    const chevrolet = screen.getByRole('button', { name: 'Casa do Chevrolet' });
    expect(transmissao).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(chevrolet);

    expect(chevrolet).toHaveAttribute('aria-pressed', 'true');
    expect(transmissao).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Peças originais, estoque e atendimento ágil.')).toBeInTheDocument();
  });

  it('submits credentials and keeps authentication errors inside the access panel', async () => {
    authState.login.mockResolvedValue({ success: false, error: 'Credenciais inválidas' });
    render(<PasswordGate><p>Conteudo protegido</p></PasswordGate>);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'gestor@pelegrini.com.br' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar no sistema' }));

    await waitFor(() => expect(authState.login).toHaveBeenCalledWith('gestor@pelegrini.com.br', 'senha123'));
    expect(screen.getByRole('alert')).toHaveTextContent('Credenciais inválidas');
  });
});
