import { AlertTriangle, CircleDollarSign, Gauge, PackageCheck, PackageX, TrendingUp } from 'lucide-react';
import { useMemo, type LucideIcon } from 'react';

import { PelegriniResponsiveValue } from '@/components/pelegrini';
import { cn } from '@/lib/utils';
import type { GiroProductSummary, GiroStatus } from '@/types/estoque';

import { buildGiroManagementSummary, GIRO_STATUS_RULES } from './giroIntelligence';

interface Props {
  products: GiroProductSummary[];
  activeStatuses: GiroStatus[];
  onStatusFilterChange: (statuses: GiroStatus[]) => void;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function GiroManagementPanel({ products, activeStatuses, onStatusFilterChange }: Props) {
  const summary = useMemo(() => buildGiroManagementSummary(products), [products]);
  const cards: Array<{
    key: GiroStatus | 'idle' | 'coverage'; label: string; value: string; icon: LucideIcon; status?: GiroStatus; description: string;
  }> = [
    { key: 'atendendo', label: 'Atendendo', value: String(summary.counts.atendendo), icon: PackageCheck, status: 'atendendo', description: GIRO_STATUS_RULES.atendendo },
    { key: 'alerta', label: 'Alerta', value: String(summary.counts.alerta), icon: AlertTriangle, status: 'alerta', description: GIRO_STATUS_RULES.alerta },
    { key: 'faltando', label: 'Ruptura', value: String(summary.counts.faltando), icon: PackageX, status: 'faltando', description: GIRO_STATUS_RULES.faltando },
    { key: 'excesso', label: 'Excesso', value: String(summary.counts.excesso), icon: TrendingUp, status: 'excesso', description: GIRO_STATUS_RULES.excesso },
    { key: 'idle', label: 'Capital parado', value: currency.format(summary.idleCapital), icon: CircleDollarSign, description: 'Estimativa: soma do valor de produtos em excesso ou com estoque e sem venda ha mais de 90 dias.' },
    { key: 'coverage', label: 'Cobertura media', value: summary.knownCoverageCount ? `${summary.averageKnownCoverageMonths.toFixed(1)} meses` : 'Dados insuficientes', icon: Gauge, description: 'Media da cobertura calculada somente para produtos com baseline de vendas conhecido no periodo selecionado.' },
  ];

  return (
    <section aria-label="Indicadores gerenciais de giro" className="grid min-w-0 grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map(card => {
        const Icon = card.icon;
        const active = card.status ? activeStatuses.includes(card.status) : false;
        const helpId = `giro-kpi-help-${card.key}`;
        const content = (
          <>
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/40 text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block break-words text-[9px] font-semibold uppercase leading-tight text-muted-foreground">{card.label}</span>
              <PelegriniResponsiveValue className="mt-1 block break-words font-semibold tabular-nums" size="md">{card.value}</PelegriniResponsiveValue>
            </span>
          </>
        );
        const className = cn(
          'pelegrini-metric-card flex min-h-16 min-w-0 items-center gap-2 rounded-md border border-border/70 bg-card px-2.5 py-2 text-left shadow-sm transition-[border-color,background-color,box-shadow] duration-150',
          active && 'border-primary/45 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.18)]',
        );

        return (
          <div className="group relative min-w-0" key={card.key}>
            {card.status ? (
              <button
                aria-describedby={helpId}
                aria-label={`${card.label}: ${card.value}`}
                aria-pressed={active}
                className={cn(className, 'h-full w-full hover:border-primary/30 hover:bg-muted/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
                data-stock-summary
                onClick={() => onStatusFilterChange(
                  active
                    ? activeStatuses.filter(status => status !== card.status)
                    : [...activeStatuses, card.status!],
                )}
                type="button"
              >
                {content}
              </button>
            ) : (
              <article aria-describedby={helpId} aria-label={`${card.label}: ${card.value}`} className={className} data-stock-summary tabIndex={0}>{content}</article>
            )}
            <span className="pointer-events-none absolute inset-x-1 top-full z-30 mt-1 hidden rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md group-hover:block group-focus-within:block" id={helpId} role="tooltip">
              {card.description}
            </span>
          </div>
        );
      })}
    </section>
  );
}
