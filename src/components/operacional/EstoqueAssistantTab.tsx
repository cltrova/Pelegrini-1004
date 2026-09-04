import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, User, Loader2, Lightbulb, MessageSquare, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Package, ShoppingCart, BarChart3, Brain, Sparkles, Save, Check, ChevronDown, ChevronUp, DollarSign, Tags, Factory, Boxes, FileText, FileDown, Download, Mic, MicOff, Zap } from 'lucide-react';
import { EstoqueRecord, GiroRecord } from '@/types/estoque';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { resolveCodEmpresaBiParam } from '@/utils/filialEndpoint';
import { toast } from 'sonner';
import { generatePDF, generateDOCX, DocumentData } from '@/utils/documentGenerator';
import { EstoqueInsights } from './EstoqueInsights';
import { parseStrictDate } from './estoque/assistantInsights';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  document?: DocumentData;
  sourceLabel?: string;
  periodLabel?: string;
}

interface Insight {
  category: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
  details: string;
}

interface Props {
  giroData: GiroRecord[];
  estoqueData: EstoqueRecord[];
  now?: Date;
  onProductAction?: (productCode: string) => void;
}

const CHAT_SOURCE_LABEL = 'estoque atual e movimentacoes';
const CHAT_PERIOD_LABEL = 'estoque atual e movimentacoes disponiveis dos ultimos 90 dias';
const ASSISTANT_SUGGESTIONS = [
  { label: 'Risco de ruptura', question: 'Quais produtos apresentam risco de ruptura?' },
  { label: 'Capital parado', question: 'Onde esta o maior capital parado no estoque?' },
  { label: 'Sem venda ha 90 dias', question: 'Quais produtos estao sem venda ha mais de 90 dias?' },
  { label: 'Atencao de compra semanal', question: 'Quais compras precisam de atencao nesta semana?' },
  { label: 'Transferir ou promover', question: 'Quais produtos sao candidatos a transferencia ou promocao?' },
  { label: 'Resumo diario', question: 'Apresente um resumo das principais decisoes de estoque de hoje.' },
] as const;

