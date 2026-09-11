import { History, Package, TrendingUp } from 'lucide-react';

import type { PelegriniSidebarItem } from '@/components/pelegrini';

const baseMenuItems: PelegriniSidebarItem[] = [
  { label: 'Estoque', icon: Package, path: '/operacional/estoque' },
];

export function buildOperacionalMenuItems(
  companyCode: string | null | undefined,
  branchId: string | null | undefined,
): PelegriniSidebarItem[] {
  return [
    ...baseMenuItems,
    ...(companyCode === '1004' || companyCode === '10041'
      ? [{ label: 'Estoque Retroativo', icon: History, path: '/operacional/estoque/retroativo' }]
      : []),
    ...(companyCode === '1004' && branchId === 'transmissao'
      ? [{ label: 'Distribuidores', icon: TrendingUp, path: '/operacional/distribuidores' }]
      : []),
  ];
}
