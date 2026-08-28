import type { CSSProperties, ReactNode } from 'react';
import type { PelegriniThemeKey } from '@/config/pelegriniTheme';
import { PELEGRINI_THEMES } from '@/config/pelegriniTheme';
import { cn } from '@/lib/utils';

interface PelegriniChartFrameProps {
  title: string;
  helper?: string;
  themeKey: PelegriniThemeKey;
  children: ReactNode;
  className?: string;
}

export function PelegriniChartFrame({ title, helper, themeKey, children, className }: PelegriniChartFrameProps) {
  const theme = PELEGRINI_THEMES[themeKey];

  return (
    <section
      data-testid="pelegrini-chart-frame"
      data-theme={themeKey}
      className={cn('pelegrini-chart-frame overflow-hidden border bg-card', className)}
      style={{
        '--pelegrini-primary': theme.primary,
        '--pelegrini-secondary': theme.secondary,
        '--pelegrini-accent': theme.accent,
      } as CSSProperties}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {helper && <p className="mt-0.5 text-xs text-muted-foreground">{helper}</p>}
        </div>
        <span className="pelegrini-chart-frame-key" aria-hidden="true" />
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
