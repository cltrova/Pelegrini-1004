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
    <section className={cn('pelegrini-panel flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-card', className)} data-testid="enterprise-data-panel">
      {hasHeader && (
        <header className="flex min-w-0 shrink-0 flex-wrap items-start justify-between gap-2 border-b border-border px-3 py-2.5">
          <div className="min-w-0">
            {title && <h2 className="break-words text-sm font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 break-words text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('min-h-0 min-w-0 flex-1', !noPadding && (density === 'compact' ? 'p-3' : 'p-4'))}>{children}</div>
    </section>
  );
}
