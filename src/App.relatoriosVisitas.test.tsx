import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import type { AppRole } from '@/types/auth';

const contexto = vi.hoisted(() => ({
  perfil: 'master' as AppRole | null,
  empresaDoPerfil: '1004',
  filiaisPermitidas: ['chevrolet', 'transmissao'],
  carregandoAutenticacao: false,
  emDispositivoMovel: false,
  relatorioRenderizado: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: PropsWithChildren) => children,
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: contexto.carregandoAutenticacao,
    isMaster: contexto.perfil === 'master',
    isGerencial: contexto.perfil === 'gerencial',
    roles: contexto.perfil ? [contexto.perfil] : [],
    codEmpresa: contexto.empresaDoPerfil,
    profile: { filiais_permitidas: contexto.filiaisPermitidas },
  }),
}));

vi.mock('@/hooks/useEmpresaConfig', () => ({
  useEmpresaConfig: () => ({ isLoading: false, hasModulo: () => true }),
}));

vi.mock('@/hooks/useUserModulePermissions', () => ({
  useUserModulePermissions: () => ({ isLoading: false, canAccessComercial: true }),
}));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => contexto.emDispositivoMovel }));
vi.mock('@/components/common/AppInstallBranding', () => ({ AppInstallBranding: () => null }));
vi.mock('@/pages/comercial/MetasVendedoresPage', () => ({ default: () => <h1>Dashboard comercial</h1> }));
vi.mock('@/pages/visitas/VisitasGerenciaPage', () => ({
  default: () => {
    contexto.relatorioRenderizado();
    return <h1>Relatórios de visitas</h1>;
  },
}));

function abrirRelatorios() {
  window.history.replaceState(null, '', '/comercial/visitas');
  return render(<App />);
}

describe('Acesso direto aos relatórios de visitas no Comercial', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      media: query,
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    localStorage.clear();
    contexto.perfil = 'master';
    contexto.empresaDoPerfil = '1004';
    contexto.filiaisPermitidas = ['chevrolet', 'transmissao'];
    contexto.carregandoAutenticacao = false;
    contexto.emDispositivoMovel = false;
    contexto.relatorioRenderizado.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
    localStorage.clear();
  });

  it.each(['master', 'gerencial', 'vendedor'] as const)('redireciona o perfil %s com Transmissão persistida', async (perfil) => {
    contexto.perfil = perfil;
    localStorage.setItem('bi-reports-filial-1004', 'transmissao');
    abrirRelatorios();

    expect(await screen.findByRole('heading', { name: 'Dashboard comercial' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/comercial/dashboard');
    expect(contexto.relatorioRenderizado).not.toHaveBeenCalled();
  });

  it.each(['master', 'gerencial'] as const)('permite o perfil %s com Chevrolet persistida', async (perfil) => {
    contexto.perfil = perfil;
    localStorage.setItem('bi-reports-filial-1004', 'chevrolet');
    abrirRelatorios();

    expect(await screen.findByRole('heading', { name: 'Relatórios de visitas' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/comercial/visitas');
  });

  it('mantém a permissão de perfil na filial Chevrolet', async () => {
    contexto.perfil = 'vendedor';
    localStorage.setItem('bi-reports-filial-1004', 'chevrolet');
    abrirRelatorios();

    expect(await screen.findByText('Acesso Negado')).toBeInTheDocument();
    expect(contexto.relatorioRenderizado).not.toHaveBeenCalled();
  });

  it('aguarda a seleção de filial no celular e redireciona quando a escolha é Transmissão', async () => {
    contexto.emDispositivoMovel = true;
    localStorage.setItem('bi-reports-filial-10041', 'chevrolet');
    abrirRelatorios();

    expect(await screen.findByRole('heading', { name: 'Selecione uma filial para continuar' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/comercial/visitas');
    expect(contexto.relatorioRenderizado).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Casa da Transmissão' }));

    expect(await screen.findByRole('heading', { name: 'Dashboard comercial' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/comercial/dashboard');
    expect(contexto.relatorioRenderizado).not.toHaveBeenCalled();
  });

  it('abre o relatório quando a escolha de filial é Chevrolet', async () => {
    abrirRelatorios();

    fireEvent.click(await screen.findByRole('button', { name: /^Casa d[ao] Chevrolet$/ }));

    expect(await screen.findByRole('heading', { name: 'Relatórios de visitas' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/comercial/visitas');
  });

  it('usa a filial única da empresa 10041 quando o Master tem Transmissão persistida na 1004', async () => {
    localStorage.setItem('bi-reports-empresa-selecionada', '10041');
    localStorage.setItem('bi-reports-filial-1004', 'transmissao');
    abrirRelatorios();

    expect(await screen.findByRole('heading', { name: 'Relatórios de visitas' })).toBeInTheDocument();
    expect(localStorage.getItem('bi-reports-filial-10041')).toBe('chevrolet');
  });

  it('usa a filial do perfil Gerencial da empresa 10041', async () => {
    contexto.perfil = 'gerencial';
    contexto.empresaDoPerfil = '10041';
    localStorage.setItem('bi-reports-filial-1004', 'transmissao');
    abrirRelatorios();

    expect(await screen.findByRole('heading', { name: 'Relatórios de visitas' })).toBeInTheDocument();
    expect(localStorage.getItem('bi-reports-filial-10041')).toBe('chevrolet');
  });

  it('aguarda a filial da empresa 10041 ao carregar o perfil Master', async () => {
    contexto.perfil = null;
    contexto.carregandoAutenticacao = true;
    localStorage.setItem('bi-reports-empresa-selecionada', '10041');
    localStorage.setItem('bi-reports-filial-1004', 'transmissao');
    const { rerender } = abrirRelatorios();

    contexto.perfil = 'master';
    contexto.carregandoAutenticacao = false;
    rerender(<App />);

    expect(await screen.findByRole('heading', { name: 'Relatórios de visitas' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/comercial/visitas');
  });

  it('aguarda a filial na empresa 10041 quando o perfil não tem filial liberada', async () => {
    contexto.perfil = 'gerencial';
    contexto.empresaDoPerfil = '10041';
    contexto.filiaisPermitidas = [];
    localStorage.setItem('bi-reports-empresa-selecionada', '10041');
    localStorage.setItem('bi-reports-filial-10041', 'chevrolet');
    abrirRelatorios();

    expect(await screen.findByRole('heading', { name: 'Selecione uma filial para continuar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chevrolet/ })).toBeDisabled();
    expect(contexto.relatorioRenderizado).not.toHaveBeenCalled();
  });
});
