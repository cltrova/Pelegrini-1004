import { useMemo, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatCurrency } from '@/utils/formatters';
import { CalendarClock, AlertTriangle, Layers, Users, Wallet } from 'lucide-react';

export type KpiKey = 'total' | 'parcelas' | 'a_vencer' | 'vencido' | 'clientes';

export interface KpiRegistro {
  cliente: string;
  codCliente: string;
  documento: string;
  vencimento: string;
  valor: number;
  categoria: 'a_vencer' | 'vencido';
}

export interface KpiTotais {
  total: number;
  parcelas: number;
  clientes: number;
  a_vencer: { valor: number; qtd: number };
  vencido: { valor: number; qtd: number };
}

export interface KpiContexto {
  periodo: string;
  filtrosAtivos: string[];
  fonte: string;
}

interface Props {
  totais: KpiTotais;
  registros: KpiRegistro[];
  foco: 'a_vencer' | 'vencido' | null;
  onFocoChange: (foco: 'a_vencer' | 'vencido' | null) => void;
  contexto: KpiContexto;
  isLoading?: boolean;
}

const ICONS = {
  total: Wallet,
  parcelas: Layers,
  a_vencer: CalendarClock,
  vencido: AlertTriangle,
  clientes: Users,
} as const;

export function SaldoAVencerKpis({
  totais,
  registros,
  foco,
  onFocoChange,
  contexto,
  isLoading,
}: Props) {
  const [detalhe, setDetalhe] = useState<KpiKey | null>(null);

  const cards = useMemo(
    () => [
      {
        key: 'total' as KpiKey,
        label: 'Total a Vencer',
        valor: totais.total,
        moeda: true,
        sub: `${totais.parcelas} títulos`,
        accent: 'text-primary',
        ring: 'group-hover:border-primary/40',
        bar: 'bg-primary',
        formula: 'Soma do saldo em aberto de todos os títulos filtrados.',
        detalhavel: true,
      },
      {
        key: 'parcelas' as KpiKey,
        label: 'Parcelas em Aberto',
        valor: totais.parcelas,
        moeda: false,
        sub: 'títulos/parcelas',
        accent: 'text-foreground',
        ring: 'group-hover:border-foreground/25',
        bar: 'bg-muted-foreground/60',
        formula: 'Contagem de títulos com saldo em aberto maior que zero.',
        detalhavel: true,
      },
      {
        key: 'a_vencer' as KpiKey,
        label: 'A Vencer',
        valor: totais.a_vencer.valor,
        moeda: true,
        sub: `${totais.a_vencer.qtd} títulos`,
        accent: 'text-emerald-600 dark:text-emerald-400',
        ring: 'group-hover:border-emerald-500/40',
        bar: 'bg-emerald-500',
        formula: 'Soma dos títulos em aberto com vencimento maior ou igual a hoje.',
        detalhavel: true,
      },
      {
        key: 'vencido' as KpiKey,
        label: 'Vencidos',
        valor: totais.vencido.valor,
        moeda: true,
        sub: `${totais.vencido.qtd} títulos`,
        accent: 'text-destructive',
        ring: 'group-hover:border-destructive/40',
        bar: 'bg-destructive',
        formula: 'Soma dos títulos em aberto com vencimento anterior a hoje.',
        detalhavel: true,
      },
      {
        key: 'clientes' as KpiKey,
        label: 'Clientes com Saldo',
        valor: totais.clientes,
        moeda: false,
        sub: 'clientes distintos',
        accent: 'text-foreground',
        ring: 'group-hover:border-foreground/25',
        bar: 'bg-muted-foreground/60',
        formula: 'Quantidade de clientes distintos com saldo em aberto.',
        detalhavel: true,
      },
    ],
    [totais],
  );

  

  const cardAtual = cards.find((c) => c.key === detalhe) ?? null;

  const registrosDetalhe = useMemo(() => {
    if (!detalhe) return [];
    if (detalhe === 'a_vencer' || detalhe === 'vencido') {
      return registros.filter((r) => r.categoria === detalhe);
    }
    return registros;
  }, [detalhe, registros]);

  const composicaoClientes = useMemo(() => {
    const map = new Map<string, { cliente: string; valor: number; qtd: number }>();
    for (const r of registrosDetalhe) {
      const cur = map.get(r.codCliente) ?? { cliente: r.cliente, valor: 0, qtd: 0 };
      cur.valor += r.valor;
      cur.qtd += 1;
      map.set(r.codCliente, cur);
    }
    return [...map.values()].sort((a, b) => b.valor - a.valor).slice(0, 30);
  }, [registrosDetalhe]);

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[124px] rounded-xl border border-border/60 bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-7 w-32" />
            <Skeleton className="mt-4 h-3 w-20" />
            <Skeleton className="mt-3 h-1 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const semDados = totais.parcelas === 0 && totais.total === 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const clicavel = card.detalhavel && !semDados;
          const ativo = foco === card.key;
          
          const Icon = ICONS[card.key];

          return (
            <Tooltip key={card.key}>
              <TooltipTrigger asChild>
                <div
                  role={clicavel ? 'button' : undefined}
                  tabIndex={clicavel ? 0 : undefined}
                  aria-pressed={ativo || undefined}
                  onClick={() => {
                    if (!clicavel) return;
                    setDetalhe(card.key);
                  }}
                  onKeyDown={(e) => {
                    if (!clicavel) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetalhe(card.key);
                    }
                  }}
                  className={[
                    'group flex h-full min-h-[104px] flex-col justify-between rounded-xl border border-border/60 bg-card p-4',
                    'transition-all duration-200 ease-out',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    clicavel ? `cursor-pointer hover:-translate-y-[2px] hover:shadow-lg hover:shadow-black/10 ${card.ring}` : '',
                    ativo ? 'border-primary/50 shadow-md' : '',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {card.label}
                    </p>
                    <Icon
                      className={`h-4 w-4 shrink-0 opacity-50 transition-opacity duration-200 group-hover:opacity-100 ${card.accent}`}
                    />
                  </div>

                  <div className="mt-3">
                    <p
                      className={`truncate text-[clamp(0.95rem,1.5vw,1.45rem)] font-semibold leading-tight tabular-nums ${card.accent}`}
                    >
                      {semDados
                        ? '—'
                        : card.moeda
                          ? formatCurrency(card.valor)
                          : card.valor.toLocaleString('pt-BR')}
                    </p>
                  </div>

                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[240px] text-xs">
                {card.formula}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <Sheet open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Detalhamento</SheetTitle>
            <SheetDescription>{cardAtual?.label}</SheetDescription>
          </SheetHeader>

          {cardAtual && (
            <div className="mt-5 space-y-5 text-sm">
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Valor</p>
                <p className={`text-2xl font-semibold tabular-nums ${cardAtual.accent}`}>
                  {cardAtual.moeda
                    ? formatCurrency(cardAtual.valor)
                    : cardAtual.valor.toLocaleString('pt-BR')}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Período filtrado</p>
                <p>{contexto.periodo}</p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Filtros ativos</p>
                <div className="flex flex-wrap gap-1.5">
                  {contexto.filtrosAtivos.length === 0 ? (
                    <span className="text-muted-foreground">Nenhum filtro adicional</span>
                  ) : (
                    contexto.filtrosAtivos.map((f) => (
                      <Badge key={f} variant="secondary" className="font-normal">
                        {f}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fórmula</p>
                <p>{cardAtual.formula}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fonte dos dados</p>
                <p className="font-mono text-xs">{contexto.fonte}</p>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Composição por cliente (top 30)
                </p>
                {composicaoClientes.length === 0 ? (
                  <p className="text-muted-foreground">Sem dados para os filtros atuais</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-border/60">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Cliente</th>
                          <th className="px-3 py-2 text-right font-medium">Títulos</th>
                          <th className="px-3 py-2 text-right font-medium">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {composicaoClientes.map((c) => (
                          <tr key={c.cliente} className="border-t border-border/50">
                            <td className="max-w-[220px] truncate px-3 py-1.5">{c.cliente}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{c.qtd}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(c.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {(cardAtual.key === 'a_vencer' || cardAtual.key === 'vencido') && (
                <button
                  type="button"
                  className="w-full rounded-lg border border-border/60 px-3 py-2 text-xs transition-colors hover:bg-muted"
                  onClick={() => {
                    onFocoChange(foco === cardAtual.key ? null : (cardAtual.key as 'a_vencer' | 'vencido'));
                    setDetalhe(null);
                  }}
                >
                  {foco === cardAtual.key ? 'Remover foco na tabela' : 'Focar esta categoria na tabela'}
                </button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
