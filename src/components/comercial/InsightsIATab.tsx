import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, AlertTriangle, TrendingUp, Info, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Insight {
  tipo: 'alerta' | 'oportunidade' | 'info' | 'sucesso';
  titulo: string;
  descricao: string;
}

interface Props {
  vendedores: any[];
  kpis: any;
}

const tipoConfig = {
  alerta: { icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20' },
  oportunidade: { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  sucesso: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  info: { icon: Info, color: 'text-sky-500', bg: 'bg-sky-500/10 border-sky-500/20' },
};

export function InsightsIATab({ vendedores, kpis }: Props) {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [loading, setLoading] = useState(false);

  const gerarInsights = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('metas-insights', {
        body: { vendedores, kpis },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      }
      setInsights(data?.insights || []);
    } catch (e: any) {
      console.error(e);
      toast.error('Falha ao gerar insights');
      setInsights([]);
    } finally {
      setLoading(false);
    }
  };

  if (!insights && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Insights com IA</h3>
        <p className="text-muted-foreground max-w-md mb-6">
          Gere análises inteligentes sobre o desempenho dos vendedores, oportunidades e pontos de atenção.
        </p>
        <Button onClick={gerarInsights} size="lg">
          <Sparkles className="h-4 w-4 mr-2" />
          Gerar Insights
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Analisando dados com IA...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Insights Gerados pela IA</h3>
        </div>
        <Button variant="outline" size="sm" onClick={gerarInsights} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Regenerar
        </Button>
      </div>

      {insights && insights.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum insight foi gerado. Tente novamente.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights?.map((ins, i) => {
            const cfg = tipoConfig[ins.tipo] || tipoConfig.info;
            const Icon = cfg.icon;
            return (
              <Card
                key={i}
                className={cn(
                  'border-border/60 transition-colors duration-300 hover:border-primary/30 hover:bg-muted/30',
                  cfg.bg,
                )}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', cfg.color)} />
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-1">{ins.titulo}</h4>
                      <p className="text-sm text-muted-foreground">{ins.descricao}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
