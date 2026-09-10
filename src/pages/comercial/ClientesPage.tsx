import { useState, useMemo, useCallback } from 'react';
import { useComercialData } from '@/hooks/useComercialData';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  MapPin,
  AlertTriangle,
  Sparkles,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  EnterpriseBadge,
  EnterpriseDataPanel,
  EnterpriseMetricCard,
  EnterpriseSearchFilter,
  EnterpriseTbody,
  EnterpriseTd,
  EnterpriseTh,
  EnterpriseThead,
  EnterpriseTr,
} from '@/components/enterprise';
import { EnterpriseComercialFilters } from '@/components/comercial/EnterpriseComercialFilters';
import {
  ComercialCommandBar,
  ComercialCompactPage,
  ComercialDataViewport,
  ComercialMetricStrip,
} from '@/components/comercial/compact';
import type { ComercialFilters as ComercialFiltersType } from '@/types/comercial';

// Paleta enterprise: usa primário do sistema + neutros + status colors.
// Para itens secundários no ranking usamos variações sutis em torno do primário.
const RANK_COLORS = [
  'hsl(var(--primary))',
  'hsl(217, 70%, 55%)',
  'hsl(217, 50%, 48%)',
  'hsl(217, 35%, 42%)',
  'hsl(217, 22%, 38%)',
  'hsl(217, 18%, 45%)',
  'hsl(217, 15%, 50%)',
  'hsl(217, 12%, 55%)',
  'hsl(217, 10%, 60%)',
  'hsl(217, 8%, 62%)',
];

const ANOS_DISPONIVEIS = ['2023', '2024', '2025', '2026'];
const CLIENTES_PER_PAGE = 50;

const hoje = new Date();
const anoAtual = String(hoje.getFullYear());
const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');

