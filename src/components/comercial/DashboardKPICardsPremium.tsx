import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  DollarSign,
  Package,
  ShoppingCart,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { EnterpriseMetricCard, type EnterpriseTone } from '@/components/enterprise';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import type { ComercialKPIs } from '@/types/comercial';

interface DashboardKPIsProps {
  kpis: ComercialKPIs;
}

interface KpiDefinition {
  label: string;
  value: number;
  formatter: (v: number) => string;
  context: string;
  target?: ReactNode;
  detail?: ReactNode;
  icon: ReactNode;
  tone: EnterpriseTone;
  onClick?: () => void;
}

function useCountAnimation(target: number, duration = 1400) {
  const [current, setCurrent] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target === prevTarget.current) return;
    const start = prevTarget.current;
    prevTarget.current = target;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(start + (target - start) * eased);
      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }, [target, duration]);

  return current;
}

const fmtCurrency = (v: number) => formatCurrency(v, true);
const fmtNumber = (v: number) => formatNumber(Math.round(v));

function KpiCard({ label, value, formatter, context, target, detail, icon, tone, onClick }: KpiDefinition) {
  const animatedValue = useCountAnimation(value);

  return (
    <EnterpriseMetricCard
      label={label}
      value={formatter(animatedValue)}
      context={context}
      detail={detail}
      icon={icon}
      onClick={onClick}
      target={target}
      tone={tone}
    />
  );
}

export function DashboardKPICardsPremium({
  kpis,
  onReceitaClick,
}: DashboardKPIsProps & { onReceitaClick?: () => void }) {
  const margem =
    kpis.faturamentoLiquido > 0
      ? ((kpis.faturamentoLiquido - kpis.totalValorCusto) / kpis.faturamentoLiquido) * 100
      : 0;
  const ticketMedio = kpis.qtdPedidos > 0 ? kpis.faturamentoLiquido / kpis.qtdPedidos : 0;

  const cards: KpiDefinition[] = [
    {
      label: 'Faturamento Real',
      value: kpis.faturamentoLiquido,
      formatter: fmtCurrency,
      context: 'Σ Valor Real do período',
      target: `Margem ${margem.toFixed(1)}%`,
      detail: onReceitaClick ? 'Clique para ver detalhes' : undefined,
      icon: <Sparkles className="h-4 w-4" />,
      onClick: onReceitaClick,
      tone: 'positive',
    },
    {
      label: 'Valor Pedido',
      value: kpis.totalValorPedido,
      formatter: fmtCurrency,
      context: 'Σ valor_total_pedido',
      icon: <DollarSign className="h-4 w-4" />,
      tone: 'info',
    },
    {
      label: 'Custo',
      value: kpis.totalValorCusto,
      formatter: fmtCurrency,
      context: 'Σ valor_custo',
      icon: <Package className="h-4 w-4" />,
      tone: 'warning',
    },
    {
      label: 'Descontos',
      value: kpis.totalValorDesconto,
      formatter: fmtCurrency,
      context: 'Σ valor_desconto',
      icon: <TrendingDown className="h-4 w-4" />,
      tone: 'negative',
    },
    {
      label: 'Pedidos',
      value: kpis.qtdPedidos,
      formatter: fmtNumber,
      context: 'Registros filtrados',
      target: `Ticket ${fmtCurrency(ticketMedio)}`,
      icon: <ShoppingCart className="h-4 w-4" />,
      tone: 'neutral',
    },
    {
      label: 'Clientes',
      value: kpis.qtdClientes,
      formatter: fmtNumber,
      context: 'Únicos no período',
      icon: <Users className="h-4 w-4" />,
      tone: 'info',
    },
    {
      label: 'Vendedores',
      value: kpis.qtdVendedores,
      formatter: fmtNumber,
      context: 'Ativos no período',
      icon: <TrendingUp className="h-4 w-4" />,
      tone: 'positive',
    },
  ];

  return (
    <div className="enterprise-grid-metrics">
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </div>
  );
}
