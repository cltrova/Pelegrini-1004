import type { CSSProperties, ReactNode } from 'react';
import type { PelegriniModuleKey } from '@/config/pelegriniIdentity';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { cn } from '@/lib/utils';

interface PelegriniModuleShellProps {
  children: ReactNode;
  sidebar: ReactNode;
  className?: string;
  variant?: 'sidebar' | 'header';
  moduleKey?: PelegriniModuleKey;
}

export function PelegriniModuleShell({
  children,
  sidebar,
  className,
  variant = 'sidebar',
  moduleKey = 'comercial',
}: PelegriniModuleShellProps) {
  const { filialAtiva } = useFilialSelecionada();
  const theme = resolvePelegriniTheme(filialAtiva || 'transmissao');
  const usesHeader = variant === 'header';

  return (
    <div
      className={cn(
        'flex h-screen w-full overflow-hidden bg-background',
        usesHeader && 'flex-col',
        className,
      )}
      data-pelegrini-theme={theme.key}
      style={{
        '--pelegrini-primary': theme.primary,
        '--pelegrini-secondary': theme.secondary,
        '--pelegrini-accent': theme.accent,
        '--pelegrini-surface': theme.surface,
      } as CSSProperties}
    >
      <div className="shrink-0">{sidebar}</div>
      <main
        className={cn('pelegrini-page-surface relative flex min-w-0 flex-1 flex-col overflow-hidden', !usesHeader && 'md:ml-[72px]')}
        data-theme={theme.key}
        data-module={moduleKey}
        data-pattern={theme.surfacePattern}
      >
        <div className="pelegrini-surface-pattern" aria-hidden="true" />
        <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
