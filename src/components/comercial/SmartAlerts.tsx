import { useMemo } from 'react';
import { AlertTriangle, TrendingDown, AlertCircle, Zap, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import type { ComercialKPIs, VendedorPerformance, EvolucaoMensal } from '@/types/comercial';

interface Props {
  kpis: ComercialKPIs;
  vendedores: VendedorPerformance[];
  evolucao: EvolucaoMensal[];
}

type Severity = 'critico' | 'alto' | 'medio' | 'info';

interface SmartAlert {
  id: string;
  severity: Severity;
  icon: React.ElementType;
  titulo: string;
  detalhe: string;
}

const SEV_STYLE: Record<Severity, { bg: string; border: string; color: string; pulse?: boolean }> = {
  critico: { bg: 'bg-destructive/10', border: 'border-destructive/40', color: 'text-destructive', pulse: true },
  alto:    { bg: 'bg-orange-500/10', border: 'border-orange-500/40', color: 'text-orange-500' },
  medio:   { bg: 'bg-warning/10', border: 'border-warning/40', color: 'text-warning' },
  info:    { bg: 'bg-primary/10', border: 'border-primary/40', color: 'text-primary' },
};

export function SmartAlerts({ kpis, vendedores, evolucao }: Props) {
  const alerts = useMemo<SmartAlert[]>(() => {
    const arr: SmartAlert[] = [];

    // Devolução alta
    const taxaDev = kpis.faturamentoBruto > 0 ? (kpis.totalDevolucoes / kpis.faturamentoBruto) * 100 : 0;
    if (taxaDev >= 7) {
      arr.push({
        id: 'dev-critica',
        severity: 'critico',
        icon: ShieldAlert,
        titulo: 'Taxa de devolução crítica',
        detalhe: `${taxaDev.toFixed(1)}% do faturamento bruto • ${formatCurrency(kpis.totalDevolucoes)}`,
      });
    } else if (taxaDev >= 4) {
      arr.push({
        id: 'dev-alta',
        severity: 'alto',
        icon: AlertTriangle,
        titulo: 'Devoluções acima do ideal',
        detalhe: `${taxaDev.toFixed(1)}% • monitorar causas principais`,
      });
    }

    // Margem baixa
    const margem = kpis.faturamentoLiquido > 0
      ? ((kpis.faturamentoLiquido - kpis.totalValorCusto) / kpis.faturamentoLiquido) * 100 : 0;
    if (margem > 0 && margem < 15) {
      arr.push({
        id: 'margem-baixa',
        severity: margem < 8 ? 'critico' : 'alto',
        icon: TrendingDown,
        titulo: 'Margem comprimida',
        detalhe: `Operando em ${margem.toFixed(1)}% — revisar custo/desconto`,
      });
    }

    // Queda no último mês
    if (evolucao.length >= 2) {
      const ult = evolucao[evolucao.length - 1];
      const ant = evolucao[evolucao.length - 2];
      if (ant.liquido > 0) {
        const variacao = ((ult.liquido - ant.liquido) / ant.liquido) * 100;
        if (variacao <= -15) {
          arr.push({
            id: 'queda-mes',
            severity: variacao <= -25 ? 'critico' : 'alto',
            icon: TrendingDown,
            titulo: 'Queda relevante no mês',
            detalhe: `${variacao.toFixed(1)}% vs mês anterior`,
          });
        }
      }
    }

    // Vendedores abaixo da meta
    const comMeta = vendedores.filter(v => v.meta && v.meta > 0);
    const abaixo = comMeta.filter(v => v.faturamentoLiquido / (v.meta || 1) < 0.6);
    if (abaixo.length >= 2) {
      arr.push({
        id: 'vendedores-meta',
        severity: 'medio',
        icon: AlertCircle,
        titulo: `${abaixo.length} vendedores abaixo de 60% da meta`,
        detalhe: abaixo.slice(0, 3).map(v => v.nome.split(' ')[0]).join(', ') + (abaixo.length > 3 ? '…' : ''),
      });
    }

    // Concentração de receita
    if (vendedores.length >= 3) {
      const sorted = [...vendedores].sort((a, b) => b.faturamentoLiquido - a.faturamentoLiquido);
      const total = sorted.reduce((s, v) => s + v.faturamentoLiquido, 0);
      const top1 = sorted[0].faturamentoLiquido;
      if (total > 0 && top1 / total > 0.45) {
        arr.push({
          id: 'concentracao',
          severity: 'medio',
          icon: Zap,
          titulo: 'Receita concentrada',
          detalhe: `${sorted[0].nome.split(' ')[0]} responde por ${((top1 / total) * 100).toFixed(0)}% do total`,
        });
      }
    }

    // Sem alertas → mostra info positivo
    if (arr.length === 0) {
      arr.push({
        id: 'tudo-bem',
        severity: 'info',
        icon: Zap,
        titulo: 'Nenhum alerta crítico',
        detalhe: 'Operação dentro dos parâmetros saudáveis',
      });
    }

    return arr.sort((a, b) => {
      const order = { critico: 0, alto: 1, medio: 2, info: 3 };
      return order[a.severity] - order[b.severity];
    });
  }, [kpis, vendedores, evolucao]);

  return (
    <div className="rounded-lg border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-destructive/15 flex items-center justify-center">
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] font-semibold text-muted-foreground">Alertas Inteligentes</p>
            <h3 className="text-sm font-bold">Detecção automática</h3>
          </div>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
          {alerts.length} {alerts.length === 1 ? 'alerta' : 'alertas'}
        </span>
      </div>

      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
        {alerts.map((a) => {
          const s = SEV_STYLE[a.severity];
          const Icon = a.icon;
          return (
            <div
              key={a.id}
              className={cn(
                'group relative rounded-lg border p-2.5 flex items-start gap-2.5 transition-colors duration-200 hover:bg-muted/30 cursor-default',
                s.bg, s.border,
              )}
            >
              <div className={cn(
                'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                s.bg, s.color,
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn('text-xs font-bold leading-tight', s.color)}>{a.titulo}</p>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{a.detalhe}</p>
              </div>
              {s.pulse && (
                <div className={cn('absolute top-2 right-2 h-1.5 w-1.5 rounded-full', a.severity === 'critico' && 'bg-destructive')} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
