import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FluxoCaixaGrupo, FluxoCaixaTotais } from '@/types/variacao';
import { formatCurrency } from '@/utils/formatters';
import { Button } from '@/components/ui/button';

interface VariacaoTableProps {
  data: FluxoCaixaGrupo[];
  totais: FluxoCaixaTotais;
  ano: string;
}

export function VariacaoTable({ data, totais, ano }: VariacaoTableProps) {
  const getValueColor = (value: number) => {
    if (value > 0) return 'text-emerald-600 dark:text-emerald-400';
    if (value < 0) return 'text-red-600 dark:text-red-400';
    return 'text-foreground';
  };

  const getVariationBg = (value: number) => {
    if (value > 0) return 'bg-emerald-50 dark:bg-emerald-900/20';
    if (value < 0) return 'bg-red-50 dark:bg-red-900/20';
    return '';
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header com ações */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <h3 className="font-semibold text-foreground">Demonstração dos Fluxos de Caixa</h3>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-primary/5">
              <th className="text-left px-4 py-3 text-xs font-semibold text-primary uppercase tracking-wider" colSpan={4}>
                Ano {ano}
              </th>
            </tr>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[350px]">
                Grupo
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-40">
                Saldo Inicial
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-40">
                Saldo Final
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-40">
                Valor Variação
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((grupo, index) => (
              <tr
                key={grupo.grupo}
                className={cn(
                  'border-b border-border/50 hover:bg-muted/30 transition-colors',
                  index % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1 h-6 rounded-full bg-primary/50" />
                    <span className="font-medium text-foreground">{grupo.grupo}</span>
                  </div>
                </td>
                <td className={cn(
                  'px-4 py-3 text-right font-mono font-medium',
                  getValueColor(grupo.saldoInicial)
                )}>
                  {formatCurrency(grupo.saldoInicial)}
                </td>
                <td className={cn(
                  'px-4 py-3 text-right font-mono font-medium',
                  getValueColor(grupo.saldoFinal)
                )}>
                  {formatCurrency(grupo.saldoFinal)}
                </td>
                <td className={cn(
                  'px-4 py-3 text-right font-mono font-medium',
                  getVariationBg(grupo.valorVariacao),
                  getValueColor(grupo.valorVariacao)
                )}>
                  {formatCurrency(grupo.valorVariacao, true)}
                </td>
              </tr>
            ))}

            {/* Linha de total */}
            <tr className="border-t-2 border-primary bg-primary/10">
              <td className="px-4 py-3">
                <span className="font-bold text-foreground">Total</span>
              </td>
              <td className={cn(
                'px-4 py-3 text-right font-mono font-bold',
                getValueColor(totais.saldoInicial)
              )}>
                {formatCurrency(totais.saldoInicial)}
              </td>
              <td className={cn(
                'px-4 py-3 text-right font-mono font-bold',
                getValueColor(totais.saldoFinal)
              )}>
                {formatCurrency(totais.saldoFinal)}
              </td>
              <td className={cn(
                'px-4 py-3 text-right font-mono font-bold',
                getVariationBg(totais.valorVariacao),
                getValueColor(totais.valorVariacao)
              )}>
                {formatCurrency(totais.valorVariacao, true)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
