import { ArrowRight, Boxes, PauseCircle } from 'lucide-react';
import { useState } from 'react';

import { PelegriniDataPanel } from '@/components/pelegrini';
import { Button } from '@/components/ui/button';

import type { StockPrimaryMovementType, StockProductInsight } from './estoqueIntelligence';

interface EstoqueMovementHighlightsProps {
  products: StockProductInsight[];
  onSelectProduct: (product: StockProductInsight) => void;
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
});

interface HighlightListProps {
  ariaLabel: string;
  products: StockProductInsight[];
  metric: (product: StockProductInsight) => string;
  onSelectProduct: (product: StockProductInsight) => void;
  showPrimaryMovement?: boolean;
}

const primaryMovementLabels: Record<StockPrimaryMovementType, string> = {
  sale: 'Venda',
  withdrawal: 'Retirada',
  purchase: 'Compra',
  entry: 'Entrada',
};

function HighlightList({
  ariaLabel,
  products,
  metric,
  onSelectProduct,
  showPrimaryMovement = false,
}: HighlightListProps) {
  return (
    <div aria-label={ariaLabel} className="min-w-0 divide-y divide-border/70">
      {products.map((product) => (
        <button
          className="group flex min-h-14 min-w-0 w-full max-w-full items-center gap-3 py-2 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          key={`${product.cod_empresa}:${product.cod_produto}`}
          onClick={() => onSelectProduct(product)}
          type="button"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">{product.produto}</span>
            <span className="flex min-w-0 flex-wrap gap-x-1 text-xs text-muted-foreground">
              <span>{`${product.quantidade_estoque.toLocaleString('pt-BR')} em estoque`}</span>
              <span aria-hidden="true">·</span>
              <span>{currencyFormatter.format(product.valor_estoque)}</span>
            </span>
            {showPrimaryMovement && product.primaryMovementType ? (
              <span className="mt-0.5 block text-xs font-medium text-foreground">
                Principal: {primaryMovementLabels[product.primaryMovementType]}
              </span>
            ) : null}
          </span>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">{metric(product)}</span>
          <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </button>
      ))}
    </div>
  );
}

type MovementHighlightMode = 'all' | 'sales' | 'withdrawals';

const movementModes: Array<{ label: string; value: MovementHighlightMode }> = [
  { label: 'Todos', value: 'all' },
  { label: 'Vendas', value: 'sales' },
  { label: 'Retiradas', value: 'withdrawals' },
];

function movementMetric(product: StockProductInsight, mode: MovementHighlightMode): number {
  if (mode === 'sales') return product.totalSales;
  if (mode === 'withdrawals') return product.totalWithdrawals;
  return product.totalMovement;
}

function formatMovementMetric(product: StockProductInsight, mode: MovementHighlightMode): string {
  const value = movementMetric(product, mode).toLocaleString('pt-BR');
  if (mode === 'sales') return `${value} vendas`;
  if (mode === 'withdrawals') return `${value} retiradas`;
  return `${value} mov.`;
}

export function EstoqueMovementHighlights({ products, onSelectProduct }: EstoqueMovementHighlightsProps) {
  const [movementMode, setMovementMode] = useState<MovementHighlightMode>('all');
  const moved = products
    .filter((product) => product.movementDataAvailable && movementMetric(product, movementMode) > 0)
    .sort((a, b) => movementMetric(b, movementMode) - movementMetric(a, movementMode))
    .slice(0, 5);
  const stagnant = products
    .filter((product) => product.stagnantDays > 90)
    .sort((a, b) => b.stagnantDays - a.stagnantDays)
    .slice(0, 5);
  const balanceFallback = products.slice(0, 5);
  const movementDataAvailable = products.some((product) => product.movementDataAvailable);

  return (
    <section className="grid min-w-0 gap-4 lg:grid-cols-2" aria-label="Destaques do estoque">
      <PelegriniDataPanel eyebrow="Giro no periodo" title="Mais movimentados">
        <div
          aria-label="Tipo de movimento"
          className="mb-2 flex min-w-0 flex-wrap items-center gap-1"
          role="group"
        >
          {movementModes.map((mode) => (
            <Button
              aria-pressed={movementMode === mode.value}
              className="h-7 px-2 text-xs"
              key={mode.value}
              onClick={() => setMovementMode(mode.value)}
              size="sm"
              type="button"
              variant={movementMode === mode.value ? 'secondary' : 'ghost'}
            >
              {mode.label}
            </Button>
          ))}
        </div>
        {moved.length ? (
          <HighlightList
            ariaLabel="Mais movimentados"
            metric={(product) => formatMovementMetric(product, movementMode)}
            onSelectProduct={onSelectProduct}
            products={moved}
            showPrimaryMovement
          />
        ) : !movementDataAvailable ? (
          <div className="min-w-0 space-y-3">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Boxes aria-hidden="true" className="h-4 w-4 shrink-0" />
              Dados insuficientes para movimentacao
            </p>
            <HighlightList
              ariaLabel="Saldos disponiveis"
              metric={() => 'Saldo atual'}
              onSelectProduct={onSelectProduct}
              products={balanceFallback}
            />
          </div>
        ) : (
          <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <Boxes aria-hidden="true" className="h-4 w-4 shrink-0" />
            Nenhum movimento deste tipo no periodo
          </p>
        )}
      </PelegriniDataPanel>

      <PelegriniDataPanel eyebrow="Sem giro recente" title="Produtos parados">
        {stagnant.length ? (
          <HighlightList
            ariaLabel="Produtos parados"
            metric={(product) => product.lastMovementDate ? `${product.stagnantDays} dias` : 'Data desconhecida'}
            onSelectProduct={onSelectProduct}
            products={stagnant}
          />
        ) : (
          <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <PauseCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
            Nenhum produto parado ha mais de 90 dias
          </p>
        )}
      </PelegriniDataPanel>
    </section>
  );
}
