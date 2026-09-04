import { useCallback, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Area, AreaChart, Bar, BarChart,
  Scatter, ScatterChart, ZAxis, Tooltip as ReTooltip
} from 'recharts';
import { CheckCircle2, AlertTriangle, XCircle, TrendingUp, TrendingDown, Minus, ArrowUpDown, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EstoqueRecord, GiroRecord, GiroFiltersState, GiroProductSummary, GiroStatus } from '@/types/estoque';
import { analyzeSalesTrends, TrendDirection } from '@/utils/salesTrendAnalysis';
import { stockProductIdentity } from '@/utils/stockIdentity';
import { EstoqueTrendAlerts } from './EstoqueTrendAlerts';
import { GiroManagementPanel } from './estoque/GiroManagementPanel';
import {
  buildGiroManagementSummary,
  GIRO_RECOMMENDED_ACTIONS,
  GIRO_STATUS_RULES,
} from './estoque/giroIntelligence';

interface Props {
  giroData: GiroRecord[];
  estoqueData: EstoqueRecord[];
  filters: GiroFiltersState;
  onStatusFilterChange: (statuses: GiroStatus[]) => void;
  activeCompanyCode?: number | string | null;
}

const STATUS_CONFIG: Record<GiroStatus, { label: string; color: string; icon: typeof CheckCircle2; bg: string }> = {
  atendendo: { label: 'Atendendo', color: 'text-emerald-400', icon: CheckCircle2, bg: 'bg-emerald-500/10' },
  alerta: { label: 'Alerta', color: 'text-amber-400', icon: AlertTriangle, bg: 'bg-amber-500/10' },
  faltando: { label: 'Faltando', color: 'text-red-400', icon: XCircle, bg: 'bg-red-500/10' },
  excesso: { label: 'Excesso', color: 'text-blue-400', icon: TrendingUp, bg: 'bg-blue-500/10' },
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const formatNumber = (v: number) =>
  new Intl.NumberFormat('pt-BR').format(v);

interface LineTooltipEntry {
  color?: string;
  name?: string;
  value?: number;
}

interface LineTooltipProps {
  active?: boolean;
  payload?: LineTooltipEntry[];
  label?: string;
}

function LineChartTooltip({ active, payload, label }: LineTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[160px] border border-border bg-card p-3 shadow-md">
      <p className="text-xs text-muted-foreground mb-2 font-medium">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
            <span className="text-xs text-muted-foreground">{p.name}</span>
          </div>
          <span className="text-sm font-bold tabular-nums">{formatNumber(p.value ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}

function calcGiroStatus(estoque: number, vendasPeriodo: number, meses: number): GiroStatus {
  if (estoque === 0) return 'faltando';
  const mediaVendaMensal = vendasPeriodo / meses;
  if (mediaVendaMensal === 0) {
    return estoque > 0 ? 'excesso' : 'faltando';
  }
  const mesesEstoque = estoque / mediaVendaMensal;
  if (mesesEstoque < 1) return 'faltando';
  if (mesesEstoque < 2) return 'alerta';
  if (mesesEstoque > 6) return 'excesso';
  return 'atendendo';
}

function getDaysSinceSale(value: string | null): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)));
}

function GiroStatusHelp({ id, status }: { id: string; status: GiroStatus }) {
  const [open, setOpen] = useState(false);
  const config = STATUS_CONFIG[status];
  const descriptionId = `${id}-description`;

  return (
    <Tooltip open={open}>
      <TooltipTrigger asChild>
        <button
          aria-describedby={descriptionId}
          aria-label={`Explicar status ${config.label}`}
          className="inline-flex cursor-help rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onBlur={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onPointerEnter={() => setOpen(true)}
          onPointerLeave={() => setOpen(false)}
          type="button"
        >
          <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', config.color, config.bg)}>
            {config.label}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs" data-testid={`${id}-tooltip`} side="top">
        {GIRO_STATUS_RULES[status]}
      </TooltipContent>
      <span className="sr-only" id={descriptionId}>{GIRO_STATUS_RULES[status]}</span>
    </Tooltip>
  );
}

