import { Card } from '@/components/ui/card';
import { ClienteAnalytics } from '@/types/resumo';
import { formatCurrency, formatInteger } from '@/utils/formatters';
import { ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  clientes: ClienteAnalytics[];
  onSelect?: (c: ClienteAnalytics) => void;
}

function scoreClasses(score: number) {
  if (score >= 85) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  if (score >= 65) return 'bg-sky-500/10 text-sky-600 dark:text-sky-400';
  if (score >= 40) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  return 'bg-rose-500/10 text-rose-600 dark:text-rose-400';
}

export function TopRiscoTable({ clientes, onSelect }: Props) {
  const top = [...clientes]
    .filter((c) => c.totalVencido > 0 || c.totalAberto > 0)
    .sort((a, b) => b.totalVencido - a.totalVencido || b.totalAberto - a.totalAberto)
    .slice(0, 10);

  return (
    <Card className="p-5">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2 mb-4 border-b border-border pb-3">
        <ShieldAlert className="h-3.5 w-3.5" />
        Triagem — Top 10 Clientes em Risco
      </h3>

      <div className="flex flex-col gap-2">
        {top.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Sem clientes em risco no momento.</p>
        )}
        {top.map((c) => (
          <button
            key={c.codCliente || c.cliente}
            onClick={() => onSelect?.(c)}
            className="text-left flex items-center justify-between p-3 rounded-md bg-muted/30 hover:bg-muted/60 border border-transparent hover:border-border transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cn(
                  'flex size-9 rounded items-center justify-center font-mono font-bold text-sm shrink-0',
                  scoreClasses(c.pontualidadeScore),
                )}
                title={`Score de Pontualidade: ${c.pontualidadeScore}/100`}
              >
                {c.pontualidadeScore}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{c.cliente || '—'}</div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  {formatInteger(c.qtdVencidas)} vencida(s) · atraso méd. {formatInteger(c.atrasoMedioAtual)}d
                </div>
              </div>
            </div>
            <div className="text-right shrink-0 pl-3">
              <div className="font-mono text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                {formatCurrency(c.totalVencido)}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                aberto: {formatCurrency(c.totalAberto)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}
