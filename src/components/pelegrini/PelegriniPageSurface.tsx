import type { CSSProperties, ReactNode } from 'react';
import type { PelegriniModuleKey } from '@/config/pelegriniIdentity';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { cn } from '@/lib/utils';

interface PelegriniPageSurfaceProps {
  children: ReactNode;
  moduleKey?: PelegriniModuleKey;
  className?: string;
}

export function PelegriniPageSurface({ children, moduleKey = 'comercial', className }: PelegriniPageSurfaceProps) {
  const { filialAtiva } = useFilialSelecionada();
  const theme = resolvePelegriniTheme(filialAtiva || 'transmissao');

  return (
    <section
      data-testid="pelegrini-page-surface"
      data-theme={theme.key}
      data-module={moduleKey}
      data-pattern={theme.surfacePattern}
      className={cn('pelegrini-page-surface relative min-h-full overflow-hidden', className)}
      style={{
        '--pelegrini-primary': theme.primary,
        '--pelegrini-secondary': theme.secondary,
        '--pelegrini-accent': theme.accent,
      } as CSSProperties}
    >
      <div className="pelegrini-surface-pattern" aria-hidden="true" />
      <div className="relative z-[1]">{children}</div>
    </section>
  );
}
