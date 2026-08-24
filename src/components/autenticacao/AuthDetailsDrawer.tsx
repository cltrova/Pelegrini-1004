import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { StatusBadge } from './StatusBadge';
import { formatCurrency } from '@/utils/formatters';
import type { ResultadoComparacao } from '@/utils/autenticacaoComparator';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: ResultadoComparacao | null;
}

function Row({ label, planilha, sistema, diff }: { label: string; planilha?: string; sistema?: string; diff?: boolean }) {
  return (
    <div className={cn('grid grid-cols-3 gap-3 px-4 py-3 text-sm', diff && 'bg-warning/5')}>
      <div className="text-muted-foreground">{label}</div>
      <div className={cn('font-medium tabular-nums', diff && 'text-warning')}>{planilha || '—'}</div>
      <div className={cn('font-medium tabular-nums', diff && 'text-warning')}>{sistema || '—'}</div>
    </div>
  );
}

export function AuthDetailsDrawer({ open, onOpenChange, data }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-lg">Detalhes do pedido</SheetTitle>
            {data && <StatusBadge status={data.status} />}
          </div>
          <SheetDescription>Comparação entre planilha importada e dados do sistema.</SheetDescription>
        </SheetHeader>

        {data && (
          <div className="mt-6 space-y-5">
            <div className="rounded-xl bg-muted/40 p-4 space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Identificador</div>
              <div className="font-mono text-sm font-semibold text-foreground">{data.numero_pedido}</div>
              {data.data && <div className="text-xs text-muted-foreground">Data: {data.data}</div>}
            </div>

            <div className="rounded-xl border border-border/60 overflow-hidden">
              <div className="grid grid-cols-3 gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40">
                <div>Campo</div>
                <div>Planilha</div>
                <div>Sistema</div>
              </div>
              <div className="divide-y divide-border/60">
                <Row
                  label="Cliente"
                  planilha={data.cliente_planilha}
                  sistema={data.cliente_sistema}
                  diff={!!data.cliente_planilha && !!data.cliente_sistema && data.cliente_planilha.toLowerCase() !== data.cliente_sistema.toLowerCase()}
                />
                <Row
                  label="Valor"
                  planilha={data.valor_planilha !== undefined ? formatCurrency(data.valor_planilha) : undefined}
                  sistema={data.valor_sistema !== undefined ? formatCurrency(data.valor_sistema) : undefined}
                  diff={
                    data.valor_planilha !== undefined &&
                    data.valor_sistema !== undefined &&
                    Math.abs(data.valor_planilha - data.valor_sistema) > 0.01
                  }
                />
              </div>
            </div>

            {data.divergencias.length > 0 && (
              <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-warning text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  Divergências detectadas
                </div>
                <ul className="space-y-1.5 text-sm text-foreground/90">
                  {data.divergencias.map((d, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-warning">•</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
