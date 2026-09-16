import { lazy, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import {
  COMERCIAL_COMPRAS_ROUTE,
  getComprasComercialMenuItem,
  isComprasComercialEnabled,
} from './comercialCompras';

export const ComprasPage = lazy(() => import('@/pages/comercial/ComprasPage'));

export interface ComercialComprasRouteDefinition {
  path: typeof COMERCIAL_COMPRAS_ROUTE;
  element: ReactNode;
}

export function getComercialComprasRoute(codEmpresa?: string | number | null): ComercialComprasRouteDefinition {
  return {
    path: COMERCIAL_COMPRAS_ROUTE,
    element: isComprasComercialEnabled(codEmpresa)
      ? <ComprasPage />
      : <Navigate to="/comercial/dashboard" replace />,
  };
}

export function appendComercialComprasMenuItem<T>(
  items: readonly T[],
  codEmpresa?: string | number | null,
): Array<T | NonNullable<ReturnType<typeof getComprasComercialMenuItem>>> {
  const comprasItem = getComprasComercialMenuItem(codEmpresa);
  return comprasItem ? [...items, comprasItem] : [...items];
}