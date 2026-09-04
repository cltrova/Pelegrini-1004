import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { Premium1004Tone } from './tokens1004';

interface PremiumSectionCardProps {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  tone?: Premium1004Tone;
  action?: ReactNode;
  className?: string;
  contentClassName?: string;
  padded?: boolean;
  children: ReactNode;
}

const TONE_CLASS: Record<Premium1004Tone, string> = {
  azul: 'text-primary',
  verde: 'text-emerald-500',
  amarelo: 'text-amber-500',
  vermelho: 'text-destructive',
  roxo: 'text-violet-500',
};

/**
 * Container padrão para todas as seções do módulo Comercial 1004.
 * Usa borda, raio e hover discretos, com ícone colorido apenas como
 * sinal semântico da seção.
 */
export function PremiumSectionCard({
  title,
  subtitle,
  icon: Icon,
  tone = 'azul',
  action,
  className,
  contentClassName,
  padded = true,
  children,
}: PremiumSectionCardProps) {
  const iconColor = TONE_CLASS[tone];
  return (
    <Card
      className={cn(
        'relative overflow-hidden rounded-lg border-border/60 bg-card transition-colors duration-300',
        'hover:border-primary/30 hover:bg-muted/20',
        className,
      )}
    >
      {(title || action) && (
        <CardHeader className="pb-2 flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0">
            {title && (
              <CardTitle className="text-base flex items-center gap-2">
                {Icon && <Icon className={cn('h-4 w-4', iconColor)} />}
                <span className="truncate">{title}</span>
              </CardTitle>
            )}
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </CardHeader>
      )}
      <CardContent className={cn(padded ? 'pt-2' : 'p-0', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
