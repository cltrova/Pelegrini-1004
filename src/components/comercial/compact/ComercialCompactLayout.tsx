import type { PropsWithChildren, ReactNode } from 'react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import './ComercialCompactLayout.css';

export interface ComercialCompactPageProps extends PropsWithChildren {
  className?: string;
  as?: 'main' | 'div' | 'section';
}

export interface ComercialCommandBarProps {
  title: string;
  context?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export interface ComercialFilterBarProps extends PropsWithChildren {
  search?: ReactNode;
  primary?: ReactNode;
  actions?: ReactNode;
  ariaLabel?: string;
  mode?: string;
  className?: string;
}

export type ComercialMetricTone = 'neutral' | 'success' | 'warning' | 'danger';

export interface ComercialMetric {
  label: string;
  value: ReactNode;
  context?: ReactNode;
  tone?: ComercialMetricTone;
  tooltip?: ReactNode;
  onClick?: () => void;
  actionLabel?: string;
}

export interface ComercialMetricStripProps {
  metrics: readonly ComercialMetric[];
  ariaLabel?: string;
  mode?: string;
  className?: string;
}

export interface ComercialDataViewportProps extends PropsWithChildren {
  className?: string;
  ariaLabel?: string;
}

export function ComercialCompactPage({ children, className, as: Component = 'main' }: ComercialCompactPageProps) {
  return <Component className={cn('comercial-compact-page min-h-0 min-w-0 max-w-full overflow-x-hidden', className)}>{children}</Component>;
}

export function ComercialCommandBar({ title, context, actions, className }: ComercialCommandBarProps) {
  return (
    <header className={cn('comercial-command-bar', className)}>
      <div className="min-w-0">
        <h1>{title}</h1>
        {context && <span className="comercial-command-context">{context}</span>}
      </div>
      {actions && <div className="comercial-command-actions">{actions}</div>}
    </header>
  );
}

export function ComercialFilterBar({
  search,
  primary,
  actions,
  children,
  ariaLabel = 'Filtros comerciais',
  mode,
  className,
}: ComercialFilterBarProps) {
  return (
    <section aria-label={ariaLabel} className={cn('comercial-filter-bar', className)} data-density="compact" data-mode={mode}>
      {search && <div className="comercial-filter-search">{search}</div>}
      {primary && <div className="comercial-filter-primary">{primary}</div>}
      {children && <div className="comercial-filter-secondary">{children}</div>}
      {actions && <div className="comercial-filter-actions">{actions}</div>}
    </section>
  );
}

function ComercialMetricCell({ label, value, context, tone = 'neutral', tooltip, onClick, actionLabel }: ComercialMetric) {
  const cell = (
    <article
      aria-label={onClick ? actionLabel || `Abrir detalhes de ${label}` : undefined}
      className={cn('comercial-metric-cell', onClick && 'cursor-pointer')}
      data-tone={tone}
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={tooltip || onClick ? 0 : undefined}
    >
      <span className="comercial-metric-label">{label}</span>
      <span className="comercial-metric-value tabular-nums" title={typeof value === 'string' ? value : undefined}>{value}</span>
      {context && <span className="comercial-metric-context">{context}</span>}
    </article>
  );

  if (!tooltip) return cell;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{cell}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function ComercialMetricStrip({
  metrics,
  ariaLabel = 'Indicadores comerciais',
  mode,
  className,
}: ComercialMetricStripProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <section
        aria-label={ariaLabel}
        className={cn('comercial-metric-strip', className)}
        data-density="compact"
        data-mode={mode}
      >
        {metrics.map((metric) => <ComercialMetricCell key={metric.label} {...metric} />)}
      </section>
    </TooltipProvider>
  );
}

export function ComercialDataViewport({ children, className, ariaLabel }: ComercialDataViewportProps) {
  const isOperational = Boolean(ariaLabel);

  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        'comercial-data-viewport min-h-0 min-w-0 max-w-full overflow-auto',
        isOperational && 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        className,
      )}
      data-testid="comercial-data-viewport"
      role={isOperational ? 'region' : undefined}
      tabIndex={isOperational ? 0 : undefined}
    >
      {children}
    </div>
  );
}
