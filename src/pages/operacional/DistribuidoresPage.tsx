import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';

import { LoadingState } from '@/components/common/LoadingState';
import { canViewDistributorEvolution } from '@/components/operacional/estoque/distributorEvolutionData';
import {
  EstoqueDataViewport,
  EstoqueWorkspace,
  EstoqueWorkspaceHeader,
} from '@/components/operacional/estoque/EstoqueWorkspace';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';

const DistributorEvolutionTab = lazy(() => import(
  '@/components/operacional/estoque/DistributorEvolutionTab'
).then((module) => ({ default: module.DistributorEvolutionTab })));

export default function DistribuidoresPage() {
  const { codEmpresaAtiva, isLoading } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();

  if (isLoading) {
    return (
      <EstoqueWorkspace aria-label="Evolução de distribuidores" className="operational-distributors bg-background">
        <EstoqueDataViewport className="p-4" role="status">
          <LoadingState />
        </EstoqueDataViewport>
      </EstoqueWorkspace>
    );
  }

  if (!canViewDistributorEvolution(codEmpresaAtiva, filialAtiva)) {
    return <Navigate replace to="/operacional/estoque" />;
  }

  return (
    <EstoqueWorkspace aria-label="Evolução de distribuidores" className="operational-distributors bg-background">
      <EstoqueWorkspaceHeader>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-foreground">Evolução de Distribuidores</h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            Histórico mensal por marca e grupo
          </p>
        </div>
      </EstoqueWorkspaceHeader>
      <Suspense
        fallback={(
          <EstoqueDataViewport className="p-4" role="status">
            <LoadingState />
          </EstoqueDataViewport>
        )}
      >
        <DistributorEvolutionTab active />
      </Suspense>
    </EstoqueWorkspace>
  );
}
