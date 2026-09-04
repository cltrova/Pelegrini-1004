import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TrendingDown, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { GiroRecord } from '@/types/estoque';
import { analyzeSalesTrends, getDecliningProducts, ProductTrend } from '@/utils/salesTrendAnalysis';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

interface Props {
  giroData: GiroRecord[];
}

function MiniSparkline({ data }: { data: { month: string; qty: number }[] }) {
  return (
    <div className="h-10 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Area type="monotone" dataKey="qty" stroke="#ef4444" fill="#ef4444" fillOpacity={0.08} strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EstoqueTrendAlerts({ giroData }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const declining = useMemo(() => {
    const trends = analyzeSalesTrends(giroData, 3);
    return getDecliningProducts(trends).slice(0, 12);
  }, [giroData]);

  if (declining.length === 0) return null;

  const totalValorRisco = declining.reduce((sum, t) => sum + t.valor_estoque, 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-red-500/20 bg-background shadow-none">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <div className="h-8 w-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                </div>
                <div>
                  <CardTitle className="text-sm">Alerta: Produtos com Vendas em Queda</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {declining.length} produtos com tendência de declínio · Capital em risco: <span className="text-red-400 font-medium">{formatCurrency(totalValorRisco)}</span>
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs text-red-400 border-red-500/30 bg-red-500/10">
                {declining.length} alertas
              </Badge>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {declining.map(item => (
                <div
                  key={`${item.empresa}-${item.cod_produto}`}
                  className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-muted-foreground font-mono">Cód: {item.cod_produto}</p>
                      <p className="text-xs font-medium truncate" title={item.produto}>
                        {item.produto}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{item.marca} · {item.empresa.replace(/^CASPPER\s*/i, '')}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30 bg-red-500/10 shrink-0">
                      <TrendingDown className="h-3 w-3 mr-0.5" />
                      -{item.dropPercent.toFixed(0)}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <MiniSparkline data={item.monthlySales} />
                    <div className="text-right">
                      <p className="text-xs font-mono font-medium">{formatCurrency(item.valor_estoque)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Pico: {item.peakSales} → Atual: {item.lastMonthSales}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
