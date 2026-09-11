import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

type SectionProps = ComponentPropsWithoutRef<'section'>;
type HeaderProps = ComponentPropsWithoutRef<'header'>;
type ToolbarProps = ComponentPropsWithoutRef<'div'>;

export function EstoqueWorkspace({
  'aria-label': ariaLabel = 'Mesa operacional de estoque',
  children,
  className,
  ...props
}: SectionProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        'operational-workspace flex h-[calc(100dvh-var(--estoque-shell-offset,0px))] min-h-0 min-w-0 flex-col overflow-hidden',
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function EstoqueWorkspaceHeader({
  'aria-label': ariaLabel = 'Navegacao do estoque',
  children,
  className,
  ...props
}: HeaderProps) {
  return (
    <header
      aria-label={ariaLabel}
      className={cn(
        'operational-workspace-header flex h-10 min-w-0 shrink-0 items-center border-b border-border/60 bg-card/95 px-2.5 max-md:pl-14',
        className,
      )}
      {...props}
    >
      {children}
    </header>
  );
}

export function EstoqueToolbar({
  'aria-label': ariaLabel = 'Comandos do estoque',
  children,
  className,
  ...props
}: ToolbarProps) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        'operational-toolbar flex h-10 min-w-0 shrink-0 flex-nowrap items-center gap-1.5 overflow-x-auto overscroll-x-contain border-b border-border/60 bg-background/95 px-2.5',
        className,
      )}
      role="toolbar"
      {...props}
    >
      {children}
    </div>
  );
}

export function EstoqueDataViewport({
  'aria-label': ariaLabel = 'Dados do estoque',
  children,
  className,
  ...props
}: SectionProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        'operational-data-viewport flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}
