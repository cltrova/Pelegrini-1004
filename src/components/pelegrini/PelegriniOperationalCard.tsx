import type { MouseEventHandler } from 'react';
import { cn } from '@/lib/utils';

type PelegriniOperationalAccent = 'whatsapp' | 'comercial' | 'operacional' | 'financeiro';

interface PelegriniOperationalCardProps {
  title: string;
  label: string;
  description: string;
  tags: string[];
  accent: PelegriniOperationalAccent;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  status?: string;
  className?: string;
}

export function PelegriniOperationalCard({
  title,
  label,
  description,
  tags,
  accent,
  onClick,
  disabled = false,
  status,
  className,
}: PelegriniOperationalCardProps) {
  return (
    <button
      type="button"
      className={cn(
        'pelegrini-operational-card group relative w-full overflow-hidden rounded-xl border text-left',
        'bg-card p-5 shadow-sm transition-[border-color,transform,box-shadow] duration-200',
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:-translate-y-0.5 hover:shadow-lg motion-reduce:hover:translate-y-0',
        className,
      )}
      data-accent={accent}
      data-status={status === 'Em breve' ? 'coming-soon' : undefined}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="pelegrini-operational-card-accent absolute inset-x-0 top-0 h-1" aria-hidden="true" />
      <span className="pelegrini-operational-card-signal mb-5 block h-px w-12 transition-colors" aria-hidden="true" />
      <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</span>
      <span className="mt-2 block text-lg font-semibold text-foreground">{label}</span>
      <span className="mt-2 block text-sm leading-6 text-muted-foreground">{description}</span>
      {status && <span className="mt-3 inline-flex border border-border bg-muted/40 px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{status}</span>}
      <span className="mt-5 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className="border border-border bg-muted/40 px-2 py-1 text-xs font-medium text-muted-foreground">
            {tag}
          </span>
        ))}
      </span>
    </button>
  );
}
