import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EnterpriseDataPanelProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  density?: 'compact' | 'normal';
  noPadding?: boolean;
  children: ReactNode;
  className?: string;
}

export function EnterpriseDataPanel({ title, description, actions, density = 'normal', noPadding = false, children, className }: EnterpriseDataPanelProps) {
  const hasHeader = title || description || actions;

  return (
    <section className={cn('min-w-0 overflow-hidden rounded-lg border border-border bg-card', className)} data-testid="enterprise-data-panel">
      {hasHeader && (
        <header className="flex min-w-0 items-start justify-between gap-3 border-b border-border/70 px-3 py-2.5">
          <div className="min-w-0">
            {title && <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('min-w-0', !noPadding && (density === 'compact' ? 'p-3' : 'p-4'))}>{children}</div>
    </section>
  );
}
