import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { getDailyCommercialInsights } from '@/lib/aiApi';
import type { InsightsBranch } from '../../../services/ia/daily-insight-types';

interface Props {
  filial?: InsightsBranch;
  periodo: { inicio: string; fim: string };
  children?: ReactNode;
}

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
        <div className="dashboard-detail-generated-insights">
          {snapshot.insights.map((insight, index) => (
            <Dialog key={`${filial}-${snapshot.dia}-${index}`}>
              <DialogTrigger asChild>
                <button type="button" className="dashboard-frame dashboard-detail-generated-insight">
                  {insight.titulo}
                </button>
              </DialogTrigger>
              <DialogContent className="commercial-overlay max-w-md gap-2 p-4">
                <DialogTitle className="break-words pr-8 text-base leading-snug">{insight.titulo}</DialogTitle>
                <DialogDescription className="whitespace-pre-wrap break-words leading-relaxed">
                  {insight.descricao}
                </DialogDescription>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      )}
    </section>
  );
}
