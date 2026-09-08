import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Trophy, AlertTriangle, Crown,
  ArrowUpRight, ArrowDownRight, Minus,
  Brain, RefreshCw, Zap, ShieldAlert,
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { MarcaAgg } from '@/types/comercialProdutos';

interface PremiumMarcasViewProps {
  porMarca: MarcaAgg[];
  selectedMarca: string | null;
  onSelectMarca: (marca: string | null) => void;
  periodoLabel?: string;
}

interface AIInsight {
  title: string;
  marca: string | null;
  value: string;
  insight: string;
  type: 'oportunidade' | 'alerta' | 'destaque' | 'risco';
}

function buildFallbackInsights(marcas: MarcaAgg[], selectedMarca: string | null): AIInsight[] {
  const ordered = [...marcas].sort((a, b) => b.faturamento - a.faturamento);
  const totalReceita = marcas.reduce((acc, m) => acc + m.faturamento, 0);
  const totalLucro = marcas.reduce((acc, m) => acc + m.lucro, 0);
  const margemPortfolio = totalReceita > 0 ? (totalLucro / totalReceita) * 100 : 0;

  // ===== Caso 1: marca específica selecionada =====
  if (selectedMarca) {
    const norm = selectedMarca.toUpperCase().trim();
    const foco = marcas.find(m => (m.marca || '').toUpperCase().trim() === norm);
    if (!foco) return [];
    const posicao = ordered.findIndex(m => (m.marca || '').toUpperCase().trim() === norm) + 1;
    const ticket = foco.produtos > 0 ? foco.faturamento / foco.produtos : 0;
    const deltaMargem = foco.margem - margemPortfolio;

    return [
      {
        title: 'Posição no portfólio',
        marca: foco.marca,
        value: `#${posicao || '—'} • ${foco.participacao.toFixed(1)}%`,
        insight: posicao <= 3
          ? `Marca estratégica — entre as ${posicao} maiores em receita do portfólio.`
          : `Marca em ${posicao}º lugar; avalie reforçar exposição se margem permitir.`,
        type: posicao <= 3 ? 'destaque' : 'oportunidade',
      },
      {
        title: 'Rentabilidade',
        marca: foco.marca,
        value: `${foco.margem.toFixed(1)}% margem`,
        insight: deltaMargem >= 0
          ? `Acima da média do portfólio (+${deltaMargem.toFixed(1)} p.p.). Mantenha política de preço.`
          : `Abaixo da média do portfólio (${deltaMargem.toFixed(1)} p.p.). Revise custo, desconto ou mix.`,
        type: deltaMargem >= 5 ? 'oportunidade' : deltaMargem < -5 ? 'risco' : 'alerta',
      },
      {
        title: 'Volume e ticket',
        marca: foco.marca,
        value: formatCurrency(ticket, true),
        insight: `Ticket médio por SKU em ${formatNumber(foco.produtos)} SKUs ativos e ${formatNumber(foco.quantidade)} unidades vendidas.`,
        type: 'destaque',
      },
      {
        title: 'Lucro absoluto',
        marca: foco.marca,
        value: formatCurrency(foco.lucro, true),
        insight: totalLucro > 0
          ? `Representa ${((foco.lucro / totalLucro) * 100).toFixed(1)}% do lucro total — peso direto na rentabilidade.`
          : 'Sem lucro registrado; priorize revisão de custos antes de novas campanhas.',
        type: foco.lucro > 0 ? 'oportunidade' : 'risco',
      },
    ];
  }

  // ===== Caso 2: visão geral =====
  const leader = ordered[0];
  if (!leader) return [];
  const profitable = [...marcas].filter(m => m.faturamento > 0).sort((a, b) => b.margem - a.margem)[0] || leader;
  const lowMargin = [...marcas].filter(m => m.faturamento > 0).sort((a, b) => a.margem - b.margem)[0] || leader;
  const hidden = [...marcas].filter(m => m.faturamento > 0 && m.margem >= 20).sort((a, b) => a.faturamento - b.faturamento)[0] || profitable;

  return [
    {
      title: 'Líder receita',
      marca: leader.marca,
      value: formatCurrency(leader.faturamento, true),
      insight: `${leader.participacao.toFixed(1)}% do portfólio; acompanhe mix e reposição.`,
      type: 'destaque',
    },
    {
      title: 'Melhor margem',
      marca: profitable.marca,
      value: `${profitable.margem.toFixed(1)}% margem`,
      insight: 'Priorize ações comerciais onde margem e volume sustentam ganho.',
      type: 'oportunidade',
    },
    {
      title: 'Atenção margem',
      marca: lowMargin.marca,
      value: `${lowMargin.margem.toFixed(1)}% margem`,
      insight: 'Revise preço, desconto ou custo antes de ampliar campanhas.',
      type: lowMargin.margem < 10 ? 'risco' : 'alerta',
    },
    {
      title: 'Potencial oculto',
      marca: hidden.marca,
      value: `${formatNumber(hidden.produtos)} SKUs`,
      insight: 'Marca rentável com espaço para ganhar exposição no ranking.',
      type: 'oportunidade',
    },
  ];
}

