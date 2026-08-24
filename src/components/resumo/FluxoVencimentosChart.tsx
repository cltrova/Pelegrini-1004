import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { DuplicataAgregada } from '@/types/resumo';
import { formatCompactNumber, formatCurrency } from '@/utils/formatters';

interface Props {
  duplicatas: DuplicataAgregada[];
}

export function FluxoVencimentosChart({ duplicatas }: Props) {
  const data = useMemo(() => {
    const map = new Map<string, { mes: string; aVencer: number; vencido: number }>();
    for (const d of duplicatas) {
      if (d.status === 'PAGO') continue;
      if (!d.dataVencimento) continue;
      const dt = new Date(d.dataVencimento);
      if (isNaN(dt.getTime())) continue;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const cur = map.get(key) ?? { mes: key, aVencer: 0, vencido: 0 };
      if (d.situacao === 'vencida') cur.vencido += d.valor;
      else cur.aVencer += d.valor;
      map.set(key, cur);
    }
    return [...map.values()]
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((r) => {
        const [y, m] = r.mes.split('-');
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return { ...r, label: `${meses[parseInt(m) - 1]}/${y.slice(2)}` };
      });
  }, [duplicatas]);

  return (
    <Card className="p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">Fluxo de Vencimentos</h3>
        <p className="text-xs text-muted-foreground">Valores a receber por mês de vencimento</p>
      </div>
      <div className="h-[260px]">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Sem dados de vencimento.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="vencGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="vencGradBad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(0 80% 50%)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(0 80% 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickFormatter={(v) => formatCompactNumber(v)} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                formatter={(value: number, name: string) => [formatCurrency(value), name === 'aVencer' ? 'A vencer' : 'Vencido']}
              />
              <Area type="monotone" dataKey="vencido" stackId="1" stroke="hsl(0 80% 50%)" fill="url(#vencGradBad)" />
              <Area type="monotone" dataKey="aVencer" stackId="1" stroke="hsl(var(--primary))" fill="url(#vencGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
