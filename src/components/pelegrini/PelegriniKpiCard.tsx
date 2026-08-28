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
    <article className={cn('pelegrini-kpi-card group relative overflow-hidden border bg-card p-4', className)} data-tone={tone}>
      <span className="pelegrini-kpi-card-rail" aria-hidden="true" />
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
        {helper && <p className="mt-1 text-sm text-muted-foreground">{helper}</p>}
      </div>
    </article>
  );
}
