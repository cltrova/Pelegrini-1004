import { formatCurrency, formatPercent } from '@/utils/formatters';
import { getRankingVendedoresChartLayout } from './rankingVendedoresChartLayout';
import { cn } from '@/lib/utils';

type Modo = 'faturamento' | 'meta';

interface RankingVendedorLabelRow {
  codigo: unknown;
  nome: string;
  mes: number;
  pctMeta: number;
}

interface Props {
  data: RankingVendedorLabelRow[];
  modo: Modo;
  variant?: 'default' | 'pelegriniBlue';
}

export function RankingVendedoresLabels({ data, modo, variant }: Props) {
  const layout = getRankingVendedoresChartLayout(data.length);
  const isPelegrini = variant === 'pelegriniBlue';

  return (
    <div
      className={cn(
        "grid items-start gap-0",
        isPelegrini ? "min-h-[48px] pl-[48px] pr-2 pt-1" : "min-h-[104px] pl-[68px] pr-4 pt-2",
      )}
      style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
    >
      {data.map((row, index) => {
        const valueLabel = modo === 'meta'
          ? formatPercent(row.pctMeta || 0)
          : formatCurrency(row.mes || 0);

        return (
          <div key={String(row.codigo ?? index)} className="min-w-0 text-center" title={row.nome}>
            <span
              className={cn("block break-words text-muted-foreground", isPelegrini && "leading-tight")}
              style={{
                fontSize: isPelegrini ? 11 : layout.sellerFontSize,
                fontWeight: isPelegrini ? 700 : layout.sellerFontWeight,
              }}
            >
              {index + 1}. {row.nome}
            </span>
            <span
              className={cn("block whitespace-nowrap font-mono text-foreground", isPelegrini ? "mt-0.5" : "mt-1")}
              style={{
                fontSize: isPelegrini ? 13 : layout.valueFontSize,
                fontWeight: isPelegrini ? 750 : layout.valueFontWeight,
              }}
            >
              {valueLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}
