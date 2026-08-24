import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search, Layers, TrendingUp, Trophy, Sparkles, Lightbulb,
  AlertTriangle, Target, Loader2, RefreshCw, X, Crown, Package,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';

interface CategoriaAgg {
  chave: string;
  faturamento: number;
  quantidade: number;
  produtos: number;
  participacao: number;
}

interface AIInsight {
  title: string;
  categoria: string | null;
  value: string;
  insight: string;
  type: 'oportunidade' | 'alerta' | 'destaque' | 'risco';
}

interface Props {
  porCategoria: CategoriaAgg[];
  periodoLabel?: string;
  selectedCategoria?: string | null;
  onSelectCategoria?: (c: string | null) => void;
}

export function PremiumCategoriasView({
  porCategoria, periodoLabel, selectedCategoria, onSelectCategoria,
}: Props) {
  const [busca, setBusca] = useState('');
  const [mostrar, setMostrar] = useState(20);
  const [drawerCat, setDrawerCat] = useState<CategoriaAgg | null>(null);

  // ============ DADOS DERIVADOS ============
  // Lista para ranking: NÃO remove a categoria selecionada, apenas aplica busca textual.
  // O destaque visual é feito na renderização.
  const filtradas = useMemo(() => {
    let arr = [...porCategoria];
    if (busca.trim()) {
      const q = busca.toLowerCase().trim();
      arr = arr.filter(c => c.chave.toLowerCase().includes(q));
    }
    return arr.sort((a, b) => b.faturamento - a.faturamento);
  }, [porCategoria, busca]);

  // Escopo para IA/insights: se há categoria selecionada, foca apenas nela.
  const escopoIA = useMemo(() => {
    if (selectedCategoria) return porCategoria.filter(c => c.chave === selectedCategoria);
    return filtradas;
  }, [porCategoria, filtradas, selectedCategoria]);

  const totalReceita = useMemo(() => escopoIA.reduce((a, c) => a + c.faturamento, 0), [escopoIA]);
  const totalQtd = useMemo(() => escopoIA.reduce((a, c) => a + c.quantidade, 0), [escopoIA]);
  const totalSkus = useMemo(() => escopoIA.reduce((a, c) => a + c.produtos, 0), [escopoIA]);

  // Receita total geral (para % do mix completo, que não muda com filtros)
  const totalReceitaGeral = useMemo(
    () => porCategoria.reduce((a, c) => a + c.faturamento, 0),
    [porCategoria],
  );

  // Recalcula participação dentro do escopo (lista visível)
  const visiveis = useMemo(() => {
    const max = filtradas.length > 0 ? Math.max(...filtradas.map(c => c.faturamento)) : 1;
    return filtradas.slice(0, mostrar).map(c => ({
      ...c,
      participacaoEscopo: totalReceitaGeral > 0 ? (c.faturamento / totalReceitaGeral) * 100 : 0,
      barraRel: max > 0 ? (c.faturamento / max) * 100 : 0,
    }));
  }, [filtradas, mostrar, totalReceitaGeral]);

  // ============ IA INSIGHTS ============
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiUsedFallback, setAiUsedFallback] = useState(false);

  const datasetSignature = useMemo(() => {
    const catKey = selectedCategoria || '__all__';
    return `${catKey}::${escopoIA.length}::${Math.round(totalReceita)}`;
  }, [selectedCategoria, escopoIA.length, totalReceita]);

  const cacheKey = `categorias-insights-cache::${datasetSignature}`;

  const buildFallbackInsights = (): AIInsight[] => {
    if (escopoIA.length === 0) return [];
    const ord = [...escopoIA].sort((a, b) => b.faturamento - a.faturamento);
    const top1 = ord[0];
    const top3 = ord.slice(0, 3).reduce((a, c) => a + c.faturamento, 0);
    const concentracao = totalReceita > 0 ? (top3 / totalReceita) * 100 : 0;
    const ticketSku = ord.map(c => ({
      ...c, ticket: c.produtos > 0 ? c.faturamento / c.produtos : 0,
    }));
    const eficiente = [...ticketSku].sort((a, b) => b.ticket - a.ticket)[0];
    const escopo = selectedCategoria ? `de ${selectedCategoria}` : 'do mix';

    return [
      {
        title: selectedCategoria ? 'Foco selecionado' : 'Categoria líder',
        categoria: top1?.chave || null,
        value: formatCurrency(top1?.faturamento || 0, true),
        insight: `Maior faturamento ${escopo}. Representa ${totalReceitaGeral > 0 ? ((top1.faturamento / totalReceitaGeral) * 100).toFixed(1) : 0}% do total.`,
        type: 'destaque',
      },
      {
        title: 'Concentração Top 3',
        categoria: null,
        value: `${concentracao.toFixed(1)}%`,
        insight: concentracao > 60
          ? `Receita concentrada no Top 3 ${escopo} — diversifique o mix.`
          : `Distribuição saudável de receita ${escopo}.`,
        type: concentracao > 60 ? 'risco' : 'oportunidade',
      },
      {
        title: 'Eficiência por SKU',
        categoria: eficiente?.chave || null,
        value: formatCurrency(eficiente?.ticket || 0, true),
        insight: `Maior receita média por SKU ${escopo}. Avalie ampliar mix similar.`,
        type: 'oportunidade',
      },
    ];
  };

  const fetchInsights = async (force = false) => {
    if (escopoIA.length === 0) return;
    if (!force) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as AIInsight[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAiInsights(parsed);
            setAiUsedFallback(false);
            return;
          }
        }
      } catch { /* ignore */ }
    }

    setAiLoading(true);
    try {
      const payload = escopoIA.slice(0, 30).map(c => ({
        chave: c.chave,
        faturamento: c.faturamento,
        quantidade: c.quantidade,
        produtos: c.produtos,
        participacao: c.participacao,
      }));
      const { data, error } = await supabase.functions.invoke('categorias-insights', {
        body: { categorias: payload, categoriaFoco: selectedCategoria, periodo: periodoLabel },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (Array.isArray(data?.insights) && data.insights.length > 0) {
        setAiInsights(data.insights);
        setAiUsedFallback(false);
        try { sessionStorage.setItem(cacheKey, JSON.stringify(data.insights)); } catch { /* ignore */ }
      } else {
        throw new Error('Resposta vazia');
      }
    } catch (e: any) {
      console.error('categorias-insights error', e);
      setAiInsights(buildFallbackInsights());
      setAiUsedFallback(true);
      toast.error('IA indisponível; mostrando insights calculados pelos dados.');
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (escopoIA.length === 0) {
      setAiInsights([]);
      return;
    }
    let usedCache = false;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as AIInsight[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAiInsights(parsed);
          setAiUsedFallback(false);
          usedCache = true;
        }
      }
    } catch { /* ignore */ }
    if (!usedCache) {
      setAiInsights(buildFallbackInsights());
      setAiUsedFallback(true);
      fetchInsights(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetSignature]);

  // ============ HANDLERS ============
  const toggleCategoria = (chave: string) => {
    if (!onSelectCategoria) return;
    onSelectCategoria(selectedCategoria === chave ? null : chave);
  };

  const totalCategoriasGeral = porCategoria.length;

  return (
    <div className="space-y-4">
      {/* HEADER + AÇÕES */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold leading-tight">Análise por Categoria/Grupo</h2>
            <p className="text-xs text-muted-foreground">
              {totalCategoriasGeral} categorias • clique para filtrar
            </p>
          </div>
          {selectedCategoria && (
            <Badge
              variant="secondary"
              className="ml-1 gap-1.5 cursor-pointer hover:bg-secondary/80"
              onClick={() => onSelectCategoria?.(null)}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {selectedCategoria}
              <X className="h-3 w-3" />
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar categoria…"
              className="h-8 pl-8 w-56 text-xs"
            />
          </div>
        </div>
      </div>

      {/* INSIGHTS DA IA */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              {selectedCategoria ? `Insights IA · ${selectedCategoria}` : 'Insights IA · Todas categorias'}
            </span>
            {aiUsedFallback && (
              <Badge variant="outline" className="h-4 text-[9px] px-1.5">cálculo local</Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchInsights(true)}
            disabled={aiLoading || escopoIA.length === 0}
            className="h-7 gap-1.5 text-xs"
          >
            {aiLoading
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <RefreshCw className="h-3 w-3" />}
            Atualizar
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {aiInsights.length === 0 && aiLoading && (
            <>
              <InsightSkeleton /><InsightSkeleton /><InsightSkeleton />
            </>
          )}
          {aiInsights.map((ins, i) => (
            <InsightCard
              key={i}
              insight={ins}
              onClick={() => {
                if (ins.categoria && porCategoria.some(c => c.chave === ins.categoria) && onSelectCategoria) {
                  onSelectCategoria(ins.categoria);
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* KPIS RÁPIDOS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Categorias"
          value={formatNumber(selectedCategoria ? 1 : filtradas.length)}
          sub={selectedCategoria ? 'foco selecionado' : `de ${totalCategoriasGeral} totais`}
          icon={Layers}
          color="primary"
        />
        <KpiCard
          label="Faturamento"
          value={formatCurrency(totalReceita, true)}
          sub={selectedCategoria ? 'da categoria' : 'no escopo'}
          icon={TrendingUp}
          color="success"
        />
        <KpiCard
          label="SKUs no escopo"
          value={formatNumber(totalSkus)}
          sub="produtos cadastrados"
          icon={Package}
          color="primary"
        />
        <KpiCard
          label="Quantidade"
          value={formatNumber(totalQtd)}
          sub="unidades vendidas"
          icon={Trophy}
          color="warning"
        />
      </div>

      {/* RANKING PREMIUM */}
      <Card className="premium-card overflow-hidden">
        <CardContent className="p-0">
          <div className="px-4 py-2.5 border-b border-border/60 flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2">
              <Crown className="h-3.5 w-3.5 text-warning" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ranking de categorias
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {visiveis.length} de {filtradas.length}
            </span>
          </div>

          <div className="max-h-[640px] overflow-y-auto divide-y divide-border/40">
            {visiveis.map((c, idx) => {
              const isSelected = selectedCategoria === c.chave;
              const ticketSku = c.produtos > 0 ? c.faturamento / c.produtos : 0;
              return (
                <button
                  key={c.chave}
                  onClick={() => toggleCategoria(c.chave)}
                  className={cn(
                    'w-full text-left px-4 py-3 transition-colors relative group',
                    'hover:bg-primary/5',
                    isSelected && 'bg-primary/10',
                  )}
                >
                  {/* barra lateral colorida quando selecionado */}
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                  )}
                  <div className="flex items-start gap-3">
                    {/* RANK BADGE */}
                    <RankBadge rank={idx + 1} />

                    {/* CONTEÚDO */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{c.chave}</p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">
                            {formatNumber(c.produtos)} SKUs • {formatNumber(c.quantidade)} unid. •
                            <span className="ml-1 text-foreground/70">
                              {formatCurrency(ticketSku, true)}/SKU
                            </span>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold tabular-nums">{formatCurrency(c.faturamento)}</p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">
                            {c.participacaoEscopo.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      {/* BARRA DE PROGRESSO PREMIUM */}
                      <div className="relative h-1.5 rounded-full bg-muted overflow-hidden mt-1.5">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            'bg-gradient-to-r from-primary via-primary to-primary/70',
                            isSelected && 'shadow-[0_0_12px_hsl(var(--primary)/0.6)]',
                          )}
                          style={{ width: `${Math.min(100, c.barraRel)}%` }}
                        />
                      </div>
                    </div>

                    {/* AÇÃO LATERAL */}
                    <div
                      className="opacity-0 group-hover:opacity-100 transition-opacity self-center"
                      onClick={(e) => { e.stopPropagation(); setDrawerCat(c); }}
                    >
                      <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-primary hover:text-primary-foreground">
                        Ver
                        <ChevronRight className="h-3 w-3" />
                      </Badge>
                    </div>
                  </div>
                </button>
              );
            })}

            {visiveis.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">
                Nenhuma categoria encontrada para os filtros aplicados.
              </div>
            )}
          </div>

          {filtradas.length > visiveis.length && (
            <div className="p-3 border-t border-border/60 bg-muted/20 flex items-center justify-center">
              <Button variant="ghost" size="sm" onClick={() => setMostrar(m => m + 20)} className="text-xs h-7">
                Mostrar mais 20 categorias
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DRAWER DETALHE */}
      <Sheet open={!!drawerCat} onOpenChange={(o) => !o && setDrawerCat(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {drawerCat && (
            <>
              <SheetHeader className="space-y-1">
                <Badge variant="outline" className="w-fit text-[10px]">CATEGORIA / GRUPO</Badge>
                <SheetTitle className="text-xl leading-tight pr-6">{drawerCat.chave}</SheetTitle>
                <SheetDescription>
                  Detalhamento completo da categoria no período {periodoLabel || 'atual'}.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 mt-5">
                <div className="grid grid-cols-2 gap-2.5">
                  <DetalheKPI label="Faturamento" value={formatCurrency(drawerCat.faturamento)} color="success" />
                  <DetalheKPI label="Participação" value={`${drawerCat.participacao.toFixed(1)}%`} color="primary" />
                  <DetalheKPI label="SKUs" value={formatNumber(drawerCat.produtos)} color="primary" />
                  <DetalheKPI label="Unidades" value={formatNumber(drawerCat.quantidade)} color="warning" />
                  <DetalheKPI
                    label="Ticket / SKU"
                    value={formatCurrency(drawerCat.produtos > 0 ? drawerCat.faturamento / drawerCat.produtos : 0)}
                    color="success"
                  />
                  <DetalheKPI
                    label="Receita / unid."
                    value={formatCurrency(drawerCat.quantidade > 0 ? drawerCat.faturamento / drawerCat.quantidade : 0)}
                    color="primary"
                  />
                </div>

                <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-2">
                  <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                    Posição no ranking
                  </p>
                  <div className="flex items-center gap-3">
                    <RankBadge rank={porCategoria.findIndex(c => c.chave === drawerCat.chave) + 1} large />
                    <div className="text-xs text-muted-foreground">
                      Esta categoria ocupa a posição{' '}
                      <span className="font-bold text-foreground">
                        #{porCategoria.findIndex(c => c.chave === drawerCat.chave) + 1}
                      </span>{' '}
                      entre {porCategoria.length} categorias do mix.
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full"
                  variant={selectedCategoria === drawerCat.chave ? 'secondary' : 'default'}
                  onClick={() => {
                    onSelectCategoria?.(selectedCategoria === drawerCat.chave ? null : drawerCat.chave);
                    setDrawerCat(null);
                  }}
                >
                  {selectedCategoria === drawerCat.chave ? 'Remover filtro' : 'Filtrar dashboard por esta categoria'}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ============ SUBCOMPONENTES ============

function RankBadge({ rank, large }: { rank: number; large?: boolean }) {
  const cfg = rank === 1
    ? { bg: 'bg-gradient-to-br from-yellow-400 to-yellow-600', text: 'text-yellow-50', icon: <Crown className="h-3 w-3" /> }
    : rank === 2
    ? { bg: 'bg-gradient-to-br from-slate-300 to-slate-500', text: 'text-slate-50', icon: null }
    : rank === 3
    ? { bg: 'bg-gradient-to-br from-amber-700 to-amber-900', text: 'text-amber-50', icon: null }
    : { bg: 'bg-muted', text: 'text-muted-foreground', icon: null };

  return (
    <div className={cn(
      'rounded-md flex items-center justify-center font-bold tabular-nums shrink-0 shadow-sm',
      large ? 'h-12 w-12 text-base' : 'h-9 w-9 text-sm',
      cfg.bg, cfg.text,
    )}>
      {cfg.icon || `#${rank}`}
    </div>
  );
}

function KpiCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: any;
  color: 'primary' | 'success' | 'warning' | 'destructive';
}) {
  const colorMap = {
    primary: 'text-primary border-primary/30 bg-primary/5',
    success: 'text-success border-success/30 bg-success/5',
    warning: 'text-warning border-warning/30 bg-warning/5',
    destructive: 'text-destructive border-destructive/30 bg-destructive/5',
  };
  return (
    <Card className="premium-card overflow-hidden">
      <CardContent className="p-3.5 flex items-stretch gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">{label}</p>
          <p className="text-xl font-bold tabular-nums truncate mt-0.5">{value}</p>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{sub || '\u00A0'}</p>
        </div>
        <div className={cn(
          'h-9 w-9 self-center rounded-lg border flex items-center justify-center shrink-0',
          colorMap[color],
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function DetalheKPI({
  label, value, color,
}: { label: string; value: string; color: 'primary' | 'success' | 'warning' | 'destructive' }) {
  const cls = {
    primary: 'text-primary border-primary/30 from-primary/10',
    success: 'text-success border-success/30 from-success/10',
    warning: 'text-warning border-warning/30 from-warning/10',
    destructive: 'text-destructive border-destructive/30 from-destructive/10',
  }[color];
  return (
    <div className={cn('p-2.5 rounded-lg border bg-gradient-to-br to-transparent', cls)}>
      <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">{label}</div>
      <div className={cn('text-base font-bold tabular-nums truncate', cls.split(' ')[0])}>{value}</div>
    </div>
  );
}

function InsightCard({ insight, onClick }: { insight: AIInsight; onClick?: () => void }) {
  const cfg = {
    oportunidade: { icon: Lightbulb, grad: 'from-primary/20 via-primary/10 to-transparent', iconBg: 'bg-primary/15 text-primary', border: 'border-primary/30', label: 'Oportunidade' },
    destaque:     { icon: Trophy,    grad: 'from-success/20 via-success/10 to-transparent', iconBg: 'bg-success/15 text-success', border: 'border-success/30', label: 'Destaque' },
    alerta:       { icon: AlertTriangle, grad: 'from-warning/20 via-warning/10 to-transparent', iconBg: 'bg-warning/15 text-warning', border: 'border-warning/30', label: 'Alerta' },
    risco:        { icon: Target,    grad: 'from-destructive/20 via-destructive/10 to-transparent', iconBg: 'bg-destructive/15 text-destructive', border: 'border-destructive/30', label: 'Risco' },
  }[insight.type] ?? { icon: Sparkles, grad: 'from-primary/20 via-primary/10 to-transparent', iconBg: 'bg-primary/15 text-primary', border: 'border-primary/30', label: 'Insight' };
  const Icon = cfg.icon;
  return (
    <Card
      onClick={onClick}
      className={cn(
        'overflow-hidden relative bg-gradient-to-br shadow-md transition-shadow',
        cfg.grad, cfg.border,
        onClick && insight.categoria ? 'cursor-pointer hover:shadow-lg' : '',
      )}
    >
      <CardContent className="p-4 relative z-10 flex flex-col gap-2 h-full">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm', cfg.iconBg)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">{cfg.label}</p>
              <p className="text-sm font-bold leading-tight truncate">{insight.title}</p>
            </div>
          </div>
        </div>
        <p className="text-lg font-bold tabular-nums truncate">{insight.value}</p>
        {insight.categoria && (
          <p className="text-[11px] text-muted-foreground truncate" title={insight.categoria}>
            {insight.categoria}
          </p>
        )}
        <p className="text-xs text-foreground/80 leading-snug line-clamp-3">{insight.insight}</p>
      </CardContent>
    </Card>
  );
}

function InsightSkeleton() {
  return (
    <Card className="overflow-hidden border-border/60 bg-muted/20">
      <CardContent className="p-4 space-y-2 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-muted" />
          <div className="space-y-1.5 flex-1">
            <div className="h-2 w-16 bg-muted rounded" />
            <div className="h-3 w-28 bg-muted rounded" />
          </div>
        </div>
        <div className="h-5 w-24 bg-muted rounded" />
        <div className="h-2 w-full bg-muted rounded" />
        <div className="h-2 w-3/4 bg-muted rounded" />
      </CardContent>
    </Card>
  );
}
