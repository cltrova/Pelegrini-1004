import { useState } from 'react';
import { ArrowLeftRight, BarChart3, Wallet } from 'lucide-react';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useUserModulePermissions } from '@/hooks/useUserModulePermissions';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import {
  PelegriniModuleSidebar,
  type PelegriniSidebarItem,
} from '@/components/pelegrini';

interface FinanceiroMenuItem extends PelegriniSidebarItem {
  moduloKey?: 'dre' | 'variacao' | 'comercial' | 'assistente_ia' | 'resumo';
}

const financeiroMenuItems: FinanceiroMenuItem[] = [
  { label: 'Resumo', icon: Wallet, path: '/financeiro/resumo', moduloKey: 'resumo' },
  { label: 'DRE', icon: BarChart3, path: '/financeiro/dre', moduloKey: 'dre' },
  { label: 'Variação', icon: ArrowLeftRight, path: '/financeiro/variacao', moduloKey: 'variacao' },
];

export function FinanceiroSidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { codEmpresaAtiva, empresa, isMaster } = useEmpresaAtiva();
  const { canAccessDRE, canAccessVariacao, canAccessAssistenteIA, canAccessResumo } = useUserModulePermissions();
  const { filialAtiva } = useFilialSelecionada();
  const theme = resolvePelegriniTheme(filialAtiva || codEmpresaAtiva);

  const hasUserModuleAccess = (moduloKey?: string): boolean => {
    if (!moduloKey) return true;
    if (isMaster) return true;

    switch (moduloKey) {
      case 'dre': return canAccessDRE;
      case 'variacao': return canAccessVariacao;
      case 'assistente_ia': return canAccessAssistenteIA;
      case 'resumo': return canAccessResumo;
      default: return true;
    }
  };

  const filteredMenuItems = financeiroMenuItems.filter((item) => {
    if (!item.moduloKey) return true;
    if (!hasUserModuleAccess(item.moduloKey)) return false;
    if (!empresa) return false;

    switch (item.moduloKey) {
      case 'dre':
        return empresa.modulo_dre;
      case 'variacao':
        return empresa.modulo_variacao;
      case 'comercial':
        return empresa.modulo_comercial;
      case 'assistente_ia':
        return empresa.modulo_assistente_ia;
      case 'resumo':
        return empresa.modulo_resumo ?? false;
      default:
        return true;
    }
  });

  return (
    <PelegriniModuleSidebar
      theme={theme}
      items={filteredMenuItems}
      mobileOpen={isMobileOpen}
      onMobileOpenChange={setIsMobileOpen}
    />
  );
}
