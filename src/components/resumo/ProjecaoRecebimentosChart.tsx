import { Card } from '@/components/ui/card';
import { ProjecaoBucket } from '@/types/resumo';
import { formatCurrency, formatCompactNumber, formatInteger } from '@/utils/formatters';
import { CalendarClock } from 'lucide-react';

interface Props {
  buckets: ProjecaoBucket[];
}

export function ProjecaoRecebimentosChart({ buckets }: Props) {
  const max = Math.max(1, ...buckets.map((b) => b.valor));
  const total = buckets.reduce((s, b) => s + b.valor, 0);

  // Sparkline SVG (linha + área)
  const W = 600;
  const H = 80;
  const PAD_X = 8;
  const PAD_Y = 6;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;
  const points = buckets.map((b, i) => {
    const x = PAD_X + (buckets.length === 1 ? innerW / 2 : (i / (buckets.length - 1)) * innerW);
    const y = PAD_Y + innerH - (b.valor / max) * innerH;
    return { x, y, b };
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(PAD_Y + innerH).toFixed(2)} L ${points[0].x.toFixed(2)} ${(PAD_Y + innerH).toFixed(2)} Z`;

  return (
    <Card className="p-5">
      <div className="flex items-end justify-between mb-3 border-b border-border pb-3">
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
            <CalendarClock className="h-3.5 w-3.5" />
            Projeção de Recebimentos
          </h3>
          <p className="text-sm text-foreground mt-1.5">Quanto entra nos próximos dias</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total projetado</div>
          <div className="font-mono text-lg font-bold text-foreground tabular-nums">
            {formatCurrency(total)}
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-20 block"
        role="img"
        aria-label="Tendência de recebimentos por janela de dias"
      >
        <defs>
          <linearGradient id="proj-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#proj-area)" />
        <path
          d={linePath}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p) => (
          <circle
            key={p.b.label}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill="hsl(var(--background))"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
          />
        ))}
      </svg>

      <div className="grid grid-cols-6 gap-2 mt-2 pt-3 border-t border-border/60">
        {buckets.map((b) => (
          <div key={b.label} className="text-center">
            <div className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">
              {b.label}
            </div>
            <div className="text-xs font-mono font-semibold text-foreground tabular-nums mt-0.5">
              {formatCompactNumber(b.valor)}
            </div>
            <div className="text-[10px] text-muted-foreground/70 font-mono">
              {formatInteger(b.quantidade)} tít
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
