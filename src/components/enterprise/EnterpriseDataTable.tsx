import type { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function EnterpriseTable({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn('min-w-0 max-h-full overflow-auto rounded-lg border border-border', className)} data-enterprise-table {...props}>
      <table className="w-full min-w-max border-collapse text-xs">{children}</table>
    </div>
  );
}

export function EnterpriseThead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('sticky top-0 z-10 bg-muted/80 text-muted-foreground', className)} {...props} />;
}

export function EnterpriseTbody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-border/60', className)} {...props} />;
}

export function EnterpriseTr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors hover:bg-[hsl(var(--enterprise-row-hover))]', className)} {...props} />;
}

export function EnterpriseTh({ numeric = false, className, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <th className={cn('px-2.5 py-2 text-left text-[11px] font-semibold uppercase', numeric && 'text-right tabular-nums', className)} {...props} />;
}

export function EnterpriseTd({ numeric = false, className, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <td className={cn('px-2.5 py-2 align-middle', numeric && 'text-right tabular-nums', className)} {...props} />;
}
