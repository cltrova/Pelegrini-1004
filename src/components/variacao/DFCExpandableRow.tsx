import { useState } from 'react';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DFCLinha } from '@/types/variacao';
import { formatCurrency } from '@/utils/formatters';

interface DFCExpandableRowProps {
  linha: DFCLinha;
  index: number;
  getValueColor: (value: number | null) => string;
  getVariacaoColor: (value: number | null) => string;
  formatVariacao: (value: number | null) => string;
  defaultExpanded?: boolean;
}

export function DFCExpandableRow({
  linha,
  index,
  getValueColor,
  getVariacaoColor,
  formatVariacao,
  defaultExpanded = false,
}: DFCExpandableRowProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const hasDetails = linha.contasDetalhes && linha.contasDetalhes.length > 0;

  const applyValueColor = (value: number | null) => getValueColor(value);

  const renderDirecao = (direcao: 'aumento' | 'reducao' | null | undefined) => {
    if (!direcao) return null;
    if (direcao === 'aumento') {
      return <TrendingUp className="inline-block h-3 w-3 ml-1 text-emerald-400" />;
    }
    return <TrendingDown className="inline-block h-3 w-3 ml-1 text-red-400" />;
  };

  const renderVariacaoBadge = (value: number | null) => {
    if (value === null || value === undefined) return null;
    const isZero = value === 0;
    const isPos = value > 0;
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold tabular-nums font-mono border',
          isPos && 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
          !isPos && !isZero && 'bg-red-500/10 border-red-500/25 text-red-300',
          isZero && 'bg-muted/40 border-border/50 text-muted-foreground'
        )}
      >
        {isPos && <TrendingUp className="h-2.5 w-2.5" />}
        {!isPos && !isZero && <TrendingDown className="h-2.5 w-2.5" />}
        {isZero && <Minus className="h-2.5 w-2.5" />}
        {formatVariacao(value)}
      </span>
    );
  };

  return (
    <>
      <tr
        className={cn(
          'group border-b border-border/25 transition-colors',
          index % 2 === 0 ? 'bg-transparent' : 'bg-muted/[0.04]',
          hasDetails ? 'cursor-pointer hover:bg-primary/[0.06]' : 'hover:bg-muted/15'
        )}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >
        <td className="px-5 py-2 pl-8">
          <div className="flex items-center gap-2">
            {hasDetails ? (
              <span
                className={cn(
                  'flex items-center justify-center h-5 w-5 rounded-md border border-border/50 bg-background/40 text-muted-foreground transition-all',
                  'group-hover:text-primary group-hover:border-primary/40 group-hover:bg-primary/10'
                )}
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </span>
            ) : (
              <span className="w-5" />
            )}
            <span className="text-foreground/85 text-[12.5px] group-hover:text-foreground transition-colors">
              {linha.descricao}
            </span>
          </div>
        </td>
        <td className={cn('px-4 py-2 text-right tabular-nums font-mono text-[12.5px]', applyValueColor(linha.valorPeriodo1))}>
          <span className="inline-flex items-center">
            {linha.valorPeriodo1 !== null ? formatCurrency(linha.valorPeriodo1) : ''}
            {renderDirecao(linha.direcaoP1)}
          </span>
        </td>
        <td className={cn('px-4 py-2 text-right tabular-nums font-mono text-[12.5px]', applyValueColor(linha.valorPeriodo2))}>
          <span className="inline-flex items-center">
            {linha.valorPeriodo2 !== null ? formatCurrency(linha.valorPeriodo2) : ''}
            {renderDirecao(linha.direcaoP2)}
          </span>
        </td>
        <td className={cn('px-4 py-2 text-right tabular-nums font-mono text-[12.5px] font-medium', applyValueColor(linha.valorVariacao))}>
          {linha.valorVariacao !== null ? formatCurrency(linha.valorVariacao) : ''}
        </td>
        <td className="px-4 py-2 text-right">
          {renderVariacaoBadge(linha.variacao)}
        </td>
      </tr>

      {/* Detalhes */}
      {isExpanded && linha.contasDetalhes?.map((conta) => (
        <tr
          key={`${linha.id}-${conta.numConta}`}
          className="bg-primary/[0.03] border-b border-border/15 hover:bg-primary/[0.06] transition-colors"
        >
          <td className="px-5 py-1.5 pl-16">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted/40 border border-border/40 text-[10px] font-mono text-muted-foreground">
                {conta.numConta}
              </span>
              <span className="text-[11.5px] text-foreground/75">
                {conta.descricao}
              </span>
            </div>
          </td>
          <td className={cn('px-4 py-1.5 text-right tabular-nums font-mono text-[11.5px]', applyValueColor(conta.valorPeriodo1))}>
            {formatCurrency(conta.valorPeriodo1)}
          </td>
          <td className={cn('px-4 py-1.5 text-right tabular-nums font-mono text-[11.5px]', applyValueColor(conta.valorPeriodo2))}>
            {formatCurrency(conta.valorPeriodo2)}
          </td>
          <td className={cn('px-4 py-1.5 text-right tabular-nums font-mono text-[11.5px]', applyValueColor(conta.valorVariacao))}>
            {formatCurrency(conta.valorVariacao)}
          </td>
          <td className={cn('px-4 py-1.5 text-right tabular-nums font-mono text-[11px]', getVariacaoColor(conta.variacao))}>
            {formatVariacao(conta.variacao)}
          </td>
        </tr>
      ))}
    </>
  );
}