const TYPE_STYLES: Record<AIInsight['type'], {
  icon: React.ReactNode; border: string; iconBg: string;
}> = {
  oportunidade: {
    icon: <Zap className="h-5 w-5" />,
    border: 'border-emerald-500/40',
    iconBg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  },
  alerta: {
    icon: <AlertTriangle className="h-5 w-5" />,
    border: 'border-amber-500/40',
    iconBg: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  },
  destaque: {
    icon: <Crown className="h-5 w-5" />,
    border: 'border-primary/35',
    iconBg: 'bg-primary/10 text-primary border-primary/30',
  },
  risco: {
    icon: <ShieldAlert className="h-5 w-5" />,
    border: 'border-red-500/40',
    iconBg: 'bg-red-500/10 text-red-500 border-red-500/30',
  },
};

// Paleta premium sólida usada nos swatches das marcas.
const BRAND_SWATCHES = [
  'hsl(217, 91%, 54%)',
  'hsl(173, 80%, 38%)',
  'hsl(142, 71%, 40%)',
  'hsl(38, 92%, 48%)',
  'hsl(280, 65%, 52%)',
  'hsl(0, 72%, 50%)',
  'hsl(200, 80%, 46%)',
  'hsl(330, 70%, 48%)',
  'hsl(45, 95%, 45%)',
  'hsl(260, 75%, 55%)',
  'hsl(160, 70%, 37%)',
  'hsl(20, 85%, 50%)',
];

function lucroColor(margem: number) {
  if (margem >= 25) return 'text-success';
  if (margem >= 10) return 'text-warning';
  return 'text-destructive';
}

function lucroBg(margem: number) {
  if (margem >= 25) return 'bg-success/15 text-success border-success/30';
  if (margem >= 10) return 'bg-warning/15 text-warning border-warning/30';
  return 'bg-destructive/15 text-destructive border-destructive/30';
}

