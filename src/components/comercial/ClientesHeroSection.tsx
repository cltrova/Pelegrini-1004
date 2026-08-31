import { useEffect, useRef, useState } from 'react';
import { Users, UserPlus, TrendingUp, ShoppingCart, Building2, ArrowUpRight, ArrowDownRight, Minus, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PelegriniResponsiveValue } from '@/components/pelegrini';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/utils/formatters';

interface HeroProps {
  qtdClientes: number;
  novosClientes: number;
  faturamentoLiquido: number;
  ticketMedio: number;
  qtdVendedores: number;
  evolucaoMensal: { mes: string; vendas: number }[];
}

type Formatter = (n: number) => string;

/** Animated counter — ease-out cubic over ~900ms */
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>();
  const startRef = useRef<number>();
  const fromRef = useRef(0);

  useEffect(() => {
    fromRef.current = value;
    startRef.current = undefined;
    const step = (t: number) => {
      if (startRef.current === undefined) startRef.current = t;
      const elapsed = t - startRef.current;
      const p = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(fromRef.current + (target - fromRef.current) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}

function Delta({ pct }: { pct: number | null }) {
  if (pct === null || !isFinite(pct)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Minus className="h-3 w-3" />
        —
      </span>
    );
  }
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums',
        up ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
      )}
    >
      <Icon className="h-3 w-3" />
      {formatPercent(Math.abs(pct))}
    </span>
  );
}

interface HeroCardProps {
  label: string;
  value: number;
  format: Formatter;
  icon: React.ComponentType<{ className?: string }>;
  deltaPct: number | null;
  deltaHint: string;
  explanation: string;
}

function HeroCard({ label, value, format, icon: Icon, deltaPct, deltaHint, explanation }: HeroCardProps) {
  const animated = useCountUp(value);
  return (
    <Card
      className={cn(
        'group relative overflow-hidden border-border/60 bg-card shadow-sm cursor-default',
        'transition-all duration-300 ease-out',
        'hover:-translate-y-1 hover:scale-[1.015] hover:border-border hover:shadow-[0_12px_32px_-12px_hsl(var(--foreground)/0.18)]'
      )}
    >
      {/* Iluminação sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-40 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.10),transparent_60%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
      {/* Borda translúcida no hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-transparent transition-colors duration-300 group-hover:ring-primary/15"
      />
      <CardContent className="relative p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">{label}</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`O que significa ${label}`}
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-64 text-xs leading-5">{explanation}</TooltipContent>
            </Tooltip>
          </div>
          <Icon className="h-4 w-4 text-muted-foreground/70 transition-all duration-300 group-hover:text-primary group-hover:scale-110" />
        </div>

        <PelegriniResponsiveValue as="p" size="hero" className="mono-value mt-4 font-semibold tabular-nums transition-colors duration-300 group-hover:text-foreground">
          {format(animated)}
        </PelegriniResponsiveValue>

        <div className="mt-3 flex items-center gap-2">
          <Delta pct={deltaPct} />
          <span className="text-[11px] text-muted-foreground">{deltaHint}</span>
        </div>
      </CardContent>
    </Card>

  );
}

export function ClientesHeroSection({
  qtdClientes,
  novosClientes,
  faturamentoLiquido,
  ticketMedio,
  qtdVendedores,
  evolucaoMensal,
}: HeroProps) {
  // Comparação: último mês vs mês anterior (a partir dos dados já carregados)
  const n = evolucaoMensal.length;
  const last = n >= 1 ? evolucaoMensal[n - 1].vendas : 0;
  const prev = n >= 2 ? evolucaoMensal[n - 2].vendas : 0;
  const receitaPct = prev > 0 ? ((last - prev) / prev) * 100 : null;

  const cards: HeroCardProps[] = [
    {
      label: 'Clientes Ativos',
      value: qtdClientes,
      format: (n) => Math.round(n).toLocaleString('pt-BR'),
      icon: Users,
      deltaPct: null,
      deltaHint: 'no período',
      explanation: 'Clientes com movimentação de compra dentro do período selecionado.',
    },
    {
      label: 'Novos Clientes',
      value: novosClientes,
      format: (n) => Math.round(n).toLocaleString('pt-BR'),
      icon: UserPlus,
      deltaPct: null,
      deltaHint: 'primeira compra recente',
      explanation: 'Clientes cuja primeira compra registrada ocorreu no período analisado.',
    },
    {
      label: 'Receita Gerada',
      value: faturamentoLiquido,
      format: (n) => formatCurrency(n),
      icon: TrendingUp,
      deltaPct: receitaPct,
      deltaHint: 'vs. mês anterior',
      explanation: 'Faturamento líquido gerado pela carteira de clientes no período.',
    },
    {
      label: 'Ticket Médio',
      value: ticketMedio,
      format: (n) => formatCurrency(n),
      icon: ShoppingCart,
      deltaPct: null,
      deltaHint: 'por pedido',
      explanation: 'Receita gerada dividida pela quantidade de pedidos do período.',
    },
    {
      label: 'Vendedores Ativos',
      value: qtdVendedores,
      format: (n) => Math.round(n).toLocaleString('pt-BR'),
      icon: Building2,
      deltaPct: null,
      deltaHint: 'no período',
      explanation: 'Vendedores que registraram movimentação na carteira durante o período.',
    },
  ];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-muted/40 via-background to-background p-5 md:p-8">
      <h1 className="mb-6 text-xl font-semibold md:text-2xl">Análise de Clientes</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-5">
        {cards.map((c) => (
          <HeroCard key={c.label} {...c} />
        ))}
      </div>
    </section>
  );
}