const filtrosIniciais: ComercialFiltersType = {
  anos: [anoAtual],
  meses: [mesAtual],
  periodo: {
    inicio: `${anoAtual}-${mesAtual}-01`,
    fim: `${anoAtual}-${mesAtual}-${String(hoje.getDate()).padStart(2, '0')}`,
  },
  status: 'todos',
};

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */
export default function ClientesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [rankingPage, setRankingPage] = useState(1);
  const [activeTab, setActiveTab] = useState('ranking');

  const [pendingFilters, setPendingFilters] = useState<ComercialFiltersType>(filtrosIniciais);
  const [appliedFilters, setAppliedFilters] = useState<ComercialFiltersType>(filtrosIniciais);

  const {
    clientesPerformance,
    pedidos,
    ufsUnicas,
    kpis,
    vendedoresDisponiveis,
    isLoading,
    error,
  } = useComercialData(appliedFilters);

  const hasChanges = JSON.stringify(pendingFilters) !== JSON.stringify(appliedFilters);

  const handleBuscar = useCallback(() => {
    setAppliedFilters(pendingFilters);
    setRankingPage(1);
  }, [pendingFilters]);

  const handleClearFilters = useCallback(() => {
    setPendingFilters(filtrosIniciais);
    setAppliedFilters(filtrosIniciais);
    setRankingPage(1);
  }, []);

  const clientesFiltrados = clientesPerformance.filter(c =>
    c.razao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.fantasia?.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const totalRankingPages = Math.max(1, Math.ceil(clientesFiltrados.length / CLIENTES_PER_PAGE));
  const currentRankingPage = Math.min(rankingPage, totalRankingPages);
  const rankingStartIndex = (currentRankingPage - 1) * CLIENTES_PER_PAGE;
  const clientesDaPagina = clientesFiltrados.slice(rankingStartIndex, rankingStartIndex + CLIENTES_PER_PAGE);
  const rankingRangeStart = clientesFiltrados.length === 0 ? 0 : rankingStartIndex + 1;
  const rankingRangeEnd = Math.min(rankingStartIndex + CLIENTES_PER_PAGE, clientesFiltrados.length);
  const rankingViewportKey = `${currentRankingPage}:${searchTerm}:${JSON.stringify(appliedFilters)}`;

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setRankingPage(1);
  }, []);

  const distribuicaoPorUF = useMemo(() => {
    const ufMap = new Map<string, number>();
    let totalGeral = 0;
    clientesPerformance.forEach(c => {
      const uf = c.uf || 'N/D';
      ufMap.set(uf, (ufMap.get(uf) || 0) + c.faturamentoLiquido);
      totalGeral += c.faturamentoLiquido;
    });
    return Array.from(ufMap.entries())
      .map(([uf, valor]) => ({
        uf,
        valor,
        percentual: totalGeral > 0 ? (valor / totalGeral) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);
  }, [clientesPerformance]);

  const top5Codigos = clientesPerformance.slice(0, 5).map(c => c.codigo);
  const evolucaoTop5 = useMemo(() => {
    const mesMap = new Map<string, Record<string, number>>();
    pedidos.filter(p => top5Codigos.includes(p.cliente_codigo)).forEach(p => {
      const mes = p.data_pedido.substring(0, 7);
      const clienteKey = String(p.cliente_codigo);
      const existing = mesMap.get(mes) || {};
      existing[clienteKey] = (existing[clienteKey] || 0) + (p.valor_liquido || 0);
      mesMap.set(mes, existing);
    });
    return Array.from(mesMap.entries())
      .map(([mes, valores]) => {
        const total = Object.values(valores).reduce((a, b) => a + b, 0);
        return { mes, total, ...valores };
      })
      .sort((a, b) => a.mes.localeCompare(b.mes));
  }, [pedidos, top5Codigos]);

  const evolucaoStats = useMemo(() => {
    if (evolucaoTop5.length < 1) return null;
    const ultimo = evolucaoTop5[evolucaoTop5.length - 1]?.total || 0;
    const anterior = evolucaoTop5[evolucaoTop5.length - 2]?.total || 0;
    const delta = anterior > 0 ? ((ultimo - anterior) / anterior) * 100 : 0;
    const maxMes = evolucaoTop5.reduce((m, c) => (c.total > m.total ? c : m), evolucaoTop5[0]);
    const total = evolucaoTop5.reduce((a, b) => a + b.total, 0);
    return { ultimo, anterior, delta, maxMes, total };
  }, [evolucaoTop5]);

  const clientesEmRisco = useMemo(() => {
    const limite = new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1);
    return clientesPerformance.filter(c => {
      if (!c.ultimaCompra) return true;
      return new Date(c.ultimaCompra) < limite;
    }).slice(0, 10);
  }, [clientesPerformance]);

  const novosClientes = useMemo(() => {
    const limite = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    return clientesPerformance.filter(c => {
      if (!c.primeiraCompra) return false;
      return new Date(c.primeiraCompra) >= limite;
    });
  }, [clientesPerformance]);

  const insightsIA = useMemo(() => {
    const arr: { tipo: 'risco' | 'oportunidade' | 'alerta' | 'tendencia'; titulo: string; descricao: string; icon: React.ReactNode; tone: 'success' | 'warning' | 'danger' | 'default' }[] = [];
    const top3 = clientesPerformance.slice(0, 3);
    const totalFat = clientesPerformance.reduce((a, b) => a + b.faturamentoLiquido, 0);
    const concentracao = top3.reduce((a, b) => a + b.faturamentoLiquido, 0);
    const pctConc = totalFat > 0 ? (concentracao / totalFat) * 100 : 0;
    if (pctConc > 40) {
      arr.push({
        tipo: 'alerta',
        titulo: 'Alta concentração de receita',
        descricao: `Os top 3 clientes representam ${pctConc.toFixed(1)}% do faturamento. Considere diversificar a base.`,
        icon: <AlertTriangle className="h-4 w-4" />,
        tone: 'warning',
      });
    }
    if (clientesEmRisco.length > 0) {
      const valorRisco = clientesEmRisco.reduce((a, b) => a + b.faturamentoLiquido, 0);
      arr.push({
        tipo: 'risco',
        titulo: `${clientesEmRisco.length} clientes em risco`,
        descricao: `Sem compras há 3+ meses · ${formatCurrency(valorRisco, true)} em receita histórica em risco.`,
        icon: <TrendingDown className="h-4 w-4" />,
        tone: 'danger',
      });
    }
    if (novosClientes.length > 0) {
      arr.push({
        tipo: 'oportunidade',
        titulo: `${novosClientes.length} novos clientes captados`,
        descricao: `Atenção pós-venda nos próximos 30 dias pode aumentar a retenção em até 25%.`,
        icon: <Sparkles className="h-4 w-4" />,
        tone: 'success',
      });
    }
    const topUf = distribuicaoPorUF[0];
    if (topUf && topUf.percentual > 35) {
      arr.push({
        tipo: 'tendencia',
        titulo: `${topUf.uf} lidera com ${topUf.percentual.toFixed(1)}%`,
        descricao: `Concentração geográfica acima do ideal. Avalie expansão regional para reduzir risco.`,
        icon: <MapPin className="h-4 w-4" />,
        tone: 'default',
      });
    }
    if (evolucaoStats && evolucaoStats.delta > 10) {
      arr.push({
        tipo: 'tendencia',
        titulo: `Aceleração de ${evolucaoStats.delta.toFixed(1)}%`,
        descricao: `Top 5 cresceram vs mês anterior. Momento ideal para upsell e cross-sell.`,
        icon: <TrendingUp className="h-4 w-4" />,
        tone: 'success',
      });
    }
    return arr;
  }, [clientesPerformance, clientesEmRisco, novosClientes, distribuicaoPorUF, evolucaoStats]);

  const formatMes = (mes: string) => {
    const [year, month] = mes.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[parseInt(month) - 1]}/${year.slice(2)}`;
  };

  if (isLoading || error) {
    return (
      <ComercialCompactPage
        as="div"
        className="clientes-page h-[calc(100dvh-9.5rem)] max-h-[calc(100dvh-9.5rem)] px-3 pb-3 pt-2 sm:px-4 md:h-full md:max-h-full"
      >
        <ComercialCommandBar title="Clientes" context="Carteira comercial" />
        <ComercialDataViewport ariaLabel="Estado da carteira de clientes" className="flex items-center justify-center">
          {isLoading
            ? <LoadingState message="Carregando clientes..." className="w-full max-w-md rounded-md shadow-none" size="sm" />
            : <ErrorState message="Erro ao carregar clientes" />}
        </ComercialDataViewport>
      </ComercialCompactPage>
    );
  }

  const toneBg = (t: 'success' | 'warning' | 'danger' | 'default') => ({
    success: 'text-success bg-success/10 ring-success/15',
    warning: 'text-warning bg-warning/10 ring-warning/15',
    danger: 'text-destructive bg-destructive/10 ring-destructive/15',
    default: 'text-primary bg-primary/10 ring-primary/15',
  }[t]);

  return (
    <ComercialCompactPage
      as="div"
      className="clientes-page h-[calc(100dvh-9.5rem)] max-h-[calc(100dvh-9.5rem)] px-3 pb-3 pt-2 sm:px-4 md:h-full md:max-h-full"
    >
      <ComercialCommandBar
        title="Clientes"
        context={`${clientesPerformance.length} clientes no período`}
        actions={
          <EnterpriseSearchFilter
            label="Buscar clientes"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Nome, razão social ou fantasia"
          />
        }
      />

      <EnterpriseComercialFilters
        pendingFilters={pendingFilters}
        appliedFilters={appliedFilters}
        onPendingFiltersChange={setPendingFilters}
        onApply={handleBuscar}
        onClear={handleClearFilters}
        hasChanges={hasChanges}
        anos={ANOS_DISPONIVEIS}
        vendedores={vendedoresDisponiveis}
        showVendedorFilter
        useNativeControls
      />

      <ComercialMetricStrip
        ariaLabel="Indicadores da carteira"
        metrics={[
          { label: 'Total de clientes', value: kpis.qtdClientes },
          { label: 'Novos em 30 dias', value: novosClientes.length, tone: 'success' },
          { label: 'Em risco', value: clientesEmRisco.length, tone: 'warning' },
          { label: 'Estados atendidos', value: ufsUnicas.length },
        ]}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <TabsList className="h-9 w-fit max-w-full shrink-0 justify-start overflow-x-auto">
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
          <TabsTrigger value="insights">Carteira</TabsTrigger>
          <TabsTrigger value="geografico">Geográfico</TabsTrigger>
        </TabsList>

        {/* =================================================== RANKING */}
        <TabsContent value="ranking" className="mt-0 flex h-full max-h-full min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          <ComercialDataViewport
            key={rankingViewportKey}
            ariaLabel="Ranking completo de clientes"
            className="h-full max-h-full"
          >
            <table aria-label="Ranking completo de clientes" className="w-full min-w-max border-collapse text-xs">
              <caption className="sr-only">Ranking completo de clientes</caption>
              <EnterpriseThead>
                <EnterpriseTr>
                  <EnterpriseTh numeric>#</EnterpriseTh>
                  <EnterpriseTh>Cliente</EnterpriseTh>
                  <EnterpriseTh>Cidade/UF</EnterpriseTh>
                  <EnterpriseTh numeric>Faturamento</EnterpriseTh>
                  <EnterpriseTh numeric>Pedidos</EnterpriseTh>
                  <EnterpriseTh numeric>Ticket</EnterpriseTh>
                  <EnterpriseTh numeric>Part. %</EnterpriseTh>
                  <EnterpriseTh numeric>Última Compra</EnterpriseTh>
                </EnterpriseTr>
              </EnterpriseThead>
              <EnterpriseTbody>
                    {clientesDaPagina.map((c, i) => {
                      const ranking = rankingStartIndex + i;
                      return (
                      <EnterpriseTr key={c.codigo} className="h-11">
                        <EnterpriseTd numeric>
                          {ranking < 3 ? (
                            <EnterpriseBadge tone={ranking === 0 ? 'info' : 'neutral'} className="justify-center">
                              {ranking + 1}°
                            </EnterpriseBadge>
                          ) : (
                            <span className="text-muted-foreground italic">{ranking + 1}</span>
                          )}
                        </EnterpriseTd>
                        <EnterpriseTd>
                          <div className="min-w-0">
                            <p className="truncate font-medium" title={c.fantasia || c.razao}>{c.fantasia || c.razao}</p>
                            {c.fantasia && (
                              <p className="truncate text-xs text-muted-foreground" title={c.razao}>{c.razao}</p>
                            )}
                          </div>
                        </EnterpriseTd>
                        <EnterpriseTd className="text-muted-foreground">
                          {c.cidade ? `${c.cidade}/${c.uf}` : c.uf || '-'}
                        </EnterpriseTd>
                        <EnterpriseTd numeric className="mono-value font-semibold">
                          {formatCurrency(c.faturamentoLiquido)}
                        </EnterpriseTd>
                        <EnterpriseTd numeric className="mono-value">{c.totalPedidos}</EnterpriseTd>
                        <EnterpriseTd numeric className="mono-value text-muted-foreground">
                          {formatCurrency(c.ticketMedio)}
                        </EnterpriseTd>
                        <EnterpriseTd numeric>
                          {formatPercent(c.participacao)}
                        </EnterpriseTd>
                        <EnterpriseTd numeric className="text-muted-foreground">
                          {c.ultimaCompra
                            ? new Date(c.ultimaCompra).toLocaleDateString('pt-BR')
                            : '-'}
                        </EnterpriseTd>
                      </EnterpriseTr>
                      );
                    })}
              </EnterpriseTbody>
            </table>
          </ComercialDataViewport>
          <nav
            aria-label="Paginação do ranking"
            className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-2 py-1.5"
          >
            <span aria-live="polite" className="text-xs tabular-nums text-muted-foreground">
              {rankingRangeStart}–{rankingRangeEnd} de {clientesFiltrados.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Página anterior"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                disabled={currentRankingPage === 1}
                onClick={() => setRankingPage(currentRankingPage - 1)}
              >
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Próxima página"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                disabled={currentRankingPage === totalRankingPages}
                onClick={() => setRankingPage(currentRankingPage + 1)}
              >
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </nav>
        </TabsContent>

        {/* =================================================== EVOLUÇÃO */}
        <TabsContent value="evolucao" className="mt-0 flex h-full max-h-full min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          <ComercialDataViewport ariaLabel="Evolução dos clientes" className="h-full max-h-full space-y-3">
          {evolucaoStats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <EnterpriseMetricCard label="Último mês" value={formatCurrency(evolucaoStats.ultimo, true)} />
              <EnterpriseMetricCard label="Mês anterior" value={formatCurrency(evolucaoStats.anterior, true)} />
              <EnterpriseMetricCard
                label="Variação"
                value={`${Math.abs(evolucaoStats.delta).toFixed(1)}%`}
                icon={evolucaoStats.delta >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                tone={evolucaoStats.delta >= 0 ? 'positive' : 'negative'}
              />
              <EnterpriseMetricCard
                label="Meta atingida"
                value={`${Math.min(((evolucaoStats.ultimo / (evolucaoStats.anterior || 1)) * 100), 200).toFixed(0)}%`}
                icon={<Target className="h-4 w-4" />}
                tone="info"
              />
            </div>
          )}

          <EnterpriseDataPanel
            title="Evolução de Vendas · Top 5 Clientes"
            density="compact"
          >
            <div className="h-[360px] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolucaoTop5}>
                  <defs>
                    {top5Codigos.map((codigo, i) => {
                      const color = RANK_COLORS[i % RANK_COLORS.length];
                      return (
                        <linearGradient key={String(codigo)} id={`area-${codigo}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      );
                    })}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatCurrency(v, true)} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={formatMes}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {top5Codigos.map((codigo, i) => {
                    const cliente = clientesPerformance.find(c => c.codigo === codigo);
                    const color = RANK_COLORS[i % RANK_COLORS.length];
                    return (
                      <Area
                        key={String(codigo)}
                        type="monotone"
                        dataKey={String(codigo)}
                        name={(cliente?.fantasia || cliente?.razao || `Cliente ${codigo}`).substring(0, 22)}
                        stroke={color}
                        strokeWidth={2}
                        fill={`url(#area-${codigo})`}
                        dot={false}
                        activeDot={{ r: 4 }}
                        animationDuration={1000}
                        animationEasing="ease-out"
                      />
                    );
                  })}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </EnterpriseDataPanel>
          </ComercialDataViewport>
        </TabsContent>

        {/* =================================================== CARTEIRA */}
        <TabsContent value="insights" className="mt-0 flex h-full max-h-full min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          <ComercialDataViewport ariaLabel="Alertas e oportunidades da carteira" className="h-full max-h-full space-y-3">
          {insightsIA.length > 0 && (
            <EnterpriseDataPanel
              title="Alertas e oportunidades"
              density="compact"
              actions={<EnterpriseBadge tone="info">{insightsIA.length} alertas</EnterpriseBadge>}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insightsIA.map((ins, i) => (
                  <div
                    key={i}
                    className="min-w-0 rounded-lg border border-border bg-muted/20 p-3.5 transition-colors hover:border-border"
                    style={{ animation: `cliRise 0.4s ${0.08 + i * 0.06}s ease-out backwards` }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('h-8 w-8 rounded-md flex items-center justify-center shrink-0 ring-1', toneBg(ins.tone))}>
                        {ins.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 truncate text-sm font-semibold">{ins.titulo}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{ins.descricao}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </EnterpriseDataPanel>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <EnterpriseDataPanel title="Clientes em Risco" description="Sem compras há 3+ meses" density="compact">
              {clientesEmRisco.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  Nenhum cliente em risco identificado
                </p>
              ) : (
                <div className="space-y-1.5">
                  {clientesEmRisco.map((c, i) => (
                    <div
                      key={c.codigo}
                      className="flex min-w-0 items-center justify-between rounded-md border border-border/60 p-2.5 transition-colors hover:bg-muted/30"
                      style={{ animation: `cliRise 0.35s ${i * 0.03}s ease-out backwards` }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{c.fantasia || c.razao}</p>
                        <p className="text-xs text-muted-foreground">
                          Última compra: {c.ultimaCompra ? new Date(c.ultimaCompra).toLocaleDateString('pt-BR') : 'Nunca'}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="font-semibold text-sm mono-value tabular-nums">{formatCurrency(c.faturamentoLiquido, true)}</p>
                        <p className="text-xs text-muted-foreground">{c.totalPedidos} pedidos</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </EnterpriseDataPanel>

            <EnterpriseDataPanel title="Novos Clientes" description="Último mês" density="compact">
              {novosClientes.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  Nenhum novo cliente no período
                </p>
              ) : (
                <div className="space-y-1.5">
                  {novosClientes.slice(0, 10).map((c, i) => (
                    <div
                      key={c.codigo}
                      className="flex min-w-0 items-center justify-between rounded-md border border-border/60 p-2.5 transition-colors hover:bg-muted/30"
                      style={{ animation: `cliRise 0.35s ${i * 0.03}s ease-out backwards` }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{c.fantasia || c.razao}</p>
                        <p className="text-xs text-muted-foreground">
                          Primeira compra: {c.primeiraCompra ? new Date(c.primeiraCompra).toLocaleDateString('pt-BR') : '-'}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="font-semibold text-sm mono-value tabular-nums text-success">{formatCurrency(c.faturamentoLiquido, true)}</p>
                        <p className="text-xs text-muted-foreground">{c.totalPedidos} pedidos</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </EnterpriseDataPanel>
          </div>
          </ComercialDataViewport>
        </TabsContent>

        {/* =================================================== GEOGRÁFICO */}
        <TabsContent value="geografico" className="mt-0 flex h-full max-h-full min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          <ComercialDataViewport ariaLabel="Distribuição geográfica dos clientes" className="h-full max-h-full">
          <EnterpriseDataPanel title="Top 10 Estados" density="compact">
            <div className="space-y-3">
              {distribuicaoPorUF.map((item, i) => {
                const maxPct = distribuicaoPorUF[0]?.percentual || 1;
                const fillPct = (item.percentual / maxPct) * 100;
                return (
                  <div
                    key={item.uf}
                    style={{ animation: `cliRise 0.35s ${i * 0.04}s ease-out backwards` }}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <EnterpriseBadge tone={i < 3 ? 'info' : 'neutral'} className="shrink-0 justify-center">
                          {i + 1}
                        </EnterpriseBadge>
                        <span className="font-semibold">{item.uf}</span>
                        <span className="text-xs text-muted-foreground">{formatPercent(item.percentual)}</span>
                      </div>
                      <span className="mono-value shrink-0 font-semibold tabular-nums text-foreground">
                        {formatCurrency(item.valor, true)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/80"
                        style={{
                          width: `${Math.max(fillPct, 2)}%`,
                          animation: `cliBar 0.7s ${0.15 + i * 0.05}s cubic-bezier(.22,.9,.32,1) backwards`,
                          transformOrigin: 'left center',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </EnterpriseDataPanel>
          </ComercialDataViewport>
        </TabsContent>
      </Tabs>

      <style>{`
        @keyframes cliRise {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cliBar {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>
    </ComercialCompactPage>
  );
}
