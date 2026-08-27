import { formatCurrency, formatPercent } from '@/utils/formatters';
import { getRankingVendedoresChartLayout } from './rankingVendedoresChartLayout';

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

export function RankingVendedoresLabels({ data, modo }: Props) {
  const layout = getRankingVendedoresChartLayout(data.length);

  return (
    <div
      className="grid min-h-[104px] items-start gap-0 pl-[68px] pr-4 pt-2"
      style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
    >
      {data.map((row, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        const shortName = row.nome.length > 14 ? `${row.nome.slice(0, 13)}…` : row.nome;
        const valueLabel = modo === 'meta'
          ? formatPercent(row.pctMeta || 0)
          : formatCurrency(row.mes || 0);

        return (
          <div key={String(row.codigo ?? index)} className="min-w-0 text-center" title={row.nome}>
            <span
              className="block truncate text-muted-foreground"
              style={{ fontSize: layout.sellerFontSize, fontWeight: layout.sellerFontWeight }}
            >
              {medal ? `${medal} ` : ''}{shortName}
            </span>
            <span
              className="mt-2 block whitespace-nowrap font-mono text-foreground"
              style={{ fontSize: layout.valueFontSize, fontWeight: layout.valueFontWeight }}
            >
              {valueLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}
