import type { PelegriniTheme } from '@/config/pelegriniTheme';
import { cn } from '@/lib/utils';

interface PelegriniBrandMarkProps {
  theme: PelegriniTheme;
  compact?: boolean;
  className?: string;
  tone?: 'default' | 'sidebar';
}

export function PelegriniBrandMark({
  theme,
  compact = false,
  className,
  tone = 'default',
}: PelegriniBrandMarkProps) {
  const isSidebar = tone === 'sidebar';

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
          <p className={cn('truncate text-sm font-semibold', isSidebar ? 'text-sidebar-foreground' : 'text-foreground')}>
            {theme.name}
          </p>
          <p className={cn('truncate text-xs', isSidebar ? 'text-sidebar-muted' : 'text-muted-foreground')}>
            {theme.tagline}
          </p>
        </div>
      )}
    </div>
  );
}
