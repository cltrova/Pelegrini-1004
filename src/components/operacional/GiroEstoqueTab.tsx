import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Area, AreaChart,
  Tooltip as ReTooltip
} from 'recharts';
import { CheckCircle2, AlertTriangle, XCircle, TrendingUp, TrendingDown, Minus, ArrowUpDown, BarChart3 } from 'lucide-react';
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

function PremiumLineTooltip({ active, payload, label }: LineTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/95 backdrop-blur-xl border border-border rounded-xl p-3 shadow-2xl min-w-[160px]">
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

export function GiroEstoqueTab({ giroData, estoqueData, filters, setFilters }: Props) {
  const [sortField, setSortField] = useState<keyof GiroProductSummary>('valor_estoque');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [visibleCount, setVisibleCount] = useState(50);
  const [analysisOpen, setAnalysisOpen] = useState(false);

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
      const va = a[sortField] ?? 0;
      const vb = b[sortField] ?? 0;
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === 'asc' ? Number(va) - Number(vb) : Number(vb) - Number(va);
    });
  }, [productSummaries, sortField, sortDir]);

  // KPIs
  const statusCounts = useMemo(() => {
    const counts: Record<GiroStatus, number> = { atendendo: 0, alerta: 0, faltando: 0, excesso: 0 };
    productSummaries.forEach(s => counts[s.status]++);
    return counts;
  }, [productSummaries]);

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

  const toggleSort = (field: keyof GiroProductSummary) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  return (
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
            <EstoqueTrendAlerts giroData={giroData} />
            <section className="space-y-3" aria-label="Movimentacao mensal">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Movimentação mensal</h3>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">{filters.periodoMeses} meses</Badge>
              </div>
              <div className="h-[230px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={evolucaoMensal}>
                    <defs>
                      <linearGradient id="giro-area-vendas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="giro-area-compras" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} />
                    <ReTooltip content={<PremiumLineTooltip />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '4 4' }} />
                    <Area type="monotone" dataKey="vendas" stroke="#f59e0b" strokeWidth={2} fill="url(#giro-area-vendas)" name="Vendas" dot={false} activeDot={{ r: 4 }} animationDuration={180} />
                    <Area type="monotone" dataKey="compras" stroke="#3b82f6" strokeWidth={2} fill="url(#giro-area-compras)" name="Compras" dot={false} activeDot={{ r: 4 }} animationDuration={180} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
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
                </div>
              </section>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="grid min-w-0 grid-cols-2 border-y border-border/70 md:flex" aria-label="Filtros por status" role="group">
        {(Object.keys(STATUS_CONFIG) as GiroStatus[]).map(key => {
          const cfg = STATUS_CONFIG[key];
          const Icon = cfg.icon;
          const isSelected = filters.statusFilter.includes(key);
          return (
            <button
              aria-pressed={isSelected}
              className={cn(
                'flex h-12 min-w-0 items-center justify-center gap-2 border-border/70 px-2 text-left transition-colors duration-150 hover:bg-muted/50 md:h-14 md:min-w-[9rem] md:flex-1 md:border-r md:px-3 md:last:border-r-0',
                'odd:border-r even:border-r-0 [&:nth-child(-n+2)]:border-b md:odd:border-r md:even:border-r md:[&:nth-child(-n+2)]:border-b-0',
                isSelected && 'bg-primary/[0.07] text-primary',
              )}
              key={key}
              onClick={() => setFilters(current => ({
                ...current,
                statusFilter: current.statusFilter.includes(key)
                  ? current.statusFilter.filter(status => status !== key)
                  : [...current.statusFilter, key],
              }))}
              type="button"
            >
              <Icon aria-hidden="true" className={cn('h-4 w-4 shrink-0', cfg.color)} />
              <span className="truncate text-xs text-muted-foreground">{cfg.label}</span>
              <span className="font-semibold tabular-nums text-foreground">{statusCounts[key]}</span>
            </button>
          );
        })}
      </div>

      <section aria-label="Produtos analisados no giro" className="min-w-0 overflow-hidden border border-border/80 bg-background">
          <div className="divide-y md:hidden">
            {sorted.slice(0, visibleCount).map(s => {
              const cfg = STATUS_CONFIG[s.status];
              return (
                <article key={`${s.empresa}-${s.cod_produto}`} className="space-y-2 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{s.produto}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{s.cod_produto} · {s.marca || 'Sem marca'}</p>
                    </div>
                    <Badge variant="outline" className={cn('shrink-0 text-xs', cfg.color, cfg.bg)}>{cfg.label}</Badge>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    <div><dt className="text-muted-foreground">Estoque</dt><dd className="mt-1 font-semibold tabular-nums">{formatNumber(s.quantidade_estoque)}</dd></div>
                    <div><dt className="text-muted-foreground">Giro</dt><dd className="mt-1 font-semibold tabular-nums">{s.giro.toFixed(2)}x</dd></div>
                    <div><dt className="text-muted-foreground">Sem venda</dt><dd className="mt-1 font-semibold tabular-nums">{s.dias_sem_venda >= 9999 ? 'N/A' : `${s.dias_sem_venda}d`}</dd></div>
                  </dl>
                </article>
              );
            })}
          </div>
          <div className="hidden max-h-[calc(100vh-19rem)] min-h-[18rem] overflow-auto md:block">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted">
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
                {sorted.slice(0, visibleCount).map(s => {
                  const cfg = STATUS_CONFIG[s.status];
                  return (
                    <TableRow className="h-11" key={`${s.empresa}-${s.cod_produto}`}>
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
                      <TableCell className="whitespace-nowrap text-right font-mono text-sm">{formatCurrency(s.valor_estoque)}</TableCell>
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
  );
}
