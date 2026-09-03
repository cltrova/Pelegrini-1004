import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EnterprisePageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  metadata?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function EnterprisePageHeader({
  title,
  subtitle,
  eyebrow,
  metadata,
  actions,
  className,
}: EnterprisePageHeaderProps) {
  return (
    <header className={cn('flex min-w-0 flex-col gap-2 border-b border-border/70 pb-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="text-[10px] font-semibold uppercase text-muted-foreground">{eyebrow}</p>}
        <h1 className="truncate text-xl font-semibold leading-tight text-foreground md:text-2xl">{title}</h1>
        {(subtitle || metadata) && (
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {subtitle && <span className="min-w-0 truncate">{subtitle}</span>}
            {subtitle && metadata && <span aria-hidden="true">|</span>}
            {metadata && <span className="min-w-0">{metadata}</span>}
          </div>
        )}
      </div>
      {actions && <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
