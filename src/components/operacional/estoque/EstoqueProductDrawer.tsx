import {
  CircleCheck,
  CircleOff,
  Siren,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useRef, type ReactNode } from 'react';

import { PelegriniResponsiveValue } from '@/components/pelegrini';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import { EstoqueEvolutionChart } from './EstoqueEvolutionChart';
import { EstoqueMovementTimeline } from './EstoqueMovementTimeline';
import {
  buildStockEvolution,
  type StockProductInsight,
  type StockStatus,
} from './estoqueIntelligence';

interface EstoqueProductDrawerProps {
  product: StockProductInsight | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<StockStatus, { className: string; icon: LucideIcon; label: string }> = {
  available: {
    className: 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
    icon: CircleCheck,
    label: 'Disponivel',
  },
  low: {
    className: 'border-amber-500/40 text-amber-700 dark:text-amber-400',
    icon: TriangleAlert,
    label: 'Estoque baixo',
  },
  critical: {
    className: 'border-destructive/30 text-destructive',
    icon: Siren,
    label: 'Critico',
  },
  out: {
    className: 'border-destructive/30 text-destructive',
    icon: CircleOff,
    label: 'Sem estoque',
  },
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { currency: 'BRL', style: 'currency' }).format(value);
}

function formatDate(value: string | null): string {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : 'Nao informada';
}

function formatCoverage(days: number | null): string {
  return days === null ? 'Dados insuficientes' : `${formatNumber(Math.max(0, Math.floor(days)))} dias`;
}

function formatMovementQuantity(available: boolean, value: number): string {
  return available ? `${formatNumber(value)} unidades` : 'Dados insuficientes';
}

const statusExplanation: Record<StockStatus, { reason: string; action: string }> = {
  out: {
    reason: 'O saldo atual e menor ou igual a zero.',
    action: 'Validar pedidos em aberto e priorizar reposicao.',
  },
  critical: {
    reason: 'A cobertura estimada e inferior a 15 dias.',
    action: 'Repor o item com prioridade e revisar a demanda recente.',
  },
  low: {
    reason: 'A cobertura estimada esta entre 15 e 30 dias.',
    action: 'Monitorar o consumo e programar a proxima compra.',
  },
  available: {
    reason: 'O saldo atual cobre pelo menos 30 dias, ou nao ha base de movimento suficiente para alertar.',
    action: 'Manter o acompanhamento no ciclo normal de estoque.',
  },
};

function DetailValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <PelegriniResponsiveValue as="dd" className="mt-1 min-w-0 break-words text-sm font-medium text-foreground" size="sm">
        {children}
      </PelegriniResponsiveValue>
    </div>
  );
}

function StatusValue({ status }: { status: StockStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold', config.className)}>
      <span aria-label={`Situacao: ${config.label}`} role="img">
        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      </span>
      {config.label}
    </span>
  );
}

