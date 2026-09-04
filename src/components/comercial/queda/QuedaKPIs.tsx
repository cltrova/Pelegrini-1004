import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { UserX, TrendingDown, DollarSign, Percent } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import type { ClienteQueda } from '@/utils/quedaClientes';
import { classificarSituacao } from '@/utils/quedaClientes';

interface Props {
  clientes: ClienteQueda[];
  isLoading?: boolean;
}

export function QuedaKPIs({ clientes, isLoading }: Props) {
  const pararam = clientes.filter(c => classificarSituacao(c) === 'parou');
  const cairam = clientes.filter(c => {
    const s = classificarSituacao(c);
    return s === 'caiu_forte' || s === 'caiu_leve';
  });
  const emQueda = clientes.filter(c => c.variacaoValor < 0);
  const faturamentoPerdido = emQueda.reduce((acc, c) => acc + Math.abs(c.variacaoValor), 0);
  const quedaMedia = emQueda.length > 0
    ? emQueda.reduce((acc, c) => acc + c.variacaoPercent, 0) / emQueda.length
    : 0;

  const cards = [
    {
      icon: UserX,
      label: 'Pararam de comprar',
      value: pararam.length.toString(),
      hint: 'Compravam antes e não compraram nada agora',
      color: 'text-red-500 bg-red-500/10',
    },
    {
      icon: TrendingDown,
      label: 'Compraram menos',
      value: cairam.length.toString(),
      hint: 'Continuam comprando, mas caíram mais de 10%',
      color: 'text-orange-500 bg-orange-500/10',
    },
    {
      icon: DollarSign,
      label: 'Deixou de entrar',
      value: formatCurrency(faturamentoPerdido),
      hint: 'Soma do que esses clientes deixaram de comprar',
      color: 'text-rose-600 bg-rose-600/10',
    },
    {
      icon: Percent,
      label: 'Queda média',
      value: `${quedaMedia.toFixed(1)}%`,
      hint: 'Média da queda entre os clientes que caíram',
      color: 'text-amber-500 bg-amber-500/10',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="premium-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
              <Skeleton className="mt-2 h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((k, i) => (
        <Card key={i} className="premium-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`h-11 w-11 shrink-0 rounded-lg flex items-center justify-center ${k.color}`}>
                <k.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium">{k.label}</p>
                <p className="text-xl font-bold mono-value truncate">{k.value}</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{k.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
