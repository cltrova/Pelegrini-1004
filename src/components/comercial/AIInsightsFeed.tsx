import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ComercialAIContext } from '@/utils/comercialAIContext';

interface FeedInsight {
  emoji: string;
  texto: string;
  tipo: 'positivo' | 'alerta' | 'info';
}

interface Props {
  contexto: ComercialAIContext;
}

const CACHE_KEY = 'comercial_ai_feed_cache_v1';
const TTL_MS = 5 * 60 * 1000;

export function AIInsightsFeed({ contexto }: Props) {
  const [insights, setInsights] = useState<FeedInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchInsights = async (force = false) => {
    try {
      setLoading(true);
      setError(false);

      const cacheKey = `${CACHE_KEY}_${contexto.empresa || 'default'}`;
      if (!force) {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { ts, data } = JSON.parse(cached);
          if (Date.now() - ts < TTL_MS && Array.isArray(data) && data.length) {
            setInsights(data);
            setLoading(false);
            return;
          }
        }
      }

      const { data, error: err } = await supabase.functions.invoke('comercial-ai-feed', {
        body: { contexto },
      });
      if (err) throw err;
      const arr: FeedInsight[] = data?.insights || [];
      if (arr.length === 0) {
        setError(true);
      } else {
        setInsights(arr);
        sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: arr }));
      }
    } catch (e) {
      console.error('AIInsightsFeed error:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contexto.empresa, contexto.kpis.faturamento_liquido]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-card to-cyan-500/5 backdrop-blur-md group">
      {/* Glow background */}
      <div className="absolute inset-0 opacity-50 pointer-events-none">
        <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-primary/20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-12 right-1/4 w-56 h-56 rounded-full bg-cyan-500/15 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative flex items-center gap-3 p-3 pl-4">
        {/* Label */}
        <div className="flex items-center gap-2 shrink-0 pr-3 border-r border-border/50">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/40 blur-md animate-pulse" />
            <div className="relative h-8 w-8 rounded-full bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center shadow-lg">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>
          <div className="hidden sm:block">
            <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-primary leading-none">Inteligência IA</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Insights de hoje</p>
          </div>
        </div>

        {/* Scrolling content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {loading && insights.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analisando dados comerciais...
            </div>
          )}
          {error && insights.length === 0 && (
            <p className="text-xs text-muted-foreground">IA indisponível no momento.</p>
          )}
          {insights.length > 0 && (
            <div className="ai-feed-marquee">
              <div className="ai-feed-track">
                {[...insights, ...insights].map((ins, i) => (
                  <span
                    key={i}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap mr-3 border transition-colors',
                      ins.tipo === 'positivo' && 'bg-success/10 border-success/30 text-success',
                      ins.tipo === 'alerta' && 'bg-destructive/10 border-destructive/30 text-destructive',
                      ins.tipo === 'info' && 'bg-primary/10 border-primary/30 text-primary'
                    )}
                  >
                    <span>{ins.emoji}</span>
                    {ins.texto}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Refresh */}
        <button
          onClick={() => fetchInsights(true)}
          className="shrink-0 h-7 w-7 rounded-full hover:bg-primary/10 flex items-center justify-center transition-colors text-muted-foreground hover:text-primary"
          title="Atualizar insights"
          disabled={loading}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>
    </div>
  );
}