function buildContext(estoque: EstoqueRecord[], giro: GiroRecord[], referenceDate = new Date()): string {
  const totalItens = estoque.length;
  const totalValor = estoque.reduce((s, r) => s + r.valor_estoque, 0);
  const totalQtd = estoque.reduce((s, r) => s + r.quantidade_estoque, 0);

  const now = referenceDate.getTime();
  const msPerDay = 86_400_000;
  const d7 = now - 7 * msPerDay;
  const d30 = now - 30 * msPerDay;
  const d60 = now - 60 * msPerDay;
  const d90 = now - 90 * msPerDay;
  const currentUtcDate = new Date(now);
  const currentCivilTimestamp = Date.UTC(currentUtcDate.getUTCFullYear(), currentUtcDate.getUTCMonth(), currentUtcDate.getUTCDate());
  const threeMonthStart = Date.UTC(currentUtcDate.getUTCFullYear(), currentUtcDate.getUTCMonth() - 3, 1);
  const validMovements = giro.flatMap((row) => {
    const parsedDate = parseStrictDate(row.data_movimento);
    if (!parsedDate || parsedDate.timestamp > now) return [];
    return [{ row, ...parsedDate }];
  });
  const diasSemVenda = (r: EstoqueRecord): number | null => {
    if (!r.data_ultima_venda) return null;
    const timestamp = new Date(r.data_ultima_venda).getTime();
    if (!Number.isFinite(timestamp)) return null;
    return Math.max(0, Math.floor((now - timestamp) / msPerDay));
  };
  const isOverDays = (r: EstoqueRecord, days: number) => {
    const age = diasSemVenda(r);
    return age !== null && age > days;
  };

  const semVenda90 = estoque.filter(r => isOverDays(r, 90)).length;
  const semVenda180 = estoque.filter(r => isOverDays(r, 180)).length;
  const dataVendaDesconhecida = estoque.filter(r => diasSemVenda(r) === null).length;

  // --- Agregação por Marca ---
  const brandMap = new Map<string, { count: number; valor: number; qtd: number; custoTotal: number; parados: number; ultimaVenda: string }>();
  estoque.forEach(r => {
    const e = brandMap.get(r.marca) || { count: 0, valor: 0, qtd: 0, custoTotal: 0, parados: 0, ultimaVenda: '' };
    e.count++; e.valor += r.valor_estoque; e.qtd += r.quantidade_estoque;
    e.custoTotal += r.custo_medio * r.quantidade_estoque;
    if (isOverDays(r, 90)) e.parados++;
    if (r.data_ultima_venda && r.data_ultima_venda > e.ultimaVenda) e.ultimaVenda = r.data_ultima_venda;
    brandMap.set(r.marca, e);
  });
  const allBrands = [...brandMap.entries()].sort((a, b) => b[1].valor - a[1].valor);

  // --- Agregação por Grupo ---
  const grupoMap = new Map<string, { count: number; valor: number; qtd: number; parados: number }>();
  estoque.forEach(r => {
    const e = grupoMap.get(r.grupo) || { count: 0, valor: 0, qtd: 0, parados: 0 };
    e.count++; e.valor += r.valor_estoque; e.qtd += r.quantidade_estoque;
    if (isOverDays(r, 90)) e.parados++;
    grupoMap.set(r.grupo, e);
  });
  const allGroups = [...grupoMap.entries()].sort((a, b) => b[1].valor - a[1].valor);

  // --- Agregação por Fornecedor ---
  const fornMap = new Map<string, { count: number; valor: number; qtd: number; parados: number }>();
  estoque.forEach(r => {
    const e = fornMap.get(r.cod_fornecedor) || { count: 0, valor: 0, qtd: 0, parados: 0 };
    e.count++; e.valor += r.valor_estoque; e.qtd += r.quantidade_estoque;
    if (isOverDays(r, 90)) e.parados++;
    fornMap.set(r.cod_fornecedor, e);
  });
  const allForn = [...fornMap.entries()].sort((a, b) => b[1].valor - a[1].valor);

  // --- Agregação por Empresa ---
  const empMap = new Map<string, { count: number; valor: number; qtd: number }>();
  estoque.forEach(r => {
    const e = empMap.get(r.empresa) || { count: 0, valor: 0, qtd: 0 };
    e.count++; e.valor += r.valor_estoque; e.qtd += r.quantidade_estoque;
    empMap.set(r.empresa, e);
  });

  // --- Curva ABC ---
  const abcDist = new Map<string, { count: number; valor: number }>();
  estoque.forEach(r => {
    const e = abcDist.get(r.classe_abc) || { count: 0, valor: 0 };
    e.count++; e.valor += r.valor_estoque;
    abcDist.set(r.classe_abc, e);
  });

  // --- Giro agregado por Marca ---
  const giroByMarca = new Map<string, { vendas: number; compras: number; transferencias_saida: number; transferencias_entrada: number }>();
  validMovements.forEach(({ row: r, timestamp }) => {
    if (timestamp < d90) return;
    const e = giroByMarca.get(r.marca) || { vendas: 0, compras: 0, transferencias_saida: 0, transferencias_entrada: 0 };
    e.vendas += r.saida_venda; e.compras += r.entrada_compra;
    e.transferencias_saida += r.saida_transferencia; e.transferencias_entrada += r.entrada_transferencia;
    giroByMarca.set(r.marca, e);
  });

  // --- Top 50 produtos por valor (Pareto) ---
  const top50Valor = [...estoque].sort((a, b) => b.valor_estoque - a.valor_estoque).slice(0, 50);

  // --- Top 50 produtos parados há mais tempo ---
  const top50Parados = estoque
    .filter(r => diasSemVenda(r) !== null)
    .sort((a, b) => (diasSemVenda(b) ?? 0) - (diasSemVenda(a) ?? 0))
    .slice(0, 50);

  // === NOVAS SEÇÕES: Análise de Vendas Recentes ===
  // 1) Vendas por período
  const v7 = { qty: 0, val: 0 }, v30 = { qty: 0, val: 0 }, v60 = { qty: 0, val: 0 }, v90 = { qty: 0, val: 0 };
  const salesRecords = validMovements.filter(({ row }) => row.saida_venda > 0);
  salesRecords.forEach(({ row: r, timestamp }) => {
    if (timestamp >= d90) { v90.qty += r.saida_venda; v90.val += r.valor_venda; }
    if (timestamp >= d60) { v60.qty += r.saida_venda; v60.val += r.valor_venda; }
    if (timestamp >= d30) { v30.qty += r.saida_venda; v30.val += r.valor_venda; }
    if (timestamp >= d7)  { v7.qty += r.saida_venda; v7.val += r.valor_venda; }
  });

  // 2) Top 30 produtos mais vendidos (90 dias)
  const prodSales90 = new Map<string, { codProduto: number; empresa: string; produto: string; marca: string; grupo: string; qty: number; val: number; lastDate: string }>();
  salesRecords.forEach(({ row: r, timestamp }) => {
    if (timestamp < d90) return;
    const key = `${r.cod_empresa_bi}:${r.cod_empresa}:${r.cod_produto}`;
    const e = prodSales90.get(key) || { codProduto: r.cod_produto, empresa: r.empresa, produto: r.produto, marca: r.marca, grupo: r.grupo, qty: 0, val: 0, lastDate: '' };
    e.qty += r.saida_venda; e.val += r.valor_venda;
    if (r.data_movimento > e.lastDate) e.lastDate = r.data_movimento;
    prodSales90.set(key, e);
  });
  const top30Vendidos = [...prodSales90.entries()]
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 30);

  // 3) Evolucao mensal limitada a janela realmente carregada pela API.
  const monthlyEvo = new Map<string, { vendas_qty: number; vendas_val: number; compras_qty: number; compras_val: number }>();
  validMovements.forEach(({ row: r, civilTimestamp: movementCivilTimestamp, monthKey }) => {
    if (movementCivilTimestamp < threeMonthStart || movementCivilTimestamp > currentCivilTimestamp) return;
    const e = monthlyEvo.get(monthKey) || { vendas_qty: 0, vendas_val: 0, compras_qty: 0, compras_val: 0 };
    e.vendas_qty += r.saida_venda; e.vendas_val += r.valor_venda;
    e.compras_qty += r.entrada_compra;
    monthlyEvo.set(monthKey, e);
  });
  const sortedMonths = [...monthlyEvo.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  // 4) Vendas por grupo e marca (30 dias)
  const salesByGroup30 = new Map<string, { qty: number; val: number }>();
  const salesByMarca30 = new Map<string, { qty: number; val: number }>();
  salesRecords.forEach(({ row: r, timestamp }) => {
    if (timestamp < d30) return;
    const g = salesByGroup30.get(r.grupo) || { qty: 0, val: 0 };
    g.qty += r.saida_venda; g.val += r.valor_venda;
    salesByGroup30.set(r.grupo, g);
    const m = salesByMarca30.get(r.marca) || { qty: 0, val: 0 };
    m.qty += r.saida_venda; m.val += r.valor_venda;
    salesByMarca30.set(r.marca, m);
  });

  return `
RESUMO GERAL DO ESTOQUE:
- Total de itens cadastrados: ${totalItens}
- Quantidade total em estoque: ${totalQtd}
- Valor total em estoque: R$ ${totalValor.toFixed(2)}
- Itens sem venda >90 dias: ${semVenda90} (${((semVenda90/totalItens)*100).toFixed(1)}%)
- Itens sem venda >180 dias: ${semVenda180} (${((semVenda180/totalItens)*100).toFixed(1)}%)
- Itens com data de ultima venda desconhecida: ${dataVendaDesconhecida}

POR EMPRESA:
${[...empMap.entries()].map(([emp, d]) => `- ${emp}: ${d.count} itens, Qtd:${d.qtd}, R$ ${d.valor.toFixed(2)}`).join('\n')}

CURVA ABC:
${[...abcDist.entries()].sort().map(([abc, d]) => `- ${abc}: ${d.count} itens, R$ ${d.valor.toFixed(2)}`).join('\n')}

TODAS AS MARCAS (${allBrands.length}) - Marca|Itens|Qtd|Valor|CustoMedioPond|Parados>90d|UltVenda:
${allBrands.map(([m, d]) => `${m}|${d.count}|${d.qtd}|${d.valor.toFixed(0)}|${d.qtd > 0 ? (d.custoTotal/d.qtd).toFixed(2) : '0'}|${d.parados}|${d.ultimaVenda?.slice(0,10) || '-'}`).join('\n')}

TODOS OS GRUPOS (${allGroups.length}) - Grupo|Itens|Qtd|Valor|Parados>90d:
${allGroups.map(([g, d]) => `${g}|${d.count}|${d.qtd}|${d.valor.toFixed(0)}|${d.parados}`).join('\n')}

TODOS OS FORNECEDORES (${allForn.length}) - CodForn|Itens|Qtd|Valor|Parados>90d:
${allForn.map(([f, d]) => `${f}|${d.count}|${d.qtd}|${d.valor.toFixed(0)}|${d.parados}`).join('\n')}

GIRO POR MARCA (90 DIAS) - Marca|TotalVendas|TotalCompras|TransfSaida|TransfEntrada:
${[...giroByMarca.entries()].sort((a, b) => b[1].vendas - a[1].vendas).map(([m, d]) => `${m}|${d.vendas}|${d.compras}|${d.transferencias_saida}|${d.transferencias_entrada}`).join('\n')}

VENDAS POR PERÍODO:
- Últimos 7 dias: ${v7.qty} unidades, R$ ${v7.val.toFixed(2)}
- Últimos 30 dias: ${v30.qty} unidades, R$ ${v30.val.toFixed(2)}
- Últimos 60 dias: ${v60.qty} unidades, R$ ${v60.val.toFixed(2)}
- Últimos 90 dias: ${v90.qty} unidades, R$ ${v90.val.toFixed(2)}

TOP 30 PRODUTOS MAIS VENDIDOS (90 DIAS) - Empresa|Cod|Produto|Marca|Grupo|QtdVendida|ValorVendido|UltMovimento:
${top30Vendidos.map(([, d]) => `${d.empresa}|${d.codProduto}|${d.produto.slice(0,40)}|${d.marca}|${d.grupo}|${d.qty}|${d.val.toFixed(0)}|${d.lastDate.slice(0,10)}`).join('\n')}

EVOLUÇÃO MENSAL (${sortedMonths.length} MESES) - Mês|VendasQtd|VendasValor|ComprasQtd:
${sortedMonths.map(([m, d]) => `${m}|${d.vendas_qty}|${d.vendas_val.toFixed(0)}|${d.compras_qty}`).join('\n')}

VENDAS POR GRUPO (30 DIAS) - Grupo|QtdVendida|ValorVendido:
${[...salesByGroup30.entries()].sort((a, b) => b[1].val - a[1].val).map(([g, d]) => `${g}|${d.qty}|${d.val.toFixed(0)}`).join('\n')}

VENDAS POR MARCA (30 DIAS) - Marca|QtdVendida|ValorVendido:
${[...salesByMarca30.entries()].sort((a, b) => b[1].val - a[1].val).map(([m, d]) => `${m}|${d.qty}|${d.val.toFixed(0)}`).join('\n')}

TOP 50 PRODUTOS POR VALOR - Cod|Produto|Marca|Grupo|Qtd|Valor|CustoMedio|ABC|UltVenda|Fornecedor:
${top50Valor.map(r => `${r.cod_produto}|${r.produto.slice(0,40)}|${r.marca}|${r.grupo}|${r.quantidade_estoque}|${r.valor_estoque.toFixed(0)}|${r.custo_medio.toFixed(2)}|${r.classe_abc}|${r.data_ultima_venda?.slice(0,10)||'-'}|${r.cod_fornecedor}`).join('\n')}

TOP 50 PRODUTOS PARADOS (SEM VENDA HÁ MAIS TEMPO) - Cod|Produto|Marca|Grupo|Qtd|Valor|DiasParado|UltVenda|Fornecedor:
${top50Parados.map(r => `${r.cod_produto}|${r.produto.slice(0,40)}|${r.marca}|${r.grupo}|${r.quantidade_estoque}|${r.valor_estoque.toFixed(0)}|${diasSemVenda(r) ?? 'desconhecido'}|${r.data_ultima_venda?.slice(0,10)||'-'}|${r.cod_fornecedor}`).join('\n')}
  `.trim();
}

