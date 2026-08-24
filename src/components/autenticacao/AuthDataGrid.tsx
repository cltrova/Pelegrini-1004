import { useMemo, useState } from 'react';
import { ArrowUpDown, Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import { StatusBadge, statusLabel } from './StatusBadge';
import type { AutenticacaoStatus, ResultadoComparacao } from '@/utils/autenticacaoComparator';

interface Props {
  data: ResultadoComparacao[];
  onRowClick: (r: ResultadoComparacao) => void;
}

const STATUS_OPTIONS: { key: AutenticacaoStatus | 'todos'; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'autenticado', label: 'Autenticados' },
  { key: 'divergente', label: 'Divergentes' },
  { key: 'nao_encontrado', label: 'Não encontrados' },
  { key: 'extra_sistema', label: 'Extras' },
];

type SortKey = 'numero' | 'cliente' | 'planilha' | 'sistema' | 'status';

export function AuthDataGrid({ data, onRowClick }: Props) {
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<AutenticacaoStatus | 'todos'>('todos');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'status', dir: 'asc' });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return data.filter((r) => {
      if (filtro !== 'todos' && r.status !== filtro) return false;
      if (q) {
        const blob = `${r.numero_pedido} ${r.cliente_planilha ?? ''} ${r.cliente_sistema ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [data, busca, filtro]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (sort.key) {
        case 'numero': av = a.numero_pedido; bv = b.numero_pedido; break;
        case 'cliente': av = a.cliente_planilha ?? a.cliente_sistema ?? ''; bv = b.cliente_planilha ?? b.cliente_sistema ?? ''; break;
        case 'planilha': av = a.valor_planilha ?? -Infinity; bv = b.valor_planilha ?? -Infinity; break;
        case 'sistema': av = a.valor_sistema ?? -Infinity; bv = b.valor_sistema ?? -Infinity; break;
        case 'status': av = a.status; bv = b.status; break;
      }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageData = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const toggleSort = (k: SortKey) =>
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' }));

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: data.length };
    for (const r of data) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [data]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden animate-fade-in">
      <div className="p-4 md:p-5 border-b border-border/60 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar pedido, cliente..."
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPage(0); }}
              className="pl-9 h-10 rounded-xl"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {sorted.length} de {data.length} registros
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((opt) => {
            const active = filtro === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => { setFiltro(opt.key); setPage(0); }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                  active
                    ? 'bg-foreground text-background shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {opt.label}
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', active ? 'bg-background/20' : 'bg-background/70')}>
                  {counts[opt.key] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr className="text-xs uppercase tracking-wide text-muted-foreground">
              <Th onClick={() => toggleSort('numero')} active={sort.key === 'numero'}>Pedido</Th>
              <Th onClick={() => toggleSort('cliente')} active={sort.key === 'cliente'}>Cliente</Th>
              <Th onClick={() => toggleSort('planilha')} active={sort.key === 'planilha'} align="right">Planilha</Th>
              <Th onClick={() => toggleSort('sistema')} active={sort.key === 'sistema'} align="right">Sistema</Th>
              <Th onClick={() => toggleSort('status')} active={sort.key === 'status'}>Status</Th>
              <th className="text-left font-semibold px-4 py-3">Divergência</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {pageData.map((r, i) => (
              <tr
                key={`${r.numero_pedido}-${i}`}
                className="group hover:bg-muted/40 transition-colors cursor-pointer"
                onClick={() => onRowClick(r)}
              >
                <td className="px-4 py-3 font-mono text-xs text-foreground">{r.numero_pedido}</td>
                <td className="px-4 py-3 max-w-[260px] truncate">{r.cliente_planilha || r.cliente_sistema || '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.valor_planilha !== undefined ? formatCurrency(r.valor_planilha) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.valor_sistema !== undefined ? formatCurrency(r.valor_sistema) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-[320px] truncate">
                  {r.divergencias.join(' · ') || '—'}
                </td>
                <td className="px-2 py-3 text-right">
                  <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </td>
              </tr>
            ))}
            {!pageData.length && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum registro corresponde aos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/20">
        <div className="text-xs text-muted-foreground">
          Mostrando {pageData.length ? safePage * pageSize + 1 : 0}–{safePage * pageSize + pageData.length} de {sorted.length}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
            className="h-8 rounded-lg border border-border bg-card px-2 text-xs"
          >
            {[25, 50, 100, 250].map((n) => <option key={n} value={n}>{n} por página</option>)}
          </select>
          <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {safePage + 1} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  align = 'left',
}: { children: React.ReactNode; onClick: () => void; active: boolean; align?: 'left' | 'right' }) {
  return (
    <th
      onClick={onClick}
      className={cn(
        'px-4 py-3 font-semibold cursor-pointer select-none whitespace-nowrap',
        align === 'right' ? 'text-right' : 'text-left',
        active && 'text-foreground',
      )}
    >
      <span className={cn('inline-flex items-center gap-1', align === 'right' && 'justify-end')}>
        {children}
        <ArrowUpDown className={cn('h-3 w-3 transition', active ? 'opacity-100' : 'opacity-40')} />
      </span>
    </th>
  );
}
