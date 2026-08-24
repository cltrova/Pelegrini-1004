import { Card } from '@/components/ui/card';
import { AgingFaixa } from '@/types/resumo';
import { formatCurrency, formatInteger, formatPercent } from '@/utils/formatters';
import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  faixas: AgingFaixa[];
}

const TONES = [
  'bg-amber-500/40',
  'bg-amber-500/70',
  'bg-rose-500/60',
  'bg-rose-500/80',
  'bg-rose-500',
];

export function AgingDetalhado({ faixas }: Props) {
  const max = Math.max(1, ...faixas.map((f) => f.valor));
  const totalVencido = faixas.reduce((s, f) => s + f.valor, 0);
  const totalQtd = faixas.reduce((s, f) => s + f.quantidade, 0);

  return (
    <Card className="p-5">
      <div className="flex items-end justify-between mb-5 border-b border-border pb-3">
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" />
            Aging — Espectro de Atraso
          </h3>
          <p className="text-sm text-foreground mt-1.5">Distribuição do vencido por faixa</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total vencido</div>
          <div className="font-mono text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums">
            {formatCurrency(totalVencido)}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">{formatInteger(totalQtd)} títulos</div>
        </div>
      </div>

      <div className="flex flex-col gap-3 font-mono">
        {faixas.map((f, i) => {
          const widthPct = (f.valor / max) * 100;
          const isExtremo = f.minDias > 60;
          return (
            <div key={f.label} className="flex items-center gap-3 group">
              <div
                className={cn(
                  'w-16 text-xs text-right tabular-nums',
                  isExtremo ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-muted-foreground',
                )}
              >
                {f.label}
              </div>
              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden relative">
                <div
                  className={cn('h-full rounded-full transition-all', TONES[i])}
                  style={{ width: `${Math.max(widthPct, 1)}%` }}
                />
              </div>
              <div className="w-24 text-xs text-right text-foreground tabular-nums">
                {formatCurrency(f.valor)}
              </div>
              <div className="w-16 text-[10px] text-right text-muted-foreground tabular-nums">
                {formatInteger(f.quantidade)} tít
              </div>
              <div className="w-12 text-[10px] text-right text-muted-foreground tabular-nums">
                {formatPercent(f.percentual)}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
