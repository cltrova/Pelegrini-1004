import type { PelegriniTheme } from '@/config/pelegriniTheme';
import { cn } from '@/lib/utils';

interface PelegriniBrandMarkProps {
  theme: PelegriniTheme;
  compact?: boolean;
  className?: string;
  showTagline?: boolean;
  tone?: 'default' | 'sidebar';
}

export function PelegriniBrandMark({
  theme,
  compact = false,
  className,
  showTagline = true,
  tone = 'default',
}: PelegriniBrandMarkProps) {
  const isSidebar = tone === 'sidebar';

  return (
    <div className={cn('pelegrini-brand-mark flex min-w-0 items-center gap-3', className)} data-brand={theme.key}>
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border border-border bg-white shadow-sm">
        <img src={theme.logoSrc} alt={theme.logoAlt} className="max-h-10 max-w-10 object-contain" />
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className={cn('text-sm font-semibold tracking-normal', isSidebar ? 'leading-tight text-sidebar-foreground' : 'truncate text-foreground')}>
            {theme.name}
          </p>
          {!isSidebar && showTagline && <p className="hidden truncate text-xs text-muted-foreground xl:block">{theme.tagline}</p>}
        </div>
      )}
    </div>
  );
}
