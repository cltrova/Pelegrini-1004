import { useMemo } from 'react';
import { Package, DollarSign, TrendingDown, AlertTriangle, BarChart3, ShoppingCart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { EstoqueRecord } from '@/types/estoque';

interface Props {
  data: EstoqueRecord[];
}

export function EstoqueKPICards({ data }: Props) {
  const kpis = useMemo(() => {
    const totalItens = data.length;
    const totalQtd = data.reduce((s, r) => s + r.quantidade_estoque, 0);
    const totalValor = data.reduce((s, r) => s + r.valor_estoque, 0);
    const custoMedioGeral = totalItens > 0
      ? data.reduce((s, r) => s + r.custo_medio, 0) / totalItens
      : 0;
    const totalCompra = data.reduce((s, r) => s + r.quantidade_compra_produto, 0);

    const now = new Date();
    const itensSemVenda90 = data.filter(r => {
      if (!r.data_ultima_venda) return true;
      const dias = Math.floor((now.getTime() - new Date(r.data_ultima_venda).getTime()) / (1000 * 60 * 60 * 24));
      return dias > 90;
    }).length;

    return { totalItens, totalQtd, totalValor, custoMedioGeral, itensSemVenda90, totalCompra };
  }, [data]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
  const formatNumber = (v: number) =>
    new Intl.NumberFormat('pt-BR').format(v);

  const cards = [
    {
      label: 'Total de Itens',
      value: formatNumber(kpis.totalItens),
      icon: Package,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      border: 'border-l-amber-500',
    },
    {
      label: 'Qtd. em Estoque',
      value: formatNumber(kpis.totalQtd),
      icon: BarChart3,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      border: 'border-l-blue-500',
    },
    {
      label: 'Valor do Estoque',
      value: formatCurrency(kpis.totalValor),
      icon: DollarSign,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      border: 'border-l-emerald-500',
    },
    {
      label: 'Custo Médio Geral',
      value: formatCurrency(kpis.custoMedioGeral),
      icon: ShoppingCart,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
      border: 'border-l-violet-500',
    },
    {
      label: 'Qtd. Comprada',
      value: formatNumber(kpis.totalCompra),
      icon: TrendingDown,
      color: 'text-cyan-500',
      bg: 'bg-cyan-500/10',
      border: 'border-l-cyan-500',
    },
    {
      label: 'Sem Venda >90d',
      value: formatNumber(kpis.itensSemVenda90),
      icon: AlertTriangle,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      border: 'border-l-red-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className={`border-l-4 ${card.border} premium-card`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`h-8 w-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
              <p className="text-lg font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
