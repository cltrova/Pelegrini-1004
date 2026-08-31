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
vi.mock('@/components/layout/MobileBottomNav', () => ({ MobileBottomNav: () => null }));

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
  fireEvent.click(screen.getByRole('button', { name: 'Acessar' }));
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

  it('opens branch selection only after a desktop Comercial click and cancel stays on Home', () => {
    renderHome(<HomePage />);

    expect(screen.queryByText('Escolha a unidade')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Comercial/i }));
    expect(screen.getByText('Escolha a unidade')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText('Escolha a unidade')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Módulos' })).toBeInTheDocument();
  });

  it('stores the chosen branch and enters the exact desktop Comercial path', () => {
    renderHome(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: /Comercial/i }));
    chooseCasaDaTransmissao();

    expect(testState.setFilialAtivaForEmpresa).toHaveBeenCalledWith('1004', 'transmissao');
    expectDestination('/comercial/dashboard');
  });

  it('requires a fresh mobile branch choice and enters the exact Operacional path', () => {
    testState.filialAtiva = 'chevrolet';
    renderHome(<HomeMobilePage />);

    expect(screen.queryByText('Escolha a unidade')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Operacional/i }));
    expect(screen.getByText('Escolha a unidade')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Casa da Transmissão/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Acessar' }));

    expectDestination('/operacional/estoque');
  });

  it('preserves the Financeiro entry resolver when branch selection confirms', () => {
    testState.permissions.modulo_resumo = false;
    testState.empresaModules.delete('resumo');
    renderHome(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: /Financeiro/i }));
    chooseCasaDaTransmissao();

    expectDestination('/financeiro/dre');
  });

  it('navigates Settings directly without opening branch selection', () => {
    renderHome(<HomePage />);

    fireEvent.click(screen.getAllByRole('button', { name: /Configuracoes/i })[0]);

    expect(screen.queryByText('Escolha a unidade')).not.toBeInTheDocument();
    expectDestination('/configuracoes');
  });

  it('keeps unauthorized module clicks on module details', () => {
    testState.isAuthenticated = false;
    renderHome(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: /Comercial/i }));

    expect(screen.getByText('Potencialize Suas Vendas')).toBeInTheDocument();
    expect(screen.queryByText('Escolha a unidade')).not.toBeInTheDocument();
  });

  it('preserves the seller redirect', () => {
    testState.isVendedor = true;
    renderHome(<HomePage />);

    expectDestination('/whatsapp');
  });
});
