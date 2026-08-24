import { useMemo } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ResultadoComparacao } from '@/utils/autenticacaoComparator';

interface Props {
  resultados: ResultadoComparacao[];
}

const COLORS = {
  autenticado: 'hsl(var(--success))',
  divergente: 'hsl(var(--warning))',
  nao_encontrado: 'hsl(var(--destructive))',
  extra_sistema: 'hsl(var(--primary))',
};

const LABELS = {
  autenticado: 'Autenticado',
  divergente: 'Divergente',
  nao_encontrado: 'Não encontrado',
  extra_sistema: 'Extra sistema',
};

export function AuthDashboard({ resultados }: Props) {
  const { pizza, topDivergencias, taxa, total } = useMemo(() => {
    const counts: Record<string, number> = { autenticado: 0, divergente: 0, nao_encontrado: 0, extra_sistema: 0 };
    const divMap = new Map<string, number>();
    for (const r of resultados) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
      if (r.status === 'divergente') {
        for (const d of r.divergencias) {
          const tipo = d.startsWith('Valor') || d.startsWith('Líquido')
            ? 'Valor'
            : d.startsWith('Cliente')
              ? 'Cliente'
              : d.startsWith('Venda')
                ? 'Venda'
                : d.startsWith('Devolução')
                  ? 'Devolução'
                  : 'Outros';
          divMap.set(tipo, (divMap.get(tipo) ?? 0) + 1);
        }
      }
    }
    const total = resultados.length;
    const pizza = Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: LABELS[k as keyof typeof LABELS], value: v, key: k }));
    const topDivergencias = Array.from(divMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const taxa = total > 0 ? (counts.autenticado / total) * 100 : 0;
    return { pizza, topDivergencias, taxa, total };
  }, [resultados]);

  if (!resultados.length) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm animate-fade-in">
        <h3 className="text-sm font-semibold text-foreground mb-1">Distribuição por status</h3>
        <p className="text-xs text-muted-foreground mb-3">{total} registros</p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pizza} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                {pizza.map((d) => (
                  <Cell key={d.key} fill={COLORS[d.key as keyof typeof COLORS]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-3 justify-center mt-2">
          {pizza.map((d) => (
            <div key={d.key} className="flex items-center gap-1.5 text-xs">
              <span className="h-2 w-2 rounded-full" style={{ background: COLORS[d.key as keyof typeof COLORS] }} />
              <span className="text-muted-foreground">{d.name}</span>
              <span className="font-semibold text-foreground">{d.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm animate-fade-in">
        <h3 className="text-sm font-semibold text-foreground mb-1">Tipos de divergência</h3>
        <p className="text-xs text-muted-foreground mb-3">
          {topDivergencias.reduce((a, b) => a + b.value, 0)} ocorrências
        </p>
        <div className="h-48">
          {topDivergencias.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topDivergencias} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" fill="hsl(var(--warning))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              Sem divergências
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm animate-fade-in flex flex-col">
        <h3 className="text-sm font-semibold text-foreground mb-1">Taxa de sucesso</h3>
        <p className="text-xs text-muted-foreground mb-3">Pedidos autenticados sobre o total</p>
        <div className="flex-1 flex items-center justify-center">
          <div className="relative h-40 w-40">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="hsl(var(--success))"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(taxa / 100) * 264} 264`}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold tabular-nums text-foreground">{taxa.toFixed(1)}%</span>
              <span className="text-xs text-muted-foreground">de sucesso</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
