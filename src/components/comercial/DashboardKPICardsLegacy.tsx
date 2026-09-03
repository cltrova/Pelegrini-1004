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
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
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
  detail?: ReactNode;
  icon: ReactNode;
  tone: EnterpriseTone;
  onClick?: () => void;
}

function useCountAnimation(target: number, duration = 1200) {
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

function KpiCard({ label, value, formatter, context, detail, icon, tone, onClick }: KpiDefinition) {
  const animatedValue = useCountAnimation(value);

  return (
    <EnterpriseMetricCard
      label={label}
      value={formatter(animatedValue)}
      context={context}
      detail={detail}
      icon={icon}
      onClick={onClick}
      tone={tone}
    />
  );
}

export function DashboardKPICardsLegacy({
  kpis,
  onReceitaClick,
}: DashboardKPIsProps & { onReceitaClick?: () => void }) {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const showDevolucoes = ['1001', '1004', '10041'].includes(String(codEmpresaAtiva ?? ''));
  const cards: KpiDefinition[] = [
    {
      label: 'Valor Total Pedido',
      value: kpis.totalValorPedido,
      formatter: fmtCurrency,
      context: 'Σ valor_total_pedido',
      icon: <DollarSign className="h-4 w-4" />,
      tone: 'info',
    },
    {
      label: 'Faturamento Real',
      value: kpis.faturamentoLiquido,
      formatter: fmtCurrency,
      context: 'Σ Valor_Real',
      detail: onReceitaClick ? 'Clique para ver detalhes' : undefined,
      icon: <TrendingUp className="h-4 w-4" />,
      onClick: onReceitaClick,
      tone: 'positive',
    },
    ...(showDevolucoes
      ? [
          {
            label: 'Devoluções',
            value: kpis.totalDevolucoes,
            formatter: fmtCurrency,
            context: 'Σ Valor_Devolucao',
            icon: <TrendingDown className="h-4 w-4" />,
            tone: 'negative' as const,
          },
        ]
      : []),
    {
      label: 'Valor Custo',
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
      icon: <Sparkles className="h-4 w-4" />,
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
