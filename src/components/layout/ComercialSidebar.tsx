import { useState, type CSSProperties } from 'react';
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
  const theme = resolvePelegriniTheme(filialAtiva || codEmpresaAtiva);
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
            className="flex items-center gap-2 text-sm text-sidebar-muted hover:text-sidebar-foreground transition-all duration-200 w-full px-3 py-2 rounded-lg hover:bg-sidebar-accent group"
          >
            <ChevronLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
            Voltar aos módulos
          </button>
        </div>

        <div className="mx-4 mt-3 h-px bg-sidebar-border" />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-1">
          {comercialMenuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.label}
                to={item.path}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  'sidebar-item',
                  active
                    ? 'sidebar-item-active'
                    : 'hover:bg-sidebar-accent/50'
                )}
              >
                <Icon className={cn(
                  'h-5 w-5',
                  active && 'text-sidebar-primary'
                )} />
                <span className={cn(active && 'font-semibold')}>{item.label}</span>
              </NavLink>
            );
          })}

          {showFutureItems && (
            <>
              <div className="my-3 h-px bg-sidebar-border" />

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
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-muted">
                        BREVE
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </nav>

      </aside>
    </>
  );
}
