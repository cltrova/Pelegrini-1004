import { useState } from 'react';
import { BarChart3, GitCompareArrows, LayoutDashboard } from 'lucide-react';
import { PelegriniModuleSidebar } from '@/components/pelegrini';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';

const financeiroMenuItems = [
  {
    label: 'Resumo',
    path: '/financeiro/resumo',
    icon: LayoutDashboard,
  },
  {
    label: 'DRE',
    path: '/financeiro/dre',
    icon: BarChart3,
  },
  {
    label: 'Variação',
    path: '/financeiro/variacao',
    icon: GitCompareArrows,
  },
];

export function FinanceiroSidebar() {
  const { filialAtiva } = useFilialSelecionada();
  const theme = resolvePelegriniTheme(filialAtiva);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <PelegriniModuleSidebar
      theme={theme}
      items={financeiroMenuItems}
      mobileOpen={isMobileOpen}
      onMobileOpenChange={setIsMobileOpen}
    />
  );
}

export default FinanceiroSidebar;