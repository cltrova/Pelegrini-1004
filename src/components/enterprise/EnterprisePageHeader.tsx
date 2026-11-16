import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EnterprisePageHeaderProps {
  title: string;
  metadata?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function EnterprisePageHeader({
  title,
  metadata,
  actions,
  className,
}: EnterprisePageHeaderProps) {
  return (
    <>
      <h1 className="sr-only">{title}</h1>
      {(metadata || actions) && (
        <div className={cn('flex min-w-0 flex-wrap items-center justify-end gap-2', className)}>
          {metadata && <span className="mr-auto min-w-0 text-xs text-muted-foreground">{metadata}</span>}
          {actions}
        </div>
      )}
    </>
  );
}
