import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { FinanceiroSidebar } from './FinanceiroSidebar';

vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: () => ({
    codEmpresaAtiva: '1004',
    isMaster: true,
    empresa: { modulo_dre: true, modulo_variacao: true, modulo_resumo: true },
  }),
}));

vi.mock('@/hooks/useUserModulePermissions', () => ({
  useUserModulePermissions: () => ({
    canAccessDRE: true,
    canAccessVariacao: true,
    canAccessAssistenteIA: true,
    canAccessResumo: true,
  }),
}));

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({
    filialAtiva: 'transmissao',
    codEmpresaContexto: '1004',
    setFilialAtivaForEmpresa: vi.fn(),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isMaster: true, user: { cod_empresa: '1004' } }),
}));

describe('FinanceiroSidebar', () => {
  it('renderiza a navegacao financeira sem perder o contexto de permissao', () => {
    render(
      <MemoryRouter initialEntries={['/financeiro/resumo']}>
        <FinanceiroSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Resumo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'DRE' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Variação' })).toBeInTheDocument();
  });
});
