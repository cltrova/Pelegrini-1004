import type { PelegriniTheme } from '@/config/pelegriniTheme';
import { cn } from '@/lib/utils';

interface PelegriniBrandMarkProps {
  theme: PelegriniTheme;
  compact?: boolean;
  className?: string;
}

export function PelegriniBrandMark({ theme, compact = false, className }: PelegriniBrandMarkProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <div
        className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white shadow-sm"
        style={{ boxShadow: `0 14px 34px -20px ${theme.glow}` }}
      >
        <img src={theme.logoSrc} alt={theme.logoAlt} className="max-h-10 max-w-10 object-contain" />
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{theme.name}</p>
          <p className="truncate text-xs text-muted-foreground">{theme.tagline}</p>
        </div>
      )}
    </div>
  );
}
