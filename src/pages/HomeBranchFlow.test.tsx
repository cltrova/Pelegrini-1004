import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import HomePage from './HomePage';
import HomeMobilePage from './HomeMobilePage';

const testState = vi.hoisted(() => ({
  isAuthenticated: true,
  isVendedor: false,
  canAccessSettings: true,
  isMaster: false,
  isMobile: false,
  filialAtiva: null as string | null,
  profile: { filiais_permitidas: ['transmissao', 'chevrolet'], filial_id: null },
  permissions: {
    modulo_dre: true,
    modulo_variacao: true,
    modulo_comercial: true,
    modulo_assistente_ia: true,
    modulo_whatsapp: true,
    modulo_operacional: true,
    modulo_resumo: true,
  },
  empresaModules: new Set(['whatsapp', 'comercial', 'operacional', 'financeiro', 'resumo', 'dre', 'variacao']),
  userModules: new Set(['whatsapp', 'comercial', 'operacional', 'financeiro', 'resumo', 'dre', 'variacao']),
  setFilialAtivaForEmpresa: vi.fn(),
  setEmpresaSelecionada: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: testState.isAuthenticated,
    isVendedor: testState.isVendedor,
    canAccessSettings: testState.canAccessSettings,
    isMaster: testState.isMaster,
    codEmpresa: '1004',
    user: { id: 'user-1', email: 'user@example.com' },
    profile: testState.profile,
    logout: vi.fn(),
  }),
}));

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({
    filialAtiva: testState.filialAtiva,
    setFilialAtivaForEmpresa: testState.setFilialAtivaForEmpresa,
  }),
}));

vi.mock('@/contexts/EmpresaSelecionadaContext', () => ({
  useEmpresaSelecionada: () => ({ setEmpresaSelecionada: testState.setEmpresaSelecionada }),
}));

vi.mock('@/hooks/useEmpresaConfig', () => ({
  useEmpresaConfig: () => ({
    isMaster: testState.isMaster,
    hasModulo: (moduleKey: string) => testState.empresaModules.has(moduleKey),
  }),
}));

vi.mock('@/hooks/useUserModulePermissions', () => ({
  useUserModulePermissions: () => ({
    permissions: testState.permissions,
    hasUserModuleAccess: (moduleKey: string) => testState.userModules.has(moduleKey),
  }),
}));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => testState.isMobile }));
vi.mock('@/components/common/ThemeToggle', () => ({ ThemeToggle: () => null }));
vi.mock('@/components/auth/LoginDialog', () => ({ LoginDialog: () => null }));

function RouteDestination() {
  const location = useLocation();
  return <p>Destination: {location.pathname}</p>;
}

function renderHome(component: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={component} />
        <Route path="*" element={<RouteDestination />} />
      </Routes>
    </MemoryRouter>,
  );
}

function expectDestination(path: string) {
  expect(screen.getByText(`Destination: ${path}`)).toBeInTheDocument();
}

function chooseCasaDaTransmissao() {
  fireEvent.click(screen.getByRole('button', { name: /Casa da Transmissão/i }));
}

describe('Home branch flow', () => {
  beforeEach(() => {
    testState.isAuthenticated = true;
    testState.isVendedor = false;
    testState.canAccessSettings = true;
    testState.isMaster = false;
    testState.isMobile = false;
    testState.filialAtiva = null;
    testState.permissions.modulo_resumo = true;
    testState.permissions.modulo_dre = true;
    testState.permissions.modulo_variacao = true;
    testState.empresaModules = new Set(['whatsapp', 'comercial', 'operacional', 'financeiro', 'resumo', 'dre', 'variacao']);
    testState.userModules = new Set(['whatsapp', 'comercial', 'operacional', 'financeiro', 'resumo', 'dre', 'variacao']);
    testState.setFilialAtivaForEmpresa.mockClear();
    testState.setEmpresaSelecionada.mockClear();
  });

  afterEach(() => vi.clearAllMocks());

  it('opens the desktop branch selection before exposing modules even with a stored branch', () => {
    testState.filialAtiva = 'chevrolet';
    renderHome(<HomePage />);

    expect(screen.getByRole('heading', { name: 'Escolha a filial' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Casa da Transmissão/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Casa do Chevrolet/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Comercial/i })).not.toBeInTheDocument();
  });

  it('stores the desktop branch before showing modules and then navigates directly', () => {
    renderHome(<HomePage />);

    chooseCasaDaTransmissao();
    expect(testState.setFilialAtivaForEmpresa).toHaveBeenCalledWith('1004', 'transmissao');
    expect(screen.getByRole('heading', { name: 'Módulos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Trocar filial/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Comercial/i }));
    expectDestination('/comercial/dashboard');
  });

  it('uses the same branch-first flow on mobile', () => {
    testState.filialAtiva = 'chevrolet';
    renderHome(<HomeMobilePage />);

    expect(screen.getByRole('heading', { name: 'Escolha a filial' })).toBeInTheDocument();
    chooseCasaDaTransmissao();
    fireEvent.click(screen.getByRole('button', { name: /Operacional/i }));

    expectDestination('/operacional/estoque');
  });

  it('returns to branch selection without navigating when the user changes branch', () => {
    renderHome(<HomePage />);

    chooseCasaDaTransmissao();
    fireEvent.click(screen.getByRole('button', { name: /Trocar filial/i }));

    expect(screen.getByRole('heading', { name: 'Escolha a filial' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Comercial/i })).not.toBeInTheDocument();
  });

  it('keeps the mobile module entry free from a redundant one-item navigation bar', () => {
    renderHome(<HomeMobilePage />);

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('preserves the Financeiro entry resolver after the initial branch choice', () => {
    testState.permissions.modulo_resumo = false;
    testState.empresaModules.delete('resumo');
    renderHome(<HomePage />);

    chooseCasaDaTransmissao();
    fireEvent.click(screen.getByRole('button', { name: /Financeiro/i }));

    expectDestination('/financeiro/dre');
  });

  it('navigates Settings directly from the selection header', () => {
    renderHome(<HomePage />);

    fireEvent.click(screen.getAllByRole('button', { name: /Configuracoes/i })[0]);

    expectDestination('/configuracoes');
  });

  it('keeps unauthorized module clicks on module details', () => {
    testState.isAuthenticated = false;
    renderHome(<HomePage />);

    chooseCasaDaTransmissao();
    fireEvent.click(screen.getByRole('button', { name: /Comercial/i }));

    expect(screen.getByText('Potencialize Suas Vendas')).toBeInTheDocument();
  });

  it('preserves the seller redirect', () => {
    testState.isVendedor = true;
    renderHome(<HomePage />);

    expectDestination('/whatsapp');
  });
});
