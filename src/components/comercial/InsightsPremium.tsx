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
    <Card className="premium-card border-border/60 overflow-hidden stagger-5">
      {/* Hero header */}
      <div
        className="relative overflow-hidden p-4 border-b border-border/40"
        style={{
          background:
            'linear-gradient(135deg, hsl(var(--primary) / 0.12) 0%, transparent 50%, hsl(280 65% 60% / 0.10) 100%)',
        }}
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-30 bg-primary animate-pulse" />
        <div className="relative flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shadow-lg"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary) / 0.35), hsl(var(--primary) / 0.10))',
              color: 'hsl(var(--primary))',
              boxShadow: '0 0 20px hsl(var(--primary) / 0.35)',
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
                  'group relative text-left rounded-xl p-3.5 border backdrop-blur-md',
                  'transition-all duration-300 cursor-pointer overflow-hidden',
                  'hover:scale-[1.03] hover:-translate-y-1 hover:shadow-2xl',
                  isExpanded && 'sm:col-span-2 lg:col-span-2 scale-[1.02] shadow-2xl ring-2'
                )}
                style={{
                  background: `linear-gradient(135deg, ${cfg.color}15, ${cfg.color}05)`,
                  borderColor: `${cfg.color}40`,
                  boxShadow: isExpanded
                    ? `0 0 30px ${cfg.color}40, inset 0 1px 0 ${cfg.color}30`
                    : `inset 0 1px 0 ${cfg.color}20`,
                }}
              >
                {/* Glow orb */}
                <div
                  className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-30 group-hover:opacity-60 transition-opacity duration-500"
                  style={{ background: cfg.color }}
                />

                <div className="relative">
                  <div className="flex items-start justify-between mb-2">
                    <div
                      className={cn(
                        'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
                        'transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-8deg]'
                      )}
                      style={{
                        background: `${cfg.color}25`,
                        color: cfg.color,
                        boxShadow: `0 0 12px ${cfg.color}40`,
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
