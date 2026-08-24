import { CheckCircle2, AlertTriangle, XCircle, BarChart3 } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface Totals {
  autenticado: number;
  divergente: number;
  nao_encontrado: number;
  extra_sistema: number;
}

interface Props {
  totals: Totals;
  trends?: { autenticado: number[]; divergente: number[]; nao_encontrado: number[]; total: number[] };
}

const CARDS = [
  { key: 'autenticado', label: 'Autenticados', Icon: CheckCircle2, tone: 'success' },
  { key: 'divergente', label: 'Divergentes', Icon: AlertTriangle, tone: 'warning' },
  { key: 'nao_encontrado', label: 'Não encontrados', Icon: XCircle, tone: 'destructive' },
  { key: 'total', label: 'Total analisado', Icon: BarChart3, tone: 'primary' },
] as const;

const TONE: Record<string, { bg: string; fg: string; stroke: string }> = {
  success: { bg: 'bg-success/10', fg: 'text-success', stroke: 'hsl(var(--success))' },
  warning: { bg: 'bg-warning/10', fg: 'text-warning', stroke: 'hsl(var(--warning))' },
  destructive: { bg: 'bg-destructive/10', fg: 'text-destructive', stroke: 'hsl(var(--destructive))' },
  primary: { bg: 'bg-primary/10', fg: 'text-primary', stroke: 'hsl(var(--primary))' },
};

export function AuthKpiCards({ totals, trends }: Props) {
  const total = totals.autenticado + totals.divergente + totals.nao_encontrado + totals.extra_sistema;
  const values: Record<string, number> = {
    autenticado: totals.autenticado,
    divergente: totals.divergente,
    nao_encontrado: totals.nao_encontrado,
    total,
  };
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {CARDS.map((c, idx) => {
        const tone = TONE[c.tone];
        const v = values[c.key];
        const trendData = (trends?.[c.key as keyof typeof trends] ?? []).map((y, i) => ({ i, y }));
        const percentLabel = c.key === 'total' ? `${total} registros` : `${pct(v)}% do total`;
        return (
          <div
            key={c.key}
            className="group rounded-2xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all animate-fade-in"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{c.label}</p>
                <p className="text-3xl font-bold tabular-nums text-foreground">{v.toLocaleString('pt-BR')}</p>
                <p className={cn('text-xs font-medium', tone.fg)}>{percentLabel}</p>
              </div>
              <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', tone.bg, tone.fg)}>
                <c.Icon className="h-5 w-5" />
              </div>
            </div>
            {trendData.length > 1 && (
              <div className="h-10 mt-3 -mx-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <Line type="monotone" dataKey="y" stroke={tone.stroke} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
