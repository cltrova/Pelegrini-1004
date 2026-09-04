import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Premium1004Tone } from './tokens1004';

interface PremiumStatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: Premium1004Tone;
  /** Barra 0-100 opcional (ex.: % da meta). */
  bar?: number | null;
  onClick?: () => void;
  className?: string;
}

const TONE_BORDER: Record<Premium1004Tone, string> = {
  azul: 'hover:border-primary/35',
  verde: 'hover:border-emerald-500/35',
  amarelo: 'hover:border-amber-500/35',
  vermelho: 'hover:border-destructive/35',
  roxo: 'hover:border-violet-500/35',
};

const TONE_ICON: Record<Premium1004Tone, string> = {
  azul: 'text-primary',
  verde: 'text-emerald-400',
  amarelo: 'text-amber-500',
  vermelho: 'text-destructive',
  roxo: 'text-violet-400',
};

const TONE_BAR: Record<Premium1004Tone, string> = {
  azul: 'bg-primary',
  verde: 'bg-emerald-500',
  amarelo: 'bg-amber-500',
  vermelho: 'bg-destructive',
  roxo: 'bg-violet-500',
};

/**
 * Card de totalizador padrão do Comercial 1004.
 * Mantém ícone, valor mono, hint discreto e barra opcional em um
 * contêiner neutro alinhado ao padrão visual empresarial.
 */
export function PremiumStatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'azul',
  bar,
  onClick,
  className,
}: PremiumStatCardProps) {
  const clickable = !!onClick;
  return (
    <Card
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        'group relative overflow-hidden rounded-lg border-border/60 bg-card transition-colors duration-300 h-full',
        'hover:bg-muted/30',
        clickable && 'cursor-pointer',
        TONE_BORDER[tone],
        className,
      )}
    >
      <CardContent className="relative p-4 flex flex-col h-full">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
            {label}
          </span>
          <div
            className={cn(
              'h-7 w-7 rounded-md flex items-center justify-center bg-muted/40 ring-1 ring-border/60',
            )}
          >
            <Icon className={cn('h-3.5 w-3.5', TONE_ICON[tone])} />
          </div>
        </div>
        <div className="text-2xl xl:text-[26px] font-bold font-mono tracking-tight leading-none">
          {value}
        </div>
        {hint && (
          <div className="mt-2 text-[11px] text-muted-foreground truncate">
            {hint}
          </div>
        )}
        {bar != null && (
          <div className="mt-auto pt-2 h-1 rounded-full bg-muted/60 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-700',
                TONE_BAR[tone],
              )}
              style={{ width: `${Math.min(100, Math.max(0, bar))}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
