import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Users, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Minus, Trophy, AlertTriangle, Search, ArrowUp, ArrowDown, Sparkles,
} from 'lucide-react';
import { formatCurrency, formatInteger, formatPercent } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { Pedido, Devolucao } from '@/types/comercial';

interface Props {
  pedidos: Pedido[];
  devolucoes: Devolucao[];
  onSelectVendedor?: (nome: string) => void;
}

type SortKey =
  | 'rank' | 'nome' | 'faturamentoAtual' | 'faturamentoAnterior'
  | 'deltaPct' | 'pedidosAtual' | 'ticketAtual' | 'devolucoesAtual';

type FilterMode = 'todos' | 'cresceu' | 'caiu' | 'ativos';

interface Row {
  codigo: string;
  nome: string;
  faturamentoAtual: number;
  faturamentoAnterior: number;
  deltaAbs: number;
  deltaPct: number;
  pedidosAtual: number;
  pedidosAnterior: number;
  deltaPedidosPct: number;
  ticketAtual: number;
  ticketAnterior: number;
  deltaTicketPct: number;
  devolucoesAtual: number;
  devolucoesAnterior: number;
  deltaDevolucoesPct: number;
  rankAtual: number;
  rankAnterior: number;
  deltaRank: number;
  status: 'novo' | 'inativo' | 'ascensao' | 'queda' | 'estavel';
}

interface MetaResumo {
  periodoAnterior: { inicio: string; fim: string; dias: number };
  periodoAtual: { inicio: string; fim: string; dias: number };
  totalColaboradores: number;
  cresceram: number;
  mediaEvolucao: number;
  maiorEvolucao?: Row;
  maiorQueda?: Row;
}

function getOptionalString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return value == null ? '' : String(value);
}

function getOptionalNumber(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateKey(p: Pedido): string {
  return (p.data_faturamento || p.data_pedido || '').toString().slice(0, 10);
}

function devolucaoDateKey(d: Devolucao): string {
  const candidato = getOptionalString(d, 'data_devolucao') || d.data || getOptionalString(d, 'data_pedido');
  return candidato.toString().slice(0, 10);
}

function pct(atual: number, anterior: number): number {
  if (anterior === 0) return atual > 0 ? 100 : 0;
  return ((atual - anterior) / anterior) * 100;
}

function StatusBadge({ status }: { status: Row['status'] }) {
  const cfg = {
    ascensao: { label: 'Em ascensão', cls: 'border-emerald-500/40 text-emerald-500 bg-emerald-500/10', icon: TrendingUp },
    queda: { label: 'Em queda', cls: 'border-rose-500/40 text-rose-500 bg-rose-500/10', icon: TrendingDown },
    estavel: { label: 'Estável', cls: 'border-border/50 text-muted-foreground bg-muted/40', icon: Minus },
    novo: { label: 'Novo', cls: 'border-primary/40 text-primary bg-primary/10', icon: Sparkles },
    inativo: { label: 'Inativo', cls: 'border-amber-500/40 text-amber-500 bg-amber-500/10', icon: AlertTriangle },
  }[status];
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn('text-[10px] font-bold uppercase tracking-wider gap-1', cfg.cls)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

function DeltaCell({ value, invert = false, suffix = '%' }: { value: number; invert?: boolean; suffix?: string }) {
  const positivo = value >= 0;
  // invert: para devoluções, queda (negativo) é bom
  const isGood = invert ? !positivo : positivo;
  const Icon = positivo ? ArrowUpRight : ArrowDownRight;
  if (Math.abs(value) < 0.05) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground tabular-nums">
        <Minus className="h-3 w-3" />
        0{suffix}
      </span>
    );
  }
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[11px] font-bold tabular-nums',
      isGood ? 'text-emerald-500' : 'text-rose-500'
    )}>
      <Icon className="h-3 w-3" />
      {positivo ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  );
}