const SEVERITY_STYLES = {
  critical: 'border-red-500/30 bg-red-500/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  success: 'border-emerald-500/30 bg-emerald-500/5',
  info: 'border-blue-500/30 bg-blue-500/5',
};

const SEVERITY_ICON_STYLES = {
  critical: 'text-red-500 bg-red-500/15',
  warning: 'text-amber-500 bg-amber-500/15',
  success: 'text-emerald-500 bg-emerald-500/15',
  info: 'text-blue-500 bg-blue-500/15',
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  giro: <RefreshCw className="h-5 w-5" />,
  custo: <TrendingDown className="h-5 w-5" />,
  ruptura: <AlertTriangle className="h-5 w-5" />,
  excesso: <Package className="h-5 w-5" />,
  compra: <ShoppingCart className="h-5 w-5" />,
  performance: <TrendingUp className="h-5 w-5" />,
  abc: <BarChart3 className="h-5 w-5" />,
  default: <Lightbulb className="h-5 w-5" />,
};

const INSIGHT_CATEGORIES = [
  { id: 'todos', label: 'Todos', icon: <Lightbulb className="h-4 w-4" /> },
  { id: 'critical', label: 'Críticos', icon: <AlertTriangle className="h-4 w-4" /> },
  { id: 'compra', label: 'Compras', icon: <ShoppingCart className="h-4 w-4" /> },
  { id: 'giro', label: 'Vendas/Giro', icon: <RefreshCw className="h-4 w-4" /> },
  { id: 'custo', label: 'Custos', icon: <DollarSign className="h-4 w-4" /> },
  { id: 'performance', label: 'Marcas', icon: <Tags className="h-4 w-4" /> },
  { id: 'excesso', label: 'Excesso', icon: <Boxes className="h-4 w-4" /> },
  { id: 'ruptura', label: 'Rupturas', icon: <Factory className="h-4 w-4" /> },
  { id: 'abc', label: 'Curva ABC', icon: <BarChart3 className="h-4 w-4" /> },
];

