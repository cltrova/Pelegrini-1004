import { cn } from '@/lib/utils';

export type LoadingVariant = 'screen' | 'content' | 'inline';

interface LoadingIndicatorProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

interface LoadingStateProps {
  message?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: LoadingVariant;
  surface?: boolean;
}

const indicatorSizes = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

const loadingStateVariants: Record<LoadingVariant, string> = {
  screen: 'flex min-h-screen w-full items-center justify-center bg-background',
  content: 'flex min-h-64 w-full items-center justify-center bg-background',
  inline: 'inline-flex items-center justify-center',
};

export function LoadingIndicator({ size = 'md', className }: LoadingIndicatorProps) {
  return (
    <span
      aria-hidden="true"
      data-testid="loading-indicator"
      className={cn(
        'block shrink-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary motion-reduce:animate-none',
        indicatorSizes[size],
        className,
      )}
    />
  );
}

export function LoadingState({
  message = 'Carregando dados da filial',
  className,
  size = 'md',
  variant = 'content',
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-label={message || 'Carregando'}
      aria-live="polite"
      className={cn(loadingStateVariants[variant], className)}
    >
      <LoadingIndicator size={size} />
    </div>
  );
}
