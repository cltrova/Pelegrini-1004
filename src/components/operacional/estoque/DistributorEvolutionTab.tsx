import { useEffect, useMemo, useState } from 'react';
import {
  CalendarRange, ChevronDown, ChevronRight, Download, Filter, RefreshCw,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useDistributorEvolution, type DistributorEvolutionFilters } from '@/hooks/useDistributorEvolution';
import { useComercialProdutos } from '@/hooks/useComercialProdutos';
import {
  buildClosedMonthsRange,
  buildDistributorEvolution,
  buildDistributorRowsFromProducts,
  calculateVariation,
  DISTRIBUTOR_BRANDS,
  type DistributorBrand,
  type DistributorMonthSummary,
} from './distributorEvolutionData';

type MetricKey = 'valor_estoque' | 'valor_vendas' | 'valor_compras' | 'valor_devolucoes' | 'margem_venda';

const BRAND_COLORS: Record<DistributorBrand, string> = {
  MWM: '#0ea5e9', EATON: '#22c55e', ZF: '#f59e0b', CUMMINS: '#ef4444', MERITOR: '#a855f7', MIC: '#ec4899',
};
const METRICS: Array<{ key: MetricKey; label: string; percent?: boolean }> = [
  { key: 'valor_estoque', label: 'Estoque' },
  { key: 'valor_vendas', label: 'Vendas' },
  { key: 'valor_compras', label: 'Compras' },
  { key: 'valor_devolucoes', label: 'Devoluções' },
  { key: 'margem_venda', label: 'Margem', percent: true },
];

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const compactMoney = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

function monthLabel(month: string, long = false): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  const date = new Date(`${month}-01T12:00:00`);
  return new Intl.DateTimeFormat('pt-BR', long
    ? { month: 'long', year: 'numeric' }
    : { month: 'short', year: '2-digit' }).format(date).replace('.', '');
}

function defaultFilters(): DistributorEvolutionFilters {
  const range = buildClosedMonthsRange();
  return {
    ...range,
    marcas: [...DISTRIBUTOR_BRANDS],
    considerarPedidosAbertos: true,
    considerarTransferenciaCompra: false,
    imputarTransferenciaVenda: false,
    operacaoFiscalInicial: 0,
    operacaoFiscalFinal: 99999,
  };
}

