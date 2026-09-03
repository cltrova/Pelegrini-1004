import { Card } from '@/components/ui/card';
import {
  Wallet,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  TrendingDown,
  Users,
  Package,
  Receipt,
} from 'lucide-react';
import { ResumoKPIs } from '@/types/resumo';
import { formatCurrency, formatInteger, formatPercent } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { PelegriniResponsiveValue } from '@/components/pelegrini';

interface Props {
  kpis: ResumoKPIs;
}

interface KpiItem {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'neutral' | 'good' | 'warn' | 'bad' | 'info';
}

const toneClasses: Record<KpiItem['tone'], { bg: string; ring: string; text: string; iconBg: string }> = {
  neutral: { bg: 'bg-card', ring: 'ring-border', text: 'text-foreground', iconBg: 'bg-muted text-muted-foreground' },
  good:    { bg: 'bg-emerald-500/5', ring: 'ring-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  warn:    { bg: 'bg-amber-500/5',   ring: 'ring-amber-500/20',   text: 'text-amber-600 dark:text-amber-400',     iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  bad:     { bg: 'bg-rose-500/5',    ring: 'ring-rose-500/20',    text: 'text-rose-600 dark:text-rose-400',       iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  info:    { bg: 'bg-sky-500/5',     ring: 'ring-sky-500/20',     text: 'text-sky-600 dark:text-sky-400',         iconBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
};

export function ResumoKPICards({ kpis }: Props) {
  const items: KpiItem[] = [
    {
      label: 'Total em Aberto',
      value: formatCurrency(kpis.totalAberto),
      hint: `${formatInteger(kpis.qtdDuplicatasAbertas)} duplicatas`,
      icon: Wallet,
      tone: 'info',
    },
    {
      label: 'Vencido',
      value: formatCurrency(kpis.totalVencido),
      hint: `${formatInteger(kpis.qtdDuplicatasVencidas)} títulos vencidos`,
      icon: AlertTriangle,
      tone: 'bad',
    },
    {
      label: 'A Vencer',
      value: formatCurrency(kpis.totalAVencer),
      hint: 'Carteira saudável',
      icon: CalendarClock,
      tone: 'warn',
    },
    {
      label: 'Recebido',
      value: formatCurrency(kpis.totalRecebido),
      hint: `${formatInteger(kpis.qtdDuplicatasPagas)} duplicatas pagas`,
      icon: CheckCircle2,
      tone: 'good',
    },
    {
      label: 'Inadimplência',
      value: formatPercent(kpis.taxaInadimplencia),
      hint: `${formatInteger(kpis.qtdClientesInadimplentes)} clientes`,
      icon: TrendingDown,
      tone: 'bad',
    },
    {
      label: 'Ticket Médio',
      value: formatCurrency(kpis.ticketMedio),
      hint: 'por duplicata em aberto',
      icon: Receipt,
      tone: 'neutral',
    },
    {
      label: 'Atraso Médio',
      value: `${formatInteger(kpis.diasMedioAtraso)} dias`,
      hint: 'das duplicatas vencidas',
      icon: CalendarClock,
      tone: 'warn',
    },
    {
      label: 'Pedidos em Aberto',
      value: formatInteger(kpis.qtdPedidosAbertos),
      hint: 'ainda não faturados',
      icon: Package,
      tone: 'info',
    },
  ];

  return (
    <div className="pelegrini-kpi-grid grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-3">
      {items.map((it) => {
        const t = toneClasses[it.tone];
        const Icon = it.icon;
        return (
          <Card
            key={it.label}
            className={cn(
              'pelegrini-kpi-card min-w-0 p-4 ring-1 transition-colors hover:bg-muted/30',
              t.bg,
              t.ring,
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium leading-tight text-muted-foreground uppercase tracking-wider">
                  {it.label}
                </p>
                <PelegriniResponsiveValue as="p" size="md" className={cn('mt-1', t.text)}>
                  {it.value}
                </PelegriniResponsiveValue>
                {it.hint && (
                  <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{it.hint}</p>
                )}
              </div>
              <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', t.iconBg)}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
