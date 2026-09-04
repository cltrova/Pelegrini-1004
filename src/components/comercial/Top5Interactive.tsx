import { useState } from 'react';
import { Crown, Medal, Award, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/utils/formatters';

interface Top5Item {
  name: string;
  value: number;
  fill: string;
}

interface Top5InteractiveProps {
  data: Top5Item[];
  percentualTotal: number;
}

export function Top5Interactive({ data, percentualTotal }: Top5InteractiveProps) {
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);

  const totalTop5 = data.reduce((acc, c) => acc + c.value, 0);
  const activeIdx = hovered ?? selected;
  const active = data[activeIdx];
  const activeShare = totalTop5 > 0 ? (active?.value / totalTop5) * 100 : 0;

  // Pódio: 2º à esquerda, 1º centro, 3º direita
  const maxValue = data[0]?.value || 1;
  const podiumOrder = [
    { idx: 1, heightPct: 70, icon: Medal, label: '2º', position: 'left' },
    { idx: 0, heightPct: 100, icon: Crown, label: '1º', position: 'center' },
    { idx: 2, heightPct: 50, icon: Award, label: '3º', position: 'right' },
  ];

  const others = data.slice(3);

  return (
    <div className="flex flex-col gap-4">
      {/* Pódio */}
      <div className="relative px-2 pt-2">
        <div className="grid grid-cols-[1fr_1.2fr_1fr] gap-3 items-end">
          {podiumOrder.map(({ idx, heightPct, icon: Icon, label }) => {
            const item = data[idx];
            if (!item) return null;
            const isActive = activeIdx === idx;
            const isFirst = idx === 0;
            const barHeight = Math.round((heightPct / 100) * 180);

            return (
              <button
                key={idx}
                onClick={() => setSelected(idx)}
                onMouseEnter={() => setHovered(idx)}
                onMouseLeave={() => setHovered(null)}
                className="group relative flex flex-col items-center justify-end transition-opacity duration-300 outline-none"
              >
                {/* Nome + valor acima do pódio */}
                <div
                  className={cn(
                    'mb-2 text-center transition-opacity duration-300 w-full px-1',
                    isActive ? 'opacity-100' : 'opacity-80 group-hover:opacity-100',
                  )}
                >
                  <Icon
                    className={cn('mx-auto mb-1', isFirst ? 'h-5 w-5' : 'h-4 w-4')}
                    style={{ color: item.fill }}
                  />
                  <p className="text-[11px] font-semibold text-foreground truncate leading-tight">
                    {item.name}
                  </p>
                  <p className={cn('mono-value font-bold mt-0.5', isFirst ? 'text-sm' : 'text-xs')} style={{ color: item.fill }}>
                    {formatCurrency(item.value)}
                  </p>
                </div>

                {/* Bloco do pódio */}
                <div
                  className={cn(
                    'w-full rounded-t-lg relative overflow-hidden border border-b-0 transition-colors duration-300',
                    isActive ? 'border-primary/35 bg-primary/15' : 'border-border/40 bg-muted/30',
                  )}
                  style={{
                    height: `${barHeight}px`,
                  }}
                >
                  {/* Brilho topo */}
                  <div
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ backgroundColor: item.fill }}
                  />
                  {/* Label de posição */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span
                      className={cn(
                        'font-bold italic tabular-nums tracking-tight',
                        isFirst ? 'text-4xl' : 'text-2xl',
                      )}
                      style={{ color: item.fill }}
                    >
                      {label}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {/* Base do pódio */}
        <div className="h-px w-full bg-border/70" />
      </div>

      {/* Resumo do destaque */}
      <div
        className="rounded-lg border border-border/60 bg-card/60 p-3 transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Em destaque · #{String(activeIdx + 1).padStart(2, '0')}
            </p>
            <p className="text-sm font-semibold text-foreground truncate mt-0.5">
              {active?.name}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="flex items-center gap-1 justify-end text-[10px] uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="h-3 w-3" /> Share Top 5
            </div>
            <p className="text-lg font-bold mono-value" style={{ color: active?.fill }}>
              {formatPercent(activeShare)}
            </p>
          </div>
        </div>
      </div>

      {/* 4º e 5º compactos */}
      {others.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-1">
            Demais posições
          </p>
          {others.map((item, i) => {
            const idx = i + 3;
            const isActive = activeIdx === idx;
            const share = totalTop5 > 0 ? (item.value / totalTop5) * 100 : 0;
            return (
              <button
                key={idx}
                onClick={() => setSelected(idx)}
                onMouseEnter={() => setHovered(idx)}
                onMouseLeave={() => setHovered(null)}
                className={cn(
                  'w-full flex items-center gap-3 p-2 rounded-md border transition-colors text-left',
                  isActive
                    ? 'border-primary/35 bg-primary/10'
                    : 'border-border/40 bg-card/30 hover:bg-card/60',
                )}
              >
                <span
                  className="text-xs font-bold italic tabular-nums w-6 text-center"
                  style={{ color: item.fill }}
                >
                  #{idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                  <div className="mt-1 h-1 w-full bg-muted/40 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${share}%`, background: item.fill }}
                    />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs mono-value font-semibold text-foreground">
                    {formatCurrency(item.value)}
                  </p>
                  <p className="text-[10px] mono-value" style={{ color: item.fill }}>
                    {formatPercent(share)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex justify-between text-[10px] text-muted-foreground px-1">
        <span>Top 5 representa</span>
        <span className="font-semibold text-foreground mono-value">
          {formatPercent(percentualTotal)} do faturamento total
        </span>
      </div>
    </div>
  );
}
