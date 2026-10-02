import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingState } from '@/components/common/LoadingState';
import { useAuth } from '@/contexts/AuthContext';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';

const PELEGRINI_COMPANIES = new Set(['1004', '10041']);

interface RequireEcommerceBranchProps {
  children: ReactNode;
  redirectTo?: string;
}

/** Restricts the frontend E-Commerce shell to an authenticated Chevrolet branch. */
export function RequireEcommerceBranch({
  children,
  redirectTo = '/',
}: RequireEcommerceBranchProps) {
  const location = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { codEmpresaAtiva, isLoading: empresaLoading } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();

  if (authLoading || empresaLoading || !codEmpresaAtiva) {
    return <LoadingState message="Carregando aplicacao" variant="screen" />;
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (!PELEGRINI_COMPANIES.has(codEmpresaAtiva) || filialAtiva !== 'chevrolet') {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}

export default RequireEcommerceBranch;
