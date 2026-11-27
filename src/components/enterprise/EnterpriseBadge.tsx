import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EnterpriseTone = 'neutral' | 'positive' | 'negative' | 'warning' | 'info';

const toneClasses: Record<EnterpriseTone, string> = {
  neutral: 'border-border bg-muted/40 text-muted-foreground',
  positive: 'border-success/35 bg-success/10 text-success',
  negative: 'border-destructive/35 bg-destructive/10 text-destructive',
  warning: 'border-warning/35 bg-warning/10 text-warning',
  info: 'border-[hsl(var(--enterprise-info)/0.35)] bg-[hsl(var(--enterprise-info)/0.10)] text-[hsl(var(--enterprise-info))]',
};

export function EnterpriseBadge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: EnterpriseTone; className?: string }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold leading-4', toneClasses[tone], className)}>
      {children}
    </span>
  );
}

export function VarianceIndicator({ value, label, className }: { value: number; label?: string; className?: string }) {
  const tone: EnterpriseTone = value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : ArrowRight;
  const formatted = `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1 text-xs', className)}>
      <EnterpriseBadge tone={tone}>
        <Icon aria-hidden="true" className="h-3 w-3" />
        <span className="tabular-nums">{formatted}</span>
      </EnterpriseBadge>
      {label && <span className="truncate text-muted-foreground">{label}</span>}
    </span>
  );
}
