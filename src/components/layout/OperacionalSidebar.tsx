import { useState } from 'react';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { PelegriniModuleSidebar } from '@/components/pelegrini';
import { buildOperacionalMenuItems } from './operacionalSidebarItems';

export function OperacionalSidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();
  const theme = resolvePelegriniTheme(filialAtiva || codEmpresaAtiva);
  const items = buildOperacionalMenuItems(codEmpresaAtiva, filialAtiva);

  return (
    <PelegriniModuleSidebar
      theme={theme}
      items={items}
      mobileOpen={isMobileOpen}
      onMobileOpenChange={setIsMobileOpen}
    />
  );
}
