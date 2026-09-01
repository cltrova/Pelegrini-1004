import { CircleCheck, CircleOff, PauseCircle, Siren, TriangleAlert, type LucideIcon } from 'lucide-react';

import { PelegriniDataPanel } from '@/components/pelegrini';
import { cn } from '@/lib/utils';

import type { StockProductInsight } from './estoqueIntelligence';

interface EstoqueAttentionPanelProps {
  products: StockProductInsight[];
  onSelectProduct: (product: StockProductInsight) => void;
}

type AttentionStatus = 'out' | 'critical' | 'low' | 'stagnant';

const statusConfig: Record<AttentionStatus, { label: string; icon: LucideIcon; priority: number }> = {
  out: { label: 'Sem estoque', icon: CircleOff, priority: 0 },
  critical: { label: 'Critico', icon: Siren, priority: 1 },
  low: { label: 'Estoque baixo', icon: TriangleAlert, priority: 2 },
  stagnant: { label: 'Parado', icon: PauseCircle, priority: 3 },
};

function getAttentionStatus(product: StockProductInsight): AttentionStatus | null {
  if (product.status === 'out' || product.status === 'critical' || product.status === 'low') {
    return product.status;
  }
  return product.stagnantDays > 90 ? 'stagnant' : null;
}

export function EstoqueAttentionPanel({ products, onSelectProduct }: EstoqueAttentionPanelProps) {
  const prioritized = products
    .map((product) => ({ product, status: getAttentionStatus(product) }))
    .filter((item): item is { product: StockProductInsight; status: AttentionStatus } => item.status !== null)
    .sort((a, b) => {
      const priority = statusConfig[a.status].priority - statusConfig[b.status].priority;
      if (priority !== 0) return priority;
      if (a.status === 'stagnant') return b.product.stagnantDays - a.product.stagnantDays;
      return a.product.produto.localeCompare(b.product.produto, 'pt-BR');
    })
    .slice(0, 6);

  return (
    <PelegriniDataPanel eyebrow="Prioridade operacional" title="Atencao no estoque">
      {prioritized.length === 0 ? (
        <div className="flex min-w-0 items-center gap-2 py-3 text-sm text-muted-foreground">
          <CircleCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>Estoque sem alertas prioritarios</span>
        </div>
      ) : (
        <div aria-label="Produtos que precisam de atencao" className="min-w-0 divide-y divide-border/70">
          {prioritized.map(({ product: item, status }) => {
            const config = statusConfig[status];
            const Icon = config.icon;
            return (
              <button
                className="flex min-h-14 min-w-0 w-full max-w-full items-center gap-3 px-1 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                key={`${item.cod_empresa}:${item.cod_produto}`}
                onClick={() => onSelectProduct(item)}
                type="button"
              >
                <span
                  aria-label={`Situacao: ${config.label.toLocaleLowerCase('pt-BR')}`}
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
                    status === 'out' || status === 'critical'
                      ? 'border-destructive/30 text-destructive'
                      : 'border-amber-500/40 text-amber-700 dark:text-amber-400',
                  )}
                  role="img"
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{item.produto}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    Codigo {item.cod_produto} · {item.marca}
                  </span>
                </span>
                <span
                  className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-foreground"
                  data-stock-status={status}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                  {config.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </PelegriniDataPanel>
  );
}