function AnalysisEmpty({ children }: { children: string }) {
  return <div className="flex min-h-32 items-center justify-center px-4 text-center text-sm text-muted-foreground" role="status">{children}</div>;
}

export function GiroEstoqueTab({ giroData, estoqueData, filters, onStatusFilterChange, activeCompanyCode }: Props) {
  const [sortField, setSortField] = useState<keyof GiroProductSummary>('valor_estoque');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [visibleCount, setVisibleCount] = useState(50);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const productIdentity = useCallback((record: EstoqueRecord | GiroRecord | GiroProductSummary) => {
    const recordCompanyCode = String(record.cod_empresa_bi ?? '').trim();
    if (recordCompanyCode && recordCompanyCode !== '0') return stockProductIdentity(record);
    return stockProductIdentity({ ...record, cod_empresa_bi: activeCompanyCode });
  }, [activeCompanyCode]);
  const movementIdentity = productIdentity;

  // Compute date cutoff based on period
  const dateCutoff = useMemo(() => {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - filters.periodoMeses, 1);
  }, [filters.periodoMeses]);

  // Filter giro data by period
  const filteredGiro = useMemo(() => {
    return giroData.filter(r => {
      const timestamp = Date.parse(r.data_movimento);
      return Number.isFinite(timestamp) && timestamp >= dateCutoff;
    });
  }, [giroData, dateCutoff]);

  // Build product summaries
  const managementProducts = useMemo(() => {
    const map = new Map<string, GiroProductSummary>();

    // Initialize from estoque data
    estoqueData.forEach(r => {
      const identity = productIdentity(r);
      if (!map.has(identity)) {
        map.set(identity, {
          cod_empresa_bi: r.cod_empresa_bi,
          cod_empresa: r.cod_empresa,
          cod_produto: r.cod_produto,
          produto: r.produto,
          marca: r.marca,
          grupo: r.grupo,
          empresa: r.empresa,
          quantidade_estoque: r.quantidade_estoque,
          valor_estoque: r.valor_estoque,
          total_vendas: 0,
          total_compras: 0,
          giro: 0,
          status: 'atendendo',
          dias_sem_venda: getDaysSinceSale(r.data_ultima_venda),
          ultima_venda: r.data_ultima_venda,
          total_saida_venda: 0,
          total_entrada_compra: 0,
          total_saida_transferencia: 0,
          total_entrada_transferencia: 0,
          cobertura_meses: null,
          classe_abc: r.classe_abc,
        });
      } else {
        const existing = map.get(identity)!;
        existing.quantidade_estoque += r.quantidade_estoque;
        existing.valor_estoque += r.valor_estoque;
        if (r.data_ultima_venda && (!existing.ultima_venda || r.data_ultima_venda > existing.ultima_venda)) {
          existing.ultima_venda = r.data_ultima_venda;
          existing.dias_sem_venda = getDaysSinceSale(r.data_ultima_venda);
        }
      }
    });

    // Aggregate giro data
    filteredGiro.forEach(r => {
      const identity = movementIdentity(r);
      let entry = map.get(identity);
      if (!entry) {
        entry = {
          cod_empresa_bi: r.cod_empresa_bi,
          cod_empresa: r.cod_empresa,
          cod_produto: r.cod_produto,
          produto: r.produto,
          marca: r.marca,
          grupo: r.grupo,
          empresa: r.empresa,
          quantidade_estoque: r.quantidade_estoque,
          valor_estoque: r.valor_estoque,
          total_vendas: 0,
          total_compras: 0,
          giro: 0,
          status: 'atendendo',
          dias_sem_venda: null,
          ultima_venda: null,
          total_saida_venda: 0,
          total_entrada_compra: 0,
          total_saida_transferencia: 0,
          total_entrada_transferencia: 0,
          cobertura_meses: null,
          classe_abc: null,
        };
        map.set(identity, entry);
      }
      entry.total_saida_venda += r.saida_venda;
      entry.total_entrada_compra += r.entrada_compra;
      entry.total_saida_transferencia += r.saida_transferencia;
      entry.total_entrada_transferencia += r.entrada_transferencia;
      entry.total_vendas += r.quantidade_movimentada * (r.tipo_movimento === 'Venda' ? 1 : 0);
      entry.total_compras += r.quantidade_movimentada * (r.tipo_movimento === 'Compra' ? 1 : 0);
    });

    // Calculate status and giro
    map.forEach(entry => {
      entry.giro = entry.quantidade_estoque > 0
        ? entry.total_vendas / entry.quantidade_estoque
        : 0;
      const mediaVendaMensal = entry.total_vendas / filters.periodoMeses;
      entry.cobertura_meses = mediaVendaMensal > 0
        ? entry.quantidade_estoque / mediaVendaMensal
        : null;
      entry.status = calcGiroStatus(entry.quantidade_estoque, entry.total_vendas, filters.periodoMeses);
    });

    let summaries = [...map.values()];

    // Apply filters
    if (filters.empresas.length > 0) summaries = summaries.filter(s => filters.empresas.includes(s.empresa));
    if (filters.marcas.length > 0) summaries = summaries.filter(s => filters.marcas.includes(s.marca));
    if (filters.grupos.length > 0) summaries = summaries.filter(s => filters.grupos.includes(s.grupo));
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      summaries = summaries.filter(s => s.produto.toLowerCase().includes(term) || s.marca.toLowerCase().includes(term));
    }

    return summaries;
  }, [estoqueData, filteredGiro, filters, movementIdentity, productIdentity]);

  const productSummaries = useMemo(() => (
    filters.statusFilter.length > 0
      ? managementProducts.filter(summary => filters.statusFilter.includes(summary.status))
      : managementProducts
  ), [filters.statusFilter, managementProducts]);

  const analysisGiroData = useMemo(() => {
    const identities = new Set(managementProducts.map(productIdentity));
    return filteredGiro.filter(record => identities.has(movementIdentity(record)));
  }, [filteredGiro, managementProducts, movementIdentity, productIdentity]);

  const managementSummary = useMemo(
    () => buildGiroManagementSummary(managementProducts),
    [managementProducts],
  );

  // Analyze sales trends
  const trendMap = useMemo(() => {
    const trends = analyzeSalesTrends(analysisGiroData, 3, productIdentity);
    const map = new Map<string, { trend: TrendDirection; dropPercent: number }>();
    trends.forEach(t => map.set(productIdentity(t), { trend: t.trend, dropPercent: t.dropPercent }));
    return map;
  }, [analysisGiroData, productIdentity]);

  // Sort
  const sorted = useMemo(() => {
    return [...productSummaries].sort((a, b) => {
      const va = a[sortField] ?? 0;
      const vb = b[sortField] ?? 0;
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === 'asc' ? Number(va) - Number(vb) : Number(vb) - Number(va);
    });
  }, [productSummaries, sortField, sortDir]);

  const topGiro = useMemo(() => {
    return [...productSummaries]
      .sort((a, b) => b.giro - a.giro)
      .slice(0, 10)
      .map(s => ({
        name: s.produto.length > 25 ? s.produto.substring(0, 25) + '...' : s.produto,
        fullName: s.produto,
        giro: parseFloat(s.giro.toFixed(2)),
        marca: s.marca,
      }));
  }, [productSummaries]);

  const topParados = useMemo(() => {
    return [...productSummaries]
      .filter((s): s is GiroProductSummary & { dias_sem_venda: number } => s.dias_sem_venda !== null)
      .sort((a, b) => b.dias_sem_venda - a.dias_sem_venda)
      .slice(0, 10)
      .map(s => ({
        name: s.produto.length > 25 ? s.produto.substring(0, 25) + '...' : s.produto,
        fullName: s.produto,
        dias: s.dias_sem_venda,
        marca: s.marca,
      }));
  }, [productSummaries]);

  // Monthly evolution
  const evolucaoMensal = useMemo(() => {
    const map = new Map<string, { vendas: number; compras: number }>();
    analysisGiroData.forEach(r => {
      const mes = r.data_movimento.substring(0, 7); // YYYY-MM
      const entry = map.get(mes) || { vendas: 0, compras: 0 };
      if (r.tipo_movimento === 'Venda') entry.vendas += r.quantidade_movimentada;
      if (r.tipo_movimento === 'Compra') entry.compras += r.quantidade_movimentada;
      map.set(mes, entry);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, vals]) => ({
        mes: mes.substring(5) + '/' + mes.substring(2, 4),
        vendas: vals.vendas,
        compras: vals.compras,
      }));
  }, [analysisGiroData]);

  const filteredMovementTotals = useMemo(() => evolucaoMensal.reduce(
    (total, month) => ({ vendas: total.vendas + month.vendas, compras: total.compras + month.compras }),
    { vendas: 0, compras: 0 },
  ), [evolucaoMensal]);

  const toggleSort = (field: keyof GiroProductSummary) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const sortDirection = (field: keyof GiroProductSummary) => (
    sortField === field ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
  );

  return (
    <TooltipProvider delayDuration={0}>
    <div className="min-w-0 space-y-3">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{sorted.length}</span> produtos analisados
        </p>
        <Button aria-label="Abrir analise de giro" className="h-9 gap-2" onClick={() => setAnalysisOpen(true)} type="button" variant="outline">
          <BarChart3 aria-hidden="true" className="h-4 w-4" />
          <span>Analise de giro</span>
        </Button>
      </div>

      <Sheet onOpenChange={setAnalysisOpen} open={analysisOpen}>
        <SheetContent className="w-[min(96vw,48rem)] overflow-x-hidden overflow-y-auto p-0 sm:max-w-3xl" side="right">
          <SheetHeader className="border-b border-border px-5 py-4 pr-12 text-left">
            <SheetTitle>Analise de giro</SheetTitle>
            <SheetDescription>Tendencia mensal e produtos que merecem acompanhamento.</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 p-5">
            <EstoqueTrendAlerts giroData={analysisGiroData} />
            <div className="grid min-w-0 gap-5 lg:grid-cols-2">
              <section aria-label="Distribuicao por status" className="min-w-0 space-y-3">
                <h3 className="text-sm font-semibold">Distribuicao por status</h3>
                <div className="flex flex-wrap gap-2" aria-label="Filtros da distribuicao por status">
                  {managementSummary.statusDistribution.map(item => (
                    <button
                      aria-label={`Filtrar status ${STATUS_CONFIG[item.status].label}`}
                      className="border border-border px-2 py-1 text-xs font-medium hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      key={item.status}
                      onClick={() => onStatusFilterChange([item.status])}
                      type="button"
                    >
                      {STATUS_CONFIG[item.status].label} {item.count}
                    </button>
                  ))}
                </div>
                <div className="h-[210px] min-w-0">
                  {managementSummary.statusDistribution.length === 0 ? (
                    <AnalysisEmpty>Sem dados para distribuicao por status.</AnalysisEmpty>
                  ) : (
                  <ResponsiveContainer height="100%" width="100%">
                    <BarChart data={managementSummary.statusDistribution}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" strokeOpacity={0.3} />
                      <XAxis dataKey="status" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <ReTooltip />
                      <Bar dataKey="count" fill="#38bdf8" name="Produtos" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </section>
              <section aria-label="Estoque versus vendas" className="min-w-0 space-y-3">
                <h3 className="text-sm font-semibold">Estoque versus vendas</h3>
                <div className="h-[210px] min-w-0">
                  {managementSummary.stockVersusSales.length === 0 ? (
                    <AnalysisEmpty>Sem dados para comparar estoque e vendas.</AnalysisEmpty>
                  ) : (
                  <ResponsiveContainer height="100%" width="100%">
                    <ScatterChart>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" strokeOpacity={0.3} />
                      <XAxis dataKey="estoque" name="Estoque" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} type="number" />
                      <YAxis dataKey="vendas" name="Vendas" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} type="number" />
                      <ZAxis dataKey="valor" range={[35, 220]} />
                      <ReTooltip cursor={{ strokeDasharray: '3 3' }} />
                      <Scatter data={managementSummary.stockVersusSales} fill="#3b82f6" name="Produtos" />
                    </ScatterChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </section>
            </div>
            <section className="space-y-3" aria-label="Movimentacao mensal">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Movimentação mensal</h3>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">{filters.periodoMeses} meses</Badge>
              </div>
              <p className="sr-only">Movimentacao filtrada: {formatNumber(filteredMovementTotals.vendas)} vendas e {formatNumber(filteredMovementTotals.compras)} compras.</p>
              <div className="h-[230px] min-w-0">
                {evolucaoMensal.length === 0 ? (
                  <AnalysisEmpty>Sem movimentacoes no periodo filtrado.</AnalysisEmpty>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={evolucaoMensal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} />
                    <ReTooltip content={<LineChartTooltip />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '4 4' }} />
                    <Area type="monotone" dataKey="vendas" stroke="#f59e0b" strokeWidth={2} fill="#f59e0b" fillOpacity={0.08} name="Vendas" dot={false} activeDot={{ r: 4 }} animationDuration={180} />
                    <Area type="monotone" dataKey="compras" stroke="#3b82f6" strokeWidth={2} fill="#3b82f6" fillOpacity={0.06} name="Compras" dot={false} activeDot={{ r: 4 }} animationDuration={180} />
                  </AreaChart>
                </ResponsiveContainer>
                )}
              </div>
            </section>
            <div className="grid min-w-0 gap-5 lg:grid-cols-2">
              <section aria-label="Faixas sem venda" className="min-w-0 space-y-3">
                <h3 className="text-sm font-semibold">Faixas sem venda</h3>
                <div className="h-[210px] min-w-0">
                  {managementSummary.noSaleBuckets.length === 0 ? (
                    <AnalysisEmpty>Sem dados de tempo sem venda.</AnalysisEmpty>
                  ) : (
                  <ResponsiveContainer height="100%" width="100%">
                    <BarChart data={managementSummary.noSaleBuckets} layout="vertical">
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" strokeOpacity={0.3} />
                      <XAxis allowDecimals={false} type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis dataKey="faixa" type="category" width={96} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <ReTooltip />
                      <Bar dataKey="count" fill="#f59e0b" name="Produtos" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </section>
              <section aria-label="Ranking de capital parado" className="min-w-0">
                <h3 className="border-b border-border pb-2 text-sm font-semibold">Ranking de capital parado</h3>
                <div className="divide-y divide-border/70">
                  {managementSummary.idleCapitalRanking.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Nenhum capital parado identificado.</p>
                  ) : managementSummary.idleCapitalRanking.slice(0, 5).map((item, index) => (
                    <div className="flex h-11 min-w-0 items-center gap-3" key={`${item.empresa}-${item.cod_produto}`}>
                      <span className="w-5 text-xs text-muted-foreground">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-sm" title={item.produto}>{item.produto}</span>
                      <span className="whitespace-nowrap text-sm font-semibold tabular-nums">{formatCurrency(item.valor)}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
            {managementSummary.abcValueDistribution.length > 0 && (
              <section aria-label="Valor por curva ABC" className="space-y-3">
                <h3 className="text-sm font-semibold">Valor por curva ABC</h3>
                <div className="grid gap-2 sm:grid-cols-3">
                  {managementSummary.abcValueDistribution.map(item => (
                    <div className="border border-border/70 p-3" key={item.classe}>
                      <p className="text-xs text-muted-foreground">Curva {item.classe} · {item.produtos} produtos</p>
                      <p className="mt-1 font-semibold tabular-nums">{formatCurrency(item.valor)}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <div className="grid min-w-0 gap-5 md:grid-cols-2">
              <section aria-label="Maior giro" className="min-w-0">
                <h3 className="border-b border-border pb-2 text-sm font-semibold">Maior giro</h3>
                <div className="divide-y divide-border/70">
                  {topGiro.slice(0, 5).map((item, index) => (
                    <div key={`${item.fullName}-${index}`} className="flex h-11 min-w-0 items-center gap-3">
                      <span className="w-5 text-xs text-muted-foreground">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-sm" title={item.fullName}>{item.fullName}</span>
                      <span className="whitespace-nowrap text-sm font-semibold tabular-nums">{item.giro.toFixed(2)}x</span>
                    </div>
                  ))}
                  {topGiro.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum produto para o ranking de giro.</p>}
                </div>
              </section>
              <section aria-label="Mais tempo sem venda" className="min-w-0">
                <h3 className="border-b border-border pb-2 text-sm font-semibold">Mais tempo sem venda</h3>
                <div className="divide-y divide-border/70">
                  {topParados.slice(0, 5).map((item, index) => (
                    <div key={`${item.fullName}-${index}`} className="flex h-11 min-w-0 items-center gap-3">
                      <span className="w-5 text-xs text-muted-foreground">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-sm" title={item.fullName}>{item.fullName}</span>
                      <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">{item.dias}d</span>
                    </div>
                  ))}
                  {topParados.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma venda conhecida para o ranking.</p>}
                </div>
              </section>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <GiroManagementPanel
        activeStatuses={filters.statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        products={managementProducts}
      />

      <section aria-label="Produtos analisados no giro" className="min-w-0 overflow-hidden border border-border/80 bg-background">
          {sorted.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground" role="status">Nenhum produto corresponde aos filtros.</p>
          )}
          <div className="divide-y md:hidden">
            {sorted.slice(0, visibleCount).map(s => {
              const statusHelpId = `giro-status-mobile-${encodeURIComponent(s.empresa)}-${s.cod_produto}`;
              return (
                <article key={`${s.empresa}-${s.cod_produto}`} className="space-y-2 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{s.produto}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{s.cod_produto} · {s.marca || 'Sem marca'}</p>
                    </div>
                    <span className="shrink-0">
                      <GiroStatusHelp id={statusHelpId} status={s.status} />
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-xs min-[420px]:grid-cols-4">
                    <div><dt className="text-muted-foreground">Estoque</dt><dd className="mt-1 font-semibold tabular-nums">{formatNumber(s.quantidade_estoque)}</dd></div>
                    <div><dt className="text-muted-foreground">Giro</dt><dd className="mt-1 font-semibold tabular-nums">{s.giro.toFixed(2)}x</dd></div>
                    <div><dt className="text-muted-foreground">Sem venda</dt><dd className="mt-1 font-semibold tabular-nums">{s.dias_sem_venda === null ? 'Desconhecido' : `${s.dias_sem_venda}d`}</dd></div>
                    <div><dt className="text-muted-foreground">Acao</dt><dd className="mt-1 font-semibold">{GIRO_RECOMMENDED_ACTIONS[s.status]}</dd></div>
                  </dl>
                </article>
              );
            })}
          </div>
          <div className="hidden max-h-[calc(100vh-19rem)] min-h-[18rem] overflow-auto md:block">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted">
                <TableRow>
                  <TableHead aria-label="Codigo" aria-sort={sortDirection('cod_produto')} className="min-w-[60px] p-0">
                    <button aria-label="Ordenar por codigo" className="flex h-12 w-full items-center gap-1 px-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => toggleSort('cod_produto')} type="button">
                      Codigo <ArrowUpDown aria-hidden="true" className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="min-w-[180px]">Produto</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Filial</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead aria-label="Estoque" aria-sort={sortDirection('quantidade_estoque')} className="p-0 text-right">
                    <button aria-label="Ordenar por estoque" className="flex h-12 w-full items-center justify-end gap-1 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => toggleSort('quantidade_estoque')} type="button">
                      Estoque <ArrowUpDown aria-hidden="true" className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead aria-label="Valor Estoque" aria-sort={sortDirection('valor_estoque')} className="p-0 text-right">
                    <button aria-label="Ordenar por valor em estoque" className="flex h-12 w-full items-center justify-end gap-1 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => toggleSort('valor_estoque')} type="button">
                      Valor Estoque <ArrowUpDown aria-hidden="true" className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead aria-label="Vendas" aria-sort={sortDirection('total_vendas')} className="p-0 text-right">
                    <button aria-label="Ordenar por vendas" className="flex h-12 w-full items-center justify-end gap-1 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => toggleSort('total_vendas')} type="button">
                      Vendas <ArrowUpDown aria-hidden="true" className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead aria-label="Giro" aria-sort={sortDirection('giro')} className="p-0 text-right">
                    <button aria-label="Ordenar por giro" className="flex h-12 w-full items-center justify-end gap-1 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => toggleSort('giro')} type="button">
                      Giro <ArrowUpDown aria-hidden="true" className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead aria-label="Dias sem venda" aria-sort={sortDirection('dias_sem_venda')} className="p-0 text-right">
                    <button aria-label="Ordenar por dias sem venda" className="flex h-12 w-full items-center justify-end gap-1 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => toggleSort('dias_sem_venda')} type="button">
                      Dias s/ Venda <ArrowUpDown aria-hidden="true" className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-center">Tendência</TableHead>
                  <TableHead className="min-w-[140px]">Acao recomendada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.slice(0, visibleCount).map(s => {
                  const statusHelpId = `giro-status-table-${encodeURIComponent(s.empresa)}-${s.cod_produto}`;
                  return (
                    <TableRow className="h-11" key={`${s.empresa}-${s.cod_produto}`}>
                      <TableCell className="font-mono text-xs">{s.cod_produto}</TableCell>
                      <TableCell className="font-medium text-sm max-w-[180px] truncate">{s.produto}</TableCell>
                      <TableCell className="text-xs">{s.marca}</TableCell>
                      <TableCell className="text-xs">{s.empresa.replace(/^CASPPER\s*/i, '')}</TableCell>
                      <TableCell className="text-center">
                        <GiroStatusHelp id={statusHelpId} status={s.status} />
                      </TableCell>
                      <TableCell className="text-right font-mono">{s.quantidade_estoque}</TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono text-sm">{formatCurrency(s.valor_estoque)}</TableCell>
                      <TableCell className="text-right font-mono">{s.total_vendas}</TableCell>
                      <TableCell className="text-right font-mono">{s.giro.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <span className={s.dias_sem_venda !== null && s.dias_sem_venda > 90 ? 'text-red-400' : s.dias_sem_venda !== null && s.dias_sem_venda > 60 ? 'text-amber-400' : ''}>
                          {s.dias_sem_venda === null ? 'Desconhecido' : `${s.dias_sem_venda}d`}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const t = trendMap.get(productIdentity(s));
                          if (!t) return <Minus aria-label="Tendencia estavel" className="h-4 w-4 text-muted-foreground inline" />;
                          if (t.trend === 'declining') return (
                            <span aria-label={`Tendencia de queda de ${t.dropPercent.toFixed(0)}%`} className="inline-flex items-center gap-1 text-red-400" title={`Queda de ${t.dropPercent.toFixed(0)}%`}>
                              <TrendingDown className="h-4 w-4" />
                              <span className="text-xs font-mono">-{t.dropPercent.toFixed(0)}%</span>
                            </span>
                          );
                          if (t.trend === 'growing') return (
                            <span aria-label="Tendencia de crescimento" className="inline-flex items-center gap-1 text-emerald-400">
                              <TrendingUp className="h-4 w-4" />
                            </span>
                          );
                          return <Minus aria-label="Tendencia estavel" className="h-4 w-4 text-muted-foreground inline" />;
                        })()}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs font-medium">{GIRO_RECOMMENDED_ACTIONS[s.status]}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {visibleCount < sorted.length && (
            <div className="flex items-center justify-center gap-3 border-t border-border/50 py-3">
              <span className="text-xs text-muted-foreground">
                Mostrando {Math.min(visibleCount, sorted.length)} de {sorted.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount(v => Math.min(v + 50, sorted.length))}
              >
                Carregar mais 50
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVisibleCount(sorted.length)}
              >
                Ver todos
              </Button>
            </div>
          )}
      </section>
    </div>
    </TooltipProvider>
  );
}
