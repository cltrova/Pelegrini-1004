import { act, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the CT and CCH login experience before exposing the application', () => {
    render(
      <PasswordGate>
        <p>Conteudo protegido</p>
      </PasswordGate>,
    );

    expect(screen.getByRole('heading', { name: 'Acesso ao sistema' })).toBeInTheDocument();
    const transmissionLogo = screen.getByRole('img', { name: 'Casa da Transmissão' });
    expect(transmissionLogo).toHaveAttribute('data-transmission-full-logo');
    expect(transmissionLogo).toHaveAttribute('src', '/brand/home/transmissao-full-white.png');
    expect(transmissionLogo.parentElement).toHaveClass('pelegrini-login-logo-stage');
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(document.querySelector('.pelegrini-login')).toHaveAttribute('data-layout', 'split-60-40');
    expect(document.querySelectorAll('[data-login-field]')).toHaveLength(2);
    expect(document.querySelector('[data-login-field="email"]')).toContainElement(screen.getByLabelText('Email'));
    expect(document.querySelector('[data-login-field="password"]')).toContainElement(screen.getByLabelText('Senha'));
    expect(screen.queryByText('Criar conta')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Confirmar senha')).not.toBeInTheDocument();
    expect(document.querySelector('[data-login-branch-mark]')).not.toBeInTheDocument();
    expect(screen.queryByText('Central de gestão')).not.toBeInTheDocument();
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
    expect(screen.queryByRole('heading', { name: 'Acesso ao sistema' })).not.toBeInTheDocument();
  });

  it('rotates the institutional story automatically without branch choice buttons', () => {
    vi.useFakeTimers();
    render(<PasswordGate><p>Conteudo protegido</p></PasswordGate>);

    expect(screen.queryByRole('button', { name: 'Casa da Transmissão' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Casa do Chevrolet' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Casa da Transmissão' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.getByRole('img', { name: 'Casa do Chevrolet' })).toBeInTheDocument();
    expect(screen.getByText('Peças originais, estoque e atendimento ágil.')).toBeInTheDocument();
    expect(document.querySelector('[data-login-branch-mark]')).not.toBeInTheDocument();
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

  it('shows actionable validation before calling authentication', async () => {
    render(<PasswordGate><p>Conteudo protegido</p></PasswordGate>);

    fireEvent.submit(screen.getByRole('button', { name: 'Entrar no sistema' }).closest('form')!);

    expect(await screen.findByText('Informe seu email.')).toBeInTheDocument();
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-invalid', 'true');
    expect(authState.login).not.toHaveBeenCalled();
  });

  it('warns when caps lock is active while typing the password', () => {
    render(<PasswordGate><p>Conteudo protegido</p></PasswordGate>);

    const passwordInput = screen.getByLabelText('Senha');
    const capsLockEvent = createEvent.keyDown(passwordInput, { key: 'A' });
    Object.defineProperty(capsLockEvent, 'getModifierState', {
      value: (key: string) => key === 'CapsLock',
    });
    fireEvent(passwordInput, capsLockEvent);

    expect(screen.getByRole('status')).toHaveTextContent('Caps Lock ativado');
  });
});
