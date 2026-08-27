import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ChevronLeft,
  Menu,
  X,
  Clock,
  XCircle,
  Package,
  BadgeDollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { PelegriniBrandMark } from '@/components/pelegrini';

interface MenuItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  disabled?: boolean;
}

function hasCotacoesComerciais(codEmpresa: string) {
  return codEmpresa === '1004' || codEmpresa === '10041';
}

// eslint-disable-next-line react-refresh/only-export-components
export function getComercialMenuItems(codEmpresa: string): MenuItem[] {
  const items: MenuItem[] = [
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


const futureMenuItems: MenuItem[] = [
  { label: 'Cotações Abertas', icon: Clock, path: '/comercial/cotacoes', disabled: true },
  { label: 'Vendas Perdidas', icon: XCircle, path: '/comercial/perdidas', disabled: true },
];

export function ComercialSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();
  const theme = resolvePelegriniTheme(filialAtiva);
  const comercialMenuItems = getComercialMenuItems(codEmpresaAtiva || '');
  const showFutureItems = !hasCotacoesComerciais(codEmpresaAtiva || '');

  const isActive = (path: string) => location.pathname === path;

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
        className={cn(
          'pelegrini-sidebar relative fixed left-0 top-0 z-50 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 md:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <PelegriniBrandMark theme={theme} />
            <div>
              <h1 className="font-bold text-lg leading-tight">Comercial</h1>
              <span className="text-[11px] text-sidebar-muted uppercase tracking-wider">
                Comercial ativo
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

        {/* Back to home */}
        <div className="px-4 pt-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-sidebar-muted hover:text-sidebar-foreground transition-all duration-200 w-full px-3 py-2 rounded-lg hover:bg-sidebar-accent group"
          >
            <ChevronLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
            Voltar aos módulos
          </button>
        </div>

        {/* Gradient separator */}
        <div className="mx-4 mt-4 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-1">
          <p className="sidebar-section">Visão Geral</p>
          {comercialMenuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.label}
                to={item.path}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  'sidebar-item transition-all duration-200 relative',
                  active
                    ? 'sidebar-item-active sidebar-active-glow'
                    : 'hover:bg-sidebar-accent/50 hover:translate-x-0.5'
                )}
              >
                <Icon className={cn(
                  'h-5 w-5 transition-all duration-200',
                  active && 'text-sidebar-primary drop-shadow-[0_0_6px_hsl(var(--sidebar-primary)/0.5)]'
                )} />
                <span className={cn(active && 'font-semibold')}>{item.label}</span>
              </NavLink>
            );
          })}

          {showFutureItems && (
            <>
              {/* Gradient separator */}
              <div className="my-3 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />

              <div>
                <p className="sidebar-section">Em breve</p>
                {futureMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="sidebar-item opacity-40 cursor-not-allowed"
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-muted badge-pulse">
                        BREVE
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-muted">
            <p>BI Reports v1.0.0</p>
            <p className="mt-1">Módulo Comercial</p>
          </div>
        </div>
      </aside>
    </>
  );
}
