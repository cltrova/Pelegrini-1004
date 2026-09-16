import { useEffect, useState } from 'react';
import {
  BarChart3,
  Clock,
  DollarSign,
  Package,
  ShoppingCart,
  Users,
  XCircle,
} from 'lucide-react';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import {
  PelegriniModuleSidebar,
  type PelegriniSidebarItem,
} from '@/components/pelegrini';

const baseMenuItems: PelegriniSidebarItem[] = [
  { label: 'Dashboard', path: '/comercial/dashboard', icon: BarChart3 },
  { label: 'Clientes', path: '/comercial/clientes', icon: Users },
  { label: 'Produtos', path: '/comercial/produtos', icon: Package },
  { label: 'Comissão', path: '/comercial/comissao', icon: DollarSign },
];

const cotacoesItems: PelegriniSidebarItem[] = [
  { label: 'Cotações Abertas', path: '/comercial/cotacoes', icon: Clock },
  { label: 'Vendas Perdidas', path: '/comercial/perdidas', icon: XCircle },
];

const comprasItem: PelegriniSidebarItem = {
  label: 'Compras',
  path: '/comercial/compras',
  icon: ShoppingCart,
  disabled: true,
};

export function getComercialMenuItems(codEmpresaAtiva?: string | null): PelegriniSidebarItem[] {
  const companyCode = String(codEmpresaAtiva ?? '');

  return [
    ...baseMenuItems,
    ...(companyCode === '10041' ? cotacoesItems : []),
    ...(companyCode === '1004' ? [comprasItem] : []),
  ];
}

const futureMenuItems: PelegriniSidebarItem[] = [
  { label: 'Cotações Abertas', path: '/comercial/cotacoes', icon: Clock, disabled: true, badge: 'BREVE' },
  { label: 'Vendas Perdidas', path: '/comercial/perdidas', icon: XCircle, disabled: true, badge: 'BREVE' },
];

export default function ComercialSidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();
  const theme = resolvePelegriniTheme(filialAtiva);
  const companyCode = String(codEmpresaAtiva ?? '');

  useEffect(() => {
    const openSidebar = () => setIsMobileOpen(true);
    window.addEventListener('open-comercial-sidebar', openSidebar);
    return () => window.removeEventListener('open-comercial-sidebar', openSidebar);
  }, []);

  return (
    <PelegriniModuleSidebar
      indexed
      theme={theme}
      items={getComercialMenuItems(companyCode)}
      futureItems={companyCode === '10041' ? undefined : futureMenuItems}
      mobileOpen={isMobileOpen}
      onMobileOpenChange={setIsMobileOpen}
    />
  );
}