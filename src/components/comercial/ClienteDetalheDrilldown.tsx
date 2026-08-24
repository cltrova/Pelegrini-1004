import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Download, ArrowUpRight, ArrowDownRight, Minus, Package, ShoppingCart, TrendingUp, Calendar } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import { useComercialProdutos } from '@/hooks/useComercialProdutos';
import type { ComercialFilters } from '@/types/comercial';

const C = {
  card: '#111827',
  card2: '#161F32',
  border: 'rgba(148,163,184,0.10)',
  text: '#FFFFFF',
  sub: '#94A3B8',
  rowAlt: 'rgba(148,163,184,0.04)',
  blue: '#3B82F6',
  green: '#10B981',
  amber: '#F59E0B',
  red: '#EF4444',
  cyan: '#06B6D4',
  violet: '#8B5CF6',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: { codigo: string | number; nome: string } | null;
  periodo: { inicio: string; fim: string };
}

function shiftYear(iso: string, years: number) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y + years}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function pct(atual: number, ant: number) {
  if (!ant) return atual > 0 ? 100 : 0;
  return ((atual - ant) / Math.abs(ant)) * 100;
}

function Trend({ value }: { value: number }) {
  const up = value > 1;
  const down = value < -1;
  const color = up ? C.green : down ? C.red : C.sub;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums" style={{ color }}>
      <Icon className="w-3 h-3" />
      {value >= 0 ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

function Kpi({ label, value, sub, icon: Icon, color }: any) {
  return (
    <div
      className="rounded-xl p-3 flex-1 min-w-[140px]"
      style={{ background: C.card2, border: `1px solid ${C.border}` }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-[11px] uppercase tracking-wide" style={{ color: C.sub }}>{label}</span>
      </div>
      <div className="text-lg font-bold tabular-nums" style={{ color: C.text }}>{value}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: C.sub }}>{sub}</div>}
    </div>
  );
}

