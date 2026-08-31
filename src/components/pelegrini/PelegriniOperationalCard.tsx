import type { ComponentType, MouseEventHandler } from 'react';
import { cn } from '@/lib/utils';

type PelegriniOperationalAccent = 'whatsapp' | 'comercial' | 'operacional' | 'financeiro';

interface PelegriniOperationalCardProps {
  title: string;
  label: string;
  description?: string;
  tags: string[];
  accent: PelegriniOperationalAccent;
  icon?: ComponentType<{ className?: string }>;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  status?: string;
  className?: string;
}

export function PelegriniOperationalCard({
  title,
  label,
  tags,
  accent,
  icon: Icon,
  onClick,
  disabled = false,
  status,
  className,
}: PelegriniOperationalCardProps) {
  return (
    <button
      type="button"
      className={cn(
        'pelegrini-operational-card group relative grid min-h-11 min-w-0 w-full max-w-full grid-cols-[2.5rem_minmax(0,1fr)] gap-3 overflow-hidden rounded-lg border bg-card p-3 text-left',
        'transition-[border-color,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted/30',
        className,
      )}
      data-accent={accent}
      data-status={status === 'Em breve' ? 'coming-soon' : undefined}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="pelegrini-operational-card-accent absolute inset-y-0 left-0 w-0.5" aria-hidden="true" />
      <span className="flex h-10 w-10 shrink-0 items-center justify-center border-r border-border text-muted-foreground" data-pelegrini-card-icon aria-hidden="true">
        {Icon && <Icon className="h-5 w-5" />}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold uppercase text-muted-foreground">{title}</span>
        <span className="mt-0.5 block break-words text-sm font-semibold text-foreground">{label}</span>
        <span className="mt-2 flex min-w-0 flex-wrap gap-1.5">
          {tags.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {tag}
            </span>
          ))}
          {status && <span className="rounded border border-border px-1.5 py-0.5 text-[11px] font-semibold uppercase text-muted-foreground">{status}</span>}
        </span>
      </span>
    </button>
  );
}
