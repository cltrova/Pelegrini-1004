import type { CSSProperties, ReactNode } from 'react';
import { resolvePelegriniTheme } from '@/config/pelegriniTheme';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { cn } from '@/lib/utils';
import { PelegriniMotionBackdrop } from './PelegriniMotionBackdrop';

interface PelegriniModuleShellProps {
  children: ReactNode;
  sidebar: ReactNode;
  className?: string;
  variant?: 'sidebar' | 'header';
}

export function PelegriniModuleShell({
  children,
  sidebar,
  className,
  variant = 'sidebar',
}: PelegriniModuleShellProps) {
  const { filialAtiva } = useFilialSelecionada();
  const theme = resolvePelegriniTheme(filialAtiva);
  const usesHeader = variant === 'header';

  return (
    <div
      className={cn(
        'min-h-screen flex w-full bg-background relative overflow-hidden',
        usesHeader && 'flex-col',
        className,
      )}
      data-pelegrini-theme={theme.key}
      style={{
        '--pelegrini-primary': theme.primary,
        '--pelegrini-secondary': theme.secondary,
        '--pelegrini-accent': theme.accent,
      } as CSSProperties}
    >
      <PelegriniMotionBackdrop theme={theme} intensity="soft" className="opacity-40" />
      <div className="relative z-10">{sidebar}</div>
      <main className={cn('relative z-10 flex-1 overflow-x-hidden', !usesHeader && 'md:ml-64')}>
        {children}
      </main>
    </div>
  );
}
