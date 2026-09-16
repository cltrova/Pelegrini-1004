import { ShoppingBasket } from 'lucide-react';

export const COMERCIAL_COMPRAS_ROUTE = '/comercial/compras' as const;
export const CASA_DA_TRANSMISSAO_CODE = '1004' as const;

export function isComprasComercialEnabled(codEmpresa?: string | number | null): boolean {
  return String(codEmpresa ?? '').trim() === CASA_DA_TRANSMISSAO_CODE;
}

export function getComprasComercialMenuItem(codEmpresa?: string | number | null) {
  if (!isComprasComercialEnabled(codEmpresa)) return null;

  return {
    label: 'Compras',
    path: COMERCIAL_COMPRAS_ROUTE,
    icon: ShoppingBasket,
  } as const;
}