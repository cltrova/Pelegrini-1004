import { useMemo } from 'react';
import { Users, Crown, Medal, Award, ArrowUpRight, ArrowDownRight, Minus, TrendingUp, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatPercent } from '@/utils/formatters';
import { cn } from '@/lib/utils';

export interface VendedorItem {
  nome: string;
  qtd: number;
  avatarUrl?: string;
}

interface Props {
  vendedores: VendedorItem[];
  /** Variação percentual (mês atual vs. anterior) por nome de vendedor. */
  variacoesPorNome?: Map<string, number>;
}

const TIER_STYLES = {
  ouro: {
    label: 'Ouro',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/30',
    icon: Crown,
  },
  prata: {
    label: 'Prata',
    badge: 'bg-slate-400/15 text-slate-600 dark:text-slate-300 ring-slate-400/30',
    icon: Medal,
  },
  bronze: {
    label: 'Bronze',
    badge: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 ring-orange-500/30',
    icon: Award,
  },
  standard: {
    label: 'Standard',
    badge: 'bg-muted text-muted-foreground ring-border/60',
    icon: Star,
  },
} as const;

type TierKey = keyof typeof TIER_STYLES;

function tierFromPosition(pos: number): TierKey {
  if (pos === 1) return 'ouro';
  if (pos === 2) return 'prata';
  if (pos === 3) return 'bronze';
  return 'standard';
}

function initials(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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

export function VendedoresRanking({ vendedores, variacoesPorNome }: Props) {
  const { items, maiorCarteira, maiorCrescimento } = useMemo(() => {
    const ordered = [...vendedores].sort((a, b) => b.qtd - a.qtd);
    const total = ordered.reduce((s, v) => s + v.qtd, 0);
    const max = ordered[0]?.qtd ?? 0;

    const items = ordered.map((v, i) => {
      const variacao = variacoesPorNome?.get(v.nome);
      return {
        posicao: i + 1,
        nome: v.nome,
        avatarUrl: v.avatarUrl,
        qtd: v.qtd,
        share: total > 0 ? (v.qtd / total) * 100 : 0,
        progresso: max > 0 ? (v.qtd / max) * 100 : 0,
        variacao: variacao ?? null,
        tier: tierFromPosition(i + 1),
      };
    });

    const maiorCarteira = items[0]?.nome ?? null;
    const maiorCrescimento =
      items.reduce<{ nome: string; pct: number } | null>((best, it) => {
        if (it.variacao === null || !isFinite(it.variacao)) return best;
        if (!best || it.variacao > best.pct) return { nome: it.nome, pct: it.variacao };
        return best;
      }, null);

    return { items, maiorCarteira, maiorCrescimento };
  }, [vendedores, variacoesPorNome]);

  return (
    <Card className="overflow-hidden border-border/60">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4 md:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground/90">Clientes por Vendedor</h3>
            <p className="text-xs text-muted-foreground">Ranking premium por carteira ativa</p>
          </div>
        </div>
        <Badge variant="secondary" className="text-[11px] font-medium">
          {items.length} vendedores
        </Badge>
      </header>

      {/* Insights rápidos */}
      {(maiorCarteira || maiorCrescimento) && (
        <div className="grid grid-cols-1 gap-2 border-b border-border/60 bg-muted/20 px-5 py-3 sm:grid-cols-2 md:px-6">
          {maiorCarteira && (
            <div className="flex items-center gap-2 text-xs">
              <Crown className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-muted-foreground">Maior carteira:</span>
              <span className="truncate font-medium text-foreground">{maiorCarteira}</span>
            </div>
          )}
          {maiorCrescimento && (
            <div className="flex items-center gap-2 text-xs">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-muted-foreground">Maior crescimento:</span>
              <span className="truncate font-medium text-foreground">{maiorCrescimento.nome}</span>
              <span className="tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                +{formatPercent(Math.abs(maiorCrescimento.pct))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Lista — top 5 visíveis, restante via scroll */}
      <ul
        className="group/list divide-y divide-border/50 overflow-y-auto overscroll-contain"
        style={{ maxHeight: 'calc(5 * 92px)' }}
      >

        {items.map((it, idx) => {
          const tier = TIER_STYLES[it.tier];
          const TierIcon = tier.icon;
          const isTop3 = it.posicao <= 3;
          return (
            <li
              key={it.nome + idx}
              className={cn(
                'group/item relative flex items-center gap-4 px-5 py-4 md:px-6 cursor-pointer',
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

              {/* Avatar + medalha */}
              <div className="relative shrink-0">
                <Avatar className={cn('h-11 w-11 ring-2 ring-offset-2 ring-offset-background', isTop3 ? tier.badge.split(' ').find(c => c.startsWith('ring-')) : 'ring-border/40')}>
                  {it.avatarUrl && <AvatarImage src={it.avatarUrl} alt={it.nome} />}
                  <AvatarFallback className="bg-muted text-xs font-semibold text-foreground/80">
                    {initials(it.nome)}
                  </AvatarFallback>
                </Avatar>
                {isTop3 && (
                  <span
                    className={cn(
                      'absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background',
                      tier.badge
                    )}
                  >
                    <TierIcon className="h-3 w-3" />
                  </span>
                )}
              </div>

              {/* Conteúdo */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 tabular-nums text-xs font-semibold text-muted-foreground">
                      #{it.posicao}
                    </span>
                    <p className="truncate text-sm font-medium text-foreground transition-colors duration-200 group-hover/item:text-primary">
                      {it.nome}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        'shrink-0 border-transparent px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide',
                        tier.badge
                      )}
                    >
                      {tier.label}
                    </Badge>
                  </div>
                  <p className="mono-value shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {it.qtd.toLocaleString('pt-BR')}
                    <span className="ml-1 text-[11px] font-normal text-muted-foreground">clientes</span>
                  </p>
                </div>

                {/* Metadata */}
                <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="tabular-nums">
                      <span className="font-medium text-foreground/70">{formatPercent(it.share)}</span>
                      <span className="ml-1">de participação</span>
                    </span>
                    {/* Info extra no hover */}
                    <span className="hidden max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-300 group-hover/item:max-w-xs group-hover/item:opacity-100 md:inline">
                      · Tier {tier.label}
                    </span>
                  </div>
                  <DeltaPill pct={it.variacao} />
                </div>

                {/* Barra */}
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width,background-color] duration-700 ease-out',
                      it.posicao === 1
                        ? 'bg-amber-500'
                        : it.posicao === 2
                        ? 'bg-slate-400'
                        : it.posicao === 3
                        ? 'bg-orange-500'
                        : 'bg-primary/60',
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
            Nenhum vendedor no período.
          </li>
        )}
      </ul>
    </Card>
  );
}
