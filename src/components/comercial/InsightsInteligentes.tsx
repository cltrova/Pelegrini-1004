import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Sparkles, TrendingUp, Users, PieChart, ArrowUpRight, AlertTriangle, Lightbulb, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'primary' | 'emerald' | 'amber' | 'rose' | 'violet' | 'sky';

const TONE_STYLES: Record<Tone, { bg: string; text: string; ring: string }> = {
  primary: { bg: 'bg-primary/10', text: 'text-primary', ring: 'ring-primary/20' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/20' },
  amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-600 dark:text-amber-400',    ring: 'ring-amber-500/20' },
  rose:    { bg: 'bg-rose-500/10',    text: 'text-rose-600 dark:text-rose-400',      ring: 'ring-rose-500/20' },
  violet:  { bg: 'bg-violet-500/10',  text: 'text-violet-600 dark:text-violet-400',  ring: 'ring-violet-500/20' },
  sky:     { bg: 'bg-sky-500/10',     text: 'text-sky-600 dark:text-sky-400',        ring: 'ring-sky-500/20' },
};

export interface InsightItem {
  id: string;
  label: string;
  headline: ReactNode;
  detail?: ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  emoji?: string;
}

interface Props {
  items: InsightItem[];
}

export function InsightsInteligentes({ items }: Props) {
  return (
    <section>
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground/90">Insights Inteligentes</h3>
            <p className="text-xs text-muted-foreground">Resumos automáticos baseados nos dados do período</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, idx) => {
          const tone = TONE_STYLES[it.tone];
          const Icon = it.icon;
          return (
            <Card
              key={it.id}
              className={cn(
                'group relative overflow-hidden border-border/60 bg-card p-4 cursor-default',
                'transition-colors duration-300 ease-out',
                'hover:border-primary/30 hover:bg-muted/30',
                'animate-fade-in'
              )}
              style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
            >
              {/* Borda translúcida no hover */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-transparent transition-colors duration-300 group-hover:ring-primary/15"
              />
              <div className="relative flex items-start gap-3">
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1',
                    tone.bg,
                    tone.ring
                  )}
                >
                  <Icon className={cn('h-4 w-4', tone.text)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {it.emoji && <span aria-hidden>{it.emoji}</span>}
                    {it.label}
                  </p>
                  <div className="mt-1 truncate text-sm font-semibold text-foreground transition-colors duration-300 group-hover:text-primary">
                    {it.headline}
                  </div>
                  {it.detail && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {it.detail}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );

        })}
      </div>
    </section>
  );
}

// Ícones re-exportados para conveniência no consumidor
export const InsightIcons = {
  TrendingUp,
  Users,
  PieChart,
  ArrowUpRight,
  AlertTriangle,
  Lightbulb,
  Minus,
  Sparkles,
};
