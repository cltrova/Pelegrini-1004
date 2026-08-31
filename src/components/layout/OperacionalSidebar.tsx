import { useState } from 'react';
import { History, Package } from 'lucide-react';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import {
  PelegriniModuleSidebar,
  type PelegriniSidebarItem,
} from '@/components/pelegrini';

const baseMenuItems: PelegriniSidebarItem[] = [
  { label: 'Estoque', icon: Package, path: '/operacional/estoque' },
];

export function OperacionalSidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();
  const theme = resolvePelegriniTheme(filialAtiva || codEmpresaAtiva);
  const items: PelegriniSidebarItem[] = [
    ...baseMenuItems,
    ...(codEmpresaAtiva === '1004' || codEmpresaAtiva === '10041'
      ? [{ label: 'Estoque Retroativo', icon: History, path: '/operacional/estoque/retroativo' }]
      : []),
  ];

  return (
    <PelegriniModuleSidebar
      theme={theme}
      items={items}
      mobileOpen={isMobileOpen}
      onMobileOpenChange={setIsMobileOpen}
    />
  );
}
