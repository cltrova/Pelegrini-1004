import { useState, type CSSProperties } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Package,
  ChevronLeft,
  Menu,
  X,
  Building2,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { Badge } from '@/components/ui/badge';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { getPelegriniIdentity } from '@/config/pelegriniIdentity';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { PelegriniBrandMark } from '@/components/pelegrini';

const baseMenuItems = [
  { label: 'Estoque', icon: Package, path: '/operacional/estoque' },
];

export function OperacionalSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { empresa, isMaster, codEmpresaAtiva } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();
  const theme = resolvePelegriniTheme(filialAtiva);
  const identity = getPelegriniIdentity(theme.key);

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
          'pelegrini-sidebar fixed left-0 top-0 z-50 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 md:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{
          '--pelegrini-primary': theme.primary,
          '--pelegrini-secondary': theme.secondary,
          '--pelegrini-accent': theme.accent,
        } as CSSProperties}
      >
        <div className="flex items-center justify-between px-5 py-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <PelegriniBrandMark theme={theme} tone="sidebar" />
            <div>
              <h1 className="font-bold text-lg leading-tight">Operacional</h1>
              <span className="text-[11px] text-sidebar-muted uppercase tracking-wider">
                Operacional ativo
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden p-1 hover:bg-sidebar-accent rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {codEmpresaAtiva && (
          <div className="px-4 pt-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sidebar-accent/50 border border-sidebar-border">
              <Building2 className="h-4 w-4 text-sidebar-muted" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-sidebar-muted">Empresa</p>
                <p className="text-sm font-medium truncate">
                  {empresa?.nome || codEmpresaAtiva}
                </p>
              </div>
              {isMaster && (
                <Badge variant="outline" className="text-[10px] shrink-0">
                  Master
                </Badge>
              )}
            </div>
          </div>
        )}

        <div className="px-4 pt-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-sidebar-muted hover:text-sidebar-foreground transition-colors w-full px-3 py-2 rounded-lg hover:bg-sidebar-accent"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar aos módulos
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-2">
          <p className="sidebar-section">Relatórios</p>
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

        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-muted">
            <p className="font-medium text-sidebar-foreground">Pelegrini</p>
            <p className="mt-1">{identity.footerLine}</p>
          </div>
        </div>
      </aside>
    </>
  );
}
