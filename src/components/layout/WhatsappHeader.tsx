import { useState, useEffect, useRef, type CSSProperties } from 'react';
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
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { Badge } from '@/components/ui/badge';
import { getPelegriniModuleVisual, resolvePelegriniTheme, resolvePelegriniVisual } from '@/config/pelegriniTheme';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { PelegriniBrandMark } from '@/components/pelegrini';
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible';

interface MenuItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

const whatsappMenuItems: MenuItem[] = [
  { label: 'Conversas', icon: MessageSquare, path: '/whatsapp' },
  { label: 'Relatórios', icon: BarChart3, path: '/whatsapp/relatorio' },
  { label: 'Agentes', icon: Bot, path: '/whatsapp/agentes' },
  { label: 'Configurações', icon: Settings, path: '/whatsapp/settings' },
];

export function WhatsappHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { empresa, isMaster, codEmpresaAtiva } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();
  const theme = resolvePelegriniTheme(filialAtiva);
  const visual = resolvePelegriniVisual(filialAtiva);
  const moduleVisual = getPelegriniModuleVisual('whatsapp', theme.key);
  const headerRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => {
    if (path === '/whatsapp') {
      return location.pathname === '/whatsapp';
    }
    return location.pathname.startsWith(path);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  return (
    <div ref={headerRef} className="relative z-50">
      {/* Main header bar */}
      <header
        className="pelegrini-whatsapp-header h-16 bg-sidebar border-b border-sidebar-border flex items-center px-4 gap-4"
        style={{
          '--pelegrini-primary': theme.primary,
          '--pelegrini-secondary': theme.secondary,
          '--pelegrini-accent': theme.accent,
        } as CSSProperties}
      >
        {/* Hamburger button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground transition-colors"
          aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
        >
          {isMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>

        {/* Logo */}
        <div className="flex min-w-0 items-center gap-3">
          <PelegriniBrandMark theme={theme} compact tone="sidebar" />
          <div className="hidden min-w-0 sm:block">
            <span className="block font-semibold text-sidebar-foreground">
              WhatsApp
            </span>
            <span className="block truncate text-[11px] text-sidebar-muted">
              {moduleVisual.kpiPrefix} / {visual.blueprintLabel}
            </span>
          </div>
        </div>

        {/* Company info */}
        {codEmpresaAtiva && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sidebar-accent/50 border border-sidebar-border">
            <Building2 className="h-4 w-4 text-sidebar-muted" />
            <span className="text-sm font-medium text-sidebar-foreground truncate max-w-[150px]">
              {empresa?.nome || codEmpresaAtiva}
            </span>
            {isMaster && (
              <Badge variant="outline" className="text-[10px] shrink-0">
                Master
              </Badge>
            )}
          </div>
        )}

        {/* Connection status */}
        <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sidebar-accent/70 border border-sidebar-border">
          <Zap className="h-4 w-4 text-sidebar-primary" />
          <span className="text-xs font-medium text-sidebar-foreground hidden sm:inline">
            Conectado
          </span>
        </div>
      </header>

      {/* Collapsible navigation menu */}
      <Collapsible open={isMenuOpen}>
        <CollapsibleContent>
          <nav
            className="bg-sidebar border-b border-sidebar-border px-4 py-3"
            style={{
              '--pelegrini-primary': theme.primary,
              '--pelegrini-secondary': theme.secondary,
              '--pelegrini-accent': theme.accent,
            } as CSSProperties}
          >
            <div className="flex flex-wrap items-center gap-2">
              {/* Menu items */}
              {whatsappMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.label}
                    to={item.path}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive(item.path)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}

              {/* Separator */}
              <div className="h-6 w-px bg-sidebar-border mx-2 hidden sm:block" />

              {/* Back to modules */}
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Voltar aos módulos</span>
              </button>
            </div>
          </nav>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
