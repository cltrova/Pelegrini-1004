import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';

import { LoadingState } from '@/components/common/LoadingState';
import { canViewDistributorEvolution } from '@/components/operacional/estoque/distributorEvolutionData';
import {
  EstoqueDataViewport,
  EstoqueWorkspace,
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
        <EstoqueDataViewport className="p-4">
          <LoadingState message="Carregando evolução de distribuidores" variant="content" />
        </EstoqueDataViewport>
      </EstoqueWorkspace>
    );
  }

  if (!canViewDistributorEvolution(codEmpresaAtiva, filialAtiva)) {
    return <Navigate replace to="/operacional/estoque" />;
  }

  return (
    <EstoqueWorkspace aria-label="Evolução de distribuidores" className="operational-distributors bg-background">
      <h1 className="sr-only">Evolução de Distribuidores</h1>
      <Suspense
        fallback={(
          <EstoqueDataViewport className="p-4">
            <LoadingState message="Carregando evolução de distribuidores" variant="content" />
          </EstoqueDataViewport>
        )}
      >
        <DistributorEvolutionTab active />
      </Suspense>
    </EstoqueWorkspace>
  );
}
