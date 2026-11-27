import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PelegriniFilterBarProps {
  children: ReactNode;
  actions?: ReactNode;
  activeCount?: number;
  className?: string;
  defaultOpen?: boolean;
  summary?: string;
}

export function PelegriniFilterBar({ actions, activeCount, children, className, defaultOpen = false, summary }: PelegriniFilterBarProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const collapsible = activeCount !== undefined || summary !== undefined;
  const resolvedActiveCount = activeCount ?? 0;
  const activeLabel = `${resolvedActiveCount} ${resolvedActiveCount === 1 ? 'ativo' : 'ativos'}`;

  return (
    <section className={cn('pelegrini-filter-bar min-w-0', className)} data-testid="pelegrini-filter-bar">
      {collapsible && (
        <button aria-controls={panelId} aria-expanded={open} className="pelegrini-filter-bar-trigger" onClick={() => setOpen((current) => !current)} type="button">
          <SlidersHorizontal aria-hidden="true" />
          <span>Filtros</span>
          {resolvedActiveCount > 0 && <span className="pelegrini-filter-count rounded-lg">{activeLabel}</span>}
          {summary && <span className="pelegrini-filter-summary">{summary}</span>}
          <ChevronDown aria-hidden="true" className={cn(open && 'rotate-180')} />
        </button>
      )}
      <div id={panelId} data-state={collapsible && open ? 'open' : undefined} hidden={collapsible && !open} className={cn('pelegrini-disclosure pelegrini-filter-controls flex flex-col gap-3 sm:flex-row sm:items-end', collapsible && !open && 'hidden')}>
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">{children}</div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </section>
  );
}
