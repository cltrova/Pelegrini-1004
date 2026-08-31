import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PelegriniDataPanelProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  eyebrow?: string;
}

export function PelegriniDataPanel({ title, action, children, className, eyebrow }: PelegriniDataPanelProps) {
  return (
    <section
      className={cn('pelegrini-data-panel min-w-0 overflow-hidden rounded-lg border bg-card', className)}
      data-pelegrini-panel
    >
      {(title || action || eyebrow) && (
        <header className="flex min-w-0 items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            {eyebrow && <p className="text-[10px] font-semibold uppercase text-muted-foreground">{eyebrow}</p>}
            {title && <h3 className="text-base font-semibold text-foreground">{title}</h3>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className="min-w-0 p-4">{children}</div>
    </section>
  );
}
