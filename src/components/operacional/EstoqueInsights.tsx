import { useMemo } from 'react';
import { EstoqueRecord } from '@/types/estoque';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, AlertTriangle, Package, Crown, Layers, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  data: EstoqueRecord[];
}

interface Insight {
  icon: React.ElementType;
  title: string;
  description: string;
  type: 'info' | 'warning' | 'success' | 'highlight';
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const formatNumber = (v: number) =>
  new Intl.NumberFormat('pt-BR').format(v);

export function EstoqueInsights({ data }: Props) {
  const insights = useMemo<Insight[]>(() => {
    if (data.length === 0) return [];
    const result: Insight[] = [];

    // Top empresa by valor
    const empresaMap = new Map<string, number>();
    data.forEach(r => empresaMap.set(r.empresa, (empresaMap.get(r.empresa) || 0) + r.valor_estoque));
    const topEmpresa = [...empresaMap.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topEmpresa) {
      const totalValor = data.reduce((s, r) => s + r.valor_estoque, 0);
      const pct = totalValor > 0 ? ((topEmpresa[1] / totalValor) * 100).toFixed(1) : '0';
      result.push({
        icon: Crown,
        title: 'Maior Valor de Estoque',
        description: `${topEmpresa[0].replace(/^CASPPER\s*/i, '')} concentra ${pct}% do valor total (${formatCurrency(topEmpresa[1])})`,
        type: 'highlight',
      });
    }

    // Curva ABC dominance
    const curvaMap = new Map<string, number>();
    data.forEach(r => curvaMap.set(r.classe_abc, (curvaMap.get(r.classe_abc) || 0) + 1));
    const topCurva = [...curvaMap.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topCurva) {
      const pct = ((topCurva[1] / data.length) * 100).toFixed(1);
      result.push({
        icon: Layers,
        title: 'Distribuição Dominante',
        description: `Curva ${topCurva[0]} representa ${pct}% dos itens (${formatNumber(topCurva[1])} produtos)`,
        type: 'info',
      });
    }

    // Items sem venda > 90 dias
    const now = new Date();
    const semVenda90 = data.filter(r => {
      if (!r.data_ultima_venda) return true;
      return Math.floor((now.getTime() - new Date(r.data_ultima_venda).getTime()) / 86400000) > 90;
    });
    if (semVenda90.length > 0) {
      const valorParado = semVenda90.reduce((s, r) => s + r.valor_estoque, 0);
      result.push({
        icon: AlertTriangle,
        title: 'Capital Parado',
        description: `${formatNumber(semVenda90.length)} itens sem venda há +90 dias, totalizando ${formatCurrency(valorParado)}`,
        type: 'warning',
      });
    }

    // Top marca by quantity
    const marcaMap = new Map<string, number>();
    data.forEach(r => marcaMap.set(r.marca, (marcaMap.get(r.marca) || 0) + r.quantidade_estoque));
    const topMarca = [...marcaMap.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topMarca) {
      result.push({
        icon: BarChart3,
        title: 'Marca com Maior Volume',
        description: `${topMarca[0]} possui ${formatNumber(topMarca[1])} unidades em estoque`,
        type: 'success',
      });
    }

    return result;
  }, [data]);

  if (insights.length === 0) return null;

  const typeStyles = {
    info: 'border-l-blue-500 bg-blue-500/5',
    warning: 'border-l-amber-500 bg-amber-500/5',
    success: 'border-l-emerald-500 bg-emerald-500/5',
    highlight: 'border-l-violet-500 bg-violet-500/5',
  };

  const iconStyles = {
    info: 'text-blue-500 bg-blue-500/10',
    warning: 'text-amber-500 bg-amber-500/10',
    success: 'text-emerald-500 bg-emerald-500/10',
    highlight: 'text-violet-500 bg-violet-500/10',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {insights.map((insight, i) => {
        const Icon = insight.icon;
        return (
          <Card
            key={i}
            className={cn(
              'border-l-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 animate-fade-in',
              typeStyles[insight.type]
            )}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', iconStyles[insight.type])}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold mb-0.5">{insight.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{insight.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
