import { formatCurrency } from '@/utils/formatters';

interface ExtraRow {
  name: string;
  value: number;
  color?: string;
  dashed?: boolean;
}

interface Props {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  labelMap?: Record<string, string>;
  valueFormatter?: (v: number) => string;
  extraRows?: ExtraRow[];
}

interface TooltipEntry {
  name?: string;
  dataKey?: string;
  value: number;
  color?: string;
  fill?: string;
}

export function PremiumChartTooltip({
  active,
  payload,
  label,
  labelMap,
  valueFormatter = (v) => formatCurrency(v),
  extraRows,
}: Props) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="premium-tooltip animate-in fade-in-0 zoom-in-95 duration-150">
      {label && (
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, idx) => {
          const key = entry.name ?? entry.dataKey;
          const displayName = key ? (labelMap?.[key] ?? key) : '';
          return (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  background: entry.color || entry.fill || 'hsl(var(--primary))',
                }}
              />
              <span className="text-muted-foreground capitalize">{displayName}</span>
              <span className="ml-auto font-bold mono-value text-foreground">
                {valueFormatter(entry.value)}
              </span>
            </div>
          );
        })}
        {extraRows?.map((row, idx) => {
          const color = row.color || 'hsl(var(--chart-4))';
          return (
            <div key={`extra-${idx}`} className="flex items-center gap-2 text-xs pt-1 mt-1 border-t border-border/40">
              <span
                className="w-3 h-0 shrink-0 border-t-2"
                style={{
                  borderColor: color,
                  borderStyle: row.dashed ? 'dashed' : 'solid',
                }}
              />
              <span className="text-muted-foreground">{row.name}</span>
              <span className="ml-auto font-bold mono-value text-foreground">
                {valueFormatter(row.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
