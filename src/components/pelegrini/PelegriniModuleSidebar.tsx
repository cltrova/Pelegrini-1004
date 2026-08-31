import { useLocation, useNavigate, NavLink } from 'react-router-dom';
import { ChevronLeft, Menu, X } from 'lucide-react';
import type * as React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { PelegriniTheme } from '@/config/pelegriniTheme';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PelegriniBrandMark } from './PelegriniBrandMark';

export interface PelegriniSidebarItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  badge?: string;
}

export interface PelegriniModuleSidebarProps {
  theme: PelegriniTheme;
  items: PelegriniSidebarItem[];
  futureItems?: PelegriniSidebarItem[];
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  homeLabel?: string;
}

interface SidebarActionProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
  children?: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  labelTestId?: string;
}

function SidebarAction({
  label,
  icon: Icon,
  className,
  children,
  disabled = false,
  onClick,
  labelTestId = 'sidebar-label',
}: SidebarActionProps) {
  const action = (
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled || undefined}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn('sidebar-action sidebar-item', disabled && 'cursor-not-allowed opacity-40', className)}
    >
      <span className="sidebar-icon" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <span className="sidebar-label" data-testid={labelTestId}>
        {label}
        {children}
      </span>
    </button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{action}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

interface SidebarLinkProps {
  item: PelegriniSidebarItem;
  active: boolean;
  onNavigate: () => void;
}

function SidebarLink({ item, active, onNavigate }: SidebarLinkProps) {
  const Icon = item.icon;
  const link = (
    <NavLink
      to={item.path}
      aria-label={item.label}
      title={item.label}
      onClick={onNavigate}
      className={cn('sidebar-action sidebar-item', active ? 'sidebar-item-active' : 'hover:bg-sidebar-accent/50')}
    >
      <span className="sidebar-icon" aria-hidden="true">
        <Icon className={cn('h-5 w-5', active && 'text-sidebar-primary')} />
      </span>
      <span className={cn('sidebar-label', active && 'font-semibold')} data-testid="sidebar-label">
        {item.label}
        {item.badge && <span className="sidebar-badge">{item.badge}</span>}
      </span>
    </NavLink>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function PelegriniModuleSidebar({
  theme,
  items,
  futureItems = [],
  mobileOpen,
  onMobileOpenChange,
  homeLabel = 'Voltar aos módulos',
}: PelegriniModuleSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const closeMobileSidebar = () => onMobileOpenChange(false);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Abrir menu"
            title="Abrir menu"
            onClick={() => onMobileOpenChange(true)}
            className="fixed left-4 top-4 z-40 flex h-12 w-12 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground md:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Abrir menu</TooltipContent>
      </Tooltip>

      {mobileOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      <aside
        data-testid="module-sidebar"
        data-state="collapsed"
        data-desktop-state="collapsed"
        className={cn(
          'pelegrini-sidebar pelegrini-sidebar-collapsible fixed left-0 top-0 z-50 flex h-screen w-[248px] flex-col overflow-hidden bg-sidebar text-sidebar-foreground transition-transform duration-300 motion-reduce:transition-none motion-reduce:duration-0 md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{
          '--pelegrini-primary': theme.primary,
          '--pelegrini-secondary': theme.secondary,
          '--pelegrini-accent': theme.accent,
        } as CSSProperties}
      >
        <div className="sidebar-brand-row relative flex h-[72px] shrink-0 items-center border-b border-sidebar-border px-3">
          <div className="sidebar-brand-compact" data-testid="sidebar-brand-compact">
            <PelegriniBrandMark theme={theme} compact tone="sidebar" />
          </div>
          <div className="sidebar-brand-expanded">
            <PelegriniBrandMark theme={theme} tone="sidebar" />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Fechar menu"
                title="Fechar menu"
                onClick={closeMobileSidebar}
                className="ml-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-lg hover:bg-sidebar-accent md:hidden"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Fechar menu</TooltipContent>
          </Tooltip>
        </div>

        <div className="px-3 pt-3">
          <SidebarAction
            label={homeLabel}
            labelTestId="sidebar-home-label"
            icon={ChevronLeft}
            onClick={() => {
              navigate('/');
              closeMobileSidebar();
            }}
          />
        </div>

        <div className="mx-3 mt-3 h-px shrink-0 bg-sidebar-border" />

        <nav aria-label="Navegação do módulo" className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-3 scrollbar-thin">
          {items.map((item) => (
            <SidebarLink
              key={item.label}
              item={item}
              active={location.pathname === item.path}
              onNavigate={closeMobileSidebar}
            />
          ))}

          {futureItems.length > 0 && (
            <div className="pt-2">
              <div className="mb-3 h-px bg-sidebar-border" />
              <p
                className="sidebar-section-label sidebar-label"
                data-testid="sidebar-future-label"
              >
                Em breve
              </p>
              <div className="space-y-1">
                {futureItems.map((item) => (
                  <SidebarAction key={item.label} label={item.label} icon={item.icon} disabled>
                    <span className="sidebar-badge">{item.badge ?? 'BREVE'}</span>
                  </SidebarAction>
                ))}
              </div>
            </div>
          )}
        </nav>
      </aside>
    </TooltipProvider>
  );
}
