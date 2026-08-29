import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PelegriniResponsiveValueProps {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
}

export function PelegriniResponsiveValue({ as: Component = 'span', children, className, size = 'md' }: PelegriniResponsiveValueProps) {
  return <Component className={cn('pelegrini-responsive-value', className)} data-size={size}>{children}</Component>;
}
