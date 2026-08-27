import type { MouseEventHandler } from 'react';
import type { PelegriniTheme } from '@/config/pelegriniTheme';
import { cn } from '@/lib/utils';

interface PelegriniBranchPanelProps {
  theme: PelegriniTheme;
  active?: boolean;
  indicators: string[];
  description: string;
  onSelect: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  className?: string;
}

export function PelegriniBranchPanel({
  theme,
  active = false,
  indicators,
  description,
  onSelect,
  disabled = false,
  className,
}: PelegriniBranchPanelProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'pelegrini-branch-panel group relative w-full overflow-hidden rounded-xl border p-4 text-left',
        active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/40',
        disabled && 'cursor-not-allowed opacity-65',
        className,
      )}
      onClick={onSelect}
      disabled={disabled}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: theme.accent }} aria-hidden="true" />
      <span className="flex items-start gap-3 pl-1">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-white p-1">
          <img src={theme.logoSrc} alt="" className="max-h-8 max-w-8 object-contain" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">{theme.name}</span>
          <span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span>
        </span>
      </span>
      <span className="mt-4 flex flex-wrap gap-2 pl-1">
        {indicators.map((indicator) => (
          <span key={indicator} className="border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground">
            {indicator}
          </span>
        ))}
      </span>
    </button>
  );
}
