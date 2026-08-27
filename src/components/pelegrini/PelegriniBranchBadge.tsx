import type { PelegriniTheme } from '@/config/pelegriniTheme';
import { cn } from '@/lib/utils';

interface PelegriniBranchBadgeProps {
  theme: PelegriniTheme;
  active?: boolean;
  className?: string;
}

export function PelegriniBranchBadge({ theme, active = false, className }: PelegriniBranchBadgeProps) {
  const signal = theme.trustSignals[0];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-all',
        active ? 'border-primary/35 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground',
        className,
      )}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.accent }} />
      <span>{theme.name}</span>
      <span className="text-muted-foreground">•</span>
      <span>{signal}</span>
    </div>
  );
}
