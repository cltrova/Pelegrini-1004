import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { EnterpriseTone } from './EnterpriseBadge';

const toneRail: Record<EnterpriseTone, string> = {
  neutral: 'bg-border',
  positive: 'bg-[hsl(var(--enterprise-positive))]',
  negative: 'bg-[hsl(var(--enterprise-negative))]',
  warning: 'bg-[hsl(var(--enterprise-warning))]',
  info: 'bg-[hsl(var(--enterprise-info))]',
};

export interface EnterpriseMetricCardProps extends HTMLAttributes<HTMLElement> {
  label: string;
  value: ReactNode;
  context?: ReactNode;
  comparison?: ReactNode;
  target?: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: EnterpriseTone;
  onClick?: () => void;
  className?: string;
}

export function EnterpriseMetricCard({
  label,
  value,
  context,
  comparison,
  target,
  detail,
  icon,
  tone = 'neutral',
  onClick,
  className,
  ...props
}: EnterpriseMetricCardProps) {
  const Component = onClick ? 'button' : 'article';

  return (
    <Component
      className={cn(
        'pelegrini-panel relative flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card p-3 text-left',
        onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        className,
      )}
      data-testid="enterprise-metric-card"
      data-interactive={onClick ? 'true' : undefined}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      {...props}
    >
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-0.5', toneRail[tone])} />
      <div className="flex min-w-0 items-start justify-between gap-2 pl-1">
        <div className="min-w-0">
          <p className="pelegrini-metric-label break-words">{label}</p>
          <div className="pelegrini-metric-value mt-1 min-w-0 text-xl leading-tight text-foreground">{value}</div>
        </div>
        {icon && <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">{icon}</div>}
      </div>
      {(context || comparison || target || detail) && (
        <div className="mt-2 min-w-0 space-y-1 pl-1 text-xs text-muted-foreground">
          {context && <div className="min-w-0 break-words">{context}</div>}
          {comparison && <div className="min-w-0">{comparison}</div>}
          {target && <div className="min-w-0 break-words">{target}</div>}
          {detail && <div className="min-w-0 break-words">{detail}</div>}
        </div>
      )}
    </Component>
  );
}
