import { formatCurrency, formatPercent } from '@/utils/formatters';
import { getRankingVendedoresChartLayout, PELEGRINI_RANKING_PLOT } from './rankingVendedoresChartLayout';
import { cn } from '@/lib/utils';

type Modo = 'faturamento' | 'meta';

interface RankingVendedorLabelRow {
  codigo: unknown;
  nome: string;
  mes: number;
  pctMeta: number;
  rank?: number;
}

interface Props {
  data: RankingVendedorLabelRow[];
  modo: Modo;
  variant?: 'default' | 'pelegriniBlue';
  onSelect?: (index: number) => void;
  onHighlight?: (key: string | null) => void;
}

export function RankingVendedoresLabels({ data, modo, variant, onSelect, onHighlight }: Props) {
  const layout = getRankingVendedoresChartLayout(data.length);
  const isPelegrini = variant === 'pelegriniBlue';
  const Label = onSelect ? 'button' : 'div';

  return (
    <div
      className={cn(
        "grid items-start gap-0",
        isPelegrini ? "min-h-9 shrink-0 pt-0.5" : "min-h-[104px] pl-[68px] pr-4 pt-2",
      )}
      style={{
        gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
        ...(isPelegrini && { paddingLeft: PELEGRINI_RANKING_PLOT.left, paddingRight: PELEGRINI_RANKING_PLOT.right }),
      }}
    >
      {data.map((row, index) => {
        const valueLabel = modo === 'meta'
          ? formatPercent(row.pctMeta || 0)
          : formatCurrency(row.mes || 0);

        return (
          <Label
            key={String(row.codigo ?? index)}
            type={onSelect ? 'button' : undefined}
            aria-label={onSelect ? `Abrir detalhes de ${row.nome}, ${valueLabel}` : undefined}
            title={row.nome}
            className={cn('min-w-0 text-center', onSelect && 'dashboard-ranking-label rounded-sm px-0.5 py-0.5 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring')}
            onClick={onSelect ? () => onSelect(index) : undefined}
            onMouseEnter={() => onHighlight?.(String(row.codigo))}
            onMouseLeave={() => onHighlight?.(null)}
            onFocus={() => onHighlight?.(String(row.codigo))}
            onBlur={() => onHighlight?.(null)}
          >
            <span
              className={cn(
                "block min-w-0 truncate text-muted-foreground",
                isPelegrini && "leading-tight",
              )}
              style={{
                fontSize: isPelegrini ? 11 : layout.sellerFontSize,
                fontWeight: isPelegrini ? 700 : layout.sellerFontWeight,
              }}
            >
              {row.rank ?? index + 1}. {row.nome}
            </span>
            <span
              aria-label={valueLabel}
              className={cn(
                "block min-w-0 font-mono text-foreground",
                modo === 'faturamento' ? 'whitespace-nowrap' : 'truncate',
                isPelegrini ? "mt-0.5" : "mt-1",
              )}
              title={valueLabel}
              style={{
                fontSize: isPelegrini ? 13 : layout.valueFontSize,
                fontWeight: isPelegrini ? 750 : layout.valueFontWeight,
              }}
            >
              {valueLabel}
            </span>
          </Label>
        );
      })}
    </div>
  );
}