export function ComparativoColaboradoresTable({ pedidos, devolucoes, onSelectVendedor }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('deltaPct');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filter, setFilter] = useState<FilterMode>('todos');
  const [search, setSearch] = useState('');

  const { rows, metaResumo } = useMemo(() => {
    if (!pedidos.length) {
      return { rows: [] as Row[], metaResumo: null as MetaResumo | null };
    }

    // Detecta janela do período: min/max de datas presentes em pedidos
    const datas = pedidos.map(dateKey).filter(Boolean).sort();
    if (datas.length === 0) return { rows: [], metaResumo: null };

    const minStr = datas[0];
    const maxStr = datas[datas.length - 1];
    const min = new Date(minStr + 'T00:00:00');
    const max = new Date(maxStr + 'T00:00:00');
    const totalDias = Math.floor((max.getTime() - min.getTime()) / 86400000) + 1;
    const metade = Math.max(1, Math.floor(totalDias / 2));

    // Divide em 1ª metade (anterior) × 2ª metade (atual)
    const corte = new Date(min.getTime() + metade * 86400000);
    const corteStr = corte.toISOString().slice(0, 10);

    const inicioAnterior = minStr;
    const fimAnterior = new Date(corte.getTime() - 86400000).toISOString().slice(0, 10);
    const inicioAtual = corteStr;
    const fimAtual = maxStr;

    type Bucket = { faturamento: number; pedidos: Set<string>; nome: string };
    const atual: Record<string, Bucket> = {};
    const anterior: Record<string, Bucket> = {};

    pedidos.forEach(p => {
      if (p.tipo === 'DEVOLUCAO') return;
      const d = dateKey(p);
      if (!d) return;
      const cod = String(p.vendedor_codigo ?? p.vendedor_nome ?? '—');
      const nome = (p.vendedor_nome || cod).toString().trim();
      const valor = p.valor_liquido || 0;
      const numPed = String(p.numero_pedido ?? p.numero ?? `${cod}-${d}-${valor}`);
      const target = d >= inicioAtual ? atual : (d <= fimAnterior ? anterior : atual);
      if (!target[cod]) target[cod] = { faturamento: 0, pedidos: new Set(), nome };
      target[cod].faturamento += valor;
      target[cod].pedidos.add(numPed);
      if (!target[cod].nome && nome) target[cod].nome = nome;
    });

    // Devoluções por vendedor (se houver campo)
    const devAtual: Record<string, number> = {};
    const devAnterior: Record<string, number> = {};
    devolucoes.forEach(d => {
      const dt = devolucaoDateKey(d);
      const cod = String(d.vendedor_codigo ?? d.vendedor_nome ?? '—');
      const valor = getOptionalNumber(d, 'valor_liquido') ?? getOptionalNumber(d, 'valor') ?? 0;
      if (!dt) return;
      const target = dt >= inicioAtual ? devAtual : (dt <= fimAnterior ? devAnterior : devAtual);
      target[cod] = (target[cod] || 0) + valor;
    });

    const todos = new Set<string>([...Object.keys(atual), ...Object.keys(anterior)]);

    // Ranking baseado em faturamento
    const rankFromBucket = (b: Record<string, Bucket>): Record<string, number> => {
      const ordenados = Object.entries(b)
        .map(([cod, v]) => ({ cod, total: v.faturamento }))
        .sort((a, b) => b.total - a.total);
      const map: Record<string, number> = {};
      ordenados.forEach((r, i) => { map[r.cod] = i + 1; });
      return map;
    };
    const rankAtual = rankFromBucket(atual);
    const rankAnt = rankFromBucket(anterior);

    const built: Row[] = Array.from(todos).map(cod => {
      const a = atual[cod];
      const ant = anterior[cod];
      const faturamentoAtual = a?.faturamento ?? 0;
      const faturamentoAnterior = ant?.faturamento ?? 0;
      const pedidosAtual = a?.pedidos.size ?? 0;
      const pedidosAnterior = ant?.pedidos.size ?? 0;
      const ticketAtual = pedidosAtual > 0 ? faturamentoAtual / pedidosAtual : 0;
      const ticketAnterior = pedidosAnterior > 0 ? faturamentoAnterior / pedidosAnterior : 0;
      const devA = devAtual[cod] ?? 0;
      const devB = devAnterior[cod] ?? 0;
      const deltaAbs = faturamentoAtual - faturamentoAnterior;
      const deltaPct = pct(faturamentoAtual, faturamentoAnterior);
      const nome = (a?.nome || ant?.nome || cod).toString();
      const rAt = rankAtual[cod] ?? 0;
      const rAn = rankAnt[cod] ?? 0;

      let status: Row['status'] = 'estavel';
      if (faturamentoAnterior === 0 && faturamentoAtual > 0) status = 'novo';
      else if (faturamentoAtual === 0 && faturamentoAnterior > 0) status = 'inativo';
      else if (deltaPct >= 15) status = 'ascensao';
      else if (deltaPct <= -15) status = 'queda';

      return {
        codigo: cod,
        nome,
        faturamentoAtual,
        faturamentoAnterior,
        deltaAbs,
        deltaPct,
        pedidosAtual,
        pedidosAnterior,
        deltaPedidosPct: pct(pedidosAtual, pedidosAnterior),
        ticketAtual,
        ticketAnterior,
        deltaTicketPct: pct(ticketAtual, ticketAnterior),
        devolucoesAtual: devA,
        devolucoesAnterior: devB,
        deltaDevolucoesPct: pct(devA, devB),
        rankAtual: rAt,
        rankAnterior: rAn,
        deltaRank: rAn && rAt ? rAn - rAt : 0,
        status,
      };
    });

    // Resumo do time
    const ativos = built.filter(r => r.faturamentoAtual > 0 || r.faturamentoAnterior > 0);
    const cresceram = ativos.filter(r => r.deltaPct > 0);
    const medias = ativos.length > 0
      ? ativos.reduce((s, r) => s + r.deltaPct, 0) / ativos.length
      : 0;
    const top = [...built].sort((a, b) => b.deltaPct - a.deltaPct)[0];
    const bottom = [...built].sort((a, b) => a.deltaPct - b.deltaPct)[0];

    const metaResumo: MetaResumo = {
      periodoAnterior: { inicio: inicioAnterior, fim: fimAnterior, dias: metade },
      periodoAtual: { inicio: inicioAtual, fim: fimAtual, dias: totalDias - metade },
      totalColaboradores: ativos.length,
      cresceram: cresceram.length,
      mediaEvolucao: medias,
      maiorEvolucao: top,
      maiorQueda: bottom,
    };

    return { rows: built, metaResumo };
  }, [pedidos, devolucoes]);

  const rowsFiltradas = useMemo(() => {
    let list = rows;
    if (filter === 'cresceu') list = list.filter(r => r.deltaPct > 0);
    else if (filter === 'caiu') list = list.filter(r => r.deltaPct < 0);
    else if (filter === 'ativos') list = list.filter(r => r.faturamentoAtual > 0);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r => r.nome.toLowerCase().includes(q) || r.codigo.toLowerCase().includes(q));
    }

    const dir = sortDir === 'asc' ? 1 : -1;
    const get = (r: Row): number | string => {
      switch (sortKey) {
        case 'rank': return r.rankAtual || 9999;
        case 'nome': return r.nome.toLowerCase();
        case 'faturamentoAtual': return r.faturamentoAtual;
        case 'faturamentoAnterior': return r.faturamentoAnterior;
        case 'deltaPct': return r.deltaPct;
        case 'pedidosAtual': return r.pedidosAtual;
        case 'ticketAtual': return r.ticketAtual;
        case 'devolucoesAtual': return r.devolucoesAtual;
      }
    };
    return [...list].sort((a, b) => {
      const va = get(a); const vb = get(b);
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb) * dir;
      return ((va as number) - (vb as number)) * dir;
    });
  }, [rows, filter, search, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir(k === 'nome' ? 'asc' : 'desc'); }
  };

  const SortHeader = ({ k, children, align = 'left' }: { k: SortKey; children: React.ReactNode; align?: 'left' | 'right' | 'center' }) => (
    <th
      onClick={() => toggleSort(k)}
      className={cn(
        'px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center'
      )}
    >
      <span className={cn('inline-flex items-center gap-1', align === 'right' && 'justify-end w-full')}>
        {children}
        {sortKey === k && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </span>
    </th>
  );

  return (
    <Card className="relative overflow-hidden border border-border/60 bg-card">
      <CardHeader className="relative pb-3 flex flex-row items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base font-bold tracking-tight flex items-center gap-2 flex-wrap">
              Evolução por Colaborador
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider border-primary/40 text-primary bg-primary/10">
                Comparativo de períodos
              </Badge>
            </CardTitle>
            <CardDescription className="text-[11px] mt-0.5">
              {metaResumo
                ? `2ª metade (${metaResumo.periodoAtual.dias}d · ${metaResumo.periodoAtual.inicio.split('-').reverse().join('/')} → ${metaResumo.periodoAtual.fim.split('-').reverse().join('/')}) vs 1ª metade (${metaResumo.periodoAnterior.dias}d · ${metaResumo.periodoAnterior.inicio.split('-').reverse().join('/')} → ${metaResumo.periodoAnterior.fim.split('-').reverse().join('/')})`
                : 'Sem dados no período selecionado'}
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar colaborador..."
              className="h-8 pl-7 text-xs w-48 bg-background/40 border-border/40"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
            {([
              { id: 'todos', label: 'Todos' },
              { id: 'cresceu', label: 'Cresceram' },
              { id: 'caiu', label: 'Caíram' },
              { id: 'ativos', label: 'Ativos' },
            ] as const).map(opt => (
              <button
                key={opt.id}
                onClick={() => setFilter(opt.id)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all',
                  filter === opt.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative">
        {!metaResumo ? (
          <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
            Sem dados para o período.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
              {metaResumo.maiorEvolucao && metaResumo.maiorEvolucao.deltaPct > 0 && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <Trophy className="h-3 w-3 text-emerald-500" /> Maior evolução
                  </div>
                  <div className="text-xs font-bold mt-0.5 truncate" title={metaResumo.maiorEvolucao.nome}>
                    {metaResumo.maiorEvolucao.nome}
                  </div>
                  <div className="text-[11px] text-emerald-500 font-semibold tabular-nums">
                    +{metaResumo.maiorEvolucao.deltaPct.toFixed(1)}% · {formatCurrency(metaResumo.maiorEvolucao.faturamentoAtual, true)}
                  </div>
                </div>
              )}
              {metaResumo.maiorQueda && metaResumo.maiorQueda.deltaPct < 0 && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <TrendingDown className="h-3 w-3 text-rose-500" /> Maior queda
                  </div>
                  <div className="text-xs font-bold mt-0.5 truncate" title={metaResumo.maiorQueda.nome}>
                    {metaResumo.maiorQueda.nome}
                  </div>
                  <div className="text-[11px] text-rose-500 font-semibold tabular-nums">
                    {metaResumo.maiorQueda.deltaPct.toFixed(1)}% · {formatCurrency(metaResumo.maiorQueda.faturamentoAtual, true)}
                  </div>
                </div>
              )}
              <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <Users className="h-3 w-3 text-primary" /> Resumo do time
                </div>
                <div className="text-xs font-bold mt-0.5">
                  {metaResumo.cresceram} de {metaResumo.totalColaboradores} cresceram
                </div>
                <div className={cn(
                  'text-[11px] font-semibold tabular-nums',
                  metaResumo.mediaEvolucao >= 0 ? 'text-emerald-500' : 'text-rose-500'
                )}>
                  Evolução média: {metaResumo.mediaEvolucao >= 0 ? '+' : ''}{metaResumo.mediaEvolucao.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/20 overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0 z-10">
                    <tr className="border-b border-border/40">
                      <SortHeader k="rank">#</SortHeader>
                      <SortHeader k="nome">Colaborador</SortHeader>
                      <SortHeader k="faturamentoAtual" align="right">Faturamento atual</SortHeader>
                      <SortHeader k="faturamentoAnterior" align="right">Anterior</SortHeader>
                      <SortHeader k="deltaPct" align="right">Δ Faturamento</SortHeader>
                      <SortHeader k="pedidosAtual" align="right">Pedidos</SortHeader>
                      <SortHeader k="ticketAtual" align="right">Ticket médio</SortHeader>
                      <SortHeader k="devolucoesAtual" align="right">Devoluções</SortHeader>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsFiltradas.length === 0 ? (
                      <tr><td colSpan={9} className="text-center text-xs text-muted-foreground py-8">Nenhum colaborador encontrado com os filtros aplicados.</td></tr>
                    ) : rowsFiltradas.map((r, idx) => {
                      const rankChange = r.deltaRank;
                      const interativa = !!onSelectVendedor;
                      return (
                        <tr
                          key={r.codigo}
                          onClick={() => onSelectVendedor?.(r.nome)}
                          className={cn(
                            'border-b border-border/20 transition-colors',
                            interativa && 'cursor-pointer hover:bg-primary/5',
                            idx % 2 === 0 && 'bg-background/10'
                          )}
                        >
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold tabular-nums w-5 text-right">{r.rankAtual || '—'}</span>
                              {r.rankAnterior > 0 && rankChange !== 0 && (
                                <span className={cn(
                                  'text-[9px] font-bold inline-flex items-center gap-0.5 tabular-nums',
                                  rankChange > 0 ? 'text-emerald-500' : 'text-rose-500'
                                )}>
                                  {rankChange > 0 ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                                  {Math.abs(rankChange)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-bold">{r.nome.slice(0, 2).toUpperCase()}</span>
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold truncate max-w-[200px]" title={r.nome}>{r.nome}</div>
                                <div className="text-[10px] text-muted-foreground tabular-nums">cód. {r.codigo}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            <div className="text-xs font-bold">{formatCurrency(r.faturamentoAtual, true)}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            <div className="text-xs text-muted-foreground">{formatCurrency(r.faturamentoAnterior, true)}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <DeltaCell value={r.deltaPct} />
                              <span className={cn('text-[10px] tabular-nums', r.deltaAbs >= 0 ? 'text-emerald-500/80' : 'text-rose-500/80')}>
                                {r.deltaAbs >= 0 ? '+' : ''}{formatCurrency(r.deltaAbs, true)}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-xs font-semibold tabular-nums">{formatInteger(r.pedidosAtual)}</span>
                              <DeltaCell value={r.deltaPedidosPct} />
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-xs font-semibold tabular-nums">{formatCurrency(r.ticketAtual, true)}</span>
                              <DeltaCell value={r.deltaTicketPct} />
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-xs font-semibold tabular-nums">{formatCurrency(r.devolucoesAtual, true)}</span>
                              <DeltaCell value={r.deltaDevolucoesPct} invert />
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <StatusBadge status={r.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              Comparação: 2ª metade do período (atual) vs 1ª metade (anterior) · clique no cabeçalho para ordenar
              {onSelectVendedor ? ' · clique numa linha para detalhar' : ''}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
