import type { ReactNode } from 'react';

interface PelegriniPageHeaderProps {
  title: string;
  actions?: ReactNode;
  eyebrow?: string;
}

export function PelegriniPageHeader({ title, actions, eyebrow }: PelegriniPageHeaderProps) {
  return (
    <header
      className="flex min-w-0 flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between"
      data-testid="pelegrini-page-header"
    >
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-semibold uppercase text-muted-foreground">{eyebrow}</p>}
        <h1 className="text-2xl font-bold leading-tight text-foreground">{title}</h1>
      </div>
      {actions && <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
