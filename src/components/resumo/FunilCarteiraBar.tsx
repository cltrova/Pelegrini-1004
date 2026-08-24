import { Card } from '@/components/ui/card';
import { FunilSegmento, EstagioCarteira } from '@/types/resumo';
import { formatCurrency, formatInteger } from '@/utils/formatters';
import { Package, FileText, CheckCircle2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  segmentos: FunilSegmento[];
  onSelect?: (estagio: EstagioCarteira) => void;
}

const STYLES: Record<EstagioCarteira, { bar: string; chip: string; icon: React.ComponentType<{ className?: string }>; text: string }> = {
  EM_ABERTO: {
    bar: 'bg-amber-500/80',
    chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    icon: Package,
    text: 'text-amber-700 dark:text-amber-400',
  },
  FATURADO_A_RECEBER: {
    bar: 'bg-sky-500/80',
    chip: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30',
    icon: FileText,
    text: 'text-sky-700 dark:text-sky-400',
  },
  RECEBIDO: {
    bar: 'bg-emerald-500/80',
    chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    icon: CheckCircle2,
    text: 'text-emerald-700 dark:text-emerald-400',
  },
};

export function FunilCarteiraBar({ segmentos, onSelect }: Props) {
  const total = segmentos.reduce((s, x) => s + x.valor, 0);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Funil da Carteira · onde está o dinheiro
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          Total movimentado: <span className="text-foreground font-semibold">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Barra segmentada */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {segmentos.map((s) => {
          const style = STYLES[s.estagio];
          const width = Math.max(s.percentual, s.valor > 0 ? 1.5 : 0);
          if (width === 0) return null;
          return (
            <button
              key={s.estagio}
              type="button"
              onClick={() => onSelect?.(s.estagio)}
              style={{ width: `${width}%` }}
              className={cn(
                'h-full transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary',
                style.bar,
              )}
              title={`${s.label}: ${formatCurrency(s.valor)} (${s.percentual.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Legenda */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
        {segmentos.map((s, idx) => {
          const style = STYLES[s.estagio];
          const Icon = style.icon;
          return (
            <button
              key={s.estagio}
              type="button"
              onClick={() => onSelect?.(s.estagio)}
              className="group flex items-center gap-2 rounded-md border border-border px-3 py-2 text-left hover:border-foreground/30 hover:bg-muted/50 transition-colors"
            >
              <div className={cn('flex h-7 w-7 items-center justify-center rounded-md border', style.chip)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                    {s.label}
                  </span>
                  <span className={cn('text-[10px] font-mono font-bold', style.text)}>
                    {s.percentual.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-sm font-semibold tabular-nums truncate">
                    {formatCurrency(s.valor)}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {formatInteger(s.quantidade)} {s.estagio === 'EM_ABERTO' ? 'pedidos' : 'duplicatas'}
                  </span>
                </div>
              </div>
              {idx < segmentos.length - 1 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/40 hidden md:block" />
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
