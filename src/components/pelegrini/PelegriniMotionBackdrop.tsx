import type { CSSProperties } from 'react';
import type { PelegriniTheme } from '@/config/pelegriniTheme';
import { cn } from '@/lib/utils';

interface PelegriniMotionBackdropProps {
  theme: PelegriniTheme;
  intensity?: 'soft' | 'strong';
  className?: string;
}

export function PelegriniMotionBackdrop({ theme, intensity = 'soft', className }: PelegriniMotionBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('pelegrini-motion-backdrop pointer-events-none absolute inset-0 overflow-hidden', className)}
      data-motion={theme.motion}
      data-intensity={intensity}
      style={
        {
          '--pelegrini-primary': theme.primary,
          '--pelegrini-secondary': theme.secondary,
          '--pelegrini-accent': theme.accent,
        } as CSSProperties
      }
    >
      <span className="pelegrini-motion-line line-one" />
      <span className="pelegrini-motion-line line-two" />
      <span className="pelegrini-motion-gear" />
    </div>
  );
}
