import { useState, type CSSProperties } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  ArrowLeftRight,
  ChevronLeft,
  Menu,
  X,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useUserModulePermissions } from '@/hooks/useUserModulePermissions';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { PelegriniBrandMark } from '@/components/pelegrini';

interface MenuItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  moduloKey?: 'dre' | 'variacao' | 'comercial' | 'assistente_ia' | 'resumo';
}

const financeiroMenuItems: MenuItem[] = [
  { label: 'Resumo', icon: Wallet, path: '/financeiro/resumo', moduloKey: 'resumo' },
  { label: 'DRE', icon: BarChart3, path: '/financeiro/dre', moduloKey: 'dre' },
  { label: 'Variação', icon: ArrowLeftRight, path: '/financeiro/variacao', moduloKey: 'variacao' },
];

export function FinanceiroSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { codEmpresaAtiva, empresa, isMaster } = useEmpresaAtiva();
  const { canAccessDRE, canAccessVariacao, canAccessAssistenteIA, canAccessResumo } = useUserModulePermissions();
  const { filialAtiva } = useFilialSelecionada();
  const theme = resolvePelegriniTheme(filialAtiva || codEmpresaAtiva);

  const isActive = (path: string) => location.pathname === path;

  // Verifica acesso do usuário ao módulo
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

  const filteredMenuItems = financeiroMenuItems.filter(item => {
    // Se não tem moduloKey, visível.
    if (!item.moduloKey) return true;

    // Verificar permissão do usuário
    if (!hasUserModuleAccess(item.moduloKey)) return false;

    // Verificar se empresa tem o módulo (mesmo para master, respeitar config da empresa)
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
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 left-4 z-40 p-2 rounded-lg bg-sidebar text-sidebar-foreground md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        data-desktop-state="collapsed"
        className={cn(
          'pelegrini-sidebar pelegrini-sidebar-collapsible fixed left-0 top-0 z-50 h-screen w-[232px] bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 motion-reduce:transition-none motion-reduce:duration-0 md:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{
          '--pelegrini-primary': theme.primary,
          '--pelegrini-secondary': theme.secondary,
          '--pelegrini-accent': theme.accent,
        } as CSSProperties}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
          <PelegriniBrandMark theme={theme} tone="sidebar" className="max-w-[13rem]" />
          <button
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden p-1 hover:bg-sidebar-accent rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Back to home */}
        <div className="px-4 pt-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-sidebar-muted hover:text-sidebar-foreground transition-colors w-full px-3 py-2 rounded-lg hover:bg-sidebar-accent"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar aos módulos
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-1">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.label}
                to={item.path}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  'sidebar-item',
                  isActive(item.path) && 'sidebar-item-active'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

      </aside>
    </>
  );
}
