import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PelegriniDataPanelProps {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}

export function PelegriniDataPanel({ title, eyebrow, children, className }: PelegriniDataPanelProps) {
  return (
    <section className={cn('pelegrini-data-panel overflow-hidden border bg-card', className)}>
      <header className="border-b border-border/70 px-4 py-3">
        {eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>}
        <h3 className="mt-1 text-base font-semibold text-foreground">{title}</h3>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