// ==================== INSIGHTS TAB ====================
function InsightsTab({ estoqueData, giroData, now }: Props) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('todos');
  const [expandedInsight, setExpandedInsight] = useState<number | null>(null);

  const generateInsights = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const context = buildContext(estoqueData, giroData, now);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistente-estoque-insights`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ context }),
        }
      );
      if (!response.ok) throw new Error(`Erro: ${response.status}`);
      const result = await response.json();
      setInsights(result.insights || []);
      setLastGenerated(new Date().toLocaleString('pt-BR'));
    } catch (error) {
      console.error('Erro ao gerar insights:', error);
      toast.error('Erro ao gerar insights');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredInsights = activeCategory === 'todos'
    ? insights
    : activeCategory === 'critical'
      ? insights.filter(i => i.severity === 'critical')
      : insights.filter(i => i.category === activeCategory);

  const categoryCounts = INSIGHT_CATEGORIES.map(cat => ({
    ...cat,
    count: cat.id === 'todos'
      ? insights.length
      : cat.id === 'critical'
        ? insights.filter(i => i.severity === 'critical').length
        : insights.filter(i => i.category === cat.id).length,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Insights do Estoque
          </h3>
          {lastGenerated && (
            <p className="text-xs text-muted-foreground mt-0.5">Atualizado em {lastGenerated}</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={generateInsights} disabled={isLoading} className="gap-2">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Analisando...' : insights.length > 0 ? 'Atualizar' : 'Gerar Insights'}
        </Button>
      </div>

      {insights.length === 0 && !isLoading ? (
        <div className="text-center py-8 space-y-2">
          <Lightbulb className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">Clique em "Gerar Insights" para analisar seu estoque</p>
          <p className="text-xs text-muted-foreground">A análise avalia giro, custos, fornecedores, rupturas e mais</p>
        </div>
      ) : isLoading && insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-3">
          <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
          <p className="text-sm text-muted-foreground">Analisando estoque como um gerente especialista...</p>
        </div>
      ) : (
        <>
          {/* Category filter chips */}
          <div className="flex flex-wrap gap-1.5">
            {categoryCounts.filter(c => c.count > 0 || c.id === 'todos').map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  activeCategory === cat.id
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400'
                    : 'bg-muted/50 border-border hover:bg-muted text-muted-foreground'
                }`}
              >
                {cat.icon}
                {cat.label}
                {cat.count > 0 && (
                  <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">{cat.count}</Badge>
                )}
              </button>
            ))}
          </div>

          {/* Insights grid */}
          <div className="divide-y divide-border/70">
            {filteredInsights.map((insight, i) => (
              <article
                key={i}
                className={`cursor-pointer px-1 py-3 transition-colors duration-150 hover:bg-muted/30 ${SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info}`}
                onClick={() => setExpandedInsight(expandedInsight === i ? null : i)}
              >
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${SEVERITY_ICON_STYLES[insight.severity] || SEVERITY_ICON_STYLES.info}`}>
                      {CATEGORY_ICONS[insight.category] || CATEGORY_ICONS.default}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-tight">{insight.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
                    </div>
                    {insight.details && (
                      expandedInsight === i
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  {expandedInsight === i && insight.details && (
                    <div className="pl-12 text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-2 mt-2">
                      <ReactMarkdown>{insight.details}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ==================== CHAT TAB ====================
function ChatTab({ estoqueData, giroData, now, customPrompt, codEmpresaBi, credits, onCreditUsed }: Props & { customPrompt: string; codEmpresaBi: string; credits: { used: number; limit: number }; onCreditUsed: () => void | Promise<void> }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [failedConversation, setFailedConversation] = useState<Message[] | null>(null);
  const [creditWarning, setCreditWarning] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (messages.length > 0 && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setRecordingTime(0);
        setIsRecording(false);

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 1000) return; // too short

        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('file', blob, 'audio.webm');

          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;

          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
              body: formData,
            }
          );

          if (!response.ok) throw new Error('Erro na transcrição');
          const result = await response.json();
          if (result.text) {
            setInput(prev => prev ? `${prev} ${result.text}` : result.text);
          }
        } catch (err) {
          console.error('Erro transcrição:', err);
          toast.error('Erro ao transcrever áudio');
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (err) {
      console.error('Erro microfone:', err);
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const sendMessage = async (suggestedQuestion?: string, retryConversation?: Message[]) => {
    const userMessage = suggestedQuestion?.trim() || input.trim();
    if ((!userMessage && !retryConversation) || isLoading) return;

    // Check credit limit
    if (credits.used >= credits.limit) {
      toast.error('Limite de créditos atingido para este mês');
      return;
    }

    const conversation = retryConversation ?? [...messages, { role: 'user' as const, content: userMessage }];
    if (!retryConversation) {
      setInput('');
      setMessages(conversation);
    }
    setFailedConversation(null);
    setCreditWarning(null);
    setIsLoading(true);

    try {
      const context = buildContext(estoqueData, giroData, now);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistente-estoque`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: conversation.map(({ role, content }) => ({ role, content })),
            context,
            customPrompt,
          }),
        }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erro: ${response.status}`);
      }
      const result = await response.json();
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: result.response,
        document: result.document || undefined,
        sourceLabel: CHAT_SOURCE_LABEL,
        periodLabel: CHAT_PERIOD_LABEL,
      }]);

    } catch (error: unknown) {
      console.error('Erro ao enviar mensagem:', error);
      setFailedConversation(conversation);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    if (codEmpresaBi) {
      try {
        await supabase.rpc('increment_assistant_credit', { p_cod_empresa_bi: codEmpresaBi });
        await onCreditUsed();
      } catch (error: unknown) {
        console.error('Erro ao contabilizar credito do assistente:', error);
        setCreditWarning('Resposta entregue, mas o uso de credito nao foi atualizado.');
      }
    }
  };

  return (
    <div className="flex h-[min(34rem,calc(100vh-15rem))] min-h-[26rem] flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-1 py-3 sm:px-3">
        {messages.length === 0 && (
          <div className="mx-auto w-full max-w-4xl space-y-3 py-4">
            <p className="text-sm font-medium">Consultas rapidas</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ASSISTANT_SUGGESTIONS.map(({ label, question }) => (
                <button key={label} aria-label={label} data-testid="stock-assistant-suggestion" onClick={() => sendMessage(question)}
                  className="min-h-10 border border-border bg-card px-3 py-2 text-left text-xs font-medium transition-colors hover:border-primary/50 hover:bg-accent">
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">As respostas usam o estoque atual e as movimentacoes disponiveis.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-amber-500" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-lg p-3 text-sm ${
              msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="space-y-3">
                  {msg.content && (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                  {msg.sourceLabel && msg.periodLabel && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                      <span>Fonte: {msg.sourceLabel}</span>
                      <span>Periodo: {msg.periodLabel}</span>
                    </div>
                  )}
                  {msg.document && (
                    <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-semibold">{msg.document.titulo}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {msg.document.itens?.length || 0} itens
                        {msg.document.total_valor ? ` · R$ ${msg.document.total_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => generatePDF(msg.document!)}>
                          <FileDown className="h-3 w-3" /> PDF
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => generateDOCX(msg.document!)}>
                          <Download className="h-3 w-3" /> Word
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-primary" />
              </div>
            )}
          </div>
        ))}
        {failedConversation && !isLoading && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-red-500/30 bg-red-500/5 px-3 py-2">
            <p className="text-sm text-red-700 dark:text-red-300">Nao foi possivel concluir esta pergunta.</p>
            <Button size="sm" type="button" variant="outline" onClick={() => sendMessage(undefined, failedConversation)}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Tentar novamente
            </Button>
          </div>
        )}
        {creditWarning && (
          <p className="text-xs text-amber-700 dark:text-amber-300" role="status">{creditWarning}</p>
        )}
        {isLoading && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm text-muted-foreground">Analisando dados...</p>
            </div>
          </div>
        )}
      </div>

      <div data-testid="stock-assistant-composer" className="sticky bottom-0 border-t border-border bg-background/95 px-1 py-3 backdrop-blur sm:px-3">
        {isRecording && (
          <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-medium text-red-600 dark:text-red-400">Gravando {formatTime(recordingTime)}</span>
            <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs gap-1.5 text-red-600" onClick={stopRecording}>
              <MicOff className="h-3.5 w-3.5" /> Parar
            </Button>
          </div>
        )}
        {isTranscribing && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Transcrevendo áudio...</span>
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Pergunte sobre seu estoque..."
            className="flex-1"
            disabled={isLoading || isRecording}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            variant={isRecording ? 'destructive' : 'outline'}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isLoading || isTranscribing}
            title={isRecording ? 'Parar gravação' : 'Gravar áudio'}
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button aria-label="Enviar pergunta" type="submit" size="icon" disabled={isLoading || !input.trim() || isRecording}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