function valueFor(row: DistributorMonthSummary | undefined, metric: MetricKey): number | null {
  const value = row?.[metric];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function previewSupports(metric: MetricKey): boolean {
  return metric === 'valor_vendas' || metric === 'valor_devolucoes';
}

function formatMetric(value: number | null, metric: MetricKey): string {
  if (value === null) return 'Indisponível';
  return metric === 'margem_venda' ? `${decimal.format(value)}%` : money.format(value);
}

function formatCompactMetric(value: number | null, metric: MetricKey): string {
  if (value === null) return '—';
  return metric === 'margem_venda' ? `${decimal.format(value)}%` : compactMoney.format(value);
}

function formatMoney(value: number | null): string {
  return value === null ? 'Indisponível' : money.format(value);
}

function sumComplete(values: Array<number | null | undefined>): number | null {
  if (!values.length || values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) return null;
  return (values as number[]).reduce((sum, value) => sum + value, 0);
}

function Delta({ value, semantic = false }: { value: number | null; semantic?: boolean }) {
  if (value === null) return <span className="text-[10px] text-muted-foreground">sem base</span>;
  return <span className={cn(
    'text-[10px] font-medium tabular-nums',
    semantic && value > 0 && 'text-emerald-500',
    semantic && value < 0 && 'text-red-500',
    !semantic && 'text-muted-foreground',
  )}>{value > 0 ? '+' : ''}{percent.format(value)}</span>;
}

function MetricStrip({ summary, preview }: { summary: DistributorMonthSummary; preview: boolean }) {
  const items = [
    ['Estoque', preview ? 'Indisponível' : formatMoney(summary.valor_estoque)],
    ['Vendas', formatMoney(summary.valor_vendas)],
    ['Compras', preview ? 'Indisponível' : formatMoney(summary.valor_compras)],
    ['Devoluções', formatMoney(summary.valor_devolucoes)],
  ];
  return <div aria-label="Resumo dos distribuidores" className="grid shrink-0 grid-cols-2 border-b border-border/60 bg-card/35 lg:grid-cols-5">
    {items.map(([label, value]) => <div className="min-w-0 border-r border-border/50 px-3 py-2 last:border-r-0" key={label}>
      <span className="block text-[10px] uppercase text-muted-foreground">{label}</span>
      <strong className="block truncate text-sm font-semibold tabular-nums text-foreground">{value}</strong>
    </div>)}
    <div className="min-w-0 px-3 py-2">
      <span className="block text-[10px] uppercase text-muted-foreground">Variação do estoque</span>
      <strong className="block text-sm font-semibold tabular-nums text-foreground">{preview ? 'Indisponível' : <Delta value={summary.variacao_valor_estoque} />}</strong>
    </div>
  </div>;
}

async function exportWorkbook(rows: ReturnType<typeof import('./distributorEvolutionData')['normalizeDistributorRows']>, filters: DistributorEvolutionFilters) {
  const XLSX = await import('xlsx');
  const evolution = buildDistributorEvolution(rows);
  const metadata = [
    ['Evolução de distribuidores - Casa da Transmissão'],
    [`Período: ${filters.dataInicio} a ${filters.dataFim}`],
    [`Marcas: ${filters.marcas.join(', ')}`],
    [`Pedidos em aberto: ${filters.considerarPedidosAbertos ? 'Sim' : 'Não'}`],
    [],
  ];
  const summaryRows = evolution.brands.flatMap((brand) => brand.months.map((item) => [
    item.mes, brand.marca, item.valor_estoque, item.variacao_valor_estoque,
    item.valor_vendas, item.valor_compras, item.valor_devolucoes, item.margem_venda,
  ]));
  const detailRows = rows.map((item) => [
    item.mes, item.marca, item.cod_grupo, item.grupo, item.classe, item.valor_estoque,
    item.percentual_estoque, item.duracao_estoque, item.valor_vendas, item.percentual_vendas,
    item.percentual_acumulado_vendas, item.margem_venda, item.prazo_medio_venda,
    item.valor_devolucoes, item.valor_compras, item.percentual_compras,
    item.prazo_medio_compra, item.percentual_diferenca_compra_cmv,
  ]);
  const summary = XLSX.utils.aoa_to_sheet([
    ...metadata,
    ['Mês', 'Marca', 'Valor estoque', 'Variação', 'Vendas', 'Compras', 'Devoluções', 'Margem venda'],
    ...summaryRows,
  ]);
  const details = XLSX.utils.aoa_to_sheet([
    ...metadata,
    ['Mês', 'Marca', 'Código grupo', 'Grupo', 'Classe', 'Valor estoque', '% estoque', 'Duração', 'Vendas', '% vendas', '% acumulado', 'Margem', 'Prazo venda', 'Devoluções', 'Compras', '% compras', 'Prazo compra', '% compra/CMV'],
    ...detailRows,
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summary, 'Resumo mensal');
  XLSX.utils.book_append_sheet(workbook, details, 'Detalhamento por grupo');
  XLSX.writeFile(workbook, `distribuidores-${filters.dataInicio}-${filters.dataFim}.xlsx`);
}

export function DistributorEvolutionTab({ active }: { active: boolean }) {
  const [pending, setPending] = useState<DistributorEvolutionFilters>(defaultFilters);
  const [filters, setFilters] = useState<DistributorEvolutionFilters>(pending);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [metric, setMetric] = useState<MetricKey>('valor_estoque');
  const [showSales, setShowSales] = useState(true);
  const [showPurchases, setShowPurchases] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<DistributorMonthSummary | null>(null);
  const [mobileBrand, setMobileBrand] = useState<DistributorBrand>('MWM');
  const query = useDistributorEvolution(filters, active);
  const productsQuery = useComercialProdutos(
    { periodo: { inicio: filters.dataInicio, fim: filters.dataFim }, ignorarEquipePadrao: true },
    { enabled: active && Boolean(query.error), keepPreviousData: false },
  );
  const previewRows = useMemo(() => buildDistributorRowsFromProducts(
    productsQuery.produtos as Array<Record<string, unknown>>,
    { dataInicio: filters.dataInicio, dataFim: filters.dataFim, marcas: filters.marcas },
  ), [filters.dataFim, filters.dataInicio, filters.marcas, productsQuery.produtos]);
  const isPreview = Boolean(query.error && previewRows.length);
  const rows = useMemo(() => isPreview ? previewRows : query.data ?? [], [isPreview, previewRows, query.data]);
  const activeMetric = isPreview && !previewSupports(metric) ? 'valor_vendas' : metric;
  const evolution = useMemo(() => buildDistributorEvolution(rows), [rows]);
  const effectiveMobileBrand = evolution.brands.some((brand) => brand.marca === mobileBrand)
    ? mobileBrand
    : evolution.brands[0]?.marca;
  const salesPurchasesData = useMemo(() => evolution.months.map((mes) => ({
    mes: monthLabel(mes),
    vendas: sumComplete(evolution.brands.map((brand) => brand.months.find((item) => item.mes === mes)?.valor_vendas)),
    compras: isPreview
      ? null
      : sumComplete(evolution.brands.map((brand) => brand.months.find((item) => item.mes === mes)?.valor_compras)),
  })), [evolution, isPreview]);
  const isRefreshing = query.isFetching || (isPreview && productsQuery.isFetching);

  useEffect(() => {
    if (effectiveMobileBrand && effectiveMobileBrand !== mobileBrand) {
      setMobileBrand(effectiveMobileBrand);
    }
  }, [effectiveMobileBrand, mobileBrand]);

  const refreshReport = async () => {
    const requests: Array<Promise<unknown>> = [query.refetch()];
    if (isPreview) requests.push(productsQuery.refetch());
    await Promise.allSettled(requests);
  };

  const toggleBrand = (brand: DistributorBrand) => {
    setPending((current) => ({
      ...current,
      marcas: current.marcas.includes(brand)
        ? current.marcas.filter((item) => item !== brand)
        : [...current.marcas, brand],
    }));
  };
  const applyFilters = () => {
    if (!pending.marcas.length || !pending.dataInicio || !pending.dataFim) return;
    setFilters({ ...pending, marcas: [...pending.marcas] });
    setFiltersOpen(false);
  };

  return <section aria-label="Evolução dos distribuidores" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
    <div aria-label="Controles dos distribuidores" className="flex min-h-10 shrink-0 items-center gap-2 border-b border-border/60 bg-background/95 px-2.5 py-1.5" role="toolbar">
      <Popover onOpenChange={setFiltersOpen} open={filtersOpen}>
        <PopoverTrigger asChild><Button aria-label="Abrir filtros dos distribuidores" className="h-7 w-7" size="icon" title="Filtros" type="button" variant="outline"><Filter className="h-3.5 w-3.5" /></Button></PopoverTrigger>
        <PopoverContent aria-label="Filtros dos distribuidores" align="start" className="operational-overlay z-40 w-[min(94vw,30rem)] space-y-4">
          <div><h3 className="text-sm font-semibold">Filtros do relatório</h3><p className="text-xs text-muted-foreground">Padrões equivalentes ao RSYS.</p></div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div><Label className="text-xs" htmlFor="distributor-start">Data inicial</Label><Input className="h-9" id="distributor-start" onChange={(event) => setPending((current) => ({ ...current, dataInicio: event.target.value }))} type="date" value={pending.dataInicio} /></div>
            <div><Label className="text-xs" htmlFor="distributor-end">Data final</Label><Input className="h-9" id="distributor-end" onChange={(event) => setPending((current) => ({ ...current, dataFim: event.target.value }))} type="date" value={pending.dataFim} /></div>
          </div>
          <div>
            <Label className="text-xs">Marcas</Label>
            <div aria-label="Marcas analisadas" className="mt-1 flex flex-wrap gap-1" role="group">
              {DISTRIBUTOR_BRANDS.map((brand) => <Button aria-pressed={pending.marcas.includes(brand)} className="h-8 px-2.5 text-xs" key={brand} onClick={() => toggleBrand(brand)} size="sm" type="button" variant={pending.marcas.includes(brand) ? 'secondary' : 'outline'}>{brand}</Button>)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs" htmlFor="fiscal-start">Operação inicial</Label><Input id="fiscal-start" min={0} onChange={(event) => setPending((current) => ({ ...current, operacaoFiscalInicial: Number(event.target.value) }))} type="number" value={pending.operacaoFiscalInicial} /></div>
            <div><Label className="text-xs" htmlFor="fiscal-end">Operação final</Label><Input id="fiscal-end" min={0} onChange={(event) => setPending((current) => ({ ...current, operacaoFiscalFinal: Number(event.target.value) }))} type="number" value={pending.operacaoFiscalFinal} /></div>
          </div>
          {[
            ['Pedidos em aberto no estoque', 'considerarPedidosAbertos'],
            ['Transferência como compra', 'considerarTransferenciaCompra'],
            ['Imputar transferência na venda', 'imputarTransferenciaVenda'],
          ].map(([label, key]) => <div className="flex items-center justify-between gap-3" key={key}><Label className="text-xs" htmlFor={`filter-${key}`}>{label}</Label><Switch checked={Boolean(pending[key as keyof DistributorEvolutionFilters])} id={`filter-${key}`} onCheckedChange={(checked) => setPending((current) => ({ ...current, [key]: checked }))} /></div>)}
          <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3"><p className="text-[11px] text-muted-foreground">Custo: fornecedor</p><Button disabled={!pending.marcas.length || !pending.dataInicio || !pending.dataFim} onClick={applyFilters} size="sm">Aplicar filtros</Button></div>
        </PopoverContent>
      </Popover>
      <CalendarRange aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate text-[11px] text-muted-foreground">{filters.dataInicio.split('-').reverse().join('/')} a {filters.dataFim.split('-').reverse().join('/')} · {filters.marcas.length} marcas</span>
      <div className="ml-auto flex items-center gap-1">
        <Button aria-label="Atualizar relatório" className="h-7 w-7" disabled={isRefreshing} onClick={() => void refreshReport()} size="icon" variant="ghost"><RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} /></Button>
        <Button aria-label="Exportar distribuidores para Excel" className="h-7 w-7" disabled={!rows.length || isPreview} onClick={() => void exportWorkbook(rows, filters)} size="icon" title={isPreview ? 'Disponível após a publicação do relatório oficial' : 'Exportar Excel'} variant="ghost"><Download className="h-3.5 w-3.5" /></Button>
      </div>
    </div>

    {query.isLoading || (query.error && productsQuery.isLoading) ? <div className="flex flex-1 items-center justify-center"><LoadingState /></div>
      : query.error && !isPreview ? <div className="flex flex-1 items-center justify-center p-4"><ErrorState title="Relatório indisponível" message={(query.error as Error).message} onRetry={() => void query.refetch()} /></div>
      : !rows.length ? <div className="flex flex-1 items-center justify-center p-4 text-sm text-muted-foreground">Nenhum dado encontrado para os filtros selecionados.</div>
      : <div className="flex min-h-0 flex-1 flex-col overflow-y-auto premium-scrollbar">
        {isPreview && <div className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-foreground" role="status"><strong>Visualização provisória.</strong> Fonte: Produtos. Vendas e devoluções são reais; os demais indicadores aguardam o relatório oficial.</div>}
        <MetricStrip preview={isPreview} summary={evolution.summary} />
        <section className="hidden min-w-0 shrink-0 border-b border-border/60 p-3 md:block">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-semibold">Comparativo mensal</h2>
              <div className="flex gap-1 overflow-x-auto">{METRICS.map((item) => <Button aria-pressed={activeMetric === item.key} className="h-7 px-2 text-[11px]" disabled={isPreview && !previewSupports(item.key)} key={item.key} onClick={() => setMetric(item.key)} size="sm" variant={activeMetric === item.key ? 'secondary' : 'ghost'}>{item.label}</Button>)}</div>
            </div>
            <div className="operational-comparison-matrix max-w-full overflow-hidden">
              <Table aria-label="Comparativo mensal dos distribuidores" className="w-full table-fixed text-[10px]">
                <TableHeader><TableRow><TableHead className="w-[7.25rem] bg-card px-1.5 text-[10px]">Marca / grupo</TableHead>{evolution.months.map((mes) => <TableHead className="px-0.5 text-center text-[10px] leading-3" key={mes}>{monthLabel(mes)}</TableHead>)}</TableRow></TableHeader>
                <TableBody>{evolution.brands.flatMap((brand) => {
                  const open = expanded.has(brand.marca);
                  const brandRow = <TableRow key={brand.marca}><TableCell className="bg-card p-0.5"><Button aria-label={`${open ? 'Recolher' : 'Expandir'} ${brand.marca}`} className="h-7 w-full justify-start gap-1 px-1 text-[10px]" onClick={() => setExpanded((current) => { const next = new Set(current); if (open) next.delete(brand.marca); else next.add(brand.marca); return next; })} size="sm" variant="ghost">{open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}<i className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: BRAND_COLORS[brand.marca] }} />{brand.marca}</Button></TableCell>{evolution.months.map((mes, index) => { const item = brand.months.find((month) => month.mes === mes); const previous = brand.months.find((month) => month.mes === evolution.months[index - 1]); const value = valueFor(item, activeMetric); return <TableCell className="p-0.5 text-center" key={mes}>{item ? <button aria-label={`${brand.marca} em ${monthLabel(mes, true)}: ${formatMetric(value, activeMetric)}`} className="w-full rounded-sm px-0.5 py-1 text-center transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setSelected(item)} title={formatMetric(value, activeMetric)} type="button"><strong className="block truncate whitespace-nowrap text-[10px] font-medium leading-3 tabular-nums">{formatCompactMetric(value, activeMetric)}</strong><Delta semantic={activeMetric === 'valor_vendas' || activeMetric === 'margem_venda'} value={calculateVariation(value, valueFor(previous, activeMetric))} /></button> : <span className="text-muted-foreground">—</span>}</TableCell>; })}</TableRow>;
                  const groupRows = open ? brand.groups.map((group) => <TableRow className="bg-muted/15" key={group.key}><TableCell className="truncate bg-muted/30 px-1.5 py-1 text-[10px]" title={group.grupo}>{group.grupo}</TableCell>{evolution.months.map((mes) => { const item = group.months.find((month) => month.mes === mes); const value = valueFor(item, activeMetric); return <TableCell className="p-0.5 text-center" key={mes}>{item ? <button aria-label={`${group.grupo} em ${monthLabel(mes, true)}: ${formatMetric(value, activeMetric)}`} className="w-full truncate px-0.5 py-1 text-center text-[10px] tabular-nums hover:bg-muted" onClick={() => setSelected(item)} title={formatMetric(value, activeMetric)} type="button">{formatCompactMetric(value, activeMetric)}</button> : '—'}</TableCell>; })}</TableRow>) : [];
                  return [brandRow, ...groupRows];
                })}</TableBody>
              </Table>
            </div>
        </section>

        <section className="shrink-0 border-b border-border/60 p-3 md:hidden">
            <div className="mb-2 flex gap-1 overflow-x-auto">{METRICS.map((item) => <Button aria-pressed={activeMetric === item.key} className="h-7 px-2 text-[11px]" disabled={isPreview && !previewSupports(item.key)} key={item.key} onClick={() => setMetric(item.key)} size="sm" variant={activeMetric === item.key ? 'secondary' : 'ghost'}>{item.label}</Button>)}</div>
            <div className="mb-2 flex gap-1 overflow-x-auto">{evolution.brands.map((brand) => <Button aria-pressed={effectiveMobileBrand === brand.marca} className="h-7 px-2 text-xs" key={brand.marca} onClick={() => setMobileBrand(brand.marca)} size="sm" variant={effectiveMobileBrand === brand.marca ? 'secondary' : 'ghost'}>{brand.marca}</Button>)}</div>
            <div className="divide-y divide-border/50">{evolution.brands.find((brand) => brand.marca === effectiveMobileBrand)?.months.map((item, index, months) => <button aria-label={`${effectiveMobileBrand} em ${monthLabel(item.mes, true)}`} className="flex w-full items-center justify-between gap-3 py-2 text-left" key={item.mes} onClick={() => setSelected(item)} type="button"><span className="text-xs font-medium capitalize">{monthLabel(item.mes, true)}</span><span className="text-right"><strong className="block text-sm tabular-nums">{formatMetric(valueFor(item, activeMetric), activeMetric)}</strong><Delta semantic={activeMetric === 'valor_vendas' || activeMetric === 'margem_venda'} value={calculateVariation(valueFor(item, activeMetric), valueFor(months[index - 1], activeMetric))} /></span></button>)}</div>
        </section>

        <section aria-label="Comparativo de vendas e compras" className="operational-chart-panel operational-panel flex min-h-[15rem] flex-1 flex-col p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-semibold">Vendas × compras</h2>
              <p className="text-[11px] text-muted-foreground">Totais mensais das marcas selecionadas</p>
            </div>
            <div className="flex items-center gap-1">
              <Button aria-pressed={showSales} className="h-7 gap-1.5 px-2 text-[11px]" onClick={() => setShowSales((visible) => !visible)} size="sm" variant={showSales ? 'secondary' : 'ghost'}><i className="h-2 w-2 rounded-full bg-sky-500" />Vendas</Button>
              <Button aria-pressed={!isPreview && showPurchases} className="h-7 gap-1.5 px-2 text-[11px]" disabled={isPreview} onClick={() => setShowPurchases((visible) => !visible)} size="sm" title={isPreview ? 'Compras aguardando fonte oficial' : undefined} variant={!isPreview && showPurchases ? 'secondary' : 'ghost'}><i className="h-2 w-2 rounded-full bg-emerald-500" />Compras</Button>
            </div>
          </div>
          {isPreview && <p className="mb-1 text-[11px] text-amber-600 dark:text-amber-400">Compras aguardando fonte oficial.</p>}
          <div className="min-h-[12rem] flex-1">
            <ResponsiveContainer height="100%" width="100%">
              <AreaChart data={salesPurchasesData} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="distributor-sales-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.28} /><stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.01} /></linearGradient>
                  <linearGradient id="distributor-purchases-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.22} /><stop offset="100%" stopColor="#10b981" stopOpacity={0.01} /></linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" fontSize={10} tickLine={false} />
                <YAxis fontSize={10} tickFormatter={(value) => `${Math.round(value / 1000)}k`} tickLine={false} width={44} />
                <Tooltip formatter={(value: number, name: string) => [money.format(value), name === 'vendas' ? 'Vendas' : 'Compras']} />
                {showSales && <Area activeDot={{ r: 4 }} dataKey="vendas" dot={false} fill="url(#distributor-sales-fill)" name="Vendas" stroke="#0ea5e9" strokeWidth={2} type="monotone" />}
                {!isPreview && showPurchases && <Area activeDot={{ r: 4 }} connectNulls={false} dataKey="compras" dot={false} fill="url(#distributor-purchases-fill)" name="Compras" stroke="#10b981" strokeWidth={2} type="monotone" />}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>}

    <Sheet onOpenChange={(open) => { if (!open) setSelected(null); }} open={Boolean(selected)}>
      <SheetContent aria-label={selected ? `${selected.marca} - ${monthLabel(selected.mes, true)}` : 'Detalhes do distribuidor'} className="operational-overlay w-[min(96vw,32rem)] overflow-y-auto p-0 sm:max-w-lg" side="right">
        {selected && <><SheetHeader className="border-b border-border/60 p-5"><SheetTitle>{selected.marca} · <span className="capitalize">{monthLabel(selected.mes, true)}</span></SheetTitle><SheetDescription>{selected.grupo} {selected.classe ? `· classe ${selected.classe}` : ''}</SheetDescription></SheetHeader><dl className="grid grid-cols-2 gap-px bg-border/50">{[
          ['Posição do estoque', isPreview ? 'Indisponível' : formatMoney(selected.valor_estoque)], ['% do estoque', selected.percentual_estoque === null ? 'Indisponível' : `${decimal.format(selected.percentual_estoque)}%`], ['Duração do estoque', selected.duracao_estoque === null ? 'Indisponível' : `${decimal.format(selected.duracao_estoque)} dias`], ['Vendas', formatMoney(selected.valor_vendas)], ['% das vendas', selected.percentual_vendas === null ? 'Indisponível' : `${decimal.format(selected.percentual_vendas)}%`], ['% acumulado', selected.percentual_acumulado_vendas === null ? 'Indisponível' : `${decimal.format(selected.percentual_acumulado_vendas)}%`], ['Margem de venda', selected.margem_venda === null ? 'Indisponível' : `${decimal.format(selected.margem_venda)}%`], ['Prazo médio de venda', selected.prazo_medio_venda === null ? 'Indisponível' : `${decimal.format(selected.prazo_medio_venda)} dias`], ['Devoluções', formatMoney(selected.valor_devolucoes)], ['Compras', isPreview ? 'Indisponível' : formatMoney(selected.valor_compras)], ['% das compras', selected.percentual_compras === null ? 'Indisponível' : `${decimal.format(selected.percentual_compras)}%`], ['Prazo médio de compra', selected.prazo_medio_compra === null ? 'Indisponível' : `${decimal.format(selected.prazo_medio_compra)} dias`], ['Diferença compra/CMV', selected.percentual_diferenca_compra_cmv === null ? 'Indisponível' : `${decimal.format(selected.percentual_diferenca_compra_cmv)}%`],
        ].map(([label, value]) => <div className="min-w-0 bg-background p-3" key={label}><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-semibold tabular-nums">{value}</dd></div>)}</dl></>}
      </SheetContent>
    </Sheet>
  </section>;
}
