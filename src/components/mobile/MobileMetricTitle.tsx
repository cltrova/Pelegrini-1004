import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  type LucideIcon,
  Percent,
  TrendingUp,
  Target,
  ArrowLeftRight,
  CalendarDays,
  Calendar,
  Gauge,
  Trophy,
  TrendingDown,
  Minus,
} from 'lucide-react';

export type MobileMetricTitleVariant = 'primary' | 'success' | 'accent' | 'default';

export interface MobileMetricTitleProps {
  children: React.ReactNode;
  icon?: LucideIcon | 'percent' | 'trendingUp' | 'target' | 'arrowLeftRight' | 'calendarDays' | 'calendar' | 'gauge' | 'trophy' | 'trendingDown' | 'minus';
  variant?: MobileMetricTitleVariant;
  className?: string;
  align?: 'left' | 'center';
  /** Quando true, reduz ainda mais o espaçamento para cards pequenos (grid 2 cols). */
  compact?: boolean;
}

const iconMap: Record<string, LucideIcon> = {
  percent: Percent,
  trendingUp: TrendingUp,
  target: Target,
  arrowLeftRight: ArrowLeftRight,
  calendarDays: CalendarDays,
  calendar: Calendar,
  gauge: Gauge,
  trophy: Trophy,
  trendingDown: TrendingDown,
  minus: Minus,
};

const variantClasses: Record<MobileMetricTitleVariant, string> = {
  primary:
    'text-primary after:bg-primary/40 shadow-[0_1px_8px_-4px_hsl(var(--primary)/0.25)]',
  success:
    'text-success after:bg-success/40 shadow-[0_1px_8px_-4px_hsl(var(--success)/0.25)]',
  accent:
    'text-accent after:bg-accent/40 shadow-[0_1px_8px_-4px_hsl(var(--accent)/0.25)]',
  default:
    'text-muted-foreground after:bg-primary/30 shadow-[0_1px_8px_-4px_hsl(var(--primary)/0.15)]',
};

const iconVariantClasses: Record<MobileMetricTitleVariant, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  accent: 'bg-accent/10 text-accent',
  default: 'bg-muted text-muted-foreground',
};

export function MobileMetricTitle({
  children,
  icon,
  variant = 'default',
  className,
  align = 'center',
  compact = false,
}: MobileMetricTitleProps) {
  const ResolvedIcon =
    typeof icon === 'string' ? iconMap[icon] : icon;

  return (
    <motion.div
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      className={cn(
        'group relative flex items-center gap-2 rounded-lg px-2',
        align === 'center' && 'justify-center text-center',
        align === 'left' && 'justify-start text-left',
        compact ? 'py-1 mb-1' : 'py-1.5 mb-1.5',
        className
      )}
    >
      {/* Glow de fundo sutil */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100',
          variant === 'primary' && 'bg-primary/5',
          variant === 'success' && 'bg-success/5',
          variant === 'accent' && 'bg-accent/5',
          variant === 'default' && 'bg-primary/3'
        )}
      />

      {ResolvedIcon && (
        <div
          className={cn(
            'relative flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors duration-300',
            iconVariantClasses[variant]
          )}
        >
          <ResolvedIcon className="h-3 w-3" strokeWidth={2.5} />
        </div>
      )}

      <span
        className={cn(
          'relative text-[11px] font-bold uppercase tracking-[0.12em]',
          'after:absolute after:-bottom-0.5 after:left-0 after:h-[1.5px] after:w-0 after:rounded-full',
          'after:transition-all after:duration-300 group-hover:after:w-full',
          variantClasses[variant]
        )}
      >
        {children}
      </span>
    </motion.div>
  );
}