export function PremiumMarcasView({ porMarca, selectedMarca, onSelectMarca, periodoLabel }: PremiumMarcasViewProps) {
  const totalReceita = porMarca.reduce((a, m) => a + m.faturamento, 0);
  const maxReceita = porMarca[0]?.faturamento || 0;

  // ===== Insights por IA =====
  const [aiInsights, setAiInsights] = useState<AIInsight[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Fingerprint inclui marca selecionada — muda quando o usuário filtra
  const fingerprint = useMemo(() => {
    const top = [...porMarca]
      .sort((a, b) => b.faturamento - a.faturamento)
      .slice(0, 15)
      .map(m => `${m.marca}:${Math.round(m.faturamento)}`)
      .join('|');
    return `${selectedMarca || '*'}::${top}::${Math.round(totalReceita)}`;
  }, [porMarca, totalReceita, selectedMarca]);

  const cacheKey = `marcas-insights-cache::${fingerprint}`;

  const fetchInsights = async (force = false) => {
    if (!porMarca.length) return;

    // Cache em sessionStorage — sobrevive a desmontagem (sair/voltar à tela)
    if (!force) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as AIInsight[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAiInsights(parsed);
            setAiError(null);
            return;
          }
        }
      } catch { /* ignore */ }
    }

    // Mostra fallback imediato enquanto a IA processa — UX rápida
    if (!aiInsights) {
      const instant = buildFallbackInsights(porMarca, selectedMarca);
      if (instant.length) setAiInsights(instant);
    }

    setAiLoading(true);
    setAiError(null);
    try {
      const payload = porMarca.slice(0, 30).map(m => ({
        marca: m.marca,
        faturamento: m.faturamento,
        lucro: m.lucro,
        margem: m.margem,
        participacao: m.participacao,
        produtos: m.produtos,
        quantidade: m.quantidade,
      }));
      const { data, error } = await supabase.functions.invoke('marcas-insights', {
        body: { marcas: payload, periodo: periodoLabel, marcaFoco: selectedMarca },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (Array.isArray(data?.insights) && data.insights.length > 0) {
        setAiInsights(data.insights);
        try { sessionStorage.setItem(cacheKey, JSON.stringify(data.insights)); } catch { /* ignore */ }
      } else {
        throw new Error('Resposta inválida da IA');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Falha ao gerar insights';
      const fallback = buildFallbackInsights(porMarca, selectedMarca);
      setAiInsights(fallback.length ? fallback : null);
      setAiError(fallback.length ? null : msg);
      toast.error('IA indisponível no momento; mantendo insights calculados pelos dados.');
    } finally {
      setAiLoading(false);
    }
  };

  // Auto-fetch: usa cache se existir, senão chama IA. Roda quando fingerprint muda.
  useEffect(() => {
    if (!porMarca.length) return;
    fetchInsights(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  // Tendência simulada por margem (placeholder visual)
  const tendencia = (m: MarcaAgg): 'up' | 'down' | 'flat' => {
    if (m.margem >= 20) return 'up';
    if (m.margem < 5) return 'down';
    return 'flat';
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* INSIGHTS POR IA — cards diretos, reagem ao filtro de marca */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Brain className={cn("h-3.5 w-3.5 text-primary", aiLoading && 'animate-pulse')} />
            <span className="uppercase tracking-widest font-medium">
              {selectedMarca ? `Insights de IA · ${selectedMarca}` : 'Insights de IA · Visão geral'}
            </span>
          </div>
          <button
            onClick={() => fetchInsights(true)}
            disabled={aiLoading || !porMarca.length}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider disabled:opacity-40"
          >
            <RefreshCw className={cn("h-3 w-3", aiLoading && 'animate-spin')} />
            {aiLoading ? 'Analisando...' : 'Atualizar'}
          </button>
        </div>

        {aiLoading && !aiInsights && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-32 rounded-lg border border-border/60 bg-muted/30 animate-pulse" />
            ))}
          </div>
        )}

        {aiError && !aiInsights && (
          <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive">
            {aiError}
          </div>
        )}

        {aiInsights && (
          <div className={cn(
            "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in transition-opacity",
            aiLoading && 'opacity-60'
          )}>
            {aiInsights.map((ins, i) => {
              const style = TYPE_STYLES[ins.type] || TYPE_STYLES.destaque;
              const clickable = !!ins.marca && porMarca.some(m => m.marca === ins.marca);
              return (
                <AIInsightCard
                  key={`${ins.title}-${i}`}
                  icon={style.icon}
                  title={ins.title}
                  value={ins.value}
                  marca={ins.marca}
                  insight={ins.insight}
                  border={style.border}
                  iconBg={style.iconBg}
                  onClick={clickable ? () => onSelectMarca(ins.marca) : undefined}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* TABELA UNIFICADA — Ranking + Receita + Share + Margem */}
      <Card className="premium-card border-border/60">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <div>
                <div>Ranking de Marcas</div>
                <div className="text-[10px] font-normal text-muted-foreground uppercase tracking-widest mt-0.5">
                  Clique em uma linha para filtrar tudo abaixo
                </div>
              </div>
            </CardTitle>
            <div className="flex items-center gap-3">
              {selectedMarca && (
                <button
                  onClick={() => onSelectMarca(null)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-md text-xs text-primary hover:bg-primary/20 transition-colors"
                >
                  <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="uppercase tracking-wider font-medium">Filtro: {selectedMarca}</span>
                  <span className="text-primary/60 hover:text-primary text-base leading-none ml-1">×</span>
                </button>
              )}
              <span className="text-xs text-muted-foreground">
                {porMarca.length} marcas
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {/* DESKTOP TABLE */}
          <div className="hidden md:block overflow-y-auto max-h-[600px] rounded-md border border-border/60 mx-3 sm:mx-0">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-20">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground [&>th]:bg-card [&>th]:border-b [&>th]:border-border">
                  <th className="px-3 py-2.5 w-12">Rank</th>
                  <th className="px-3 py-2.5">Marca</th>
                  <th className="px-3 py-2.5 text-right">SKUs</th>
                  <th className="px-3 py-2.5 text-right">Qtd</th>
                  <th className="px-3 py-2.5 min-w-[200px]">Receita</th>
                  <th className="px-3 py-2.5 text-right">Share</th>
                  <th className="px-3 py-2.5 text-right">Lucro</th>
                  <th className="px-3 py-2.5 text-right">Margem</th>
                  <th className="px-3 py-2.5 text-center w-16">Tend.</th>
                </tr>
              </thead>
              <tbody>
                {porMarca.map((m, i) => {
                  const isSelected = selectedMarca === m.marca;
                  const isDimmed = selectedMarca && !isSelected;
                  const trend = tendencia(m);
                  const swatch = BRAND_SWATCHES[i % BRAND_SWATCHES.length];
                  const pctMax = maxReceita > 0 ? (m.faturamento / maxReceita) * 100 : 0;
                  return (
                    <tr
                      key={m.marca}
                      onClick={() => onSelectMarca(isSelected ? null : m.marca)}
                      className={cn(
                        "border-t border-border/40 cursor-pointer transition-colors duration-150 group",
                        isSelected
                          ? 'bg-primary/10 hover:bg-primary/15'
                          : 'hover:bg-muted/50',
                        isDimmed && 'opacity-50'
                      )}
                    >
                      {/* Rank com medalha */}
                      <td className="px-3 py-2.5">
                        {i === 0 && <Crown className="h-4 w-4 text-amber-400 fill-amber-400/30" />}
                        {i === 1 && <Trophy className="h-4 w-4 text-slate-300" />}
                        {i === 2 && <Trophy className="h-4 w-4 text-orange-400" />}
                        {i > 2 && <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>}
                      </td>
                      {/* Marca */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-sm shrink-0"
                            style={{ backgroundColor: swatch }}
                          />
                          <span className={cn("font-medium truncate", isSelected && 'text-primary font-bold')}>
                            {m.marca}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                        {m.produtos}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">
                        {formatNumber(m.quantidade)}
                      </td>
                      {/* Receita com barra proporcional ao Top 1 */}
                      <td className="px-3 py-2.5 min-w-[200px]">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={cn(
                            "font-semibold tabular-nums text-sm",
                            isSelected && 'text-primary'
                          )}>
                            {formatCurrency(m.faturamento)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                          <div
                            className="h-full bg-primary transition-[width] duration-700 ease-out"
                            style={{
                              width: `${Math.max(2, pctMax)}%`,
                            }}
                          />
                        </div>
                      </td>
                      {/* Share */}
                      <td className="px-3 py-2.5 text-right">
                        <span className={cn(
                          "text-xs tabular-nums",
                          isSelected ? 'text-primary font-semibold' : 'text-muted-foreground'
                        )}>
                          {m.participacao.toFixed(1)}%
                        </span>
                      </td>
                      {/* Lucro */}
                      <td className="px-3 py-2.5 text-right">
                        <span className={cn("text-xs font-semibold tabular-nums", lucroColor(m.margem))}>
                          {formatCurrency(m.lucro)}
                        </span>
                      </td>
                      {/* Margem badge */}
                      <td className="px-3 py-2.5 text-right">
                        <Badge variant="outline" className={cn("h-5 text-[10px] tabular-nums px-2", lucroBg(m.margem))}>
                          {m.margem.toFixed(1)}%
                        </Badge>
                      </td>
                      {/* Tendência */}
                      <td className="px-3 py-2.5 text-center">
                        {trend === 'up' && <ArrowUpRight className="h-4 w-4 text-success inline" />}
                        {trend === 'down' && <ArrowDownRight className="h-4 w-4 text-destructive inline" />}
                        {trend === 'flat' && <Minus className="h-4 w-4 text-muted-foreground inline" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS */}
          <div className="md:hidden space-y-2 p-3">
            {porMarca.map((m, i) => {
              const isSelected = selectedMarca === m.marca;
              const isDimmed = selectedMarca && !isSelected;
              const trend = tendencia(m);
              const swatch = BRAND_SWATCHES[i % BRAND_SWATCHES.length];
              const pctMax = maxReceita > 0 ? (m.faturamento / maxReceita) * 100 : 0;
              return (
                <div
                  key={m.marca}
                  onClick={() => onSelectMarca(isSelected ? null : m.marca)}
                  className={cn(
                    "p-3 rounded-lg border transition-colors cursor-pointer",
                    isSelected
                      ? 'border-primary/60 bg-primary/10'
                      : 'border-border/60 bg-card hover:border-border',
                    isDimmed && 'opacity-50'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: swatch }}
                      >
                        {i + 1}
                      </span>
                      <span className="font-semibold truncate">{m.marca}</span>
                    </div>
                    {trend === 'up' && <ArrowUpRight className="h-4 w-4 text-success shrink-0" />}
                    {trend === 'down' && <ArrowDownRight className="h-4 w-4 text-destructive shrink-0" />}
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">Receita</div>
                      <div className="font-semibold tabular-nums">{formatCurrency(m.faturamento, true)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">Share</div>
                      <div className="font-semibold tabular-nums">{m.participacao.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">Lucro</div>
                      <div className={cn("font-semibold tabular-nums", lucroColor(m.margem))}>
                        {formatCurrency(m.lucro, true)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">Margem</div>
                      <Badge variant="outline" className={cn("h-5 text-[10px] tabular-nums px-1.5", lucroBg(m.margem))}>
                        {m.margem.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-[width] duration-500"
                      style={{
                        width: `${Math.max(2, pctMax)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer com total */}
          <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between px-3 sm:px-0 pb-3 sm:pb-0 text-xs">
            <span className="text-muted-foreground uppercase tracking-widest text-[10px]">
              Total {porMarca.length} marcas
            </span>
            <span className="font-semibold tabular-nums">{formatCurrency(totalReceita)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface AIInsightCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  marca: string | null;
  insight: string;
  border: string;
  iconBg: string;
  onClick?: () => void;
}

function AIInsightCard({ icon, title, value, marca, insight, border, iconBg, onClick }: AIInsightCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "text-left p-4 rounded-lg border bg-card transition-colors duration-200 flex flex-col h-full",
        border,
        onClick ? 'hover:bg-muted/30 cursor-pointer' : 'cursor-default'
      )}
    >
      <div className="flex items-start gap-3 mb-2">
        <div className={cn("h-10 w-10 rounded-lg border flex items-center justify-center shrink-0", iconBg)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {title}
          </div>
          <div className="text-base font-bold truncate mt-0.5">{value}</div>
          {marca && (
            <div className="text-[11px] text-muted-foreground truncate font-medium">{marca}</div>
          )}
        </div>
      </div>
      <p className="text-[11px] leading-relaxed text-foreground/80 mt-1">
        {insight}
      </p>
    </button>
  );
}

