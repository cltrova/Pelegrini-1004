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

const TONE_ACCENT: Record<Premium1004Tone, string> = {
  azul: 'from-primary/25 via-primary/5 to-transparent',
  verde: 'from-emerald-500/25 via-emerald-500/5 to-transparent',
  amarelo: 'from-amber-500/25 via-amber-500/5 to-transparent',
  vermelho: 'from-destructive/25 via-destructive/5 to-transparent',
  roxo: 'from-violet-500/25 via-violet-500/5 to-transparent',
};

const TONE_RING: Record<Premium1004Tone, string> = {
  azul: 'hover:ring-primary/40',
  verde: 'hover:ring-emerald-500/40',
  amarelo: 'hover:ring-amber-500/40',
  vermelho: 'hover:ring-destructive/40',
  roxo: 'hover:ring-violet-500/40',
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
 * Mesmo layout dos cards de topo da aba "Visão Geral"
 * (VisaoGeralRapida1004): gradient sutil, ícone em pill, valor mono
 * grande, hint discreto e barra de progresso opcional.
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
        'group relative overflow-hidden border-border/60 transition-all duration-300 h-full',
        'hover:-translate-y-0.5 hover:shadow-lg hover:ring-1',
        clickable && 'cursor-pointer',
        TONE_RING[tone],
        className,
      )}
    >
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-70 pointer-events-none',
          TONE_ACCENT[tone],
        )}
      />
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-white/5 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
      <CardContent className="relative p-4 flex flex-col h-full">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
            {label}
          </span>
          <div
            className={cn(
              'h-7 w-7 rounded-md flex items-center justify-center bg-background/60 backdrop-blur-sm ring-1 ring-border/50',
              'transition-transform group-hover:scale-110 group-hover:rotate-[-4deg]',
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
                'h-full rounded-full transition-all duration-700',
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
