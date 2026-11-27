import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, TrendingUp, Info, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getDailyCommercialInsights } from '@/lib/aiApi';
import { cn } from '@/lib/utils';
import { formatCalendarDate } from '@/utils/formatters';
import type { InsightsBranch } from '../../../services/ia/daily-insight-types';

interface Props {
  filial?: InsightsBranch;
  periodo: { inicio: string; fim: string };
  children?: ReactNode;
}

const tipoConfig = {
  alerta: { icon: AlertTriangle, color: 'text-destructive' },
  oportunidade: { icon: TrendingUp, color: 'text-success' },
  sucesso: { icon: CheckCircle2, color: 'text-success' },
  info: { icon: Info, color: 'text-primary' },
};

export function InsightsIATab({ filial, periodo, children }: Props) {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['analises-comerciais-diarias', user?.id, filial],
    queryFn: ({ signal }) => filial ? getDailyCommercialInsights(filial, signal) : null,
    enabled: Boolean(user && filial),
    staleTime: 5 * 60_000,
    refetchInterval: 15 * 60_000,
    retry: false,
  });
  const snapshot = filial && user && data && data.periodo.inicio === periodo.inicio && data.periodo.fim <= periodo.fim ? data : null;

  return (
    <section className="dashboard-detail-insights" aria-label="Indicadores e análises diárias">
      {children}
      {snapshot && snapshot.insights.length > 0 && (
        <>
          <div className="dashboard-detail-generated-insights">
            {snapshot.insights.map((insight, index) => {
              const { icon: Icon, color } = tipoConfig[insight.tipo] ?? tipoConfig.info;
              return (
                <article key={index} className="dashboard-frame dashboard-detail-generated-insight p-2 text-xs">
                  <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', color)} />
                  <div className="min-w-0">
                    <h4 className="font-semibold">{insight.titulo}</h4>
                    <p className="commercial-insight-action break-words text-muted-foreground">{insight.descricao}</p>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="text-right text-xs text-muted-foreground">
            Comissões do RSYS até <time dateTime={snapshot.periodo.fim}>{formatCalendarDate(snapshot.periodo.fim)}</time>
          </p>
        </>
      )}
    </section>
  );
}
