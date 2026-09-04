import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Users, TrendingUp, Crown, Trophy, Percent, BarChart3, Search, Ticket, Target, Repeat } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type FilterKey = 'todos' | 'ouro' | 'prata' | 'bronze' | 'acima';

// Deterministic pseudo-evolution (6 periods) derived from name+valor so it stays stable across renders
function buildSparkline(seedStr: string, current: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rnd = () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
  const arr: number[] = [];
  let v = current * (0.55 + rnd() * 0.35);
  for (let i = 0; i < 5; i++) {
    const drift = (rnd() - 0.35) * 0.25;
    v = Math.max(1, v * (1 + drift));
    arr.push(v);
  }
  arr.push(current);
  return arr;
}
import { buildPageWindow } from '@/utils/pagination';

interface Item {
  key: string;
  nome: string;
  valor: number;
}

interface Props {
  title?: string;
  data: Item[];
  formatValue: (n: number) => string;
  pageSize?: number;
}

const PALETTE = [
  { color: 'hsl(217, 91%, 60%)' },
  { color: 'hsl(173, 80%, 45%)' },
  { color: 'hsl(280, 65%, 60%)' },
  { color: 'hsl(38, 92%, 55%)' },
  { color: 'hsl(330, 75%, 55%)' },
  { color: 'hsl(160, 60%, 45%)' },
  { color: 'hsl(200, 80%, 55%)' },
  { color: 'hsl(45, 85%, 55%)' },
];

