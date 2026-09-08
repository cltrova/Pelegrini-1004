import { useMemo } from 'react';
import { Trophy, Crown, Medal, Award, ArrowUpRight, ArrowDownRight, Minus, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { ClientePerformance } from '@/types/comercial';

interface Props {
  clientes: ClientePerformance[];
  /** Variação percentual por código de cliente (ex.: mês atual vs. anterior). */
  variacoesPorCodigo?: Map<string, number>;
  /** Faturamento total geral para cálculo de participação (fallback: soma dos itens). */
  totalGeral?: number;
}

const RANK_STYLES: Record<number, { badge: string; ring: string; icon: React.ComponentType<{ className?: string }> }> = {
  1: {
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/30',
    ring: 'ring-amber-500/20',
    icon: Crown,
  },
  2: {
    badge: 'bg-slate-400/15 text-slate-600 dark:text-slate-300 ring-slate-400/30',
    ring: 'ring-slate-400/20',
    icon: Medal,
  },
  3: {
    badge: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 ring-orange-500/30',
    ring: 'ring-orange-500/20',
    icon: Award,
  },
};

function DeltaPill({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined || !isFinite(pct)) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        <Minus className="h-3 w-3" /> —
      </span>
    );
  }
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
        up
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
      )}
    >
      <Icon className="h-3 w-3" />
      {formatPercent(Math.abs(pct))}
    </span>
  );
}

export function TopClientesRanking({ clientes, variacoesPorCodigo, totalGeral }: Props) {
  const items = useMemo(() => {
    const soma = totalGeral ?? clientes.reduce((s, c) => s + c.faturamentoLiquido, 0);
    const max = clientes.reduce((m, c) => Math.max(m, c.faturamentoLiquido), 0);
    return clientes.map((c, i) => {
      const participacao = soma > 0 ? (c.faturamentoLiquido / soma) * 100 : 0;
      const progresso = max > 0 ? (c.faturamentoLiquido / max) * 100 : 0;
      const variacao = variacoesPorCodigo?.get(String(c.codigo));
      return {
        posicao: i + 1,
        codigo: String(c.codigo),
        nome: c.fantasia || c.razao,
        razao: c.razao,
        cidade: c.cidade,
        uf: c.uf,
        valor: c.faturamentoLiquido,
        participacao,
        progresso,
        variacao: variacao ?? null,
      };
    });
  }, [clientes, totalGeral, variacoesPorCodigo]);

  return (
    <Card className="overflow-hidden border-border/60">
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4 md:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
            <Trophy className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground/90">Top Clientes</h3>
            <p className="text-xs text-muted-foreground">Ranking por faturamento líquido</p>
          </div>
        </div>
        <Badge variant="secondary" className="text-[11px] font-medium">
          {items.length} clientes
        </Badge>
      </header>

      <ul className="group/list divide-y divide-border/50">
        {items.map((it, idx) => {
          const rank = RANK_STYLES[it.posicao];
          const Icon = rank?.icon;
          return (
            <li
              key={it.codigo}
              className={cn(
                'group/item relative flex items-center gap-4 px-5 py-3.5 md:px-6 cursor-pointer',
                'transition-colors duration-200 ease-out animate-fade-in',
                'opacity-100 group-hover/list:opacity-60 hover:!opacity-100 hover:!bg-muted/50 hover:z-10'
              )}
              style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'both' }}
            >
              {/* Barra lateral de destaque no hover */}
              <span
                aria-hidden
                className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-primary opacity-0 transition-opacity duration-300 group-hover/item:opacity-100"
              />

              {/* Posição */}
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold tabular-nums ring-1',
                  rank
                    ? cn(rank.badge, 'ring-1')
                    : 'bg-muted/60 text-muted-foreground ring-border/60'
                )}
              >
                {Icon ? <Icon className="h-4 w-4" /> : `#${it.posicao}`}
              </div>

              {/* Nome + barra */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground transition-colors duration-200 group-hover/item:text-primary">
                      {it.nome}
                    </p>
                    {it.posicao <= 3 && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'shrink-0 border-transparent px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide',
                          rank?.badge
                        )}
                      >
                        Top {it.posicao}
                      </Badge>
                    )}
                  </div>
                  <p className="mono-value shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(it.valor)}
                  </p>
                </div>

                {/* Metadata linha */}
                <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                  <div className="flex min-w-0 items-center gap-3">
                    {(it.cidade || it.uf) && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {it.cidade ? `${it.cidade}${it.uf ? ` · ${it.uf}` : ''}` : it.uf}
                        </span>
                      </span>
                    )}
                    <span className="tabular-nums">
                      <span className="text-foreground/70 font-medium">{formatPercent(it.participacao)}</span>
                      <span className="ml-1">do total</span>
                    </span>
                    {/* Info extra revelada no hover */}
                    <span className="hidden max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-300 group-hover/item:max-w-xs group-hover/item:opacity-100 md:inline">
                      · Ranking #{it.posicao}
                    </span>
                  </div>
                  <DeltaPill pct={it.variacao} />
                </div>

                {/* Barra de progresso */}
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width,background-color] duration-700 ease-out',
                      it.posicao === 1 ? 'bg-primary' : 'bg-primary/60',
                      'group-hover/item:!bg-primary'
                    )}
                    style={{ width: `${Math.max(2, it.progresso)}%` }}
                  />
                </div>
              </div>
            </li>
          );

        })}

        {items.length === 0 && (
          <li className="px-6 py-10 text-center text-sm text-muted-foreground">
            Nenhum cliente no período.
          </li>
        )}
      </ul>
    </Card>
  );
}
