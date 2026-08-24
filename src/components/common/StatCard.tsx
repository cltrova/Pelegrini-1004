import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  color?: 'default' | 'positive' | 'negative' | 'primary' | 'accent';
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  color = 'default',
  icon,
  className,
}: StatCardProps) {
  const colorClasses = {
    default: '',
    positive: 'border-l-4 border-l-success',
    negative: 'border-l-4 border-l-destructive',
    primary: 'border-l-4 border-l-primary',
    accent: 'border-l-4 border-l-accent',
  };

  const trendColors = {
    up: 'text-success bg-success/10',
    down: 'text-destructive bg-destructive/10',
    stable: 'text-muted-foreground bg-muted',
  };

  const TrendIcon = {
    up: TrendingUp,
    down: TrendingDown,
    stable: Minus,
  };

  return (
    <div className={cn('stat-card', colorClasses[color], className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-1">
            {title}
          </p>
          <p className="text-2xl font-bold text-foreground mono-value">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
      </div>

      {trend && trendValue && (
        <div className="mt-3 flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              trendColors[trend]
            )}
          >
            {(() => {
              const Icon = TrendIcon[trend];
              return <Icon className="h-3 w-3" />;
            })()}
            {trendValue}
          </span>
        </div>
      )}
    </div>
  );
}