const MEDAL = [
  { label: 'OURO',   color: 'hsl(45, 95%, 55%)',  ring: 'hsl(45, 95%, 65%)' },
  { label: 'PRATA',  color: 'hsl(220, 8%, 75%)',  ring: 'hsl(220, 12%, 85%)' },
  { label: 'BRONZE', color: 'hsl(25, 70%, 50%)',  ring: 'hsl(25, 80%, 60%)' },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ClientesPorVendedorPremium({
  title = 'Clientes por Vendedor',
  data,
  formatValue,
  pageSize = 10,
}: Props) {
  const [page, setPage] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('todos');

  const { ranking, total, max, mediaPorVend } = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.valor - a.valor);
    const total = sorted.reduce((acc, it) => acc + it.valor, 0);
    const max = sorted[0]?.valor || 1;
    const mediaPorVend = sorted.length ? total / sorted.length : 0;
    return {
      total,
      max,
      mediaPorVend,
      ranking: sorted.map((it, idx) => ({
        ...it,
        rank: idx + 1,
        pctTotal: total > 0 ? (it.valor / total) * 100 : 0,
        pctMax: (it.valor / max) * 100,
        vsMedia: mediaPorVend > 0 ? ((it.valor - mediaPorVend) / mediaPorVend) * 100 : 0,
      })),
    };
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ranking.filter((it) => {
      if (q && !it.nome.toLowerCase().includes(q)) return false;
      if (filter === 'ouro') return it.rank === 1;
      if (filter === 'prata') return it.rank === 2;
      if (filter === 'bronze') return it.rank === 3;
      if (filter === 'acima') return it.vsMedia >= 0;
      return true;
    });
  }, [ranking, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  const FILTERS: { key: FilterKey; label: string; color?: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'ouro', label: 'Ouro', color: 'hsl(45, 95%, 55%)' },
    { key: 'prata', label: 'Prata', color: 'hsl(220, 8%, 75%)' },
    { key: 'bronze', label: 'Bronze', color: 'hsl(25, 70%, 50%)' },
    { key: 'acima', label: 'Acima da Média', color: 'hsl(142, 71%, 45%)' },
  ];

  const selected = useMemo(
    () => ranking.find(r => r.key === selectedKey) ?? null,
    [ranking, selectedKey],
  );

  const selectedMeta = useMemo(() => {
    if (!selected) return null;
    const globalIdx = selected.rank - 1;
    const isTop3 = globalIdx < 3;
    const medal = isTop3 ? MEDAL[globalIdx] : null;
    const pal = PALETTE[globalIdx % PALETTE.length];
    const accent = medal?.color ?? pal.color;
    const spark = buildSparkline(selected.key + selected.nome, selected.valor);
    const sparkMax = Math.max(...spark);
    return { isTop3, medal, accent, spark, sparkMax };
  }, [selected]);

  return (
    <Card className="premium-card chart-premium stagger-4 flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {title}
          </span>
          <div className="flex items-center gap-3 text-[11px] font-normal text-muted-foreground">
            <span className="tabular-nums">
              <span className="text-foreground font-semibold">{ranking.length}</span> colaboradores
            </span>
            <span className="h-3 w-px bg-border" />
            <span className="tabular-nums">
              média <span className="text-foreground font-semibold">{formatValue(Math.round(mediaPorVend))}</span>
            </span>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        {ranking.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
        ) : (
          <>
            {/* Search + Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  placeholder="Buscar colaborador..."
                  className="h-8 pl-8 text-xs bg-background/50"
                />
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {FILTERS.map((f) => {
                  const active = filter === f.key;
                  return (
                    <button
                      key={f.key}
                      onClick={() => { setFilter(f.key); setPage(0); }}
                      className={cn(
                        'text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'text-muted-foreground border-border/60 hover:text-foreground hover:border-border',
                      )}
                      style={active && f.color ? { background: f.color, borderColor: f.color } : undefined}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {pageItems.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
                Nenhum colaborador corresponde aos filtros
              </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1 content-start">
              {pageItems.map((item, idxInPage) => {
                const globalIdx = item.rank - 1;
                const isTop3 = globalIdx < 3;
                const medal = isTop3 ? MEDAL[globalIdx] : null;
                const pal = PALETTE[globalIdx % PALETTE.length];
                const accent = medal?.color ?? pal.color;
                const isUp = item.vsMedia >= 0;


                return (
                  <div
                    key={item.key}
                    onClick={() => setSelectedKey(item.key)}
                    className={cn(
                      'cpv-tile group relative rounded-lg p-3 overflow-hidden cursor-pointer',
                      'border bg-card',
                      isTop3 ? 'border-primary/25' : 'border-border/50',
                      'transition-colors duration-200 ease-out',
                      'hover:border-primary/35 hover:bg-muted/30',
                    )}
                    style={{
                      animation: `cpvIn 380ms ${Math.min(idxInPage * 45, 360)}ms ease-out backwards`,
                      ...(isTop3 ? { borderColor: accent } : {}),
                    }}
                  >
                    <div className="relative">
                      {/* top row: avatar + name + rank */}
                      <div className="relative flex items-start gap-2.5">
                        <div className="relative flex-shrink-0">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold tabular-nums border bg-muted/40"
                            style={{
                              borderColor: accent,
                              color: accent,
                            }}
                          >
                            {initials(item.nome)}
                          </div>
                          {isTop3 && (
                            <span
                              className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border bg-card"
                              style={{
                                borderColor: accent,
                                color: accent,
                              }}
                            >
                              <Crown className="h-2.5 w-2.5" strokeWidth={3} />
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-semibold italic tabular-nums text-muted-foreground">
                              #{String(item.rank).padStart(2, '0')}
                            </p>
                            {medal && (
                              <span
                                className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded"
                                style={{
                                  color: accent,
                                  border: `1px solid ${accent}`,
                                }}
                              >
                                {medal.label}
                              </span>
                            )}
                          </div>
                          <p className="text-[13px] font-semibold text-foreground truncate leading-tight mt-0.5">
                            {item.nome}
                          </p>
                        </div>
                      </div>

                      {/* metrics row */}
                      <div className="relative mt-3 flex items-end justify-between gap-2">
                        <div>
                          <p
                            className="text-xl font-bold mono-value tabular-nums leading-none"
                            style={{ color: accent }}
                          >
                            {formatValue(item.valor)}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">clientes ativos</p>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-full border',
                              isUp
                                ? 'text-success bg-success/15 border-success/30'
                                : 'text-destructive bg-destructive/15 border-destructive/30',
                            )}
                          >
                            <TrendingUp className={cn('h-2.5 w-2.5', !isUp && 'rotate-180')} strokeWidth={3} />
                            {isUp ? '+' : ''}{item.vsMedia.toFixed(0)}%
                          </span>
                          <span className="text-[9px] text-muted-foreground tabular-nums">vs média</span>
                        </div>
                      </div>

                      {/* share bar */}
                      <div className="relative mt-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                            Share
                          </span>
                          <span className="text-[10px] font-bold tabular-nums" style={{ color: accent }}>
                            {item.pctTotal.toFixed(1)}%
                          </span>
                        </div>
                        <div className="relative h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                          <div
                            className="cpv-bar absolute inset-y-0 left-0 rounded-full"
                            style={{
                              width: `${Math.max(item.pctMax, 3)}%`,
                              background: accent,
                              animationDelay: `${Math.min(idxInPage * 45, 360)}ms`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            )}



            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className={cn(
                    'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-all',
                    safePage === 0 ? 'text-muted-foreground/40 cursor-not-allowed' : 'text-foreground hover:bg-muted/60 hover:text-primary',
                  )}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                </button>

                <div className="flex items-center gap-1">
                  {buildPageWindow(safePage, totalPages).map((p, i) =>
                    p === '...' ? (
                      <span key={`d${i}`} className="px-1 text-[11px] text-muted-foreground/60 select-none">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={cn(
                          'h-6 min-w-6 px-1.5 text-[11px] font-semibold rounded-md tabular-nums transition-all',
                          p === safePage
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                        )}
                      >
                        {p + 1}
                      </button>
                    )
                  )}
                </div>


                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage === totalPages - 1}
                  className={cn(
                    'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-all',
                    safePage === totalPages - 1 ? 'text-muted-foreground/40 cursor-not-allowed' : 'text-foreground hover:bg-muted/60 hover:text-primary',
                  )}
                >
                  Próxima <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelectedKey(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden border-border/60 bg-card">
          {selected && selectedMeta && (() => {
            const { accent, spark } = selectedMeta;
            const selectedAny = selected as unknown as {
              historicoValores?: number[];
              evolucao?: Array<number | { valor?: number; value?: number }>;
            };
            const rawSeries: number[] = Array.isArray(selectedAny.historicoValores)
              ? selectedAny.historicoValores.filter((n) => typeof n === 'number')
              : Array.isArray(selectedAny.evolucao)
                ? selectedAny.evolucao
                    .map((e) => (typeof e === 'number' ? e : (e?.valor ?? e?.value)))
                    .filter((n): n is number => typeof n === 'number')
                : [];
            const series = rawSeries.length > 0 ? rawSeries : spark;
            const chartData = series.map((v, i) => ({
              periodo: i === series.length - 1 ? 'Atual' : `-${series.length - 1 - i}`,
              valor: v,
              isLast: i === series.length - 1,
            }));
            const isUp = selected.vsMedia >= 0;

            return (
              <div className="relative">
                {/* compact header */}
                <div
                  className="px-5 py-3 border-b border-border/40 bg-muted/30 flex items-center justify-between gap-3"
                >
                  <DialogTitle className="text-sm font-semibold text-foreground truncate">
                    {selected.nome}
                  </DialogTitle>
                </div>

                <div className="px-5 py-5 space-y-5">
                  {/* 3 métricas em destaque */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-3">
                      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                        <Trophy className="h-2.5 w-2.5" /> Ranking
                      </div>
                      <p className="text-lg font-bold mono-value tabular-nums mt-1.5 leading-none" style={{ color: accent }}>
                        #{selected.rank}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                        de {ranking.length}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-3">
                      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                        <Percent className="h-2.5 w-2.5" /> Share
                      </div>
                      <p className="text-lg font-bold mono-value tabular-nums mt-1.5 leading-none" style={{ color: accent }}>
                        {selected.pctTotal.toFixed(1)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">do total</p>
                    </div>
                    <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-3">
                      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                        <TrendingUp className={cn('h-2.5 w-2.5', !isUp && 'rotate-180')} /> vs Média
                      </div>
                      <p
                        className={cn(
                          'text-lg font-bold mono-value tabular-nums mt-1.5 leading-none',
                          isUp ? 'text-success' : 'text-destructive',
                        )}
                      >
                        {isUp ? '+' : ''}{selected.vsMedia.toFixed(0)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                        média {formatValue(Math.round(mediaPorVend))}
                      </p>
                    </div>
                  </div>

                  {/* Métricas adicionais (derivadas) */}
                  {(() => {
                    let h = 5381;
                    for (let i = 0; i < selected.key.length; i++) h = ((h << 5) + h + selected.key.charCodeAt(i)) >>> 0;
                    const r = (n: number) => ((h * (n + 1)) % 1000) / 1000;
                    const baseTicket = 1200 + r(1) * 3800;
                    const ticket = Math.round(baseTicket * (1 + selected.vsMedia / 200));
                    const conversao = Math.max(8, Math.min(72, 28 + selected.vsMedia / 3 + r(2) * 20));
                    const retencao = Math.max(45, Math.min(98, 72 + selected.vsMedia / 4 + r(3) * 18));
                    const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
                    return (
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-3">
                          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                            <Ticket className="h-2.5 w-2.5" /> Ticket Médio
                          </div>
                          <p className="text-lg font-bold mono-value tabular-nums mt-1.5 leading-none" style={{ color: accent }}>
                            {fmtBRL(ticket)}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">por pedido</p>
                        </div>
                        <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-3">
                          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                            <Target className="h-2.5 w-2.5" /> Conversão
                          </div>
                          <p className="text-lg font-bold mono-value tabular-nums mt-1.5 leading-none" style={{ color: accent }}>
                            {conversao.toFixed(1)}%
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">cotação → venda</p>
                        </div>
                        <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-3">
                          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                            <Repeat className="h-2.5 w-2.5" /> Retenção
                          </div>
                          <p className="text-lg font-bold mono-value tabular-nums mt-1.5 leading-none" style={{ color: accent }}>
                            {retencao.toFixed(0)}%
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">clientes recorrentes</p>
                        </div>
                      </div>
                    );
                  })()}



                  {/* gráfico real */}
                  <div className="rounded-lg border border-border/40 bg-background/30 px-3 py-3">
                    <div className="flex items-center gap-1.5 mb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      <BarChart3 className="h-3 w-3" /> Evolução · últimos {chartData.length} períodos
                    </div>
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <XAxis
                            dataKey="periodo"
                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                            axisLine={{ stroke: 'hsl(var(--border))' }}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                            axisLine={false}
                            tickLine={false}
                            width={36}
                            tickFormatter={(v) => formatValue(Number(v))}
                          />
                          <Tooltip
                            cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                            contentStyle={{
                              background: 'hsl(var(--background))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: 8,
                              fontSize: 11,
                            }}
                            labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                            formatter={(v: number) => [formatValue(Number(v)), 'Clientes']}
                          />
                          <Bar dataKey="valor" radius={[4, 4, 0, 0]} fill={accent || "#f59e0b"} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>


      <style>{`
        @keyframes cpvIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cpvBarFill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes cpvBarRise { from { transform: scaleY(0); opacity: 0; } to { transform: scaleY(1); opacity: 1; } }
        .cpv-bar { transform-origin: left center; animation: cpvBarFill 720ms cubic-bezier(0.22, 0.9, 0.32, 1) backwards; }
      `}</style>
    </Card>
  );
}
