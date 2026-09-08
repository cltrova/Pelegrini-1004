import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { DuplicataAgregada } from '@/types/resumo';
import { formatCompactNumber, formatCurrency } from '@/utils/formatters';

interface Props {
  duplicatas: DuplicataAgregada[];
}

interface AgingBucket {
  name: string;
  valor: number;
  qtd: number;
  color: string;
}

type AgingTooltipPayload = {
  payload?: AgingBucket;
};

export function AgingChart({ duplicatas }: Props) {
  const buckets = useMemo<AgingBucket[]>(() => {
    const def: AgingBucket[] = [
      { name: 'A vencer', valor: 0, qtd: 0, color: 'hsl(var(--primary))' },
      { name: '1-15 dias', valor: 0, qtd: 0, color: 'hsl(48 96% 53%)' },
      { name: '16-30 dias', valor: 0, qtd: 0, color: 'hsl(32 95% 50%)' },
      { name: '31-60 dias', valor: 0, qtd: 0, color: 'hsl(20 90% 50%)' },
      { name: '61-90 dias', valor: 0, qtd: 0, color: 'hsl(8 85% 50%)' },
      { name: '90+ dias', valor: 0, qtd: 0, color: 'hsl(0 80% 45%)' },
    ];
    for (const d of duplicatas) {
      if (d.status === 'PAGO') continue;
      let idx = 0;
      const dias = d.diasAtraso;
      if (d.situacao === 'a_vencer' || d.situacao === 'vence_hoje') idx = 0;
      else if (dias <= 15) idx = 1;
      else if (dias <= 30) idx = 2;
      else if (dias <= 60) idx = 3;
      else if (dias <= 90) idx = 4;
      else idx = 5;
      def[idx].valor += d.valor;
      def[idx].qtd += 1;
    }
    return def;
  }, [duplicatas]);

  return (
    <Card className="p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">Aging — Idade da Dívida</h3>
        <p className="text-xs text-muted-foreground">Distribuição do valor em aberto por faixa de atraso</p>
      </div>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tickFormatter={(v) => formatCompactNumber(v)} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              formatter={(value: number, _name: string, item: AgingTooltipPayload) => [
                formatCurrency(value),
                `${item.payload?.qtd ?? 0} duplicatas`,
              ]}
              labelStyle={{ fontWeight: 600 }}
            />
            <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
              {buckets.map((b) => <Cell key={b.name} fill={b.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
