import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PelegriniKpiCardProps {
  label: string;
  value: ReactNode;
  helper?: string;
  tone?: 'blue' | 'steel' | 'gold' | 'green' | 'red';
  className?: string;
}

export function PelegriniKpiCard({ label, value, helper, tone = 'blue', className }: PelegriniKpiCardProps) {
  return (
    <article className={cn('pelegrini-kpi-card group relative min-w-0 overflow-hidden border bg-card p-4', className)} data-tone={tone}>
      <span className="pelegrini-kpi-card-rail" aria-hidden="true" />
      <div className="relative min-w-0">
        <p className="pelegrini-metric-label">{label}</p>
        <div className="pelegrini-metric-value kpi-fluid-value mt-1.5 text-foreground">{value}</div>
        {helper && <p className="mt-1 min-w-0 text-sm text-muted-foreground">{helper}</p>}
      </div>
    </article>
  );
}
