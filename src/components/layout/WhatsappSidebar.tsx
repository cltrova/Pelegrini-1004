import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  BarChart3,
  Settings,
  ChevronLeft,
  Menu,
  X,
  Building2,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { Badge } from '@/components/ui/badge';

interface MenuItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

const whatsappMenuItems: MenuItem[] = [
  { label: 'Conversas', icon: MessageSquare, path: '/whatsapp' },
  { label: 'Relatórios', icon: BarChart3, path: '/whatsapp/relatorio' },
  { label: 'Configurações', icon: Settings, path: '/whatsapp/settings' },
];

export function WhatsappSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { empresa, isMaster, codEmpresaAtiva } = useEmpresaAtiva();

  const isActive = (path: string) => {
    if (path === '/whatsapp') {
      return location.pathname === '/whatsapp';
    }
    return location.pathname.startsWith(path);
  };

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
          'fixed left-0 top-0 z-50 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 md:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">WhatsApp</h1>
              <span className="text-[11px] text-sidebar-muted uppercase tracking-wider">
                Módulo
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

        {/* Empresa selecionada */}
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

        {/* Status da conexão */}
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <Zap className="h-4 w-4 text-green-500" />
            <span className="text-xs font-medium text-green-500">Conectado</span>
          </div>
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
        <nav className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-2">
          <p className="sidebar-section">Menu</p>
          {whatsappMenuItems.map((item) => {
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

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-muted">
            <p>BI Reports v1.0.0</p>
            <p className="mt-1">Módulo WhatsApp</p>
          </div>
        </div>
      </aside>
    </>
  );
}
