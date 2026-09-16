import { useState } from 'react';
import {
  BadgeDollarSign,
  Clock,
  LayoutDashboard,
  Package,
  Users,
  XCircle,
} from 'lucide-react';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import {
  PelegriniModuleSidebar,
  type PelegriniSidebarItem,
} from '@/components/pelegrini';

function hasCotacoesComerciais(codEmpresa: string) {
  return codEmpresa === '1004' || codEmpresa === '10041';
}

// eslint-disable-next-line react-refresh/only-export-components
export function getComercialMenuItems(codEmpresa: string): PelegriniSidebarItem[] {
  const items: PelegriniSidebarItem[] = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/comercial/dashboard' },
    { label: 'Produtos', icon: Package, path: '/comercial/produtos' },
    { label: 'Clientes', icon: Users, path: '/comercial/clientes' },
    { label: 'Comissão', icon: BadgeDollarSign, path: '/comercial/comissao' },
  ];

  if (hasCotacoesComerciais(codEmpresa)) {
    items.push({ label: 'Cotações Abertas', icon: Clock, path: '/comercial/cotacoes' });
    items.push({ label: 'Vendas Perdidas', icon: XCircle, path: '/comercial/perdidas' });
  }

  return items;
}

const futureMenuItems: PelegriniSidebarItem[] = [
  { label: 'Cotações Abertas', icon: Clock, path: '/comercial/cotacoes', disabled: true, badge: 'BREVE' },
  { label: 'Vendas Perdidas', icon: XCircle, path: '/comercial/perdidas', disabled: true, badge: 'BREVE' },
];

export function ComercialSidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();
  const theme = resolvePelegriniTheme(filialAtiva || codEmpresaAtiva);
  const comercialMenuItems = getComercialMenuItems(codEmpresaAtiva || '');
  const showFutureItems = !hasCotacoesComerciais(codEmpresaAtiva || '');

  return (
    <PelegriniModuleSidebar
      theme={theme}
      items={comercialMenuItems}
      futureItems={showFutureItems ? futureMenuItems : undefined}
      mobileOpen={isMobileOpen}
      onMobileOpenChange={setIsMobileOpen}
    />
  );
}
