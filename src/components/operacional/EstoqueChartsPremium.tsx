import { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EstoqueRecord, EstoqueFiltersState } from '@/types/estoque';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, Treemap
} from 'recharts';
import { TrendingUp, TrendingDown, ChevronRight, X, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Props {
  data: EstoqueRecord[];
  allData: EstoqueRecord[];
  filters: EstoqueFiltersState;
  setFilters: React.Dispatch<React.SetStateAction<EstoqueFiltersState>>;
  isLoading?: boolean;
}

const GRADIENTS = [
  { start: '#f59e0b', end: '#d97706' },
  { start: '#3b82f6', end: '#2563eb' },
  { start: '#10b981', end: '#059669' },
  { start: '#8b5cf6', end: '#7c3aed' },
  { start: '#ef4444', end: '#dc2626' },
  { start: '#06b6d4', end: '#0891b2' },
  { start: '#ec4899', end: '#db2777' },
  { start: '#84cc16', end: '#65a30d' },
];

const COLORS = GRADIENTS.map(g => g.start);

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const formatNumber = (v: number) =>
  new Intl.NumberFormat('pt-BR').format(v);

const formatPercent = (v: number) => `${v.toFixed(1)}%`;

// Custom premium tooltip
function PremiumTooltip({ active, payload, label, total, valueLabel = 'Valor' }: any) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  const pct = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="bg-card/95 backdrop-blur-xl border border-border rounded-xl p-3 shadow-2xl min-w-[180px]">
      <p className="text-xs text-muted-foreground mb-1 font-medium">{label}</p>
      <p className="text-base font-bold text-foreground">
        {typeof value === 'number' && value > 999 ? formatCurrency(value) : formatNumber(value)}
      </p>
      <div className="flex items-center gap-2 mt-1">
        <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-amber-500">{formatPercent(pct)}</span>
      </div>
    </div>
  );
}

