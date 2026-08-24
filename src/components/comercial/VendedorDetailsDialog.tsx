import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  DollarSign, Target, TrendingUp, TrendingDown, Users, ReceiptText,
  Trophy, AlertTriangle, Sparkles, MapPin, Calendar, Percent, Package, Loader2, Crown, Medal, Award
} from 'lucide-react';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import type { Pedido, Devolucao } from '@/types/comercial';

/* ─────────── Palette (escopo 1005) ─────────── */
const C = {
  bg0: '#070B14',
  card: '#111827',
  card2: '#161F32',
  border: 'rgba(148,163,184,0.10)',
  text: '#FFFFFF',
  sub: '#94A3B8',
  blue: '#3B82F6',
  green: '#10B981',
  amber: '#F59E0B',
  red: '#EF4444',
  violet: '#8B5CF6',
};

interface VendedorRow {
  codigo: string | number;
  nome: string;
  metaMensal: number;
  faturamentoMesAtual: number;
  valorPendente: number;
  valorTotal: number;
  percentualMetaFaturado: number;
  percentualMetaTotal: number;
  diferenca: number;
  status: 'acima' | 'proximo' | 'abaixo';
  metaDiaria: number;
  metaEsperada: number;
  ticketMedio?: number;
}

interface Props {
  vendedor: VendedorRow | null;
  ranking: number;
  pedidos: Pedido[];
  devolucoes: Devolucao[];
  diasUteisNoMes: number;
  diasUteisDecorridos: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VendedorDetailsDialog({ vendedor, ranking, pedidos, devolucoes, diasUteisNoMes, diasUteisDecorridos, open, onOpenChange }: Props) {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const is1005 = String(codEmpresaAtiva ?? '') === '1005';
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const stats = useMemo(() => {
    if (!vendedor) return null;
    const pedidosV = pedidos.filter(p => String(p.vendedor_codigo) === String(vendedor.codigo));
    const devsV = devolucoes.filter(d => String(d.vendedor_codigo) === String(vendedor.codigo));

    const pedidosOnly = pedidosV.filter(p => p.tipo !== 'DEVOLUCAO');
    // Devoluções: o pipeline unifica tudo em `pedidos` com tipo=DEVOLUCAO.
    // Se o array unificado tiver devoluções, usamos ele; senão, caímos no array legado `devsV`.
    const devsUnificadas = pedidosV.filter(p => p.tipo === 'DEVOLUCAO');
    const totalDevolucoes = devsUnificadas.length > 0
      ? devsUnificadas.reduce((s, d: any) => s + Math.abs(d.valor_devolucao_real ?? d.valor_real ?? d.valor_liquido ?? d.valor_total ?? 0), 0)
      : devsV.reduce((s, d) => s + Math.abs(d.valor_total || d.valor_liquido || 0), 0);
    const qtdPedidos = pedidosOnly.length;
    const qtdDevolucoes = devsUnificadas.length > 0 ? devsUnificadas.length : devsV.length;
    const ticket = qtdPedidos > 0 ? vendedor.faturamentoMesAtual / qtdPedidos : 0;

    // Valor por linha: prioriza valor_liquido (faturado), mas cai para valor_real/valor_liquido_coluna/valor_bruto
    // quando o pedido ainda não foi faturado (sem data_faturamento), evitando Top 5 zerado.
    const valorLinha = (p: any) => {
      const v = Math.abs(p.valor_liquido || 0);
      if (v > 0) return v;
      return Math.abs(p.valor_real || p.valor_liquido_coluna || p.valor_bruto || 0);
    };

    // Clientes únicos
    const clientesMap = new Map<string, { nome: string; uf?: string; valor: number; pedidos: number }>();
    for (const p of pedidosOnly) {
      const key = String(p.cliente_codigo);
      const nome = p.cliente_fantasia || p.cliente_razao || `Cliente ${key}`;
      const cur = clientesMap.get(key) || { nome, uf: p.cliente_uf, valor: 0, pedidos: 0 };
      cur.valor += valorLinha(p);
      cur.pedidos += 1;
      clientesMap.set(key, cur);
    }
    const topClientes = Array.from(clientesMap.values()).sort((a, b) => b.valor - a.valor).slice(0, 5);
    const qtdClientes = clientesMap.size;

    // UFs
    const ufMap = new Map<string, number>();
    for (const p of pedidosOnly) {
      const uf = p.cliente_uf || '—';
      ufMap.set(uf, (ufMap.get(uf) || 0) + valorLinha(p));
    }
    const topUFs = Array.from(ufMap.entries()).map(([uf, valor]) => ({ uf, valor })).sort((a, b) => b.valor - a.valor).slice(0, 5);

    // Faturado por dia (top dias)
    const diaMap = new Map<string, number>();
    for (const p of pedidosOnly) {
      const data = (p.data_faturamento || p.data_pedido || '').toString().substring(0, 10);
      if (!data) continue;
      diaMap.set(data, (diaMap.get(data) || 0) + valorLinha(p));
    }
    const diasAtivos = diaMap.size;
    const melhorDia = Array.from(diaMap.entries()).sort((a, b) => b[1] - a[1])[0];

    const taxaDevolucao = vendedor.faturamentoMesAtual > 0 ? (totalDevolucoes / vendedor.faturamentoMesAtual) * 100 : 0;
    const mediaDiaria = diasUteisDecorridos > 0 ? vendedor.faturamentoMesAtual / diasUteisDecorridos : 0;
    const projecaoFimMes = mediaDiaria * diasUteisNoMes;
    const gapMeta = vendedor.metaMensal - vendedor.faturamentoMesAtual;
    const diasRestantes = Math.max(0, diasUteisNoMes - diasUteisDecorridos);
    const ritmoNecessario = diasRestantes > 0 ? gapMeta / diasRestantes : 0;

    return {
      qtdPedidos, qtdDevolucoes, ticket, topClientes, qtdClientes, topUFs,
      diasAtivos, melhorDia, taxaDevolucao, mediaDiaria, projecaoFimMes,
      gapMeta, diasRestantes, ritmoNecessario, totalDevolucoes,
    };
  }, [vendedor, pedidos, devolucoes, diasUteisNoMes, diasUteisDecorridos]);

  const gerarInsightsIA = async () => {
    if (!vendedor || !stats) return;
    setAiLoading(true);
    setAiError(null);
    setAiInsights(null);
    try {
      const contexto = {
        vendedor: {
          nome: vendedor.nome,
          ranking,
          meta_mensal: Math.round(vendedor.metaMensal),
          faturado: Math.round(vendedor.faturamentoMesAtual),
          valor_em_aberto: Math.round(vendedor.valorPendente),
          atingimento_pct: +vendedor.percentualMetaFaturado.toFixed(1),
          status: vendedor.status,
          ticket_medio: Math.round(stats.ticket),
          qtd_pedidos: stats.qtdPedidos,
          qtd_clientes: stats.qtdClientes,
          qtd_devolucoes: stats.qtdDevolucoes,
          total_devolucoes: Math.round(stats.totalDevolucoes),
          taxa_devolucao_pct: +stats.taxaDevolucao.toFixed(2),
          media_diaria: Math.round(stats.mediaDiaria),
          projecao_fim_mes: Math.round(stats.projecaoFimMes),
          gap_meta: Math.round(stats.gapMeta),
          dias_restantes: stats.diasRestantes,
          ritmo_necessario_dia: Math.round(stats.ritmoNecessario),
          top_clientes: stats.topClientes.map(c => ({ nome: c.nome, uf: c.uf, valor: Math.round(c.valor), pedidos: c.pedidos })),
          top_estados: stats.topUFs.map(u => ({ uf: u.uf, valor: Math.round(u.valor) })),
        },
      };
      const prompt = `Analise este vendedor de forma MUITO RESUMIDA e direto ao ponto. Responda em markdown com 3 seções curtas:

1. **📊 Diagnóstico** — 1 frase com status (faturado, % meta, gap, ritmo/dia necessário).
2. **⚠️ Riscos** — no máximo 2 bullets de 1 linha cada, só os pontos mais críticos.
3. **🎯 Ações** — no máximo 3 bullets de 1 linha cada, práticos para bater a meta.

Sem introduções, sem rodeios, sem repetir dados óbvios. Use números apenas quando essenciais.`;

      const { data, error } = await supabase.functions.invoke('comercial-ai-chat', {
        body: { messages: [{ role: 'user', content: prompt }], contexto },
      });
      if (error) throw error;
      setAiInsights(data?.reply || 'Sem resposta.');
    } catch (e: any) {
      setAiError(String(e?.message || e));
    } finally {
      setAiLoading(false);
    }
  };

  if (!vendedor || !stats) return null;

  const statusInfo = vendedor.status === 'acima'
    ? { label: 'Acima da meta', cls: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' }
    : vendedor.status === 'proximo'
    ? { label: 'Próximo da meta', cls: 'bg-amber-500/20 text-amber-500 border-amber-500/30' }
    : { label: 'Abaixo da meta', cls: 'bg-red-500/20 text-red-500 border-red-500/30' };

  // ============ THEMING (escopo 1005) ============
  if (is1005) {
    const rb =
      ranking === 1 ? { bg: `linear-gradient(135deg, ${C.amber}, #FBBF24)`, color: '#0B0F1A', icon: Crown }
      : ranking === 2 ? { bg: `linear-gradient(135deg, #CBD5E1, #94A3B8)`, color: '#0B0F1A', icon: Medal }
      : ranking === 3 ? { bg: `linear-gradient(135deg, #B45309, #92400E)`, color: '#FFF', icon: Award }
      : { bg: 'rgba(148,163,184,0.18)', color: C.sub, icon: null as any };
    const RbIcon = rb.icon;
    const stColor = vendedor.status === 'acima' ? C.green : vendedor.status === 'proximo' ? C.amber : C.red;
    const totalTop5 = stats.topClientes.reduce((s, c) => s + c.valor, 0) || 1;

    // Meta inconsistente no ERP: atingimento absurdo (>500%) ou meta nula
    const metaInconsistente = vendedor.metaMensal <= 0 || vendedor.percentualMetaFaturado > 500;
    const metaLabel = metaInconsistente ? 'Não cadastrada' : formatCurrency(vendedor.metaMensal);
    const atingLabel = metaInconsistente ? '—' : formatPercent(vendedor.percentualMetaFaturado);
    const metaDiariaLabel = metaInconsistente ? '—' : formatCurrency(vendedor.metaDiaria);
    const metaEsperadaLabel = metaInconsistente ? '—' : formatCurrency(vendedor.metaEsperada);
    const diferencaLabel = metaInconsistente ? '—' : formatCurrency(vendedor.diferenca);

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] p-0 gap-0 border-0 overflow-hidden"
          style={{
            background: `radial-gradient(1200px 600px at 80% -10%, ${C.blue}10, transparent 60%), ${C.bg0}`,
            border: `1px solid ${C.border}`,
          }}
        >
          <DialogHeader className="px-6 pt-6 pb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: rb.bg, color: rb.color }}
                >
                  {RbIcon ? <RbIcon className="w-5 h-5" /> : `#${ranking}`}
                </div>
                <div>
                  <DialogTitle className="text-xl uppercase tracking-wide" style={{ color: C.text }}>
                    {vendedor.nome}
                  </DialogTitle>
                  <DialogDescription className="mt-1" style={{ color: C.sub }}>
                    Diagnóstico completo de performance do vendedor
                  </DialogDescription>
                </div>
              </div>
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold"
                style={{ background: `${stColor}1A`, color: stColor, border: `1px solid ${stColor}33` }}
              >
                {statusInfo.label}
              </span>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-120px)]">
            <div className="p-6 space-y-5">
              {/* KPIs principais */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi1005 icon={DollarSign} label="Faturado" value={formatCurrency(vendedor.faturamentoMesAtual)} accent={C.green} />
                <Kpi1005 icon={Target} label="Meta" value={metaLabel} accent={metaInconsistente ? C.amber : C.blue} />
                <Kpi1005
                  icon={Percent}
                  label="Atingimento"
                  value={atingLabel}
                  accent={metaInconsistente ? C.amber : vendedor.percentualMetaFaturado >= 100 ? C.green : vendedor.percentualMetaFaturado >= 80 ? C.amber : C.red}
                />
                <Kpi1005 icon={ReceiptText} label="Em Aberto" value={formatCurrency(vendedor.valorPendente)} accent={C.amber} />
              </div>

              {metaInconsistente && (
                <div
                  className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
                  style={{ background: `${C.amber}14`, border: `1px solid ${C.amber}33`, color: C.text }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: C.amber }} />
                  <span>
                    Meta deste vendedor não está cadastrada corretamente no ERP para o período selecionado.
                    Os indicadores de meta (atingimento, diferença, ritmo) foram ocultados para evitar leitura incorreta.
                  </span>
                </div>
              )}

