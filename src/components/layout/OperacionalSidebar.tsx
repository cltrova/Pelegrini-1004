import { useState, type CSSProperties } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Package,
  ChevronLeft,
  Menu,
  X,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { PelegriniBrandMark, PelegriniBranchSwitcher } from '@/components/pelegrini';

const baseMenuItems = [
  { label: 'Estoque', icon: Package, path: '/operacional/estoque' },
];

export function OperacionalSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();
  const theme = resolvePelegriniTheme(filialAtiva || codEmpresaAtiva);

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 left-4 z-40 p-2 rounded-lg bg-sidebar text-sidebar-foreground md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'pelegrini-sidebar fixed left-0 top-0 z-50 h-screen w-[232px] bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 motion-reduce:transition-none motion-reduce:duration-0 md:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{
          '--pelegrini-primary': theme.primary,
          '--pelegrini-secondary': theme.secondary,
          '--pelegrini-accent': theme.accent,
        } as CSSProperties}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
          <PelegriniBrandMark theme={theme} tone="sidebar" className="max-w-[13rem]" />
          <button
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden p-1 hover:bg-sidebar-accent rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 pt-3">
          <PelegriniBranchSwitcher variant="sidebar" />
        </div>

        <div className="px-4 pt-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-sidebar-muted hover:text-sidebar-foreground transition-colors w-full px-3 py-2 rounded-lg hover:bg-sidebar-accent"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar aos módulos
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-1">
          <p className="sidebar-section">Operacional</p>
          {[
            ...baseMenuItems,
            ...(codEmpresaAtiva === '1004' || codEmpresaAtiva === '10041'
              ? [{ label: 'Estoque Retroativo', icon: History, path: '/operacional/estoque/retroativo' }]
              : []),
          ].map((item) => {
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

        <div className="p-3 border-t border-sidebar-border">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-sidebar-muted">
            {theme.shortName} · Estoque e giro
          </div>
        </div>
      </aside>
    </>
  );
}
