import { useState, type ReactNode } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PelegriniFilterBarProps {
  activeCount?: number;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  summary?: string;
}

export function PelegriniFilterBar({ activeCount = 0, children, className, defaultOpen = false, summary }: PelegriniFilterBarProps) {
  const [open, setOpen] = useState(defaultOpen);
  const activeLabel = `${activeCount} ${activeCount === 1 ? 'ativo' : 'ativos'}`;

  return (
    <section className={cn('pelegrini-filter-bar', className)}>
      <button aria-expanded={open} className="pelegrini-filter-bar-trigger" onClick={() => setOpen((current) => !current)} type="button">
        <SlidersHorizontal aria-hidden="true" />
        <span>Filtros</span>
        {activeCount > 0 && <span className="pelegrini-filter-count">{activeLabel}</span>}
        {summary && <span className="pelegrini-filter-summary">{summary}</span>}
        <ChevronDown aria-hidden="true" className={cn(open && 'rotate-180')} />
      </button>
      <div className={cn('pelegrini-filter-controls', !open && 'hidden lg:flex')}>{children}</div>
    </section>
  );
}
