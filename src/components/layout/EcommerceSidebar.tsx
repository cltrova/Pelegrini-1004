import { useState } from 'react';
import { ChartNoAxesCombined, Link2, Megaphone, ShoppingCart } from 'lucide-react';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import {
  PelegriniModuleSidebar,
  type PelegriniSidebarItem,
} from '@/components/pelegrini';

const ecommerceMenuItems: PelegriniSidebarItem[] = [
  { label: 'Visão geral', path: '/ecommerce', icon: ChartNoAxesCombined },
  { label: 'Anúncios', path: '/ecommerce/anuncios', icon: Megaphone },
  { label: 'Pedidos', path: '/ecommerce/pedidos', icon: ShoppingCart },
  { label: 'Integração Mercado Livre', path: '/ecommerce/integracao', icon: Link2 },
];

export function EcommerceSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { filialAtiva } = useFilialSelecionada();
  const theme = resolvePelegriniTheme(filialAtiva);

  return (
    <PelegriniModuleSidebar
      theme={theme}
      items={ecommerceMenuItems}
      mobileOpen={mobileOpen}
      onMobileOpenChange={setMobileOpen}
    />
  );
}

export default EcommerceSidebar;
