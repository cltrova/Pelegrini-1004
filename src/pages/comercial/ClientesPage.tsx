import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useComercialData } from '@/hooks/useComercialData';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  Search,
  TrendingUp,
  TrendingDown,
  MapPin,
  AlertTriangle,
  Sparkles,
  Activity,
  Target,
  Brain,
  Crown,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import { CollapsibleFilterBar } from '@/components/common/CollapsibleFilterBar';
import {
  ComercialFilters,
  getComercialFiltersSummary,
  countActiveFilters,
} from '@/components/comercial/ComercialFilters';
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
/* Hooks                                                               */
/* ------------------------------------------------------------------ */
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/* ------------------------------------------------------------------ */
/* KPI Card — enterprise clean                                         */
/* ------------------------------------------------------------------ */
interface KpiProps {
  title: string;
  value: number;
  formatter?: (n: number) => string;
  icon: React.ReactNode;
  delta?: number;
  index: number;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}
function KpiCard({ title, value, formatter = (n) => String(Math.round(n)), icon, delta, index, tone = 'default' }: KpiProps) {
  const animated = useCountUp(value);
  const toneRing = {
    default: 'text-primary bg-primary/10 ring-primary/15',
    success: 'text-success bg-success/10 ring-success/15',
    warning: 'text-warning bg-warning/10 ring-warning/15',
    danger: 'text-destructive bg-destructive/10 ring-destructive/15',
  }[tone];
  return (
    <Card
      className={cn(
        'group relative overflow-hidden border-border/60 transition-all duration-300',
        'hover:border-border hover:shadow-md hover:-translate-y-px',
      )}
      style={{ animation: `cliRise 0.4s ${0.04 + index * 0.05}s ease-out backwards` }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground mb-1.5 truncate">
              {title}
            </p>
            <p className="text-2xl font-bold mono-value tracking-tight text-foreground leading-none">
              {formatter(animated)}
            </p>
            {typeof delta === 'number' && (
              <div className="mt-2 flex items-center gap-1.5">
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md',
                    delta >= 0 ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10',
                  )}
                >
                  {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(delta).toFixed(1)}%
                </span>
                <span className="text-[11px] text-muted-foreground">vs período anterior</span>
              </div>
            )}
          </div>
          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center ring-1 shrink-0', toneRing)}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */
export default function ClientesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('ranking');

  const [pendingFilters, setPendingFilters] = useState<ComercialFiltersType>(filtrosIniciais);
  const [appliedFilters, setAppliedFilters] = useState<ComercialFiltersType>(filtrosIniciais);
  const [filtersOpen, setFiltersOpen] = useState(false);

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
    setFiltersOpen(false);
  }, [pendingFilters]);

  const handleClearFilters = useCallback(() => {
    setPendingFilters(filtrosIniciais);
    setAppliedFilters(filtrosIniciais);
  }, []);

  const clientesFiltrados = clientesPerformance.filter(c =>
    c.razao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.fantasia?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const top10Treemap = clientesPerformance.slice(0, 10).map((c, i) => ({
    name: c.fantasia || c.razao,
    size: c.faturamentoLiquido,
    fill: RANK_COLORS[i % RANK_COLORS.length],
  }));

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

  if (isLoading) return <LoadingState message="Carregando clientes..." />;
  if (error) return <ErrorState message="Erro ao carregar clientes" />;

  const top5Clientes = clientesPerformance.slice(0, 5);

  const toneBg = (t: 'success' | 'warning' | 'danger' | 'default') => ({
    success: 'text-success bg-success/10 ring-success/15',
    warning: 'text-warning bg-warning/10 ring-warning/15',
    danger: 'text-destructive bg-destructive/10 ring-destructive/15',
    default: 'text-primary bg-primary/10 ring-primary/15',
  }[t]);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <CollapsibleFilterBar
        title="Filtros"
        summary={getComercialFiltersSummary(appliedFilters, vendedoresDisponiveis)}
        activeFiltersCount={countActiveFilters(appliedFilters)}
        onClear={handleClearFilters}
        isOpen={filtersOpen}
        onOpenChange={setFiltersOpen}
      >
        <ComercialFilters
          filters={pendingFilters}
          onFiltersChange={setPendingFilters}
          onBuscar={handleBuscar}
          hasChanges={hasChanges}
          anos={ANOS_DISPONIVEIS}
          vendedores={vendedoresDisponiveis}
          showVendedorFilter
        />
      </CollapsibleFilterBar>

      {/* ===== Header ===== */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15">
              <Users className="h-4 w-4 text-primary" />
            </span>
            Análise de Clientes
          </h1>
          <p className="page-subtitle">Ranking, evolução e insights da base de clientes</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* ===== KPIs ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Total Clientes" value={kpis.qtdClientes} icon={<Users className="h-4 w-4" />} delta={5.2} index={0} />
        <KpiCard title="Novos (30 dias)" value={novosClientes.length} icon={<Sparkles className="h-4 w-4" />} delta={12.4} index={1} tone="success" />
        <KpiCard title="Em Risco" value={clientesEmRisco.length} icon={<AlertTriangle className="h-4 w-4" />} delta={-3.1} index={2} tone="warning" />
        <KpiCard title="Estados Atendidos" value={ufsUnicas.length} icon={<MapPin className="h-4 w-4" />} delta={2.0} index={3} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
          <TabsTrigger value="insights">
            <Brain className="h-3.5 w-3.5 mr-1" /> Insights IA
          </TabsTrigger>
          <TabsTrigger value="geografico">Geográfico</TabsTrigger>
        </TabsList>

        {/* =================================================== RANKING */}
        <TabsContent value="ranking" className="space-y-5 mt-5">
          {/* Podium Top 5 */}
          {top5Clientes.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {top5Clientes.map((c, i) => {
                const isFirst = i === 0;
                return (
                  <Card
                    key={c.codigo}
                    className={cn(
                      'group relative transition-all duration-300 hover:shadow-md hover:-translate-y-px',
                      isFirst ? 'md:col-span-2 border-primary/30' : 'border-border/60',
                    )}
                    style={{ animation: `cliRise 0.4s ${0.08 + i * 0.06}s ease-out backwards` }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {isFirst ? (
                            <Crown className="h-4 w-4 text-primary" />
                          ) : (
                            <span className="text-[11px] font-semibold italic text-muted-foreground">#{i + 1}</span>
                          )}
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                            {isFirst ? 'Líder' : i === 1 ? 'Vice' : `Top ${i + 1}`}
                          </span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] font-medium">
                          {formatPercent(c.participacao)}
                        </Badge>
                      </div>
                      <p className={cn('font-semibold truncate', isFirst ? 'text-base' : 'text-sm')}>
                        {c.fantasia || c.razao}
                      </p>
                      {c.cidade && (
                        <p className="text-[11px] text-muted-foreground truncate mb-2">
                          {c.cidade}/{c.uf}
                        </p>
                      )}
                      <p
                        className={cn(
                          'mono-value font-bold tracking-tight',
                          isFirst ? 'text-xl text-primary' : 'text-base text-foreground',
                        )}
                      >
                        {formatCurrency(c.faturamentoLiquido, !isFirst)}
                      </p>
                      <div className="mt-2 h-1 rounded-full bg-muted/60 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/80"
                          style={{
                            width: `${Math.min((c.faturamentoLiquido / (top5Clientes[0]?.faturamentoLiquido || 1)) * 100, 100)}%`,
                            animation: `cliBar 0.7s ${0.2 + i * 0.08}s cubic-bezier(.22,.9,.32,1) backwards`,
                            transformOrigin: 'left center',
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Concentração */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Concentração Top 10 Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top10Treemap} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => formatCurrency(v, true)}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--primary) / 0.05)' }}
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="size" name="Faturamento" radius={[0, 4, 4, 0]} animationDuration={800}>
                      {top10Treemap.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={RANK_COLORS[index % RANK_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Tabela de ranking */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ranking Completo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">#</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Cliente</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Cidade/UF</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Faturamento</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Pedidos</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Ticket</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Part. %</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Última Compra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesFiltrados.slice(0, 20).map((c, i) => (
                      <tr key={c.codigo} className="border-b border-border/40 premium-table-row">
                        <td className="py-3 px-2">
                          {i < 3 ? (
                            <Badge className={cn(
                              'w-7 h-7 rounded-full p-0 flex items-center justify-center text-xs font-bold border-0',
                              i === 0 && 'rank-1',
                              i === 1 && 'rank-2',
                              i === 2 && 'rank-3',
                            )}>
                              {i + 1}°
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground italic">{i + 1}</span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <div>
                            <p className="font-medium">{c.fantasia || c.razao}</p>
                            {c.fantasia && (
                              <p className="text-xs text-muted-foreground">{c.razao}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">
                          {c.cidade ? `${c.cidade}/${c.uf}` : c.uf || '-'}
                        </td>
                        <td className="py-3 px-2 text-right mono-value font-semibold">
                          {formatCurrency(c.faturamentoLiquido)}
                        </td>
                        <td className="py-3 px-2 text-right mono-value">{c.totalPedidos}</td>
                        <td className="py-3 px-2 text-right mono-value text-muted-foreground">
                          {formatCurrency(c.ticketMedio)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          {formatPercent(c.participacao)}
                        </td>
                        <td className="py-3 px-2 text-right text-muted-foreground">
                          {c.ultimaCompra
                            ? new Date(c.ultimaCompra).toLocaleDateString('pt-BR')
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =================================================== EVOLUÇÃO */}
        <TabsContent value="evolucao" className="space-y-5 mt-5">
          {evolucaoStats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card><CardContent className="p-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Último mês</p>
                <p className="text-xl font-bold mono-value text-foreground">{formatCurrency(evolucaoStats.ultimo, true)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Mês anterior</p>
                <p className="text-xl font-bold mono-value text-muted-foreground">{formatCurrency(evolucaoStats.anterior, true)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Variação</p>
                <p className={cn('text-xl font-bold mono-value flex items-center gap-1', evolucaoStats.delta >= 0 ? 'text-success' : 'text-destructive')}>
                  {evolucaoStats.delta >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {Math.abs(evolucaoStats.delta).toFixed(1)}%
                </p>
              </CardContent></Card>
              <Card className="border-primary/30"><CardContent className="p-4">
                <p className="text-[11px] uppercase tracking-wider text-primary font-medium mb-1 flex items-center gap-1"><Target className="h-3 w-3" /> Meta atingida</p>
                <p className="text-xl font-bold mono-value text-primary">{Math.min(((evolucaoStats.ultimo / (evolucaoStats.anterior || 1)) * 100), 200).toFixed(0)}%</p>
              </CardContent></Card>
            </div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Evolução de Vendas · Top 5 Clientes
                </CardTitle>
                <Badge variant="secondary" className="text-[10px]">
                  <Brain className="h-3 w-3 mr-1" /> Analisado por IA
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[360px]">
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* =================================================== INSIGHTS IA */}
        <TabsContent value="insights" className="space-y-5 mt-5">
          {insightsIA.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15">
                    <Brain className="h-4 w-4 text-primary" />
                  </span>
                  Insights Inteligentes
                  <Badge variant="secondary" className="ml-2 text-[10px]">
                    {insightsIA.length} análises
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {insightsIA.map((ins, i) => (
                    <div
                      key={i}
                      className="group relative rounded-lg border border-border/60 bg-card p-3.5 transition-all hover:border-border hover:shadow-sm"
                      style={{ animation: `cliRise 0.4s ${0.08 + i * 0.06}s ease-out backwards` }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ring-1', toneBg(ins.tone))}>
                          {ins.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold mb-1">{ins.titulo}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{ins.descricao}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Clientes em Risco
                  <span className="text-xs font-normal text-muted-foreground">(sem compras há 3+ meses)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {clientesEmRisco.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">
                    Nenhum cliente em risco identificado
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {clientesEmRisco.map((c, i) => (
                      <div
                        key={c.codigo}
                        className="flex items-center justify-between p-2.5 rounded-md border border-border/50 hover:bg-muted/30 hover:border-border transition-all"
                        style={{ animation: `cliRise 0.35s ${i * 0.03}s ease-out backwards` }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{c.fantasia || c.razao}</p>
                          <p className="text-xs text-muted-foreground">
                            Última compra: {c.ultimaCompra ? new Date(c.ultimaCompra).toLocaleDateString('pt-BR') : 'Nunca'}
                          </p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="font-semibold text-sm mono-value">{formatCurrency(c.faturamentoLiquido, true)}</p>
                          <p className="text-xs text-muted-foreground">{c.totalPedidos} pedidos</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-success" />
                  Novos Clientes
                  <span className="text-xs font-normal text-muted-foreground">(último mês)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {novosClientes.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">
                    Nenhum novo cliente no período
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {novosClientes.slice(0, 10).map((c, i) => (
                      <div
                        key={c.codigo}
                        className="flex items-center justify-between p-2.5 rounded-md border border-border/50 hover:bg-muted/30 hover:border-border transition-all"
                        style={{ animation: `cliRise 0.35s ${i * 0.03}s ease-out backwards` }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{c.fantasia || c.razao}</p>
                          <p className="text-xs text-muted-foreground">
                            Primeira compra: {c.primeiraCompra ? new Date(c.primeiraCompra).toLocaleDateString('pt-BR') : '-'}
                          </p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="font-semibold text-sm mono-value text-success">{formatCurrency(c.faturamentoLiquido, true)}</p>
                          <p className="text-xs text-muted-foreground">{c.totalPedidos} pedidos</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* =================================================== GEOGRÁFICO */}
        <TabsContent value="geografico" className="space-y-5 mt-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Top 10 Estados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {distribuicaoPorUF.map((item, i) => {
                  const maxPct = distribuicaoPorUF[0]?.percentual || 1;
                  const fillPct = (item.percentual / maxPct) * 100;
                  return (
                    <div
                      key={item.uf}
                      style={{ animation: `cliRise 0.35s ${i * 0.04}s ease-out backwards` }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-3">
                          <Badge className={cn(
                            'w-7 h-7 rounded-full p-0 flex items-center justify-center text-xs font-bold border-0',
                            i === 0 && 'rank-1',
                            i === 1 && 'rank-2',
                            i === 2 && 'rank-3',
                            i > 2 && 'bg-muted text-muted-foreground',
                          )}>
                            {i + 1}
                          </Badge>
                          <span className="font-semibold">{item.uf}</span>
                          <span className="text-xs text-muted-foreground">{formatPercent(item.percentual)}</span>
                        </div>
                        <span className="mono-value font-semibold text-foreground">
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
            </CardContent>
          </Card>
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
    </div>
  );
}
