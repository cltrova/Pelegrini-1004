import { useMemo } from 'react';
import { User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/utils/formatters';

interface VendedorMetaCardProps {
  nome: string;
  foto?: string;
  cargo?: string;
  metaMensal: number;
  faturamentoAtual: number;
  performanceDiaria: number;
  className?: string;
}

export function VendedorMetaCard({
  nome,
  foto,
  cargo = 'Vendedor',
  metaMensal,
  faturamentoAtual,
  performanceDiaria,
  className,
}: VendedorMetaCardProps) {
  const percentualMeta = useMemo(() => {
    if (metaMensal <= 0) return 0;
    return Math.min((faturamentoAtual / metaMensal) * 100, 100);
  }, [faturamentoAtual, metaMensal]);

  // SVG Circle Progress
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentualMeta / 100) * circumference;

  return (
    <Card className={cn(
      'relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
      'bg-gradient-to-br from-card to-card/80',
      className
    )}>
      <CardContent className="p-6 flex flex-col items-center">
        {/* Indicador Circular de Progresso */}
        <div className="relative w-40 h-40 mb-4">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
            {/* Background circle */}
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              className="text-muted/20"
            />
            {/* Progress circle */}
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="url(#progressGradient)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--chart-2))" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Foto do vendedor no centro */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-4 border-background shadow-lg flex items-center justify-center overflow-hidden">
              {foto ? (
                <img src={foto} alt={nome} className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-primary/60" />
              )}
            </div>
          </div>
          
          {/* Percentual sobre o círculo */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-background px-3 py-1 rounded-full shadow-md border">
            <span className="text-lg font-bold text-primary mono-value">
              {formatPercent(percentualMeta)}
            </span>
          </div>
        </div>

        {/* Informações do Vendedor */}
        <div className="text-center mt-2">
          <h3 className="font-semibold text-lg leading-tight">{nome}</h3>
          <p className="text-sm text-muted-foreground">{cargo}</p>
        </div>

        {/* Barra de Performance Diária */}
        <div className="w-full mt-6 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Performance Diária</span>
            <span className={cn(
              'font-medium mono-value',
              performanceDiaria >= 100 ? 'text-success' : 
              performanceDiaria >= 90 ? 'text-warning' : 'text-destructive'
            )}>
              {formatPercent(performanceDiaria)} da meta
            </span>
          </div>
          <Progress 
            value={Math.min(performanceDiaria, 100)} 
            className={cn(
              'h-2.5',
              performanceDiaria >= 100 ? '[&>div]:bg-success' : 
              performanceDiaria >= 90 ? '[&>div]:bg-warning' : '[&>div]:bg-destructive'
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
