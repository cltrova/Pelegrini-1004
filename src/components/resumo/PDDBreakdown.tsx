import { Card } from '@/components/ui/card';
import { PDDResultado } from '@/types/resumo';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { ShieldAlert } from 'lucide-react';

interface Props {
  pdd: PDDResultado;
}

export function PDDBreakdown({ pdd }: Props) {
  const max = Math.max(1, ...pdd.porFaixa.map((f) => f.valor));

  return (
    <Card className="p-5">
      <div className="flex items-end justify-between mb-4 border-b border-border pb-3">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5" />
          PDD — Provisão p/ Devedores Duvidosos
        </h3>
        <div className="text-right">
          <div className="font-mono text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {formatCurrency(pdd.total)}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            {formatPercent(pdd.percentual)} da carteira
          </div>
        </div>
      </div>

      <div className="space-y-3 font-mono">
        {pdd.porFaixa.map((f) => {
          const w = (f.valor / max) * 100;
          return (
            <div key={f.label} className="flex items-center gap-3">
              <div className="w-16 text-xs text-right text-muted-foreground tabular-nums">{f.label}</div>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500/60 rounded-full"
                  style={{ width: `${Math.max(w, 1)}%` }}
                />
              </div>
              <div className="w-20 text-[10px] text-right text-muted-foreground tabular-nums">
                taxa {(f.taxa * 100).toFixed(0)}%
              </div>
              <div className="w-24 text-xs text-right text-foreground tabular-nums">
                {formatCurrency(f.valor)}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground mt-4 leading-relaxed">
        Estimativa baseada em taxas progressivas por faixa de atraso (5% até 30d, 15% 31-60d, 30% 61-90d, 60% 91-180d, 100% acima de 180d).
      </p>
    </Card>
  );
}
