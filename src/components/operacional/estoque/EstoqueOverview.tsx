import { useMemo, useState, type ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, CircleDollarSign, Filter, Package, PackageCheck, RefreshCw, ShoppingCart, TrendingUp, X } from 'lucide-react';

import type { EstoqueRecord, GiroRecord, StockQuickFilter } from '@/types/estoque';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/common/EmptyState';
import { cn } from '@/lib/utils';
import { buildStockOverviewProducts, buildStockOverviewSummary, type OverviewMetric, type OverviewProduct } from './estoqueOverviewData';

interface Props {
  stockData: EstoqueRecord[];
  movementData: GiroRecord[];
  activeCompanyCode?: number | string | null;
  onOpenCentral: (filter?: StockQuickFilter) => void;
  isFetching?: boolean;
  onRefresh?: () => void;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const colors = ['#38bdf8', '#22c55e', '#f59e0b', '#ef4444', '#a78bfa', '#14b8a6', '#fb7185', '#94a3b8'];

function Metric({ label, value, icon: Icon, tone = 'normal', onClick }: { label: string; value: string; icon: typeof Package; tone?: string; onClick?: () => void }) {
  const content = <><div className="flex min-w-0 items-center gap-1.5"><Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="min-w-0 truncate text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span></div><strong className={cn('mt-1 block min-w-0 break-words text-lg font-semibold leading-tight tabular-nums', tone === 'danger' && 'text-red-400', tone === 'attention' && 'text-amber-300', tone === 'positive' && 'text-emerald-400')}>{value}</strong></>;
  return onClick ? <button className="min-w-0 bg-card/80 px-3 py-2.5 text-left transition-colors hover:bg-muted/30" onClick={onClick} type="button">{content}</button> : <div className="min-w-0 bg-card/80 px-3 py-2.5">{content}</div>;
}

function Panel({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={cn('flex h-auto min-h-0 min-w-0 flex-col overflow-hidden border border-border/70 bg-card/60 p-2.5', className)}><div className="mb-2 flex shrink-0 items-center justify-between gap-2"><h2 className="min-w-0 truncate text-xs font-semibold text-foreground">{title}</h2>{action}</div><div className="min-h-0 overflow-hidden">{children}</div></section>;
}

export function EstoqueOverview({ stockData, movementData, activeCompanyCode, onOpenCentral, isFetching = false, onRefresh }: Props) {
  const [months, setMonths] = useState(3);
  const [brand, setBrand] = useState('');
  const [group, setGroup] = useState('');
  const [branch, setBranch] = useState('');
  const [chartMetric, setChartMetric] = useState<OverviewMetric>('value');
  const [distributionMetric, setDistributionMetric] = useState<OverviewMetric>('value');
  const [hoveredBrand, setHoveredBrand] = useState('');
  const [brandChartActive, setBrandChartActive] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const products = useMemo(() => buildStockOverviewProducts(stockData, movementData, months, activeCompanyCode), [activeCompanyCode, months, movementData, stockData]);
  const options = useMemo(() => ({
    brands: [...new Set(products.map((product) => product.marca))].sort(),
    groups: [...new Set(products.map((product) => product.grupo))].sort(),
    branches: [...new Set(products.map((product) => product.empresa))].sort(),
  }), [products]);
  const filtered = useMemo(() => products.filter((product) => (!brand || product.marca === brand) && (!group || product.grupo === group) && (!branch || product.empresa === branch)), [brand, branch, group, products]);
  const summary = useMemo(() => buildStockOverviewSummary(filtered, movementData, months), [filtered, months, movementData]);
  const topValue = useMemo(() => [...filtered].sort((a, b) => b.valor_estoque - a.valor_estoque).slice(0, 10), [filtered]);
  const topRisk = useMemo(() => [...filtered].filter((product) => product.status === 'faltando' || product.status === 'alerta').sort((a, b) => (a.cobertura_meses ?? -1) - (b.cobertura_meses ?? -1)).slice(0, 10), [filtered]);
  const topExcess = useMemo(() => [...filtered].filter((product) => product.status === 'excesso').sort((a, b) => b.valor_estoque - a.valor_estoque).slice(0, 10), [filtered]);
  const distribution = summary.brands;
  const chartData = summary.months.map((item) => ({ ...item, principal: chartMetric === 'value' ? item.valor : chartMetric === 'quantity' ? item.vendas : item.compras }));
  const metricValue = (item: { value: number; quantity: number; percent: number }) => distributionMetric === 'value' ? currency.format(item.value) : distributionMetric === 'quantity' ? number.format(item.quantity) : `${item.percent.toFixed(1)}%`;

  if (!stockData.length && !movementData.length) return <div className="flex flex-1 items-center justify-center p-4"><EmptyState message="Nenhum dado de estoque disponível para montar a visão geral." /></div>;

  return <div aria-label="Visão geral do estoque" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
    <div aria-label="Controles da visão geral" className="flex min-h-10 shrink-0 items-center gap-2 border-b border-border/60 bg-background/95 px-2.5 py-1.5" role="toolbar">
      <Button aria-label="Abrir filtros da visão geral" className="h-7 w-7" onClick={() => setFiltersOpen(true)} size="icon" type="button" variant="outline" title="Filtros"><Filter className="h-3.5 w-3.5" /></Button>
      <span className="text-[11px] text-muted-foreground">{number.format(filtered.length)} produtos analisados</span>
      <div className="ml-auto flex items-center gap-1"><span className="hidden text-[11px] text-muted-foreground sm:inline">{months} meses</span>{onRefresh && <Button aria-label="Atualizar visão geral" className="h-7 w-7" disabled={isFetching} onClick={onRefresh} size="icon" type="button" variant="ghost"><RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} /></Button>}</div>
    </div>
    <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
      <DialogContent className="max-w-md border-border/80 bg-card p-4">
        <DialogHeader><DialogTitle className="flex items-center gap-2 text-sm"><Filter className="h-4 w-4 text-primary" />Filtros da visão geral</DialogTitle></DialogHeader>
        <div className="grid gap-3 pt-2">
          <label className="grid gap-1 text-xs text-muted-foreground">Período<select aria-label="Período da visão geral" className="h-9 border border-border bg-background px-2 text-sm text-foreground" value={months} onChange={(event) => setMonths(Number(event.target.value))}><option value={3}>Últimos 3 meses</option><option value={6}>Últimos 6 meses</option><option value={12}>Últimos 12 meses</option></select></label>
          <label className="grid gap-1 text-xs text-muted-foreground">Marca<select aria-label="Filtrar por marca" className="h-9 border border-border bg-background px-2 text-sm text-foreground" value={brand} onChange={(event) => setBrand(event.target.value)}><option value="">Todas as marcas</option>{options.brands.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="grid gap-1 text-xs text-muted-foreground">Grupo<select aria-label="Filtrar por grupo" className="h-9 border border-border bg-background px-2 text-sm text-foreground" value={group} onChange={(event) => setGroup(event.target.value)}><option value="">Todos os grupos</option>{options.groups.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="grid gap-1 text-xs text-muted-foreground">Filial<select aria-label="Filtrar por filial" className="h-9 border border-border bg-background px-2 text-sm text-foreground" value={branch} onChange={(event) => setBranch(event.target.value)}><option value="">Todas as filiais</option>{options.branches.map((item) => <option key={item}>{item}</option>)}</select></label>
          <Button className="mt-1 w-full" onClick={() => setFiltersOpen(false)} type="button">Aplicar filtros</Button>
        </div>
      </DialogContent>
    </Dialog>
    <div className="grid shrink-0 grid-cols-2 gap-px border-b border-border/60 bg-border/60 sm:grid-cols-4 lg:grid-cols-8">
      <Metric label="Produtos" value={number.format(summary.totalProducts)} icon={Package} onClick={() => onOpenCentral('all')} />
      <Metric label="Com estoque" value={number.format(summary.withStock)} icon={PackageCheck} tone="positive" onClick={() => onOpenCentral('with-stock')} />
      <Metric label="Valor estoque" value={currency.format(summary.totalValue)} icon={CircleDollarSign} />
      <Metric label="Sem estoque" value={number.format(summary.out)} icon={ArrowDownRight} tone="danger" onClick={() => onOpenCentral('out')} />
      <Metric label="Críticos" value={number.format(summary.critical)} icon={AlertTriangle} tone="danger" onClick={() => onOpenCentral('critical')} />
      <Metric label="Excesso" value={number.format(summary.excess)} icon={TrendingUp} tone="attention" onClick={() => onOpenCentral('excess')} />
      <Metric label="Capital parado" value={currency.format(summary.idleCapital)} icon={CircleDollarSign} tone="attention" />
      <Metric label="Vendas" value={number.format(summary.sales)} icon={ShoppingCart} />
    </div>
    <div className="grid min-h-0 flex-1 auto-rows-min items-start gap-2 overflow-hidden p-2 lg:grid-cols-12">
      <Panel className="lg:col-span-7" title="Evolução de compras, vendas e estoque" action={<div className="flex gap-1">{(['value', 'quantity', 'percent'] as OverviewMetric[]).map((item) => <Button key={item} aria-pressed={chartMetric === item} className="h-6 px-1.5 text-[10px]" onClick={() => setChartMetric(item)} size="sm" type="button" variant={chartMetric === item ? 'secondary' : 'ghost'}>{item === 'value' ? 'Valor' : item === 'quantity' ? 'Quantidade' : '%'}</Button>)}</div>}>
        {chartData.length ? <div className="h-64 min-h-0"><ResponsiveContainer height="100%" width="100%"><AreaChart data={chartData} margin={{ left: 0, right: 8, top: 6 }}><defs><linearGradient id="estoque-evolution-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--pelegrini-accent)" stopOpacity={0.42} /><stop offset="58%" stopColor="var(--pelegrini-primary)" stopOpacity={0.18} /><stop offset="100%" stopColor="var(--pelegrini-primary)" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="mes" tick={{ fontSize: 10 }} tickLine={false} /><YAxis tick={{ fontSize: 10 }} tickLine={false} width={48} /><Tooltip content={<OverviewTooltip metric={chartMetric} />} /><Area activeDot={{ fill: 'var(--pelegrini-accent)', r: 5, stroke: 'hsl(var(--card))', strokeWidth: 2 }} dataKey="principal" fill="url(#estoque-evolution-fill)" name="Indicador" stroke="var(--pelegrini-accent)" strokeWidth={2.5} type="monotone" /></AreaChart></ResponsiveContainer></div> : <EmptyState message="Sem movimentações no período selecionado." />}
      </Panel>
      <Panel className="lg:col-span-5" title="Distribuição por marca" action={<div className="flex gap-1">{(['value', 'quantity', 'percent'] as OverviewMetric[]).map((item) => <Button key={item} aria-pressed={distributionMetric === item} className="h-6 px-1.5 text-[10px]" onClick={() => setDistributionMetric(item)} size="sm" type="button" variant={distributionMetric === item ? 'secondary' : 'ghost'}>{item === 'value' ? 'Valor' : item === 'quantity' ? 'Qtd.' : '%'}</Button>)}</div>}>
        {distribution.length ? <div className="grid grid-cols-[minmax(0,1fr)_minmax(10rem,12rem)] items-center gap-3"><div className="h-64 min-h-0"><ResponsiveContainer height="100%" width="100%"><PieChart onMouseLeave={() => { setBrandChartActive(false); setHoveredBrand(''); }}><Pie data={distribution} dataKey={distributionMetric === 'value' ? 'value' : distributionMetric === 'quantity' ? 'quantity' : 'percent'} innerRadius={58} outerRadius={96} paddingAngle={2} onClick={(item) => setBrand(String(item.name))} onMouseEnter={(_, index) => { setBrandChartActive(true); setHoveredBrand(distribution[index]?.name ?? ''); }}>{distribution.map((item, index) => <Cell fill={colors[index % colors.length]} fillOpacity={hoveredBrand && hoveredBrand !== item.name ? 0.34 : 1} key={item.name} />)}</Pie><Tooltip active={brandChartActive} content={<OverviewTooltip metric={distributionMetric} />} /></PieChart></ResponsiveContainer></div><div className="grid content-center gap-1.5">{distribution.slice(0, 6).map((item, index) => <button className={cn('flex min-w-0 items-center gap-2 rounded-sm px-1.5 py-1 text-left text-[11px] transition-colors hover:bg-muted/40', hoveredBrand === item.name && 'bg-muted/50 text-foreground')} key={item.name} onClick={() => setBrand(item.name)} onMouseEnter={() => setHoveredBrand(item.name)} onMouseLeave={() => setHoveredBrand('')} type="button"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colors[index % colors.length] }} /><span className="min-w-0 flex-1 truncate">{item.name}</span><span className="shrink-0 tabular-nums text-muted-foreground">{metricValue(item)}</span></button>)}</div></div> : <EmptyState message="Sem dados por marca." />}
      </Panel>
      <Panel className="lg:col-span-4" title="Maior valor em estoque"><Ranking items={topValue} value={(item) => currency.format(item.valor_estoque)} onSelect={() => onOpenCentral('all')} /></Panel>
      <Panel className="lg:col-span-4" title="Maior risco de ruptura"><Ranking items={topRisk} value={(item) => item.cobertura_meses === null ? 'Sem vendas' : `${item.cobertura_meses.toFixed(1)} meses`} danger onSelect={() => onOpenCentral('critical')} /></Panel>
      <Panel className="lg:col-span-4" title="Maior excesso"><Ranking items={topExcess} value={(item) => currency.format(item.valor_estoque)} attention onSelect={() => onOpenCentral('excess')} /></Panel>
    </div>
  </div>;
}

function Ranking({ items, value, onSelect, danger, attention }: { items: OverviewProduct[]; value: (item: OverviewProduct) => string; onSelect: () => void; danger?: boolean; attention?: boolean }) {
  return items.length ? <div aria-label="Ranking de produtos" className="max-h-[13.5rem] space-y-1 overflow-y-auto pr-1 premium-scrollbar">{items.map((item, index) => <button className="flex w-full items-center gap-2 border-b border-border/40 px-1 py-1 text-left last:border-0 hover:bg-muted/30" key={`${item.cod_produto}-${index}`} onClick={onSelect} type="button"><span className="w-4 shrink-0 text-[10px] text-muted-foreground">{index + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{item.produto}</span><span className="block truncate text-[10px] text-muted-foreground">{item.marca}</span></span><span className={cn('shrink-0 text-xs tabular-nums', danger && 'text-red-400', attention && 'text-amber-300')}>{value(item)}</span></button>)}</div> : <div className="flex min-h-20 items-center justify-center text-xs text-muted-foreground">Sem dados no filtro.</div>;
}

function OverviewTooltip({ active, payload, label, metric }: { active?: boolean; payload?: Array<{ name?: string; value?: number }>; label?: string; metric: OverviewMetric }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const value = item.value ?? 0;
  const formatted = metric === 'value' ? currency.format(value) : metric === 'quantity' ? number.format(value) : `${value.toFixed(1)}%`;
  return <div className="rounded border border-border/80 bg-card/95 px-3 py-2 text-xs shadow-lg"><div className="mb-1 text-muted-foreground">{label ?? item.name}</div><strong className="font-semibold text-foreground">{formatted}</strong></div>;
}
