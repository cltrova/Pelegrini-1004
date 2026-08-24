import { useEffect, useMemo, useState } from 'react';
import { Store } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { cn } from '@/lib/utils';

interface FilialDatum {
  name: string;
  fullName: string;
  value: number;
  pedidos: number;
  color: string;
}

interface Props {
  data: FilialDatum[];
  variacaoMesAnterior?: number;
}

// Remove asteriscos, espaços duplicados e aplica capitalização amigável.
function cleanFilialName(raw: string): string {
  if (!raw) return 'Sem Filial';
  const cleaned = raw
    .replace(/\*+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Sem Filial';
  // Capitalização amigável (Title Case), preservando siglas curtas (<= 3 letras) em maiúsculo.
  return cleaned
    .toLowerCase()
    .split(' ')
    .map((w) => {
      if (!w) return w;
      if (w.length <= 3 && /^[a-z]+$/.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

export function FaturamentoPorFilialPremium({ data, variacaoMesAnterior }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, [data]);

  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);
  const totalPedidos = useMemo(() => data.reduce((s, d) => s + d.pedidos, 0), [data]);
  const maxValue = useMemo(() => data.reduce((m, d) => (d.value > m ? d.value : m), 0), [data]);
  const sorted = useMemo(() => [...data].sort((a, b) => b.value - a.value), [data]);

  const cardStyle: React.CSSProperties = {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 14,
  };

  if (!data.length) {
    return (
      <div style={cardStyle} className="p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Store className="h-4 w-4" /> Faturamento por Filial
        </div>
        <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
          Sem dados de filial no período.
        </div>
      </div>
    );
  }

  const variacao = variacaoMesAnterior;
  const variacaoPositiva = variacao !== undefined && variacao >= 0;

  return (
    <div style={cardStyle} className="p-5">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 mb-5">
        <Store className="h-4 w-4 text-muted-foreground" />
        <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-light">
          Faturamento por Filial
        </span>
      </div>

      {/* Totalizadores do topo */}
      <div className="grid grid-cols-3 gap-3 mb-6 pb-5 border-b border-white/[0.06]">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-light mb-2">
            Total faturado
          </p>
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold tabular-nums text-foreground leading-tight break-words">
              {formatCurrency(total, true)}
            </p>
            {variacao !== undefined && (
              <span
                className={cn(
                  'self-start text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded',
                  variacaoPositiva
                    ? 'text-emerald-400 bg-emerald-400/10'
                    : 'text-rose-400 bg-rose-400/10'
                )}
              >
                {variacaoPositiva ? '▲' : '▼'} {formatPercent(Math.abs(variacao))}
              </span>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-light mb-2">
            Filiais ativas
          </p>
          <p className="text-lg font-semibold tabular-nums text-foreground leading-tight">
            {data.length}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-light mb-2">
            Total de pedidos
          </p>
          <p className="text-lg font-semibold tabular-nums text-foreground leading-tight">
            {totalPedidos.toLocaleString('pt-BR')}
          </p>
        </div>
      </div>

      {/* Lista de filiais */}
      <div className="flex flex-col gap-3">
        {sorted.map((d, i) => {
          const perc = total > 0 ? (d.value / total) * 100 : 0;
          const barPerc = maxValue > 0 ? (d.value / maxValue) * 100 : 0;
          const displayName = cleanFilialName(d.fullName || d.name);
          return (
            <div key={`${d.fullName || d.name}-${i}`} className="group">
              <div className="flex items-center gap-3">
                <span
                  className="text-[10px] tabular-nums font-medium w-5 text-center shrink-0"
                  style={{ color: d.color }}
                >
                  {i + 1}
                </span>
                <span
                  className="text-sm font-medium flex-1 min-w-0 text-foreground/90 truncate"
                  title={displayName}
                >
                  {displayName}
                </span>
                <span className="text-sm font-semibold tabular-nums text-foreground whitespace-nowrap">
                  {formatCurrency(d.value, true)}
                </span>
                <span
                  className="text-[10px] font-medium tabular-nums w-12 text-right text-muted-foreground whitespace-nowrap shrink-0"
                >
                  {formatPercent(perc)}
                </span>
              </div>
              <div
                className="mt-1.5 h-[3px] rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: mounted ? `${barPerc}%` : '0%',
                    background: d.color,
                    opacity: 0.85,
                    transition: `width 900ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 60}ms`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
