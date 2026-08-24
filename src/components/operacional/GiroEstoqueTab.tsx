import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip as RechartsTooltip, Tooltip } from 'recharts';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart,
  Tooltip as ReTooltip
} from 'recharts';
import { CheckCircle2, AlertTriangle, XCircle, TrendingUp, TrendingDown, Minus, ArrowUpDown, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EstoqueRecord, GiroRecord, GiroFiltersState, GiroProductSummary, GiroStatus } from '@/types/estoque';
import { analyzeSalesTrends, TrendDirection } from '@/utils/salesTrendAnalysis';
import { EstoqueTrendAlerts } from './EstoqueTrendAlerts';

interface Props {
  giroData: GiroRecord[];
  estoqueData: EstoqueRecord[];
  filters: GiroFiltersState;
  setFilters: React.Dispatch<React.SetStateAction<GiroFiltersState>>;
}

const STATUS_CONFIG: Record<GiroStatus, { label: string; color: string; icon: typeof CheckCircle2; bg: string; gradient: string }> = {
  atendendo: { label: 'Atendendo', color: 'text-emerald-400', icon: CheckCircle2, bg: 'bg-emerald-500/20', gradient: 'from-emerald-500 to-emerald-400' },
  alerta: { label: 'Alerta', color: 'text-amber-400', icon: AlertTriangle, bg: 'bg-amber-500/20', gradient: 'from-amber-500 to-amber-400' },
  faltando: { label: 'Faltando', color: 'text-red-400', icon: XCircle, bg: 'bg-red-500/20', gradient: 'from-red-500 to-red-400' },
  excesso: { label: 'Excesso', color: 'text-blue-400', icon: TrendingUp, bg: 'bg-blue-500/20', gradient: 'from-blue-500 to-blue-400' },
};

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const formatNumber = (v: number) =>
  new Intl.NumberFormat('pt-BR').format(v);

const formatPercent = (v: number) => `${v.toFixed(1)}%`;

// Premium tooltip matching Visão Geral style
function PremiumTooltip({ active, payload, label, total, valueLabel = 'Valor', isCurrency = false }: any) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value ?? 0;
  const pct = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="bg-card/95 backdrop-blur-xl border border-border rounded-xl p-3 shadow-2xl min-w-[180px]">
      <p className="text-xs text-muted-foreground mb-1 font-medium">{label || payload[0]?.name}</p>
      <p className="text-base font-bold text-foreground">
        {isCurrency ? formatCurrency(value) : formatNumber(value)}
      </p>
      {total > 0 && (
        <div className="flex items-center gap-2 mt-1">
          <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-amber-500">{formatPercent(pct)}</span>
        </div>
      )}
    </div>
  );
}

function PremiumLineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/95 backdrop-blur-xl border border-border rounded-xl p-3 shadow-2xl min-w-[160px]">
      <p className="text-xs text-muted-foreground mb-2 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
            <span className="text-xs text-muted-foreground">{p.name}</span>
          </div>
          <span className="text-sm font-bold tabular-nums">{formatNumber(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Drill-down breadcrumb
function GiroDrillBreadcrumb({ path, onNavigate }: { path: string[]; onNavigate: (index: number) => void }) {
  if (path.length <= 1) return null;
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
      {path.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3" />}
          <button
            onClick={() => onNavigate(i)}
            className={cn(
              'hover:text-foreground transition-colors',
              i === path.length - 1 ? 'text-foreground font-semibold' : 'hover:underline'
            )}
          >
            {item}
          </button>
        </span>
      ))}
    </div>
  );
}

