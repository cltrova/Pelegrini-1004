import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AlertaCritico } from '@/types/resumo';
import { formatCurrency } from '@/utils/formatters';
import { AlertTriangle, ShieldAlert, CalendarClock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  alertas: AlertaCritico[];
}

const ICON_MAP: Record<AlertaCritico['tipo'], React.ComponentType<{ className?: string }>> = {
  CONCENTRACAO: Users,
  CLIENTE_RISCO: ShieldAlert,
  VENCIMENTO_HOJE: CalendarClock,
  AGING_EXTREMO: AlertTriangle,
};

export function AlertasCriticosBanner({ alertas }: Props) {
  const [open, setOpen] = useState(false);
  if (alertas.length === 0) return null;

  const altas = alertas.filter((a) => a.severidade === 'alta').length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 gap-2 text-xs font-semibold border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10',
            'text-rose-600 dark:text-rose-400',
          )}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          </span>
          Diagnóstico & Alertas
          <span className="ml-1 px-1.5 py-0.5 rounded bg-rose-500/15 text-[10px] font-mono font-bold">
            {alertas.length}
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            Diagnóstico & Alertas da Carteira
          </DialogTitle>
          <DialogDescription>
            {alertas.length} alerta{alertas.length !== 1 && 's'} ativo
            {alertas.length !== 1 && 's'}
            {altas > 0 && (
              <>
                {' '}
                · <span className="text-rose-600 dark:text-rose-400 font-semibold">{altas} de alta severidade</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          {alertas.map((a) => {
            const Icon = ICON_MAP[a.tipo];
            return (
              <div
                key={a.id}
                className={cn(
                  'p-3 rounded-md border-l-2',
                  a.severidade === 'alta'
                    ? 'bg-rose-500/10 border-rose-500'
                    : 'bg-amber-500/10 border-amber-500',
                )}
              >
                <div className="flex items-start gap-2">
                  <Icon
                    className={cn(
                      'h-4 w-4 mt-0.5 shrink-0',
                      a.severidade === 'alta'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-amber-600 dark:text-amber-400',
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        'text-sm font-semibold',
                        a.severidade === 'alta'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-amber-600 dark:text-amber-400',
                      )}
                    >
                      {a.titulo}
                    </div>
                    <div className="text-xs text-muted-foreground leading-relaxed mt-1">
                      {a.descricao}
                    </div>
                    {a.valor !== undefined && a.valor > 0 && (
                      <div className="text-xs font-mono font-bold text-foreground mt-1.5 tabular-nums">
                        {formatCurrency(a.valor)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
