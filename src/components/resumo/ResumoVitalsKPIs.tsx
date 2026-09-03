import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  Package,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { EnterpriseDataPanel, EnterpriseMetricCard } from '@/components/enterprise';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { PDDResultado, ResumoKPIs } from '@/types/resumo';
import { formatCurrency, formatInteger, formatPercent } from '@/utils/formatters';

interface Props {
  kpis: ResumoKPIs;
  pdd: PDDResultado;
}

export function ResumoVitalsKPIs({ kpis, pdd }: Props) {
  const totalCarteira =
    kpis.totalPedidosEmAberto + kpis.totalAVencer + kpis.totalVencido + kpis.totalRecebido;
  const qtdNoPrazo = Math.max(0, kpis.qtdDuplicatasAbertas - kpis.qtdDuplicatasVencidas);
  const pct = (v: number) => (totalCarteira > 0 ? (v / totalCarteira) * 100 : 0);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        <EnterpriseDataPanel title="Total Geral da Carteira" density="compact">
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.55fr)] lg:items-center">
            <div className="min-w-0">
              <div className="mb-2 flex min-w-0 items-center gap-2">
                <Wallet className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate text-[10px] font-bold uppercase text-muted-foreground">
                  Total Geral da Carteira
                </span>
                <InfoHint text="Essa soma fecha exatamente assim: Em Aberto + Faturado no Prazo + Faturado Vencido + Recebido." />
              </div>
              <div className="pelegrini-responsive-value break-words text-2xl font-semibold leading-tight tabular-nums text-foreground md:text-3xl">
                {formatCurrency(totalCarteira)}
              </div>
              <div className="mt-1.5 break-words text-xs leading-relaxed text-muted-foreground">
                {formatCurrency(kpis.totalPedidosEmAberto)} + {formatCurrency(kpis.totalAVencer)} +{' '}
                {formatCurrency(kpis.totalVencido)} + {formatCurrency(kpis.totalRecebido)}
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-1 text-xs font-mono">
              <DistRow color="bg-amber-500" label="Em Aberto (nao faturado)" pct={pct(kpis.totalPedidosEmAberto)} />
              <DistRow color="bg-sky-500" label="Faturado no prazo" pct={pct(kpis.totalAVencer)} />
              <DistRow color="bg-rose-500" label="Faturado vencido" pct={pct(kpis.totalVencido)} />
              <DistRow color="bg-emerald-500" label="Recebido" pct={pct(kpis.totalRecebido)} />
            </div>
          </div>
        </EnterpriseDataPanel>

        <div className="enterprise-grid-metrics">
          <EnterpriseMetricCard
            context="(nao faturado)"
            detail={`${formatInteger(kpis.qtdPedidosAbertos)} pedidos`}
            icon={<Package className="h-4 w-4" />}
            label="Em Aberto"
            target={<InfoHint text="Pedidos que ainda não viraram nota fiscal nem duplicata." />}
            tone="warning"
            value={<ResponsiveValue>{kpis.totalPedidosEmAberto > 0 ? formatCurrency(kpis.totalPedidosEmAberto) : '-'}</ResponsiveValue>}
          />
          <EnterpriseMetricCard
            context="(no prazo)"
            detail={`${formatInteger(qtdNoPrazo)} duplicatas`}
            icon={<Clock className="h-4 w-4" />}
            label="Faturado"
            target={<InfoHint text="Duplicatas já emitidas e ainda dentro do prazo de pagamento." />}
            tone="info"
            value={<ResponsiveValue>{formatCurrency(kpis.totalAVencer)}</ResponsiveValue>}
          />
          <EnterpriseMetricCard
            context="(vencido)"
            detail={`${formatInteger(kpis.qtdDuplicatasVencidas)} titulos | atraso medio ${formatInteger(kpis.diasMedioAtraso)}d`}
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Faturado"
            target={<InfoHint tone="rose" text="Duplicatas já emitidas cuja data de vencimento passou e seguem sem pagamento." />}
            tone="negative"
            value={<ResponsiveValue>{formatCurrency(kpis.totalVencido)}</ResponsiveValue>}
          />
          <EnterpriseMetricCard
            context="(no periodo)"
            detail={`${formatInteger(kpis.qtdDuplicatasPagas)} pagamentos`}
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Recebido"
            target={<InfoHint text="Valores que já entraram no caixa." />}
            tone="positive"
            value={<ResponsiveValue>{formatCurrency(kpis.totalRecebido)}</ResponsiveValue>}
          />
          <EnterpriseMetricCard
            context={`${formatPercent(pdd.percentual)} da carteira a receber`}
            detail={`inadimpl. ${formatPercent(kpis.taxaInadimplencia)} | ${formatInteger(kpis.qtdClientesInadimplentes)} clientes`}
            icon={<ShieldAlert className="h-4 w-4" />}
            label="PDD Estimada"
            target={<InfoHint tone="amber" text="PDD é a perda estimada sobre os títulos vencidos, usando faixas progressivas de atraso." />}
            tone="warning"
            value={<ResponsiveValue>{formatCurrency(pdd.total)}</ResponsiveValue>}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

function ResponsiveValue({ children }: { children: ReactNode }) {
  return <span className="pelegrini-responsive-value break-words">{children}</span>;
}

function DistRow({ color, label, pct }: { color: string; label: string; pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('h-2 w-2 shrink-0 rounded-sm', color)} />
      <span className="flex-1 truncate text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{pct.toFixed(1)}%</span>
    </div>
  );
}

function InfoHint({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'rose' | 'amber' }) {
  const colorClass =
    tone === 'rose'
      ? 'text-rose-500/70 hover:text-rose-500'
      : tone === 'amber'
        ? 'text-amber-500/70 hover:text-amber-500'
        : 'text-muted-foreground/60 hover:text-foreground';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label="Mais informações"
          className={cn('shrink-0 transition-colors focus:outline-none', colorClass)}
          type="button"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
