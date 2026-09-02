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
  const isChevrolet = theme.key === 'chevrolet';
  const isCompactSidebar = isSidebar && compact;
  const logoSrc = isSidebar && theme.key === 'transmissao'
    ? '/brand/home/transmissao-transparent.png'
    : theme.logoSrc;

  return (
    <div className={cn(
      'pelegrini-brand-mark flex min-w-0 items-center gap-3',
      isSidebar && 'justify-center',
      className,
    )} data-brand={theme.key}>
      <div className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden border border-transparent bg-transparent',
        isCompactSidebar
          ? isChevrolet ? 'h-12 w-16' : 'h-12 w-12'
          : isSidebar
            ? isChevrolet ? 'h-14 w-44' : 'h-16 w-24'
          : isChevrolet ? 'h-12 w-24' : 'h-12 w-12',
      )}>
        <img
          src={logoSrc}
          alt={theme.logoAlt}
          className={cn(
            'object-contain',
            isSidebar && 'pelegrini-sidebar-logo',
            isCompactSidebar
              ? isChevrolet ? 'pelegrini-chevrolet-logo max-h-10 max-w-16' : 'max-h-11 max-w-12'
              : isSidebar
                ? isChevrolet ? 'pelegrini-chevrolet-logo max-h-12 max-w-44' : 'max-h-16 max-w-24'
              : isChevrolet ? 'pelegrini-chevrolet-logo max-h-9 max-w-24' : 'max-h-10 max-w-10',
          )}
        />
      </div>
      {!compact && !isSidebar && (
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
