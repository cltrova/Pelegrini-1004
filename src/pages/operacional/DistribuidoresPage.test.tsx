import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DistribuidoresPage from './DistribuidoresPage';

const companyState = vi.hoisted(() => ({ code: '1004', loading: false }));
const branchState = vi.hoisted(() => ({ branch: 'transmissao' as string | null }));

vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: () => ({ codEmpresaAtiva: companyState.code, isLoading: companyState.loading }),
}));

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({ filialAtiva: branchState.branch }),
}));

vi.mock('@/components/operacional/estoque/DistributorEvolutionTab', () => ({
  DistributorEvolutionTab: ({ active }: { active: boolean }) => (
    <div data-active={active}>Tela de evolução dos distribuidores</div>
  ),
}));

function renderRoute() {
  render(
    <MemoryRouter
      initialEntries={['/operacional/distribuidores']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/operacional/distribuidores" element={<DistribuidoresPage />} />
        <Route path="/operacional/estoque" element={<div>Tela de estoque</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DistribuidoresPage', () => {
  beforeEach(() => {
    companyState.code = '1004';
    companyState.loading = false;
    branchState.branch = 'transmissao';
  });

  it('renders the standalone screen for Casa da Transmissao', async () => {
    renderRoute();

    expect(await screen.findByText('Tela de evolução dos distribuidores')).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('heading', { name: 'Evolução de Distribuidores' })).toBeInTheDocument();
  });

  it('redirects Casa da Chevrolet to Estoque', async () => {
    companyState.code = '10041';
    branchState.branch = 'chevrolet';
    renderRoute();

    expect(await screen.findByText('Tela de estoque')).toBeInTheDocument();
    expect(screen.queryByText('Tela de evolução dos distribuidores')).not.toBeInTheDocument();
  });
});