export function EstoqueProductDrawer({ product, open, onOpenChange }: EstoqueProductDrawerProps) {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  return (
    <Sheet open={open && product !== null} onOpenChange={onOpenChange}>
      {product ? (
        <SheetContent
          className="w-full min-w-0 max-w-full overflow-y-auto sm:max-w-xl lg:max-w-2xl"
          onCloseAutoFocus={(event) => {
            if (!returnFocusRef.current) return;
            event.preventDefault();
            returnFocusRef.current.focus();
          }}
          onOpenAutoFocus={() => {
            returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
        >
          <div className="min-w-0 space-y-5">
            <SheetHeader className="min-w-0 pr-8">
              <SheetTitle className="min-w-0 break-words">{product.produto}</SheetTitle>
              <SheetDescription className="flex min-w-0 flex-wrap gap-x-2 gap-y-1">
                <span>Codigo {product.cod_produto}</span>
                <span aria-hidden="true">·</span>
                <span>{product.marca || 'Marca nao informada'}</span>
              </SheetDescription>
            </SheetHeader>

            <StatusValue status={product.status} />

            <section aria-labelledby="stock-rule-title" className="min-w-0 border-y border-border py-4">
              <h3 className="text-sm font-semibold text-foreground" id="stock-rule-title">Como este status foi calculado</h3>
              <p className="mt-2 text-sm text-muted-foreground">{statusExplanation[product.status].reason}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Cobertura calculada com as saidas dos ultimos tres meses-calendario: saldo atual dividido pela media diaria de saidas.
              </p>
              <p className="mt-2 text-sm font-medium text-primary">Acao recomendada: {statusExplanation[product.status].action}</p>
            </section>

            <section aria-labelledby="stock-balance-title" className="min-w-0 border-t border-border pt-5">
              <h3 className="text-sm font-semibold text-foreground" id="stock-balance-title">Saldo e cobertura</h3>
              <dl className="mt-3 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailValue label="Quantidade">{formatNumber(product.quantidade_estoque)} unidades</DetailValue>
                <DetailValue label="Minimo operacional estimado">
                  {formatMovementQuantity(product.movementDataAvailable, product.operationalMinimum)}
                </DetailValue>
                <DetailValue label="Cobertura">
                  {product.movementDataAvailable ? formatCoverage(product.coverageDays) : 'Dados insuficientes'}
                </DetailValue>
              </dl>
            </section>

            <section aria-labelledby="stock-identification-title" className="min-w-0 border-t border-border pt-5">
              <h3 className="text-sm font-semibold text-foreground" id="stock-identification-title">Identificacao</h3>
              <dl className="mt-3 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailValue label="Marca">{product.marca || 'Nao informada'}</DetailValue>
                <DetailValue label="Grupo">{product.grupo || 'Sem grupo'}</DetailValue>
                <DetailValue label="Linha">{product.linha || 'Sem linha'}</DetailValue>
                <DetailValue label="Aplicacao">{product.aplicacao_produto || 'Nao informada'}</DetailValue>
                <DetailValue label="Codigo do fabricante">{product.cod_fabricante || 'Nao informado'}</DetailValue>
                <DetailValue label="Referencia do fabricante">{product.nr_fabricante || 'Nao informada'}</DetailValue>
                <DetailValue label="Referencia original">{product.nr_original || 'Nao informada'}</DetailValue>
              </dl>
            </section>

            <section aria-labelledby="stock-financial-title" className="min-w-0 border-t border-border pt-5">
              <h3 className="text-sm font-semibold text-foreground" id="stock-financial-title">Estoque e filial</h3>
              <dl className="mt-3 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailValue label="Valor em estoque">{formatCurrency(product.valor_estoque)}</DetailValue>
                <DetailValue label="Custo medio">{formatCurrency(product.custo_medio)}</DetailValue>
                <DetailValue label="Filial">{product.empresa || 'Nao informada'}</DetailValue>
                {product.localizacao_produto ? (
                  <DetailValue label="Localizacao">{product.localizacao_produto}</DetailValue>
                ) : null}
              </dl>
            </section>

            <section aria-labelledby="stock-dates-title" className="min-w-0 border-t border-border pt-5">
              <h3 className="text-sm font-semibold text-foreground" id="stock-dates-title">Ultimas movimentacoes</h3>
              <dl className="mt-3 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailValue label="Ultima venda">{formatDate(product.data_ultima_venda)}</DetailValue>
                <DetailValue label="Ultima compra">{formatDate(product.data_ultima_compra)}</DetailValue>
                <DetailValue label="Ultima transferencia">{formatDate(product.data_ultima_transferencia)}</DetailValue>
                <DetailValue label="Ultima movimentacao">{formatDate(product.lastMovementDate)}</DetailValue>
              </dl>
            </section>

            <section aria-labelledby="stock-summary-title" className="min-w-0 border-t border-border pt-5">
              <h3 className="text-sm font-semibold text-foreground" id="stock-summary-title">Resumo do periodo</h3>
              <dl className="mt-3 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
                <DetailValue label="Entradas fisicas do periodo">
                  {formatMovementQuantity(product.movementDataAvailable, product.totalInbound)}
                </DetailValue>
                <DetailValue label="Saidas fisicas do periodo">
                  {formatMovementQuantity(product.movementDataAvailable, product.totalPhysicalOutbound)}
                </DetailValue>
                <DetailValue label="Giro fisico do periodo">
                  {formatMovementQuantity(product.movementDataAvailable, product.totalMovement)}
                </DetailValue>
              </dl>
            </section>

            <EstoqueMovementTimeline movements={product.movements} />
            <EstoqueEvolutionChart
              movementDataAvailable={product.movementDataAvailable}
              points={buildStockEvolution(product)}
            />
          </div>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}