// ==================== BRAIN TAB ====================
function BrainTab({ codEmpresaBi }: { codEmpresaBi: string }) {
  const [prompt, setPrompt] = useState('');
  const [savedPrompt, setSavedPrompt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(true);
  const [aiRequest, setAiRequest] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<{ suggested_prompt: string; explanation: string } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Load existing prompt
  useEffect(() => {
    if (!codEmpresaBi) {
      setIsLoadingPrompt(false);
      return;
    }
    async function load() {
      try {
        const { data } = await supabase
          .from('estoque_assistant_config')
          .select('custom_prompt')
          .eq('cod_empresa_bi', codEmpresaBi)
          .maybeSingle();

        if (data?.custom_prompt) {
          setPrompt(data.custom_prompt);
          setSavedPrompt(data.custom_prompt);
        }
      } catch (e) {
        console.error('Erro ao carregar prompt:', e);
      } finally {
        setIsLoadingPrompt(false);
      }
    }
    load();
  }, [codEmpresaBi]);

  const savePrompt = async () => {
    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from('estoque_assistant_config')
        .select('id')
        .eq('cod_empresa_bi', codEmpresaBi)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('estoque_assistant_config')
          .update({ custom_prompt: prompt })
          .eq('cod_empresa_bi', codEmpresaBi);
      } else {
        await supabase
          .from('estoque_assistant_config')
          .insert({ cod_empresa_bi: codEmpresaBi, custom_prompt: prompt });
      }
      setSavedPrompt(prompt);
      toast.success('Prompt salvo com sucesso!');
    } catch (e) {
      console.error('Erro ao salvar:', e);
      toast.error('Erro ao salvar prompt');
    } finally {
      setIsSaving(false);
    }
  };

  const askAiHelp = async () => {
    if (!aiRequest.trim() || isAiLoading) return;
    setIsAiLoading(true);
    setAiSuggestion(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistente-estoque-brain`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            currentPrompt: prompt,
            userRequest: aiRequest.trim(),
          }),
        }
      );

      if (!response.ok) throw new Error(`Erro: ${response.status}`);
      const result = await response.json();
      setAiSuggestion(result);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao consultar assistente');
    } finally {
      setIsAiLoading(false);
    }
  };

  const applySuggestion = () => {
    if (aiSuggestion?.suggested_prompt) {
      setPrompt(aiSuggestion.suggested_prompt);
      setAiSuggestion(null);
      setAiRequest('');
      toast.info('Sugestão aplicada! Clique em "Salvar" para confirmar.');
    }
  };

  if (isLoadingPrompt) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasChanges = prompt !== savedPrompt;

  return (
    <div className="space-y-6">
      {/* Prompt Editor */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" />
              Prompt do Assistente
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Personalize como o assistente se comporta e responde às suas perguntas
            </p>
          </div>
          <Button
            size="sm"
            onClick={savePrompt}
            disabled={isSaving || !hasChanges}
            className="gap-2"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : hasChanges ? <Save className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            {isSaving ? 'Salvando...' : hasChanges ? 'Salvar' : 'Salvo'}
          </Button>
        </div>

        <Textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Ex: Seja objetivo e direto nas respostas. Foque em ações práticas. Sempre sugira quantidades de compra baseadas no giro dos últimos 3 meses. Destaque produtos classe A com risco de ruptura..."
          className="min-h-[180px] text-sm font-mono resize-y"
        />
        <p className="text-[11px] text-muted-foreground">
          Este prompt será adicionado às instruções do assistente em todas as conversas e análises de insights.
        </p>
      </div>

      {/* AI Helper */}
      <Card className="border-purple-500/20 bg-purple-500/5">
        <CardContent className="p-4 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            Assistente de Prompt
          </h4>
          <p className="text-xs text-muted-foreground">
            Descreva o que deseja melhorar e receba uma sugestão de prompt otimizado
          </p>

          <div className="flex gap-2">
            <Input
              value={aiRequest}
              onChange={e => setAiRequest(e.target.value)}
              placeholder="Ex: quero respostas mais curtas e objetivas..."
              className="flex-1 text-sm"
              disabled={isAiLoading}
              onKeyDown={e => e.key === 'Enter' && askAiHelp()}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={askAiHelp}
              disabled={isAiLoading || !aiRequest.trim()}
              className="gap-2 shrink-0"
            >
              {isAiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Sugerir
            </Button>
          </div>

          {aiSuggestion && (
            <div className="space-y-3 border border-purple-500/20 rounded-lg p-3 bg-background">
              <p className="text-xs font-medium text-purple-600 dark:text-purple-400">
                💡 {aiSuggestion.explanation}
              </p>
              <div className="bg-muted/50 rounded p-3 text-xs font-mono max-h-40 overflow-y-auto whitespace-pre-wrap">
                {aiSuggestion.suggested_prompt}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={applySuggestion} className="gap-2">
                  <Check className="h-3.5 w-3.5" />
                  Aplicar Sugestão
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAiSuggestion(null)}>
                  Descartar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
export function EstoqueAssistantTab({ giroData, estoqueData, now, onProductAction }: Props) {
  const [customPrompt, setCustomPrompt] = useState('');
  const [credits, setCredits] = useState({ used: 0, limit: 5000 });
  const [activeView, setActiveView] = useState<'chat' | 'insights'>('chat');
  const { codEmpresaAtiva, empresa } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();
  const codEmpresaBi = resolveCodEmpresaBiParam(empresa, filialAtiva) || codEmpresaAtiva || '';

  // Load custom prompt + credits
  useEffect(() => {
    async function load() {
      if (!codEmpresaBi) return;

      const [configRes, creditRes] = await Promise.all([
        supabase.from('estoque_assistant_config').select('custom_prompt').eq('cod_empresa_bi', codEmpresaBi).maybeSingle(),
        supabase.from('estoque_assistant_credits').select('credits_used, credits_limit').eq('cod_empresa_bi', codEmpresaBi).maybeSingle(),
      ]);

      if (configRes.data?.custom_prompt) {
        setCustomPrompt(configRes.data.custom_prompt);
      }
      if (creditRes.data) {
        setCredits({ used: creditRes.data.credits_used, limit: creditRes.data.credits_limit });
      }
    }
    load();
  }, [codEmpresaBi]);

  const refreshCredits = useCallback(async () => {
    if (!codEmpresaBi) return;
    const { data } = await supabase.from('estoque_assistant_credits').select('credits_used, credits_limit').eq('cod_empresa_bi', codEmpresaBi).maybeSingle();
    if (data) setCredits({ used: data.credits_used, limit: data.credits_limit });
  }, [codEmpresaBi]);

  const creditPercent = credits.limit > 0 ? Math.min((credits.used / credits.limit) * 100, 100) : 0;

  return (
    <section aria-label="Assistente de estoque" className="min-w-0 border-y border-border/70 bg-background">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border/70 px-3 py-2.5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Bot className="h-4 w-4 text-primary" />
              Assistente de Estoque
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{codEmpresaBi ? 'Chat e analise local disponiveis' : 'Analise local disponivel'}</p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold">{credits.used}</span>
              <span className="text-xs text-muted-foreground">/ {credits.limit}</span>
            </div>
            <div className="h-1 w-14 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${creditPercent > 90 ? 'bg-red-500' : creditPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${creditPercent}%` }}
              />
            </div>
          </div>
      </header>
      <Tabs className="px-3" onValueChange={(value) => setActiveView(value as 'chat' | 'insights')} value={activeView}>
        <TabsList aria-label="Areas do assistente" className="flex h-9 w-full items-end justify-start gap-4 rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger className="h-9 gap-2 rounded-none border-b-2 border-transparent bg-transparent px-1 py-0 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none" value="chat">
            <MessageSquare className="h-4 w-4" /> Chat
          </TabsTrigger>
          <TabsTrigger className="h-9 gap-2 rounded-none border-b-2 border-transparent bg-transparent px-1 py-0 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none" value="insights">
            <Lightbulb className="h-4 w-4" /> Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent className="mt-2" forceMount value="chat">
            <ChatTab estoqueData={estoqueData} giroData={giroData} now={now} customPrompt={customPrompt} codEmpresaBi={codEmpresaBi} credits={credits} onCreditUsed={refreshCredits} />
        </TabsContent>
        <TabsContent className="mt-2" forceMount value="insights">
            <EstoqueInsights data={estoqueData} giroData={giroData} now={now} onProductAction={onProductAction} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
