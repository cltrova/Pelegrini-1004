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
        'flex h-[calc(100dvh-var(--estoque-shell-offset,0px))] min-h-0 min-w-0 flex-col overflow-hidden',
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
        'flex h-11 min-w-0 shrink-0 items-center border-b border-border/70 bg-card px-3',
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
        'flex h-11 min-w-0 shrink-0 items-center gap-2 border-b border-border/70 bg-background px-3',
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
      className={cn('min-h-0 min-w-0 flex-1 overflow-auto', className)}
      {...props}
    >
      {children}
    </section>
  );
}
