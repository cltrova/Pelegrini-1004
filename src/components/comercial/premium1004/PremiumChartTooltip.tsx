import { formatCurrency, formatPercent } from '@/utils/formatters';

interface TooltipEntry {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
  payload?: any;
}

interface PremiumChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: any;
  /** Prefixo do label (ex: 'Dia', 'Mês'). */
  labelPrefix?: string;
  /** Formatação por dataKey — padrão: currency. */
  format?: (value: number, name?: string) => string;
  /** Linha auxiliar de contexto (ex: vendedor, categoria). */
  contextLine?: string;
}

/**
 * Tooltip padrão dos gráficos do Comercial 1004.
 * Estilo alinhado ao "Resultado acumulado vs meta" da Visão Geral.
 */
export function PremiumChartTooltip({
  active,
  payload,
  label,
  labelPrefix,
  format,
  contextLine,
}: PremiumChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const fmt = (v: number, name?: string) => {
    if (v == null || Number.isNaN(v)) return '—';
    if (format) return format(v, name);
    return formatCurrency(v);
  };

  return (
    <div
      className="rounded-md border border-border bg-card px-3 py-2 shadow-lg text-xs"
      style={{ minWidth: 160 }}
    >
      {label != null && (
        <div className="font-semibold text-foreground mb-1">
          {labelPrefix ? `${labelPrefix} ${label}` : String(label)}
        </div>
      )}
      {contextLine && (
        <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">
          {contextLine}
        </div>
      )}
      <div className="space-y-0.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: p.color || 'currentColor' }}
            />
            <span className="text-muted-foreground flex-1 truncate">
              {p.name || p.dataKey}
            </span>
            <span className="font-mono font-semibold text-foreground">
              {typeof p.value === 'number' ? fmt(p.value, p.name) : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const premiumTooltipCommonProps = {
  cursor: { fill: 'hsl(var(--muted) / 0.35)' },
  contentStyle: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    fontSize: 12,
  },
} as const;

/** Formatadores prontos para uso em Tooltip.formatter */
export const currencyFormatter = (v: number) => formatCurrency(v);
export const percentFormatter = (v: number) => formatPercent(v);
