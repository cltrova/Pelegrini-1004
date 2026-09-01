import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

import { PelegriniResponsiveValue } from '@/components/pelegrini';
import type { GiroRecord } from '@/types/estoque';

interface EstoqueMovementTimelineProps {
  movements: GiroRecord[];
}

interface MovementDisplay {
  direction: 'inbound' | 'outbound';
  label: string;
  quantity: number;
}

function describeMovement(movement: GiroRecord): MovementDisplay | null {
  const candidates: MovementDisplay[] = [
    { direction: 'inbound', label: 'Compra', quantity: movement.entrada_compra },
    { direction: 'inbound', label: 'Entrada por transferencia', quantity: movement.entrada_transferencia },
    {
      direction: 'inbound',
      label: 'Outras entradas',
      quantity: movement.entrada_outras + movement.entrada_devolucao,
    },
    { direction: 'outbound', label: 'Venda', quantity: movement.saida_venda },
    { direction: 'outbound', label: 'Saida por transferencia', quantity: movement.saida_transferencia },
    {
      direction: 'outbound',
      label: 'Outras saidas',
      quantity: movement.saida_outras + movement.saida_devolucao,
    },
  ];

  return candidates.find((candidate) => candidate.quantity !== 0) ?? null;
}

function formatDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : 'Data desconhecida';
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Math.abs(value));
}

function movementTimestamp(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function EstoqueMovementTimeline({ movements }: EstoqueMovementTimelineProps) {
  const recentMovements = movements
    .map((movement) => ({ movement, display: describeMovement(movement) }))
    .filter((item): item is { movement: GiroRecord; display: MovementDisplay } => item.display !== null)
    .sort((a, b) => movementTimestamp(b.movement.data_movimento) - movementTimestamp(a.movement.data_movimento))
    .slice(0, 20);

  return (
    <section aria-labelledby="stock-movement-title" className="min-w-0 border-t border-border pt-5">
      <h3 className="text-sm font-semibold text-foreground" id="stock-movement-title">Historico recente</h3>

      {recentMovements.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Historico indisponivel</p>
      ) : (
        <ol aria-label="Historico recente" className="mt-3 min-w-0 divide-y divide-border/70">
          {recentMovements.map(({ movement, display }, index) => {
            const inbound = display.direction === 'inbound';
            const Icon = inbound ? ArrowDownToLine : ArrowUpFromLine;
            const directionLabel = inbound ? 'Entrada' : 'Saida';
            const sign = inbound ? '+' : '-';

            return (
              <li
                className="flex min-w-0 items-center gap-3 py-3"
                key={`${movement.cod_empresa}:${movement.cod_produto}:${movement.data_movimento}:${index}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
                  <Icon aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{display.label}</span>
                  <span className="block text-xs tabular-nums text-muted-foreground">
                    {formatDate(movement.data_movimento)}
                  </span>
                </span>
                <PelegriniResponsiveValue
                  className={inbound ? 'shrink-0 font-semibold text-emerald-700 dark:text-emerald-400' : 'shrink-0 font-semibold text-destructive'}
                  size="sm"
                >
                  {directionLabel} {sign}{formatQuantity(display.quantity)}
                </PelegriniResponsiveValue>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
