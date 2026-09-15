import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  message?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  surface?: boolean;
}

export function LoadingState({
  message = 'Carregando dados da filial',
  className,
  size = 'md',
  surface = true,
}: LoadingStateProps) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div
      role="status"
      aria-label={message || 'Carregando'}
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center text-muted-foreground',
        surface && 'rounded-xl border border-border bg-card shadow-sm',
        className
      )}
    >
      <Loader2 className={cn('animate-spin motion-reduce:animate-none text-primary', sizes[size])} />
      {message && <p className="mt-3 text-sm">{message}</p>}
    </div>
  );
}