// Drill-down breadcrumb
function DrillBreadcrumb({ path, onNavigate }: { path: string[]; onNavigate: (index: number) => void }) {
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

// Active filter chip
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

export function EstoqueChartsPremium({ data, allData, filters, setFilters, isLoading }: Props) {
  const [drillPath, setDrillPath] = useState<string[]>(['Visão Geral']);
  const [drillFilter, setDrillFilter] = useState<{ type: string; value: string } | null>(null);
  const [hoveredCurva, setHoveredCurva] = useState<string | null>(null);

  // Apply drill-down filter on top of existing data
  const chartData = useMemo(() => {
    if (!drillFilter) return data;
    switch (drillFilter.type) {
      case 'empresa': return data.filter(r => r.empresa === drillFilter.value);
      case 'marca': return data.filter(r => r.marca === drillFilter.value);
      case 'grupo': return data.filter(r => r.grupo === drillFilter.value);
      case 'curva': return data.filter(r => r.classe_abc === drillFilter.value.replace('Curva ', ''));
      default: return data;
    }
  }, [data, drillFilter]);

  const totalValor = useMemo(() => chartData.reduce((s, r) => s + r.valor_estoque, 0), [chartData]);
  const totalQtd = useMemo(() => chartData.reduce((s, r) => s + r.quantidade_estoque, 0), [chartData]);

  const valorPorEmpresa = useMemo(() => {
    const map = new Map<string, number>();
    chartData.forEach(r => map.set(r.empresa, (map.get(r.empresa) || 0) + r.valor_estoque));
    return [...map.entries()]
      .map(([name, value]) => ({ name: name.replace(/^CASPPER\s*/i, ''), fullName: name, value }))
      .sort((a, b) => b.value - a.value);
  }, [chartData]);

  const curvaABC = useMemo(() => {
    const map = new Map<string, { count: number; valor: number }>();
    chartData.forEach(r => {
      const cur = map.get(r.classe_abc) || { count: 0, valor: 0 };
      cur.count++;
      cur.valor += r.valor_estoque;
      map.set(r.classe_abc, cur);
    });
    return [...map.entries()]
      .map(([name, { count, valor }]) => ({ name: `Curva ${name}`, value: count, valor }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [chartData]);

  const curvaAtiva = useMemo(() => {
    if (curvaABC.length === 0) return null;
    return curvaABC.find((item) => item.name === hoveredCurva) ?? curvaABC[0];
  }, [curvaABC, hoveredCurva]);

  const curvaAtivaIndex = useMemo(() => {
    if (!curvaAtiva) return -1;
    return curvaABC.findIndex((item) => item.name === curvaAtiva.name);
  }, [curvaABC, curvaAtiva]);

  const qtdPorMarca = useMemo(() => {
    const map = new Map<string, { qtd: number; valor: number }>();
    chartData.forEach(r => {
      const cur = map.get(r.marca) || { qtd: 0, valor: 0 };
      cur.qtd += r.quantidade_estoque;
      cur.valor += r.valor_estoque;
      map.set(r.marca, cur);
    });
    return [...map.entries()]
      .map(([name, { qtd, valor }]) => ({ name, value: qtd, valor }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [chartData]);

  const valorPorGrupo = useMemo(() => {
    const map = new Map<string, { valor: number; qtd: number }>();
    chartData.forEach(r => {
      const cur = map.get(r.grupo) || { valor: 0, qtd: 0 };
      cur.valor += r.valor_estoque;
      cur.qtd += r.quantidade_estoque;
      map.set(r.grupo, cur);
    });
    return [...map.entries()]
      .map(([name, { valor, qtd }]) => ({
        name: name.length > 25 ? name.substring(0, 25) + '…' : name,
        fullName: name,
        value: valor,
        qtd,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [chartData]);

  const handleBarClick = useCallback((chartType: string) => (entry: any) => {
    if (!entry) return;
    const value = entry.fullName || entry.name;
    setDrillFilter({ type: chartType, value });
    setDrillPath(prev => [...prev, value]);
  }, []);

  const handlePieClick = useCallback((entry: any) => {
    if (!entry) return;
    setDrillFilter({ type: 'curva', value: entry.name });
    setDrillPath(prev => [...prev, entry.name]);
  }, []);

  const handleBreadcrumbNav = useCallback((index: number) => {
    if (index === 0) {
      setDrillFilter(null);
      setDrillPath(['Visão Geral']);
    } else {
      setDrillPath(prev => prev.slice(0, index + 1));
    }
  }, []);

  const clearDrill = useCallback(() => {
    setDrillFilter(null);
    setDrillPath(['Visão Geral']);
  }, []);

  // Active global filters display
  const activeFilters = useMemo(() => {
    const chips: { label: string; value: string; onRemove: () => void }[] = [];
    if (filters.empresas.length > 0)
      chips.push({ label: 'Filial', value: filters.empresas[0], onRemove: () => setFilters(f => ({ ...f, empresas: [] })) });
    if (filters.marcas.length > 0)
      chips.push({ label: 'Marca', value: filters.marcas[0], onRemove: () => setFilters(f => ({ ...f, marcas: [] })) });
    if (filters.curvasABC.length > 0)
      chips.push({ label: 'Curva', value: filters.curvasABC[0], onRemove: () => setFilters(f => ({ ...f, curvasABC: [] })) });
    if (drillFilter)
      chips.push({ label: 'Drill-down', value: drillFilter.value, onRemove: clearDrill });
    return chips;
  }, [filters, drillFilter, setFilters, clearDrill]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="premium-card">
            <CardHeader className="pb-2"><Skeleton className="h-4 w-40" /></CardHeader>
            <CardContent><Skeleton className="h-[280px] w-full rounded-lg" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const svgGradients = (
    <svg width={0} height={0} className="absolute">
      <defs>
        {GRADIENTS.map((g, i) => (
          <linearGradient key={i} id={`grad-${i}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={g.start} />
            <stop offset="100%" stopColor={g.end} />
          </linearGradient>
        ))}
        <linearGradient id="grad-bar-amber" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
        <linearGradient id="grad-bar-blue" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
        <linearGradient id="grad-bar-green" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
    </svg>
  );

  return (
    <div className="space-y-4">
      {svgGradients}

      {/* Active filters & drill breadcrumb */}
      {(activeFilters.length > 0 || drillPath.length > 1) && (
        <div className="flex flex-wrap items-center gap-2">
          <DrillBreadcrumb path={drillPath} onNavigate={handleBreadcrumbNav} />
          {activeFilters.map((f, i) => (
            <ActiveFilterChip key={i} {...f} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Valor por Empresa */}
        <Card className="premium-card group hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300 hover:-translate-y-0.5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="h-1 w-6 rounded-full bg-gradient-to-r from-amber-500 to-amber-400" />
                Valor de Estoque por Filial
              </CardTitle>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                Clique para filtrar
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={valorPorEmpresa} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} horizontal={false} />
                <XAxis type="number" tickFormatter={formatCurrency} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} />
                <ReTooltip content={<PremiumTooltip total={totalValor} />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                <Bar
                  dataKey="value"
                  fill="url(#grad-bar-amber)"
                  radius={[0, 6, 6, 0]}
                  cursor="pointer"
                  onClick={(d: any) => handleBarClick('empresa')(d)}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Curva ABC */}
        <Card className="premium-card group hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 hover:-translate-y-0.5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="h-1 w-6 rounded-full bg-gradient-to-r from-blue-500 to-blue-400" />
                Distribuição por Curva ABC
              </CardTitle>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                Clique para filtrar
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
              {/* Donut chart on the left */}
              <div className="relative flex-shrink-0" style={{ width: 200, height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart onMouseLeave={() => setHoveredCurva(null)}>
                    <Pie
                      data={curvaABC}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      dataKey="value"
                      paddingAngle={3}
                      cursor="pointer"
                      onClick={handlePieClick}
                      onMouseEnter={(_, index) => setHoveredCurva(curvaABC[index]?.name ?? null)}
                      animationDuration={800}
                      animationEasing="ease-out"
                    >
                      {curvaABC.map((item, i) => {
                        const isActive = curvaAtivaIndex === -1 || curvaAtivaIndex === i;
                        return (
                          <Cell
                            key={item.name}
                            fill={`url(#grad-${i})`}
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
                    <p className="text-lg font-bold leading-tight">{formatNumber(chartData.length)}</p>
                    <p className="text-[10px] text-muted-foreground">itens totais</p>
                  </div>
                </div>
              </div>

              {/* Mini list on the right */}
              <div className="flex-1 space-y-1">
                {curvaABC.map((item, i) => {
                  const pct = chartData.length > 0 ? ((item.value / chartData.length) * 100).toFixed(1) : '0';
                  const isHighlighted = curvaAtiva?.name === item.name;

                  return (
                    <button
                      key={item.name}
                      onClick={() => handlePieClick(item)}
                      onMouseEnter={() => setHoveredCurva(item.name)}
                      onMouseLeave={() => setHoveredCurva(null)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-3 py-2 transition-colors group/item',
                        isHighlighted ? 'bg-muted/60 border border-border/60' : 'hover:bg-muted/40 border border-transparent'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ background: COLORS[i % COLORS.length] }}
                        />
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold tabular-nums">{formatNumber(item.value)} itens</span>
                        <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">{pct}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Qtd por Marca - Top 10 */}
        <Card className="premium-card group hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 hover:-translate-y-0.5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="h-1 w-6 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />
                Quantidade por Marca (Top 10)
              </CardTitle>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                Clique para filtrar
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={qtdPorMarca} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} />
                <ReTooltip content={<PremiumTooltip total={totalQtd} valueLabel="Quantidade" />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                <Bar
                  dataKey="value"
                  fill="url(#grad-bar-blue)"
                  radius={[0, 6, 6, 0]}
                  cursor="pointer"
                  onClick={(d: any) => handleBarClick('marca')(d)}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Valor por Grupo - Top 10 */}
        <Card className="premium-card group hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300 hover:-translate-y-0.5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="h-1 w-6 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" />
                Valor por Grupo (Top 10)
              </CardTitle>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                Clique para filtrar
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={valorPorGrupo} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} horizontal={false} />
                <XAxis type="number" tickFormatter={formatCurrency} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} />
                <ReTooltip content={<PremiumTooltip total={totalValor} />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                <Bar
                  dataKey="value"
                  fill="url(#grad-bar-green)"
                  radius={[0, 6, 6, 0]}
                  cursor="pointer"
                  onClick={(d: any) => handleBarClick('grupo')(d)}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
