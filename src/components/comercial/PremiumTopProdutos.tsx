import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Trophy, X, Search, TrendingUp, Package, DollarSign, Crown, Medal, Award,
  ExternalLink, Calendar, User, FileText, BarChart3, ArrowUpRight,
  Sparkles, AlertTriangle, Lightbulb, Target, RefreshCw, Loader2,
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TopProdutoAgg, ResumoVendaLinha } from '@/types/comercialProdutos';

interface AIInsight {
  title: string;
  produto: string | null;
  value: string;
  insight: string;
  type: 'oportunidade' | 'alerta' | 'destaque' | 'risco';
}

interface PremiumTopProdutosProps {
  produtos: TopProdutoAgg[];
  resumoVendas?: ResumoVendaLinha[];
  selectedMarca: string | null;
  onSelectMarca: (marca: string | null) => void;
  onHoverMarca?: (marca: string | null) => void;
}

const PAGE_SIZE = 20;

export function PremiumTopProdutos({
  produtos, resumoVendas = [], selectedMarca, onSelectMarca,
}: PremiumTopProdutosProps) {
  const [busca, setBusca] = useState('');
  const [mostrar, setMostrar] = useState(PAGE_SIZE);
  const [produtoDetalhe, setProdutoDetalhe] = useState<TopProdutoAgg | null>(null);

  const filtrados = useMemo(() => {
    const base = selectedMarca
      ? produtos.filter(p => (p.marca || '').toUpperCase().trim() === selectedMarca.toUpperCase().trim())
      : produtos;
    if (!busca.trim()) return base;
    const q = busca.toLowerCase();
    return base.filter(p =>
      p.descricao.toLowerCase().includes(q) ||
      String(p.cod_produto).toLowerCase().includes(q) ||
      (p.marca || '').toLowerCase().includes(q)
    );
  }, [produtos, selectedMarca, busca]);

  const totalReceita = useMemo(() => filtrados.reduce((a, p) => a + p.faturamento, 0), [filtrados]);
  const totalQtd = useMemo(() => filtrados.reduce((a, p) => a + p.quantidade, 0), [filtrados]);
  const ticketMedio = filtrados.length > 0 ? totalReceita / filtrados.length : 0;
  const maxFat = filtrados.length > 0 ? Math.max(...filtrados.slice(0, 50).map(p => Math.abs(p.faturamento))) : 1;

  const visiveis = filtrados.slice(0, mostrar);

  // ============= IA INSIGHTS =============
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiUsedFallback, setAiUsedFallback] = useState(false);

  // Assinatura estável do dataset atual (qtd produtos + receita arredondada + marca)
  const datasetSignature = useMemo(() => {
    const marcaKey = selectedMarca || '__all__';
    return `${marcaKey}::${filtrados.length}::${Math.round(totalReceita)}`;
  }, [selectedMarca, filtrados.length, totalReceita]);

  const cacheKey = `produtos-insights-cache::${datasetSignature}`;

  const buildFallbackInsights = (): AIInsight[] => {
    if (filtrados.length === 0) return [];
    const ordenados = [...filtrados].sort((a, b) => b.faturamento - a.faturamento);
    const top1 = ordenados[0];
    const top5Receita = ordenados.slice(0, 5).reduce((a, p) => a + p.faturamento, 0);
    const concentracao = totalReceita > 0 ? (top5Receita / totalReceita) * 100 : 0;

    const ticketDeCadaProduto = ordenados.map(p => ({
      ...p,
      ticket: p.quantidade > 0 ? p.faturamento / p.quantidade : 0,
    }));
    const premium = [...ticketDeCadaProduto].sort((a, b) => b.ticket - a.ticket)[0];

    const escopo = selectedMarca ? `da marca ${selectedMarca}` : 'do ranking';

    return [
      {
        title: selectedMarca ? `Líder em ${selectedMarca}` : 'Produto líder',
        produto: top1?.descricao || null,
        value: formatCurrency(top1?.faturamento || 0, true),
        insight: `Maior faturamento ${escopo}. Representa ${totalReceita > 0 ? ((top1.faturamento / totalReceita) * 100).toFixed(1) : 0}% do total.`,
        type: 'destaque',
      },
      {
        title: 'Concentração Top 5',
        produto: null,
        value: `${concentracao.toFixed(1)}%`,
        insight: concentracao > 60
          ? `Receita muito concentrada no Top 5 ${escopo} — diversifique o mix para reduzir risco.`
          : `Distribuição saudável de receita ${escopo}.`,
        type: concentracao > 60 ? 'risco' : 'oportunidade',
      },
      {
        title: 'Ticket premium',
        produto: premium?.descricao || null,
        value: formatCurrency(premium?.ticket || 0, true),
        insight: `Maior ticket por unidade ${escopo}. Avalie ampliar mix premium similar.`,
        type: 'oportunidade',
      },
    ];
  };

  const fetchInsights = async (force = false) => {
    if (filtrados.length === 0) return;

    // Cache hit: usa sem chamar a IA
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
      const payload = filtrados.slice(0, 60).map(p => ({
        cod_produto: p.cod_produto,
        descricao: p.descricao,
        marca: p.marca,
        faturamento: p.faturamento,
        quantidade: p.quantidade,
      }));
      const { data, error } = await supabase.functions.invoke('produtos-insights', {
        body: { produtos: payload, marcaFoco: selectedMarca },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (Array.isArray(data?.insights) && data.insights.length > 0) {
        setAiInsights(data.insights);
        setAiUsedFallback(false);
        try { sessionStorage.setItem(cacheKey, JSON.stringify(data.insights)); } catch { /* ignore quota */ }
      } else {
        throw new Error('Resposta vazia');
      }
    } catch (e: any) {
      console.error('produtos-insights error', e);
      setAiInsights(buildFallbackInsights());
      setAiUsedFallback(true);
      toast.error('IA indisponível; mostrando insights calculados pelos dados.');
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (filtrados.length === 0) {
      setAiInsights([]);
      return;
    }
    // Tenta cache primeiro (instantâneo) e só chama IA se não houver cache para essa assinatura
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
      // Mostra fallback imediato e dispara IA em background uma única vez por assinatura
      setAiInsights(buildFallbackInsights());
      setAiUsedFallback(true);
      fetchInsights(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetSignature]);



  // Detalhes do produto selecionado (via resumoVendas)
  const detalhesProduto = useMemo(() => {
    if (!produtoDetalhe) return null;
    const cod = String(produtoDetalhe.cod_produto);
    const linhas = resumoVendas.filter(l => String(l.cod_produto) === cod);
    const receita = linhas.reduce((a, l) => a + l.receita, 0);
    const custo = linhas.reduce((a, l) => a + l.custo, 0);
    const lucro = linhas.reduce((a, l) => a + l.lucro, 0);
    const margem = receita > 0 ? (lucro / receita) * 100 : 0;

    // Top clientes
    const porCliente = new Map<string, { nome: string; receita: number; pedidos: number }>();
    linhas.forEach(l => {
      const key = l.cliente_razao || `Cliente ${l.cliente_codigo}` || '—';
      const cur = porCliente.get(key) || { nome: key, receita: 0, pedidos: 0 };
      cur.receita += l.receita;
      cur.pedidos += 1;
      porCliente.set(key, cur);
    });
    const topClientes = Array.from(porCliente.values()).sort((a, b) => b.receita - a.receita).slice(0, 5);

    // Por mês
    const porMes = new Map<string, number>();
    linhas.forEach(l => {
      const d = new Date(l.data);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      porMes.set(key, (porMes.get(key) || 0) + l.receita);
    });
    const evolucaoMensal = Array.from(porMes.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, valor]) => ({ mes, valor }));

    // Últimas NFs
    const ultimasNFs = [...linhas]
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
      .slice(0, 8);

    return {
      receita, custo, lucro, margem,
      pedidos: linhas.length,
      topClientes, evolucaoMensal, ultimasNFs,
    };
  }, [produtoDetalhe, resumoVendas]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Insights estratégicos da IA — substitui totalizadores repetidos */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/30">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-bold leading-tight">Insights da IA</h3>
            <p className="text-[11px] text-muted-foreground">
              {aiUsedFallback ? 'Calculados pelos dados' : 'Análise gerada por IA'}
              {selectedMarca && <> · marca <span className="text-primary font-semibold">{selectedMarca}</span></>}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchInsights(true)}
          disabled={aiLoading || filtrados.length === 0}
          className="h-8 gap-1.5 text-xs"
        >
          {aiLoading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <RefreshCw className="h-3.5 w-3.5" />}
          {aiLoading ? 'Gerando…' : 'Atualizar'}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {aiInsights.length === 0 && aiLoading && (
          <>
            <InsightSkeleton />
            <InsightSkeleton />
            <InsightSkeleton />
          </>
        )}
        {aiInsights.length === 0 && !aiLoading && (
          <Card className="sm:col-span-3 border-dashed border-border/60">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Sem produtos no recorte atual para gerar insights.
            </CardContent>
          </Card>
        )}
        {aiInsights.map((ins, i) => (
          <InsightCard key={i} insight={ins} />
        ))}
      </div>


      {/* Card principal premium */}
      <Card className="border-border/60 overflow-hidden shadow-lg shadow-primary/5">
        {/* Header com gradiente sutil */}
        <div className="relative p-5 border-b border-border/50 bg-gradient-to-br from-primary/5 via-transparent to-accent/5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/30">
                <Trophy className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">Ranking de Produtos</h3>
                <p className="text-xs text-muted-foreground">
                  Clique no nome do produto para ver o detalhamento completo
                  {selectedMarca && <> · marca <span className="text-primary font-semibold">{selectedMarca}</span></>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto, código ou marca..."
                  value={busca}
                  onChange={e => { setBusca(e.target.value); setMostrar(PAGE_SIZE); }}
                  className="pl-9 h-9 text-sm bg-background/60 backdrop-blur"
                />
              </div>
              {selectedMarca && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectMarca(null)}
                  className="h-9 gap-1.5 text-xs"
                >
                  <X className="h-3 w-3" /> {selectedMarca}
                </Button>
              )}
            </div>
          </div>
        </div>

        <CardContent className="p-0">
          {visiveis.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              Nenhum produto encontrado.
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {/* Header da lista (desktop) */}
              <div className="hidden md:grid grid-cols-[56px_1fr_120px_180px_90px] gap-4 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40">
                <div>Rank</div>
                <div>Produto</div>
                <div className="text-right">Qtd vendida</div>
                <div className="text-right">Faturamento</div>
                <div className="text-right">Share</div>
              </div>

              {visiveis.map((p, i) => {
                const rank = i + 1;
                const share = totalReceita > 0 ? (p.faturamento / totalReceita) * 100 : 0;
                const barPct = (Math.abs(p.faturamento) / maxFat) * 100;
                const isTop3 = rank <= 3;
                const rankIcon = rank === 1 ? <Crown className="h-3.5 w-3.5" />
                  : rank === 2 ? <Medal className="h-3.5 w-3.5" />
                  : rank === 3 ? <Award className="h-3.5 w-3.5" />
                  : null;

                return (
                  <div
                    key={String(p.cod_produto) + i}
                    className={cn(
                      "group px-5 py-3.5 transition-all relative",
                      "hover:bg-gradient-to-r hover:from-primary/5 hover:via-transparent hover:to-transparent",
                      isTop3 && "bg-gradient-to-r from-amber-500/5 via-transparent to-transparent",
                    )}
                  >
                    {/* Layout desktop: grid */}
                    <div className="hidden md:grid grid-cols-[56px_1fr_120px_180px_90px] gap-4 items-center">
                      {/* Rank com ícone para top 3 */}
                      <div className="flex items-center justify-center">
                        <div className={cn(
                          "h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold tabular-nums shadow-sm transition-transform group-hover:scale-110",
                          rank === 1 && "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-amber-500/40",
                          rank === 2 && "bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-slate-400/40",
                          rank === 3 && "bg-gradient-to-br from-orange-400 to-orange-700 text-white shadow-orange-500/40",
                          !isTop3 && "bg-muted/70 text-muted-foreground border border-border/60",
                        )}>
                          {rankIcon || rank}
                        </div>
                      </div>

                      {/* Produto - título clicável */}
                      <div className="min-w-0">
                        <button
                          onClick={() => setProdutoDetalhe(p)}
                          className="group/title text-left w-full"
                        >
                          <span className={cn(
                            "font-medium text-sm truncate inline-flex items-center gap-1.5",
                            "text-foreground hover:text-primary transition-colors",
                            "underline-offset-4 hover:underline decoration-primary/40 decoration-1",
                          )} title={`Ver detalhes de ${p.descricao}`}>
                            {p.descricao}
                            <ArrowUpRight className="h-3 w-3 opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0" />
                          </span>
                        </button>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-muted-foreground font-mono">#{p.cod_produto}</span>
                          {p.marca && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onSelectMarca(selectedMarca === p.marca ? null : p.marca!); }}
                              className={cn(
                                "text-[11px] px-1.5 py-0.5 rounded-md border transition-all",
                                selectedMarca === p.marca
                                  ? "bg-primary/15 border-primary/40 text-primary font-semibold"
                                  : "bg-muted/40 border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary"
                              )}
                            >
                              {p.marca}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Qtd */}
                      <div className="text-right tabular-nums text-sm font-medium">
                        {formatNumber(p.quantidade)}
                      </div>

                      {/* Faturamento + barra premium */}
                      <div className="text-right">
                        <div className="font-bold text-sm tabular-nums">{formatCurrency(p.faturamento, true)}</div>
                        <div className="h-1.5 mt-1.5 rounded-full bg-muted/60 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-700",
                              isTop3
                                ? "bg-gradient-to-r from-amber-400 to-amber-600"
                                : "bg-gradient-to-r from-primary to-primary/70"
                            )}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Share */}
                      <div className="text-right">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "tabular-nums text-xs font-semibold",
                            share > 5 && "bg-primary/15 text-primary border-primary/30"
                          )}
                        >
                          {share.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>

                    {/* Layout mobile */}
                    <div className="md:hidden flex items-start gap-3">
                      <div className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 shadow-sm",
                        rank === 1 && "bg-gradient-to-br from-amber-400 to-amber-600 text-white",
                        rank === 2 && "bg-gradient-to-br from-slate-300 to-slate-500 text-white",
                        rank === 3 && "bg-gradient-to-br from-orange-400 to-orange-700 text-white",
                        !isTop3 && "bg-muted/70 text-muted-foreground border border-border/60",
                      )}>
                        {rankIcon || rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => setProdutoDetalhe(p)}
                          className="text-left w-full"
                        >
                          <span className="font-medium text-sm leading-tight text-foreground hover:text-primary inline-flex items-center gap-1">
                            {p.descricao}
                            <ArrowUpRight className="h-3 w-3 shrink-0" />
                          </span>
                        </button>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          #{p.cod_produto}{p.marca ? ` · ${p.marca}` : ''}
                        </div>
                        <div className="flex items-center justify-between mt-2 gap-2">
                          <span className="text-xs text-muted-foreground">
                            {formatNumber(p.quantidade)} un.
                          </span>
                          <span className="font-bold text-sm tabular-nums">
                            {formatCurrency(p.faturamento, true)}
                          </span>
                          <Badge variant="secondary" className="tabular-nums text-[10px]">
                            {share.toFixed(1)}%
                          </Badge>
                        </div>
                        <div className="h-1.5 mt-1.5 rounded-full bg-muted/60 overflow-hidden">
                          <div
                            className={cn(
                              "h-full bg-gradient-to-r",
                              isTop3 ? "from-amber-400 to-amber-600" : "from-primary to-primary/70"
                            )}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          {filtrados.length > mostrar && (
            <div className="p-3 border-t border-border/50 flex items-center justify-between bg-muted/20">
              <span className="text-xs text-muted-foreground">
                Mostrando {visiveis.length} de {formatNumber(filtrados.length)} produtos
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMostrar(m => m + PAGE_SIZE)}
                className="h-8 text-xs"
              >
                Mostrar mais 20
              </Button>
            </div>
          )}
          {filtrados.length > 0 && filtrados.length <= mostrar && (
            <div className="p-3 border-t border-border/50 text-xs text-muted-foreground text-center bg-muted/20">
              {formatNumber(filtrados.length)} produtos exibidos · Total {formatCurrency(totalReceita, true)} · {formatNumber(totalQtd)} unidades
            </div>
          )}
        </CardContent>
      </Card>

      {/* DRAWER LATERAL - detalhes do produto */}
      <Sheet open={!!produtoDetalhe} onOpenChange={(open) => !open && setProdutoDetalhe(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {produtoDetalhe && (
            <>
              <SheetHeader className="pb-4 border-b border-border/50">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
                    <Package className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-left text-base leading-tight">{produtoDetalhe.descricao}</SheetTitle>
                    <SheetDescription className="flex items-center gap-2 mt-1 text-xs">
                      <span className="font-mono">#{produtoDetalhe.cod_produto}</span>
                      {produtoDetalhe.marca && (
                        <>
                          <span>·</span>
                          <button
                            onClick={() => { onSelectMarca(produtoDetalhe.marca!); setProdutoDetalhe(null); }}
                            className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                          >
                            {produtoDetalhe.marca}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </button>
                        </>
                      )}
                      {produtoDetalhe.categoria && <span>· {produtoDetalhe.categoria}</span>}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-5 py-5">
                {/* KPIs do produto */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <DetalheKPI
                    label="Receita"
                    value={formatCurrency(produtoDetalhe.faturamento, true)}
                    color="primary"
                  />
                  <DetalheKPI
                    label="Quantidade"
                    value={formatNumber(produtoDetalhe.quantidade)}
                    color="success"
                  />
                  <DetalheKPI
                    label="Pedidos"
                    value={formatNumber(detalhesProduto?.pedidos || produtoDetalhe.pedidos || 0)}
                    color="accent"
                  />
                  <DetalheKPI
                    label="Margem"
                    value={`${(detalhesProduto?.margem || 0).toFixed(1)}%`}
                    color={(detalhesProduto?.margem || 0) > 20 ? 'success' : (detalhesProduto?.margem || 0) > 10 ? 'warning' : 'destructive'}
                  />
                </div>

                {/* Margem detalhada */}
                {detalhesProduto && detalhesProduto.receita > 0 && (
                  <div className="p-3 rounded-lg border border-border/60 bg-muted/20">
                    <div className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wide mb-2 flex items-center gap-1.5">
                      <BarChart3 className="h-3 w-3" /> Rentabilidade
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <div className="text-[11px] text-muted-foreground">Receita</div>
                        <div className="font-semibold tabular-nums">{formatCurrency(detalhesProduto.receita, true)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-muted-foreground">Custo</div>
                        <div className="font-semibold tabular-nums text-muted-foreground">{formatCurrency(detalhesProduto.custo, true)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-muted-foreground">Lucro</div>
                        <div className={cn(
                          "font-semibold tabular-nums",
                          detalhesProduto.lucro >= 0 ? "text-success" : "text-destructive"
                        )}>
                          {formatCurrency(detalhesProduto.lucro, true)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Top Clientes */}
                {detalhesProduto && detalhesProduto.topClientes.length > 0 && (
                  <div>
                    <h4 className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wide mb-2 flex items-center gap-1.5">
                      <User className="h-3 w-3" /> Top 5 clientes que compraram
                    </h4>
                    <div className="space-y-1.5">
                      {detalhesProduto.topClientes.map((c, i) => {
                        const maxC = detalhesProduto.topClientes[0].receita || 1;
                        const pct = (c.receita / maxC) * 100;
                        return (
                          <div key={i} className="p-2.5 rounded-md border border-border/50 bg-muted/10">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-sm font-medium truncate">{c.nome}</span>
                              <span className="text-sm font-bold tabular-nums shrink-0">{formatCurrency(c.receita, true)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground mb-1">
                              <span>{c.pedidos} {c.pedidos === 1 ? 'compra' : 'compras'}</span>
                            </div>
                            <div className="h-1 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-primary to-primary/60" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Evolução mensal */}
                {detalhesProduto && detalhesProduto.evolucaoMensal.length > 1 && (
                  <div>
                    <h4 className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wide mb-2 flex items-center gap-1.5">
                      <TrendingUp className="h-3 w-3" /> Evolução mensal de receita
                    </h4>
                    <div className="p-3 rounded-lg border border-border/60 bg-muted/10">
                      <Sparkline data={detalhesProduto.evolucaoMensal.map(e => e.valor)} />
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                        <span>{formatMes(detalhesProduto.evolucaoMensal[0].mes)}</span>
                        <span>{formatMes(detalhesProduto.evolucaoMensal[detalhesProduto.evolucaoMensal.length - 1].mes)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Últimas NFs */}
                {detalhesProduto && detalhesProduto.ultimasNFs.length > 0 && (
                  <div>
                    <h4 className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wide mb-2 flex items-center gap-1.5">
                      <FileText className="h-3 w-3" /> Últimas movimentações
                    </h4>
                    <div className="rounded-md border border-border/50 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                          <tr>
                            <th className="text-left px-2.5 py-1.5 font-semibold">Data</th>
                            <th className="text-left px-2.5 py-1.5 font-semibold">NF</th>
                            <th className="text-left px-2.5 py-1.5 font-semibold">Cliente</th>
                            <th className="text-right px-2.5 py-1.5 font-semibold">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalhesProduto.ultimasNFs.map((l, i) => (
                            <tr key={i} className="border-t border-border/40 hover:bg-muted/20">
                              <td className="px-2.5 py-1.5 tabular-nums text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="h-2.5 w-2.5" />
                                  {l.data ? new Date(l.data).toLocaleDateString('pt-BR') : '—'}
                                </span>
                              </td>
                              <td className="px-2.5 py-1.5 font-mono">{l.num_nf || '—'}</td>
                              <td className="px-2.5 py-1.5 truncate max-w-[180px]">{l.cliente_razao || '—'}</td>
                              <td className={cn(
                                "px-2.5 py-1.5 text-right tabular-nums font-semibold",
                                l.tipo === 'DEVOLUCAO' && "text-destructive"
                              )}>
                                {formatCurrency(l.receita, true)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {!detalhesProduto?.ultimasNFs.length && resumoVendas.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Detalhamento por NF não disponível neste período.
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ResumoCard({
  icon, label, value, gradient, iconBg,
}: { icon: React.ReactNode; label: string; value: string; gradient: string; iconBg: string }) {
  return (
    <Card className={cn(
      "border-border/60 overflow-hidden relative bg-gradient-to-br shadow-md",
      gradient,
    )}>
      <CardContent className="p-4 flex items-center gap-3 relative z-10">
        <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm", iconBg)}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wide">{label}</p>
          <p className="text-lg font-bold tabular-nums truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DetalheKPI({
  label, value, color,
}: { label: string; value: string; color: 'primary' | 'success' | 'accent' | 'warning' | 'destructive' }) {
  return (
    <div className={cn(
      "p-2.5 rounded-lg border bg-gradient-to-br",
      color === 'primary' && "border-primary/30 from-primary/10 to-transparent",
      color === 'success' && "border-success/30 from-success/10 to-transparent",
      color === 'accent' && "border-accent/30 from-accent/10 to-transparent",
      color === 'warning' && "border-warning/30 from-warning/10 to-transparent",
      color === 'destructive' && "border-destructive/30 from-destructive/10 to-transparent",
    )}>
      <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">{label}</div>
      <div className={cn(
        "text-base font-bold tabular-nums truncate",
        color === 'primary' && "text-primary",
        color === 'success' && "text-success",
        color === 'accent' && "text-foreground",
        color === 'warning' && "text-warning",
        color === 'destructive' && "text-destructive",
      )}>
        {value}
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 32;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${h} ${points} ${w},${h}`}
        fill="url(#spark-grad)"
      />
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function formatMes(ym: string) {
  const [y, m] = ym.split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[Number(m) - 1]}/${y.slice(2)}`;
}

function InsightCard({ insight }: { insight: AIInsight }) {
  const cfg = {
    oportunidade: { icon: Lightbulb, grad: 'from-primary/20 via-primary/10 to-transparent', iconBg: 'bg-primary/15 text-primary', border: 'border-primary/30', label: 'Oportunidade' },
    destaque:     { icon: Trophy,    grad: 'from-success/20 via-success/10 to-transparent', iconBg: 'bg-success/15 text-success', border: 'border-success/30', label: 'Destaque' },
    alerta:       { icon: AlertTriangle, grad: 'from-warning/20 via-warning/10 to-transparent', iconBg: 'bg-warning/15 text-warning', border: 'border-warning/30', label: 'Alerta' },
    risco:        { icon: Target,    grad: 'from-destructive/20 via-destructive/10 to-transparent', iconBg: 'bg-destructive/15 text-destructive', border: 'border-destructive/30', label: 'Risco' },
  }[insight.type] ?? { icon: Sparkles, grad: 'from-accent/20 via-accent/10 to-transparent', iconBg: 'bg-accent/15 text-accent-foreground', border: 'border-accent/30', label: 'Insight' };
  const Icon = cfg.icon;
  return (
    <Card className={cn('overflow-hidden relative bg-gradient-to-br shadow-md hover:shadow-lg transition-shadow', cfg.grad, cfg.border)}>
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
        {insight.produto && (
          <p className="text-[11px] text-muted-foreground truncate" title={insight.produto}>
            {insight.produto}
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
