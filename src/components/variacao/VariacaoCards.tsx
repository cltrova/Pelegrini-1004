import { TrendingUp, TrendingDown, Wallet, ArrowUpDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';

interface VariacaoCardsProps {
  ano: string;
  saldoInicial: number;
  saldoFinal: number;
  valorVariacao: number;
}

export function VariacaoCards({
  ano,
  saldoInicial,
  saldoFinal,
  valorVariacao,
}: VariacaoCardsProps) {
  const isPositive = valorVariacao >= 0;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Saldo Inicial */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Saldo Inicial {ano}</p>
              <p className={cn(
                'text-2xl font-bold font-mono',
                saldoInicial >= 0 ? 'text-foreground' : 'text-red-600 dark:text-red-400'
              )}>
                {formatCurrency(saldoInicial)}
              </p>
              <p className="text-xs text-muted-foreground">Acumulado até 01/{ano}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Wallet className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Saldo Final */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Saldo Final {ano}</p>
              <p className={cn(
                'text-2xl font-bold font-mono',
                saldoFinal >= 0 ? 'text-foreground' : 'text-red-600 dark:text-red-400'
              )}>
                {formatCurrency(saldoFinal)}
              </p>
              <p className="text-xs text-muted-foreground">Total + Saldo Inicial</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Variação */}
      <Card className={cn(
        'border-2',
        isPositive ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      )}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Variação {ano}</p>
              <p className={cn(
                'text-2xl font-bold font-mono',
                isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              )}>
                {formatCurrency(valorVariacao, true)}
              </p>
              <p className="text-xs text-muted-foreground">Saldo Final - Saldo Inicial</p>
            </div>
            <div className={cn(
              'h-12 w-12 rounded-full flex items-center justify-center',
              isPositive ? 'bg-emerald-200 dark:bg-emerald-800' : 'bg-red-200 dark:bg-red-800'
            )}>
              {isPositive ? (
                <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
