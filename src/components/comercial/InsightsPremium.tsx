import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, ArrowUpRight, Lightbulb, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Insight {
  tipo: 'alerta' | 'oportunidade' | 'info';
  titulo: string;
  descricao: string;
}

interface Props {
  insights: Insight[];
}

const tipoConfig = {
  alerta: {
    color: 'hsl(0 72% 51%)',
    Icon: AlertTriangle,
    label: 'Alerta',
  },
  oportunidade: {
    color: 'hsl(142 71% 45%)',
    Icon: ArrowUpRight,
    label: 'Oportunidade',
  },
  info: {
    color: 'hsl(217 91% 60%)',
    Icon: Lightbulb,
    label: 'Insight',
  },
};

export function InsightsPremium({ insights }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!insights.length) return null;

  return (
    <Card className="border-border/60 bg-card overflow-hidden stagger-5">
      {/* Hero header */}
      <div className="relative overflow-hidden p-4 border-b border-border/40 bg-card">
        <div className="relative flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10 ring-1 ring-primary/25"
            style={{
              color: 'hsl(var(--primary))',
            }}
          >
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              Insights & Alertas Inteligentes
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                {insights.length} ativos
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">Clique nos cards para mais detalhes</p>
          </div>
        </div>
      </div>

      <CardContent className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {insights.map((insight, i) => {
            const cfg = tipoConfig[insight.tipo];
            const Icon = cfg.Icon;
            const isExpanded = expandedIdx === i;

            return (
              <button
                key={i}
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                className={cn(
                  'group relative text-left rounded-lg p-3.5 border bg-card',
                  'transition-colors duration-300 cursor-pointer overflow-hidden hover:bg-muted/30',
                  isExpanded && 'sm:col-span-2 lg:col-span-2 ring-2'
                )}
                style={{
                  borderColor: `${cfg.color}40`,
                }}
              >
                <div className="relative">
                  <div className="flex items-start justify-between mb-2">
                    <div
                      className={cn(
                        'h-9 w-9 rounded-lg flex items-center justify-center shrink-0'
                      )}
                      style={{
                        background: `${cfg.color}25`,
                        color: cfg.color,
                      }}
                    >
                      <Icon className={cn('h-4.5 w-4.5', insight.tipo === 'alerta' && 'animate-pulse')} />
                    </div>
                    <span
                      className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: `${cfg.color}20`,
                        color: cfg.color,
                        border: `1px solid ${cfg.color}40`,
                      }}
                    >
                      {cfg.label}
                    </span>
                  </div>

                  <p
                    className="font-bold text-sm leading-tight mb-1"
                    style={{ color: cfg.color }}
                  >
                    {insight.titulo}
                  </p>
                  <p
                    className={cn(
                      'text-[11px] text-muted-foreground leading-snug',
                      !isExpanded && 'line-clamp-2'
                    )}
                  >
                    {insight.descricao}
                  </p>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t flex items-center justify-end gap-1" style={{ borderColor: `${cfg.color}30` }}>
                      <X className="h-3 w-3" style={{ color: cfg.color }} />
                      <span className="text-[10px] font-semibold" style={{ color: cfg.color }}>recolher</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