              {/* Progresso da meta */}
              <Panel1005>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold flex items-center gap-2" style={{ color: C.text }}>
                    <Target className="h-4 w-4" style={{ color: C.blue }} /> Progresso da Meta
                  </span>
                  <span className="font-mono" style={{ color: C.text }}>
                    {formatCurrency(vendedor.faturamentoMesAtual)} / {metaLabel}
                  </span>
                </div>
                <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(148,163,184,0.12)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: metaInconsistente ? '0%' : `${Math.min(100, vendedor.percentualMetaFaturado)}%`,
                      background: `linear-gradient(90deg, ${C.blue}, ${C.violet})`,
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 text-xs">
                  <Info1005 label="Meta diária" value={metaDiariaLabel} />
                  <Info1005 label="Meta esperada hoje" value={metaEsperadaLabel} />
                  <Info1005 label="Diferença" value={diferencaLabel} positive={!metaInconsistente && vendedor.diferenca >= 0} />
                  <Info1005 label="Projeção fim do mês" value={formatCurrency(stats.projecaoFimMes)} />
                </div>
              </Panel1005>

              {/* Operação */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: C.text }}>
                  <Package className="h-4 w-4" style={{ color: C.blue }} /> Operação no Período
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Kpi1005 icon={ReceiptText} label="Pedidos" value={String(stats.qtdPedidos)} accent={C.blue} small />
                  <Kpi1005 icon={Users} label="Clientes" value={String(stats.qtdClientes)} accent={C.violet} small />
                  <Kpi1005 icon={TrendingUp} label="Ticket médio" value={formatCurrency(stats.ticket)} accent={C.green} small />
                  <Kpi1005 icon={Calendar} label="Dias ativos" value={`${stats.diasAtivos} / ${diasUteisDecorridos}`} accent={C.blue} small />
                  <Kpi1005 icon={TrendingDown} label="Devoluções" value={formatCurrency(stats.totalDevolucoes)} accent={C.red} small />
                  <Kpi1005 icon={Percent} label="Taxa devolução" value={`${stats.taxaDevolucao.toFixed(2)}%`} accent={stats.taxaDevolucao > 5 ? C.red : C.green} small />
                  <Kpi1005 icon={TrendingUp} label="Média/dia útil" value={formatCurrency(stats.mediaDiaria)} accent={C.green} small />
                  <Kpi1005 icon={AlertTriangle} label="Ritmo p/ meta" value={metaInconsistente ? '—' : (stats.ritmoNecessario > 0 ? formatCurrency(stats.ritmoNecessario) + '/d' : '—')} accent={C.amber} small />
                </div>
              </div>

              {/* Top clientes */}
              <Panel1005>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: C.text }}>
                  <Trophy className="h-4 w-4" style={{ color: C.amber }} /> Top 5 Clientes
                </h3>
                {stats.topClientes.length === 0 ? (
                  <p className="text-sm" style={{ color: C.sub }}>Sem pedidos no período.</p>
                ) : (
                  <div className="space-y-2.5">
                    {stats.topClientes.map((c, i) => {
                      const pct = (c.valor / totalTop5) * 100;
                      const maxPct = (stats.topClientes[0].valor / totalTop5) * 100 || 1;
                      const barW = (pct / maxPct) * 100;
                      return (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <span
                            className="h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                            style={{ background: 'rgba(148,163,184,0.12)', color: C.sub }}
                          >
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between gap-2">
                              <span className="truncate font-medium" style={{ color: C.text }}>{c.nome}</span>
                              <span className="font-mono shrink-0" style={{ color: C.green }}>{formatCurrency(c.valor)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] mt-0.5" style={{ color: C.sub }}>
                              <span>{c.uf || '—'} · {c.pedidos} pedido{c.pedidos !== 1 ? 's' : ''}</span>
                              <span className="font-mono">{pct.toFixed(1)}% do Top 5</span>
                            </div>
                            <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(148,163,184,0.10)' }}>
                              <div className="h-full rounded-full" style={{ width: `${barW}%`, background: `linear-gradient(90deg, ${C.green}, ${C.blue})` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel1005>

              {/* UFs */}
              {stats.topUFs.length > 0 && (
                <Panel1005>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: C.text }}>
                    <MapPin className="h-4 w-4" style={{ color: C.blue }} /> Distribuição por Estado
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {stats.topUFs.map(u => (
                      <span
                        key={u.uf}
                        className="font-mono text-[11px] px-2.5 py-1 rounded-full"
                        style={{ background: `${C.blue}14`, color: C.text, border: `1px solid ${C.blue}33` }}
                      >
                        <span style={{ color: C.sub }}>{u.uf}:</span> {formatCurrency(u.valor)}
                      </span>
                    ))}
                  </div>
                </Panel1005>
              )}

              {/* Insights IA */}
              <Panel1005>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: C.text }}>
                    <Sparkles className="h-4 w-4" style={{ color: C.violet }} /> Insights da IA
                  </h3>
                  <Button
                    size="sm"
                    onClick={gerarInsightsIA}
                    disabled={aiLoading}
                    style={{ background: `linear-gradient(135deg, ${C.blue}, ${C.violet})`, color: '#fff', border: 'none' }}
                  >
                    {aiLoading ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Analisando...</> : <><Sparkles className="h-3.5 w-3.5 mr-2" /> {aiInsights ? 'Gerar novamente' : 'Gerar análise'}</>}
                  </Button>
                </div>
                {!aiInsights && !aiLoading && !aiError && (
                  <p className="text-sm" style={{ color: C.sub }}>
                    Clique em "Gerar análise" para receber um diagnóstico personalizado da IA com recomendações para este vendedor.
                  </p>
                )}
                {aiError && <p className="text-sm" style={{ color: C.red }}>{aiError}</p>}
                {aiInsights && (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none rounded-lg p-4"
                    style={{ background: 'rgba(148,163,184,0.06)', border: `1px solid ${C.border}` }}
                  >
                    <ReactMarkdown>{aiInsights}</ReactMarkdown>
                  </div>
                )}
              </Panel1005>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  }

  // ============ LEGACY (demais empresas) ============
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-12 w-12 rounded-full flex items-center justify-center text-base font-bold",
                ranking === 1 ? "bg-amber-500 text-black" :
                ranking === 2 ? "bg-slate-300 text-slate-900" :
                ranking === 3 ? "bg-amber-700 text-white" :
                "bg-muted text-muted-foreground"
              )}>
                #{ranking}
              </div>
              <div>
                <DialogTitle className="text-xl uppercase tracking-wide">{vendedor.nome}</DialogTitle>
                <DialogDescription className="mt-1">
                  Diagnóstico completo de performance do vendedor
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className={statusInfo.cls}>{statusInfo.label}</Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="p-6 space-y-6">
            {/* KPIs principais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPI icon={<DollarSign className="h-4 w-4" />} label="Faturado" value={formatCurrency(vendedor.faturamentoMesAtual)} color="emerald" />
              <KPI icon={<Target className="h-4 w-4" />} label="Meta" value={formatCurrency(vendedor.metaMensal)} color="primary" />
              <KPI icon={<Percent className="h-4 w-4" />} label="Atingimento" value={formatPercent(vendedor.percentualMetaFaturado)} color={vendedor.percentualMetaFaturado >= 100 ? 'emerald' : vendedor.percentualMetaFaturado >= 80 ? 'amber' : 'red'} />
              <KPI icon={<ReceiptText className="h-4 w-4" />} label="Em Aberto" value={formatCurrency(vendedor.valorPendente)} color="amber" />
            </div>

            {/* Progresso da meta */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Progresso da Meta</span>
                  <span className="font-mono">{formatCurrency(vendedor.faturamentoMesAtual)} / {formatCurrency(vendedor.metaMensal)}</span>
                </div>
                <Progress value={Math.min(100, vendedor.percentualMetaFaturado)} className="h-2" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 text-xs">
                  <Info label="Meta diária" value={formatCurrency(vendedor.metaDiaria)} />
                  <Info label="Meta esperada hoje" value={formatCurrency(vendedor.metaEsperada)} />
                  <Info label="Diferença" value={formatCurrency(vendedor.diferenca)} positive={vendedor.diferenca >= 0} />
                  <Info label="Projeção fim do mês" value={formatCurrency(stats.projecaoFimMes)} />
                </div>
              </CardContent>
            </Card>

            {/* Operação */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Operação no Período</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI icon={<ReceiptText className="h-4 w-4" />} label="Pedidos" value={String(stats.qtdPedidos)} small />
                <KPI icon={<Users className="h-4 w-4" />} label="Clientes" value={String(stats.qtdClientes)} small />
                <KPI icon={<TrendingUp className="h-4 w-4" />} label="Ticket médio" value={formatCurrency(stats.ticket)} small />
                <KPI icon={<Calendar className="h-4 w-4" />} label="Dias ativos" value={`${stats.diasAtivos} / ${diasUteisDecorridos}`} small />
                <KPI icon={<TrendingDown className="h-4 w-4" />} label="Devoluções" value={formatCurrency(stats.totalDevolucoes)} small color="red" />
                <KPI icon={<Percent className="h-4 w-4" />} label="Taxa devolução" value={`${stats.taxaDevolucao.toFixed(2)}%`} small color={stats.taxaDevolucao > 5 ? 'red' : 'emerald'} />
                <KPI icon={<TrendingUp className="h-4 w-4" />} label="Média/dia útil" value={formatCurrency(stats.mediaDiaria)} small />
                <KPI icon={<AlertTriangle className="h-4 w-4" />} label="Ritmo p/ meta" value={stats.ritmoNecessario > 0 ? formatCurrency(stats.ritmoNecessario) + '/d' : '—'} small color="amber" />
              </div>
            </div>

            <Separator />

            {/* Top clientes */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Top 5 Clientes</h3>
              {stats.topClientes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem pedidos no período.</p>
              ) : (
                <div className="space-y-2">
                  {stats.topClientes.map((c, i) => {
                    const pct = (c.valor / vendedor.faturamentoMesAtual) * 100;
                    return (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="w-5 text-muted-foreground tabular-nums">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between gap-2">
                            <span className="truncate font-medium">{c.nome}</span>
                            <span className="font-mono text-emerald-500 shrink-0">{formatCurrency(c.valor)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{c.uf || '—'} · {c.pedidos} pedido{c.pedidos !== 1 ? 's' : ''}</span>
                            <span>{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* UFs */}
            {stats.topUFs.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Distribuição por Estado</h3>
                <div className="flex flex-wrap gap-2">
                  {stats.topUFs.map(u => (
                    <Badge key={u.uf} variant="outline" className="font-mono">
                      {u.uf}: {formatCurrency(u.valor)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Insights IA */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Insights da IA
                </h3>
                <Button size="sm" onClick={gerarInsightsIA} disabled={aiLoading}>
                  {aiLoading ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Analisando...</> : <><Sparkles className="h-3.5 w-3.5 mr-2" /> {aiInsights ? 'Gerar novamente' : 'Gerar análise'}</>}
                </Button>
              </div>
              {!aiInsights && !aiLoading && !aiError && (
                <p className="text-sm text-muted-foreground">Clique em "Gerar análise" para receber um diagnóstico personalizado da IA com recomendações para este vendedor.</p>
              )}
              {aiError && <p className="text-sm text-red-500">{aiError}</p>}
              {aiInsights && (
                <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/30 rounded-lg p-4 border">
                  <ReactMarkdown>{aiInsights}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────── Componentes 1005 ─────────── */
function Panel1005({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: `linear-gradient(140deg, ${C.card} 0%, ${C.card2} 100%)`,
        border: `1px solid ${C.border}`,
        boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 30px -16px rgba(0,0,0,0.6)',
      }}
    >
      {children}
    </div>
  );
}

function Kpi1005({ icon: Icon, label, value, accent, small }: { icon: any; label: string; value: string; accent: string; small?: boolean }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl p-3"
      style={{
        background: `linear-gradient(140deg, ${C.card} 0%, ${C.card2} 100%)`,
        border: `1px solid ${C.border}`,
      }}
    >
      <div
        className="absolute -top-10 -right-10 w-24 h-24 rounded-full opacity-20 blur-2xl pointer-events-none"
        style={{ background: accent }}
      />
      <div className="relative flex items-center gap-2 text-[11px] uppercase tracking-wider mb-1" style={{ color: C.sub }}>
        <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
        {label}
      </div>
      <div className={cn('relative font-mono font-bold tabular-nums', small ? 'text-sm' : 'text-lg')} style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

function Info1005({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  const color = positive === true ? C.green : positive === false ? C.red : C.text;
  return (
    <div>
      <div style={{ color: C.sub }}>{label}</div>
      <div className="font-mono font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}

function KPI({ icon, label, value, color = 'default', small = false }: { icon: React.ReactNode; label: string; value: string; color?: 'default' | 'emerald' | 'red' | 'amber' | 'primary'; small?: boolean }) {
  const colorCls = {
    default: 'text-foreground',
    emerald: 'text-emerald-500',
    red: 'text-red-500',
    amber: 'text-amber-500',
    primary: 'text-primary',
  }[color];
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">{icon}{label}</div>
      <div className={cn("font-bold font-mono", small ? "text-sm" : "text-lg", colorCls)}>{value}</div>
    </div>
  );
}

function Info({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className={cn("font-mono font-semibold", positive === true ? 'text-emerald-500' : positive === false ? 'text-red-500' : '')}>{value}</div>
    </div>
  );
}