function ActiveFilterChip({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1 text-xs bg-amber-500/10 text-amber-500 border-amber-500/20">
      {label}: {value}
      <button onClick={onRemove} className="ml-1 hover:bg-amber-500/20 rounded-full p-0.5">
        <X className="h-3 w-3" />
      </button>
    </Badge>
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

export function GiroEstoqueTab({ giroData, estoqueData, filters, setFilters }: Props) {
  const [sortField, setSortField] = useState<string>('valor_estoque');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [visibleCount, setVisibleCount] = useState(50);
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);
  const [drillPath, setDrillPath] = useState<string[]>(['Giro']);
  const [drillFilter, setDrillFilter] = useState<{ type: string; value: string } | null>(null);

  // Compute date cutoff based on period
  const dateCutoff = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - filters.periodoMeses);
    return d.toISOString();
  }, [filters.periodoMeses]);

  // Filter giro data by period
  const filteredGiro = useMemo(() => {
    return giroData.filter(r => r.data_movimento >= dateCutoff);
  }, [giroData, dateCutoff]);

  // Build product summaries
  const productSummaries = useMemo(() => {
    const map = new Map<number, GiroProductSummary>();

    // Initialize from estoque data
    estoqueData.forEach(r => {
      if (!map.has(r.cod_produto)) {
        map.set(r.cod_produto, {
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
          dias_sem_venda: r.data_ultima_venda
            ? Math.floor((Date.now() - new Date(r.data_ultima_venda).getTime()) / (1000 * 60 * 60 * 24))
            : 9999,
          ultima_venda: r.data_ultima_venda,
          total_saida_venda: 0,
          total_entrada_compra: 0,
          total_saida_transferencia: 0,
          total_entrada_transferencia: 0,
        });
      }
    });

    // Aggregate giro data
    filteredGiro.forEach(r => {
      let entry = map.get(r.cod_produto);
      if (!entry) {
        entry = {
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
          dias_sem_venda: 9999,
          ultima_venda: null,
          total_saida_venda: 0,
          total_entrada_compra: 0,
          total_saida_transferencia: 0,
          total_entrada_transferencia: 0,
        };
        map.set(r.cod_produto, entry);
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
      entry.status = calcGiroStatus(entry.quantidade_estoque, entry.total_vendas, filters.periodoMeses);
    });

    let summaries = [...map.values()];

    // Apply filters
    if (filters.empresas.length > 0) summaries = summaries.filter(s => filters.empresas.includes(s.empresa));
    if (filters.marcas.length > 0) summaries = summaries.filter(s => filters.marcas.includes(s.marca));
    if (filters.grupos.length > 0) summaries = summaries.filter(s => filters.grupos.includes(s.grupo));
    if (filters.statusFilter.length > 0) summaries = summaries.filter(s => filters.statusFilter.includes(s.status));
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      summaries = summaries.filter(s => s.produto.toLowerCase().includes(term) || s.marca.toLowerCase().includes(term));
    }

    return summaries;
  }, [estoqueData, filteredGiro, filters]);

  // Analyze sales trends
  const trendMap = useMemo(() => {
    const trends = analyzeSalesTrends(giroData, 3);
    const map = new Map<number, { trend: TrendDirection; dropPercent: number }>();
    trends.forEach(t => map.set(t.cod_produto, { trend: t.trend, dropPercent: t.dropPercent }));
    return map;
  }, [giroData]);

  // Sort
  const sorted = useMemo(() => {
    return [...productSummaries].sort((a, b) => {
      const va = (a as any)[sortField] ?? 0;
      const vb = (b as any)[sortField] ?? 0;
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [productSummaries, sortField, sortDir]);

  // KPIs
  const statusCounts = useMemo(() => {
    const counts: Record<GiroStatus, number> = { atendendo: 0, alerta: 0, faltando: 0, excesso: 0 };
    productSummaries.forEach(s => counts[s.status]++);
    return counts;
  }, [productSummaries]);

  // Charts data
  const statusPieData = useMemo(() => {
    return (Object.keys(STATUS_CONFIG) as GiroStatus[]).map(key => ({
      name: STATUS_CONFIG[key].label,
      key,
      value: statusCounts[key],
    }));
  }, [statusCounts]);

  const totalProducts = productSummaries.length;

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
      .filter(s => s.dias_sem_venda < 9999)
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
    filteredGiro.forEach(r => {
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
  }, [filteredGiro]);

  const filterOptions = useMemo(() => ({
    empresas: [...new Set(productSummaries.map(s => s.empresa))].sort(),
    marcas: [...new Set(productSummaries.map(s => s.marca))].sort(),
    grupos: [...new Set(productSummaries.map(s => s.grupo))].sort(),
  }), [productSummaries]);

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const handleBarClick = useCallback((chartType: string) => (entry: any) => {
    if (!entry) return;
    const value = entry.fullName || entry.name;
    setDrillFilter({ type: chartType, value });
    setDrillPath(prev => [...prev, value]);
  }, []);

  const handleBreadcrumbNav = useCallback((index: number) => {
    if (index === 0) {
      setDrillFilter(null);
      setDrillPath(['Giro']);
    }
  }, []);

  const clearDrill = useCallback(() => {
    setDrillFilter(null);
    setDrillPath(['Giro']);
  }, []);

  const activeChips = useMemo(() => {
    const chips: { label: string; value: string; onRemove: () => void }[] = [];
    if (drillFilter)
      chips.push({ label: 'Drill-down', value: drillFilter.value, onRemove: clearDrill });
    return chips;
  }, [drillFilter, clearDrill]);

  // SVG gradients
  const svgGradients = (
    <svg width={0} height={0} className="absolute">
      <defs>
        <linearGradient id="giro-grad-emerald" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <linearGradient id="giro-grad-red" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#f87171" />
        </linearGradient>
        <linearGradient id="giro-grad-amber" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
        <linearGradient id="giro-grad-blue" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
        <linearGradient id="giro-area-amber" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
        </linearGradient>
        <linearGradient id="giro-area-blue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
        </linearGradient>
      </defs>
    </svg>
  );

  const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

  return (
    <div className="space-y-4">
      {svgGradients}

      {/* Trend Alerts - Collapsible */}
      <EstoqueTrendAlerts giroData={giroData} />


      {/* Breadcrumbs & active filter chips */}
      {(activeChips.length > 0 || drillPath.length > 1) && (
        <div className="flex flex-wrap items-center gap-2">
          <GiroDrillBreadcrumb path={drillPath} onNavigate={handleBreadcrumbNav} />
          {activeChips.map((f, i) => (
            <ActiveFilterChip key={i} {...f} />
          ))}
        </div>
      )}

      {/* Status KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(STATUS_CONFIG) as GiroStatus[]).map(key => {
          const cfg = STATUS_CONFIG[key];
          const Icon = cfg.icon;
          const count = statusCounts[key];
          const pct = productSummaries.length > 0 ? ((count / productSummaries.length) * 100).toFixed(0) : '0';
          const isSelected = filters.statusFilter.includes(key);
          return (
            <Card
              key={key}
              className={cn(
                'premium-card cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg',
                isSelected && 'ring-2 ring-amber-500 shadow-lg'
              )}
              onClick={() => setFilters(f => ({
                ...f,
                statusFilter: f.statusFilter.includes(key)
                  ? f.statusFilter.filter(s => s !== key)
                  : [...f.statusFilter, key]
              }))}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center transition-transform hover:scale-110', cfg.bg)}>
                    <Icon className={cn('h-5 w-5', cfg.color)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums">{count}</p>
                    <p className="text-xs text-muted-foreground">{cfg.label} ({pct}%)</p>
                  </div>
                </div>
                {/* Mini progress bar */}
                <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', cfg.gradient)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status Distribution — Donut with center total */}
        <Card className="premium-card group hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300 hover:-translate-y-0.5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="h-1 w-6 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" />
                Distribuição de Status
              </CardTitle>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                Clique para filtrar
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
              {/* Donut */}
              <div className="relative flex-shrink-0" style={{ width: 200, height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart onMouseLeave={() => setHoveredStatus(null)}>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      dataKey="value"
                      paddingAngle={3}
                      cursor="pointer"
                      onClick={(entry: any) => {
                        if (!entry) return;
                        const statusKey = entry.key as GiroStatus;
                        setFilters(f => ({
                          ...f,
                          statusFilter: f.statusFilter.includes(statusKey)
                            ? f.statusFilter.filter(s => s !== statusKey)
                            : [...f.statusFilter, statusKey]
                        }));
                      }}
                      onMouseEnter={(_, index) => setHoveredStatus(statusPieData[index]?.name ?? null)}
                      animationDuration={800}
                      animationEasing="ease-out"
                    >
                      {statusPieData.map((item, i) => {
                        const isActive = !hoveredStatus || hoveredStatus === item.name;
                        return (
                          <Cell
                            key={item.name}
                            fill={PIE_COLORS[i]}
                            stroke={isActive ? 'hsl(var(--background))' : 'none'}
                            strokeWidth={isActive ? 3 : 0}
                            opacity={isActive ? 1 : 0.35}
                          />
                        );
                      })}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center total label */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border border-border/60 bg-background/90 text-center shadow-lg backdrop-blur-sm">
                    <p className="text-lg font-bold leading-tight">{formatNumber(totalProducts)}</p>
                    <p className="text-[10px] text-muted-foreground">produtos</p>
                  </div>
                </div>
              </div>

              {/* Side list */}
              <div className="flex-1 space-y-1">
                {statusPieData.map((item, i) => {
                  const pct = totalProducts > 0 ? ((item.value / totalProducts) * 100).toFixed(1) : '0';
                  const isHighlighted = hoveredStatus === item.name || !hoveredStatus;
                  return (
                    <button
                      key={item.name}
                      onClick={() => {
                        const statusKey = item.key as GiroStatus;
                        setFilters(f => ({
                          ...f,
                          statusFilter: f.statusFilter.includes(statusKey)
                            ? f.statusFilter.filter(s => s !== statusKey)
                            : [...f.statusFilter, statusKey]
                        }));
                      }}
                      onMouseEnter={() => setHoveredStatus(item.name)}
                      onMouseLeave={() => setHoveredStatus(null)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-3 py-2 transition-colors',
                        isHighlighted ? 'bg-muted/60 border border-border/60' : 'hover:bg-muted/40 border border-transparent'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-3 w-3 rounded-full shrink-0" style={{ background: PIE_COLORS[i] }} />
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold tabular-nums">{formatNumber(item.value)}</span>
                        <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">{pct}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Evolution — Area chart with premium tooltip */}
        <Card className="premium-card group hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300 hover:-translate-y-0.5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="h-1 w-6 rounded-full bg-gradient-to-r from-amber-500 to-amber-400" />
                Evolução Mensal de Movimentação
              </CardTitle>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                {filters.periodoMeses} meses
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={evolucaoMensal}>
                <defs>
                  <linearGradient id="giro-area-vendas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="giro-area-compras" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} />
                <ReTooltip content={<PremiumLineTooltip />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="vendas" stroke="#f59e0b" strokeWidth={2.5} fill="url(#giro-area-vendas)" name="Vendas" dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#f59e0b', stroke: 'hsl(var(--background))', strokeWidth: 2 }} animationDuration={800} />
                <Area type="monotone" dataKey="compras" stroke="#3b82f6" strokeWidth={2.5} fill="url(#giro-area-compras)" name="Compras" dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#3b82f6', stroke: 'hsl(var(--background))', strokeWidth: 2 }} animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Giro — Premium bar chart */}
        <Card className="premium-card group hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300 hover:-translate-y-0.5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="h-1 w-6 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" />
                Top 10 Maior Giro
              </CardTitle>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                Clique para filtrar
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topGiro} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} />
                <ReTooltip content={<PremiumTooltip total={topGiro.reduce((s, r) => s + r.giro, 0)} />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                <Bar
                  dataKey="giro"
                  fill="url(#giro-grad-emerald)"
                  radius={[0, 6, 6, 0]}
                  cursor="pointer"
                  onClick={(d: any) => handleBarClick('marca')({ ...d, fullName: d.marca, name: d.marca })}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Parados — Premium bar chart */}
        <Card className="premium-card group hover:shadow-xl hover:shadow-red-500/5 transition-all duration-300 hover:-translate-y-0.5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="h-1 w-6 rounded-full bg-gradient-to-r from-red-500 to-red-400" />
                Top 10 Produtos Parados
              </CardTitle>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                Dias sem venda
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topParados} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} />
                <ReTooltip content={<PremiumTooltip total={topParados.reduce((s, r) => s + r.dias, 0)} />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                <Bar
                  dataKey="dias"
                  fill="url(#giro-grad-red)"
                  radius={[0, 6, 6, 0]}
                  cursor="pointer"
                  onClick={(d: any) => handleBarClick('marca')({ ...d, fullName: d.marca, name: d.marca })}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="premium-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{sorted.length} produtos analisados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="min-w-[60px] cursor-pointer" onClick={() => toggleSort('cod_produto')}>
                    Código <ArrowUpDown className="h-3 w-3 inline" />
                  </TableHead>
                  <TableHead className="min-w-[180px]">Produto</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Filial</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('quantidade_estoque')}>
                    Estoque <ArrowUpDown className="h-3 w-3 inline" />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('valor_estoque')}>
                    Valor Estoque <ArrowUpDown className="h-3 w-3 inline" />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('total_vendas')}>
                    Vendas <ArrowUpDown className="h-3 w-3 inline" />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('giro')}>
                    Giro <ArrowUpDown className="h-3 w-3 inline" />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('dias_sem_venda')}>
                    Dias s/ Venda <ArrowUpDown className="h-3 w-3 inline" />
                  </TableHead>
                  <TableHead className="text-center">Tendência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.slice(0, visibleCount).map((s, i) => {
                  const cfg = STATUS_CONFIG[s.status];
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{s.cod_produto}</TableCell>
                      <TableCell className="font-medium text-sm max-w-[180px] truncate">{s.produto}</TableCell>
                      <TableCell className="text-xs">{s.marca}</TableCell>
                      <TableCell className="text-xs">{s.empresa.replace(/^CASPPER\s*/i, '')}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-xs ${cfg.color} ${cfg.bg}`}>
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{s.quantidade_estoque}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(s.valor_estoque)}</TableCell>
                      <TableCell className="text-right font-mono">{s.total_vendas}</TableCell>
                      <TableCell className="text-right font-mono">{s.giro.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <span className={s.dias_sem_venda > 90 ? 'text-red-400' : s.dias_sem_venda > 60 ? 'text-amber-400' : ''}>
                          {s.dias_sem_venda >= 9999 ? 'N/A' : `${s.dias_sem_venda}d`}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const t = trendMap.get(s.cod_produto);
                          if (!t) return <Minus className="h-4 w-4 text-muted-foreground inline" />;
                          if (t.trend === 'declining') return (
                            <span className="inline-flex items-center gap-1 text-red-400" title={`Queda de ${t.dropPercent.toFixed(0)}%`}>
                              <TrendingDown className="h-4 w-4" />
                              <span className="text-xs font-mono">-{t.dropPercent.toFixed(0)}%</span>
                            </span>
                          );
                          if (t.trend === 'growing') return (
                            <span className="inline-flex items-center gap-1 text-emerald-400">
                              <TrendingUp className="h-4 w-4" />
                            </span>
                          );
                          return <Minus className="h-4 w-4 text-muted-foreground inline" />;
                        })()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {visibleCount < sorted.length && (
            <div className="flex items-center justify-center gap-3 py-4 border-t border-border/50">
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
        </CardContent>
      </Card>
    </div>
  );
}
