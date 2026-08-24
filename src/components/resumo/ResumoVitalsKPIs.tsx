import { Card } from '@/components/ui/card';
import { ResumoKPIs, PDDResultado } from '@/types/resumo';
import { formatCurrency, formatInteger, formatPercent } from '@/utils/formatters';
import {
  AlertTriangle,
  CheckCircle2,
  Package,
  Clock,
  Wallet,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
        <Card className="relative overflow-hidden p-5 bg-gradient-to-br from-primary/5 via-card to-card border-primary/30">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Total Geral da Carteira
                </span>
                <InfoHint text="Essa soma fecha exatamente assim: Em Aberto + Faturado no Prazo + Faturado Vencido + Recebido." />
              </div>
              <div className="font-mono text-3xl md:text-4xl font-bold tracking-tight tabular-nums text-foreground">
                {formatCurrency(totalCarteira)}
              </div>
              <div className="text-xs text-muted-foreground mt-1.5">
                {formatCurrency(kpis.totalPedidosEmAberto)} + {formatCurrency(kpis.totalAVencer)} +{' '}
                {formatCurrency(kpis.totalVencido)} + {formatCurrency(kpis.totalRecebido)}
              </div>
            </div>

            <div className="flex flex-col gap-1 text-xs font-mono min-w-[260px]">
              <DistRow color="bg-amber-500" label="Em Aberto (não faturado)" pct={pct(kpis.totalPedidosEmAberto)} />
              <DistRow color="bg-sky-500" label="Faturado no prazo" pct={pct(kpis.totalAVencer)} />
              <DistRow color="bg-rose-500" label="Faturado vencido" pct={pct(kpis.totalVencido)} />
              <DistRow color="bg-emerald-500" label="Recebido" pct={pct(kpis.totalRecebido)} />
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StageCard
            tone="amber"
            icon={Package}
            label="Em Aberto"
            sublabel="(não faturado)"
            value={kpis.totalPedidosEmAberto > 0 ? formatCurrency(kpis.totalPedidosEmAberto) : '—'}
            sub={`${formatInteger(kpis.qtdPedidosAbertos)} pedidos`}
            tooltip="Pedidos que ainda não viraram nota fiscal nem duplicata."
          />

          <StageCard
            tone="sky"
            icon={Clock}
            label="Faturado"
            sublabel="(no prazo)"
            value={formatCurrency(kpis.totalAVencer)}
            sub={`${formatInteger(qtdNoPrazo)} duplicatas`}
            tooltip="Duplicatas já emitidas e ainda dentro do prazo de pagamento."
          />

          <Card className="relative overflow-hidden p-4 bg-rose-500/5 border-rose-500/40 shadow-[0_0_24px_-12px_hsl(var(--destructive))]">
            <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-rose-600 dark:text-rose-400 min-w-0">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Faturado</span>
              </div>
              <InfoHint
                tone="rose"
                text="Duplicatas já emitidas cuja data de vencimento passou e seguem sem pagamento."
              />
            </div>
            <div className="text-[10px] text-rose-600/80 dark:text-rose-400/80 -mt-1 mb-1 italic font-semibold truncate">
              (vencido)
            </div>
            <div className="font-mono text-xl md:text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums truncate">
              {formatCurrency(kpis.totalVencido)}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground font-mono">
              {formatInteger(kpis.qtdDuplicatasVencidas)} títulos · atraso médio{' '}
              <span className="text-foreground">{formatInteger(kpis.diasMedioAtraso)}d</span>
            </div>
          </Card>

          <StageCard
            tone="emerald"
            icon={CheckCircle2}
            label="Recebido"
            sublabel="(no período)"
            value={formatCurrency(kpis.totalRecebido)}
            sub={`${formatInteger(kpis.qtdDuplicatasPagas)} pagamentos`}
            tooltip="Valores que já entraram no caixa."
          />

          <Card className="relative overflow-hidden p-4 bg-amber-500/5 border-amber-500/40">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-amber-600 dark:text-amber-400">
                <ShieldAlert className="h-3.5 w-3.5" />
                PDD Estimada
              </div>
              <InfoHint
                tone="amber"
                text="PDD é a perda estimada sobre os títulos vencidos, usando faixas progressivas de atraso."
              />
            </div>
            <div className="font-mono text-xl md:text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums truncate">
              {formatCurrency(pdd.total)}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground font-mono">
              {formatPercent(pdd.percentual)} da carteira a receber
            </div>
            <div className="mt-1 text-[10px] text-amber-600/80 dark:text-amber-400/80 font-medium">
              inadimpl. {formatPercent(kpis.taxaInadimplencia)} · {formatInteger(kpis.qtdClientesInadimplentes)} clientes
            </div>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}

interface StageCardProps {
  tone: 'amber' | 'sky' | 'emerald';
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel?: string;
  value: string;
  sub?: string;
  tooltip: string;
}

function StageCard({ tone, icon: Icon, label, sublabel, value, sub, tooltip }: StageCardProps) {
  const valueClass =
    tone === 'amber'
      ? 'text-amber-600 dark:text-amber-400'
      : tone === 'sky'
        ? 'text-sky-600 dark:text-sky-400'
        : 'text-emerald-600 dark:text-emerald-400';
  const barClass =
    tone === 'amber' ? 'bg-amber-500' : tone === 'sky' ? 'bg-sky-500' : 'bg-emerald-500';

  return (
    <Card className="relative overflow-hidden p-4 bg-card border-border hover:border-foreground/20 transition-colors">
      <div className={cn('absolute top-0 left-0 w-1 h-full', barClass)} />
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground min-w-0">
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{label}</span>
        </div>
        <InfoHint text={tooltip} />
      </div>
      {sublabel && (
        <div className="text-[10px] text-muted-foreground/80 -mt-1 mb-1 italic truncate">
          {sublabel}
        </div>
      )}
      <div className={cn('font-mono text-xl md:text-2xl font-bold tabular-nums truncate', valueClass)}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground font-mono truncate">{sub}</div>}
    </Card>
  );
}

function DistRow({ color, label, pct }: { color: string; label: string; pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('h-2 w-2 rounded-sm shrink-0', color)} />
      <span className="text-muted-foreground flex-1 truncate">{label}</span>
      <span className="text-foreground font-semibold tabular-nums">{pct.toFixed(1)}%</span>
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
          type="button"
          className={cn('shrink-0 transition-colors focus:outline-none', colorClass)}
          aria-label="Mais informações"
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
