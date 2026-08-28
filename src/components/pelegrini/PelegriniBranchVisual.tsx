import type { CSSProperties } from 'react';
import type { PelegriniTheme } from '@/config/pelegriniTheme';
import { resolvePelegriniVisual } from '@/config/pelegriniTheme';
import { cn } from '@/lib/utils';

interface PelegriniBranchVisualProps {
  theme: PelegriniTheme;
  className?: string;
}

export function PelegriniBranchVisual({ theme, className }: PelegriniBranchVisualProps) {
  const visual = resolvePelegriniVisual(theme.key);

  return (
    <div
      data-testid="pelegrini-branch-visual"
      data-theme={theme.key}
      data-motif={theme.motif}
      className={cn('pelegrini-branch-visual relative overflow-hidden border border-border bg-card', className)}
      style={{
        '--pelegrini-primary': theme.primary,
        '--pelegrini-secondary': theme.secondary,
        '--pelegrini-accent': theme.accent,
      } as CSSProperties}
    >
      <div className="pelegrini-branch-visual-grid" aria-hidden="true" />
      <div className="relative flex items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {visual.heroNoun}
          </p>
          <h3 className="mt-1 text-base font-semibold text-foreground">{visual.blueprintLabel}</h3>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{visual.panelMicrocopy}</p>
        </div>
        <div className="pelegrini-branch-visual-symbol shrink-0" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