export function ClienteDetalheDrilldown({ open, onOpenChange, cliente, periodo }: Props) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'atual' | 'delta' | 'produto'>('atual');

  // Amplia o período: mesmo intervalo do ano anterior + período atual
  const periodoAmpliado = useMemo(
    () => ({ inicio: shiftYear(periodo.inicio, -1), fim: periodo.fim }),
    [periodo.inicio, periodo.fim],
  );

  const filters: ComercialFilters = useMemo(
    () => ({ periodo: periodoAmpliado, status: 'todos', cliente: cliente?.codigo }),
    [periodoAmpliado, cliente?.codigo],
  );

  const { produtos, isLoading } = useComercialProdutos(open && cliente ? filters : undefined);

  const anoAtualLabel = periodo.fim.substring(0, 4);
  const anoAntLabel = String(Number(anoAtualLabel) - 1);

  const { rows, totais } = useMemo(() => {
    const map = new Map<string, {
      cod: string | number; nome: string; marca?: string;
      qtdAtual: number; qtdAnt: number; recAtual: number; recAnt: number;
      pedidosAtual: Set<string | number>; pedidosAnt: Set<string | number>;
    }>();

    const inA = periodo.inicio, fA = periodo.fim;
    const inP = shiftYear(inA, -1), fP = shiftYear(fA, -1);

    let recA = 0, recP = 0, qA = 0, qP = 0;
    const pA = new Set<string | number>(), pP = new Set<string | number>();

    (produtos || []).filter(p => String(p.cliente_codigo) === String(cliente?.codigo)).forEach(p => {
      const d = (p.data_faturamento || p.data_pedido || '').substring(0, 10);
      if (!d) return;
      const isAtual = d >= inA && d <= fA;
      const isAnt = d >= inP && d <= fP;
      if (!isAtual && !isAnt) return;

      const key = String(p.cod_produto);
      const ex = map.get(key) || {
        cod: p.cod_produto, nome: p.descricao, marca: p.marca,
        qtdAtual: 0, qtdAnt: 0, recAtual: 0, recAnt: 0,
        pedidosAtual: new Set(), pedidosAnt: new Set(),
      };
      if (isAtual) {
        ex.qtdAtual += p.quantidade; ex.recAtual += p.valor_total;
        if (p.cod_pedido) ex.pedidosAtual.add(p.cod_pedido);
        recA += p.valor_total; qA += p.quantidade;
        if (p.cod_pedido) pA.add(p.cod_pedido);
      }
      if (isAnt) {
        ex.qtdAnt += p.quantidade; ex.recAnt += p.valor_total;
        if (p.cod_pedido) ex.pedidosAnt.add(p.cod_pedido);
        recP += p.valor_total; qP += p.quantidade;
        if (p.cod_pedido) pP.add(p.cod_pedido);
      }
      map.set(key, ex);
    });

    const list = Array.from(map.values()).map(r => ({
      ...r,
      delta: pct(r.recAtual, r.recAnt),
    }));

    return {
      rows: list,
      totais: {
        recAtual: recA, recAnt: recP, qAtual: qA, qAnt: qP,
        pedidosAtual: pA.size, pedidosAnt: pP.size,
        delta: pct(recA, recP),
      },
    };
  }, [produtos, cliente?.codigo, periodo.inicio, periodo.fim]);

  const rowsFiltradas = useMemo(() => {
    const t = search.trim().toLowerCase();
    const filtered = !t ? rows : rows.filter(r =>
      String(r.cod).toLowerCase().includes(t) ||
      r.nome.toLowerCase().includes(t) ||
      (r.marca || '').toLowerCase().includes(t)
    );
    const sorted = [...filtered];
    if (sortKey === 'atual') sorted.sort((a, b) => b.recAtual - a.recAtual);
    else if (sortKey === 'delta') sorted.sort((a, b) => b.delta - a.delta);
    else sorted.sort((a, b) => a.nome.localeCompare(b.nome));
    return sorted;
  }, [rows, search, sortKey]);

  const exportCsv = () => {
    const header = ['Codigo', 'Produto', 'Marca', `Qtde ${anoAntLabel}`, `Qtde ${anoAtualLabel}`, `R$ ${anoAntLabel}`, `R$ ${anoAtualLabel}`, 'Delta %'];
    const lines = [header.join(';')];
    rowsFiltradas.forEach(r => {
      lines.push([
        r.cod, `"${r.nome.replace(/"/g, '""')}"`, r.marca || '',
        r.qtdAnt.toFixed(0), r.qtdAtual.toFixed(0),
        r.recAnt.toFixed(2).replace('.', ','), r.recAtual.toFixed(2).replace('.', ','),
        r.delta.toFixed(1).replace('.', ','),
      ].join(';'));
    });
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cliente-${cliente?.codigo}-comparativo.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[900px] p-0 border-0 overflow-hidden flex flex-col"
        style={{ background: '#0B1220' }}
      >
        <SheetHeader
          className="px-6 py-4 border-b"
          style={{ borderColor: C.border, background: `linear-gradient(140deg, ${C.card} 0%, ${C.card2} 100%)` }}
        >
          <SheetTitle className="text-white">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-[10px]" style={{ borderColor: C.border, color: C.sub }}>
                #{cliente?.codigo}
              </Badge>
              <span className="text-base font-semibold">{cliente?.nome}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs font-normal" style={{ color: C.sub }}>
              <Calendar className="w-3 h-3" />
              Comparativo {anoAntLabel} vs {anoAtualLabel} — período {periodo.inicio.substring(8, 10)}/{periodo.inicio.substring(5, 7)} até {periodo.fim.substring(8, 10)}/{periodo.fim.substring(5, 7)}
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="px-6 py-4 flex flex-wrap gap-2" style={{ borderBottom: `1px solid ${C.border}` }}>
          <Kpi
            label={`Receita ${anoAtualLabel}`}
            value={formatCurrency(totais.recAtual)}
            sub={<>vs {formatCurrency(totais.recAnt)} <Trend value={totais.delta} /></>}
            icon={TrendingUp}
            color={C.green}
          />
          <Kpi
            label="Itens"
            value={totais.qAtual.toLocaleString('pt-BR')}
            sub={`ano anterior: ${totais.qAnt.toLocaleString('pt-BR')}`}
            icon={Package}
            color={C.cyan}
          />
          <Kpi
            label="Pedidos"
            value={totais.pedidosAtual.toLocaleString('pt-BR')}
            sub={`ano anterior: ${totais.pedidosAnt.toLocaleString('pt-BR')}`}
            icon={ShoppingCart}
            color={C.violet}
          />
          <Kpi
            label="Ticket médio"
            value={formatCurrency(totais.pedidosAtual ? totais.recAtual / totais.pedidosAtual : 0)}
            sub={`ano ant: ${formatCurrency(totais.pedidosAnt ? totais.recAnt / totais.pedidosAnt : 0)}`}
            icon={TrendingUp}
            color={C.amber}
          />
        </div>

        <div className="px-6 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.sub }} />
            <Input
              placeholder="Buscar produto ou marca..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 border-0 h-9"
              style={{ background: C.card2, color: C.text, border: `1px solid ${C.border}` }}
            />
          </div>
          <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: C.card2, border: `1px solid ${C.border}` }}>
            {([
              { k: 'atual', l: 'Receita' },
              { k: 'delta', l: 'Δ%' },
              { k: 'produto', l: 'A→Z' },
            ] as const).map(o => (
              <button
                key={o.k}
                onClick={() => setSortKey(o.k)}
                className="px-2.5 py-1 text-[11px] rounded-md transition-all"
                style={{
                  background: sortKey === o.k ? `${C.cyan}22` : 'transparent',
                  color: sortKey === o.k ? C.cyan : C.sub,
                  fontWeight: sortKey === o.k ? 600 : 400,
                }}
              >
                {o.l}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={!rowsFiltradas.length}
            className="h-9 gap-1.5"
            style={{ background: C.card2, borderColor: C.border, color: C.text }}
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="text-center py-12 text-sm" style={{ color: C.sub }}>Carregando itens do cliente…</div>
          ) : rowsFiltradas.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: C.sub }}>
              Nenhum produto encontrado neste período para este cliente.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10" style={{ background: '#0B1220' }}>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th className="text-left py-2 px-2 text-[11px] font-medium uppercase tracking-wide" style={{ color: C.sub }}>Produto</th>
                  <th className="text-right py-2 px-2 text-[11px] font-medium uppercase tracking-wide" style={{ color: C.sub }}>Qtde {anoAntLabel}</th>
                  <th className="text-right py-2 px-2 text-[11px] font-medium uppercase tracking-wide" style={{ color: C.sub }}>Qtde {anoAtualLabel}</th>
                  <th className="text-right py-2 px-2 text-[11px] font-medium uppercase tracking-wide" style={{ color: C.sub }}>R$ {anoAntLabel}</th>
                  <th className="text-right py-2 px-2 text-[11px] font-medium uppercase tracking-wide" style={{ color: C.sub }}>R$ {anoAtualLabel}</th>
                  <th className="text-right py-2 px-2 text-[11px] font-medium uppercase tracking-wide" style={{ color: C.sub }}>Δ%</th>
                </tr>
              </thead>
              <tbody>
                {rowsFiltradas.map((r, idx) => (
                  <tr
                    key={String(r.cod)}
                    style={{
                      background: idx % 2 ? C.rowAlt : 'transparent',
                      borderBottom: `1px solid ${C.border}`,
                    }}
                    className="transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="py-2 px-2">
                      <div className="text-xs font-medium leading-tight" style={{ color: C.text }}>{r.nome}</div>
                      <div className="text-[10px] font-mono mt-0.5" style={{ color: C.sub }}>
                        #{r.cod}{r.marca ? ` · ${r.marca}` : ''}
                      </div>
                    </td>
                    <td className="text-right py-2 px-2 text-xs tabular-nums" style={{ color: C.sub }}>
                      {r.qtdAnt ? r.qtdAnt.toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="text-right py-2 px-2 text-xs font-semibold tabular-nums" style={{ color: C.text }}>
                      {r.qtdAtual ? r.qtdAtual.toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="text-right py-2 px-2 text-xs tabular-nums" style={{ color: C.sub }}>
                      {r.recAnt ? formatCurrency(r.recAnt) : '—'}
                    </td>
                    <td className="text-right py-2 px-2 text-xs font-semibold tabular-nums" style={{ color: C.text }}>
                      {r.recAtual ? formatCurrency(r.recAtual) : '—'}
                    </td>
                    <td className="text-right py-2 px-2"><Trend value={r.delta} /></td>
                  </tr>
                ))}
                <tr style={{ borderTop: `2px solid ${C.border}`, background: C.card2 }}>
                  <td className="py-2 px-2 text-xs font-bold uppercase tracking-wide" style={{ color: C.text }}>Total</td>
                  <td className="text-right py-2 px-2 text-xs font-bold tabular-nums" style={{ color: C.sub }}>
                    {totais.qAnt.toLocaleString('pt-BR')}
                  </td>
                  <td className="text-right py-2 px-2 text-xs font-bold tabular-nums" style={{ color: C.text }}>
                    {totais.qAtual.toLocaleString('pt-BR')}
                  </td>
                  <td className="text-right py-2 px-2 text-xs font-bold tabular-nums" style={{ color: C.sub }}>
                    {formatCurrency(totais.recAnt)}
                  </td>
                  <td className="text-right py-2 px-2 text-xs font-bold tabular-nums" style={{ color: C.text }}>
                    {formatCurrency(totais.recAtual)}
                  </td>
                  <td className="text-right py-2 px-2"><Trend value={totais.delta} /></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
