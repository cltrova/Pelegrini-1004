import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ClienteAnalytics, DuplicataAgregada, ClassificacaoCliente, PedidoAberto } from '@/types/resumo';
import { formatCurrency, formatInteger, formatPercent } from '@/utils/formatters';
import { Search, ArrowUp, ArrowDown, ArrowUpDown, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  clientes: ClienteAnalytics[];
  duplicatas: DuplicataAgregada[];
  pedidos?: PedidoAberto[];
  empresas?: string[];
}

const CLASS_COLORS: Record<ClassificacaoCliente, string> = {
  EXCELENTE: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  BOM: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
  ATENCAO: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  CRITICO: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
};

const CLASS_LABELS: Record<ClassificacaoCliente, string> = {
  EXCELENTE: 'Excelente',
  BOM: 'Bom Pagador',
  ATENCAO: 'Atenção',
  CRITICO: 'Crítico',
};

type SortKey =
  | 'cliente'
  | 'pontualidadeScore'
  | 'totalEmAberto'
  | 'totalAVencer'
  | 'totalVencido'
  | 'totalRecebido'
  | 'percentualNoPrazo'
  | 'atrasoMedioHistorico';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'todos' | 'pago' | 'a_vencer' | 'vence_hoje' | 'vencida';
type AtrasoFilter = 'todos' | 'sem_atraso' | '1_30' | '31_60' | '61_90' | '90_mais';

interface ClienteRow extends ClienteAnalytics {
  // valores recalculados conforme filtros aplicados
  fEmAberto: number;        // pedidos não faturados
  fAVencer: number;         // duplicatas faturadas a vencer (não vencidas, não pagas)
  fVencido: number;         // duplicatas faturadas vencidas
  fRecebido: number;        // duplicatas pagas
  fQtdDuplicatas: number;
  fQtdPagas: number;
  fQtdVencidas: number;
  fQtdPedidos: number;
}

export function AnaliseClienteTab({ clientes, duplicatas, pedidos = [], empresas = [] }: Props) {
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState<ClassificacaoCliente | 'TODOS'>('TODOS');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [empresaFilter, setEmpresaFilter] = useState<string>('todas');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [atrasoFilter, setAtrasoFilter] = useState<AtrasoFilter>('todos');
  const [sortKey, setSortKey] = useState<SortKey>('totalAVencer');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<ClienteAnalytics | null>(null);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'cliente' ? 'asc' : 'desc');
    }
  };

  // Pré-filtro de duplicatas conforme filtros (status, empresa, período, atraso)
  const dupsFiltradas = useMemo(() => {
    const inicio = dataInicio ? new Date(dataInicio).getTime() : null;
    const fim = dataFim ? new Date(dataFim).getTime() : null;

    return duplicatas.filter((d) => {
      if (statusFilter !== 'todos' && d.situacao !== statusFilter) return false;
      if (empresaFilter !== 'todas' && !d.empresas.includes(empresaFilter)) return false;
      if (inicio || fim) {
        const t = d.dataVencimento ? new Date(d.dataVencimento).getTime() : null;
        if (!t) return false;
        if (inicio && t < inicio) return false;
        if (fim && t > fim) return false;
      }
      if (atrasoFilter !== 'todos') {
        const a = d.diasAtraso || 0;
        if (atrasoFilter === 'sem_atraso' && a > 0) return false;
        if (atrasoFilter === '1_30' && (a < 1 || a > 30)) return false;
        if (atrasoFilter === '31_60' && (a < 31 || a > 60)) return false;
        if (atrasoFilter === '61_90' && (a < 61 || a > 90)) return false;
        if (atrasoFilter === '90_mais' && a <= 90) return false;
      }
      return true;
    });
  }, [duplicatas, statusFilter, empresaFilter, dataInicio, dataFim, atrasoFilter]);

  // Pedidos só entram na coluna "Em Aberto" se status=todos ou em_aberto, sem filtro de atraso
  // e respeitando filtro de empresa.
  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((p) => {
      // Pedidos em aberto não compõem status pago/vencida/a_vencer/vence_hoje
      if (statusFilter !== 'todos') return false;
      if (atrasoFilter !== 'todos' && atrasoFilter !== 'sem_atraso') return false;
      if (empresaFilter !== 'todas' && p.empresa !== empresaFilter) return false;
      return true;
    });
  }, [pedidos, statusFilter, empresaFilter, atrasoFilter]);

  const hasDupFilter =
    statusFilter !== 'todos' ||
    empresaFilter !== 'todas' ||
    !!dataInicio ||
    !!dataFim ||
    atrasoFilter !== 'todos';

  // Recalcula métricas por cliente
  const filtered = useMemo<ClienteRow[]>(() => {
    const s = search.trim().toLowerCase();

    const dupsPorCliente = new Map<string, DuplicataAgregada[]>();
    for (const d of dupsFiltradas) {
      const key = d.codCliente || d.cliente;
      const arr = dupsPorCliente.get(key) ?? [];
      arr.push(d);
      dupsPorCliente.set(key, arr);
    }

    const pedidosPorCliente = new Map<string, PedidoAberto[]>();
    for (const p of pedidosFiltrados) {
      const key = p.codCliente || p.cliente;
      const arr = pedidosPorCliente.get(key) ?? [];
      arr.push(p);
      pedidosPorCliente.set(key, arr);
    }

    const rows: ClienteRow[] = [];
    for (const c of clientes) {
      if (classFilter !== 'TODOS' && c.classificacao !== classFilter) continue;
      if (s && !`${c.cliente} ${c.codCliente}`.toLowerCase().includes(s)) continue;

      const key = c.codCliente || c.cliente;
      const dups = dupsPorCliente.get(key) ?? [];
      const peds = pedidosPorCliente.get(key) ?? [];

      let fAVencer = 0;
      let fVencido = 0;
      let fRecebido = 0;
      let fQtdPagas = 0;
      let fQtdVencidas = 0;
      for (const d of dups) {
        const v = Math.max(0, Number(d.valor) || 0);
        const r = Math.max(0, Number(d.valorRecebido) || 0);
        if (d.status === 'PAGO') {
          fQtdPagas++;
          fRecebido += r;
        } else if (d.situacao === 'vencida') {
          fQtdVencidas++;
          fVencido += v;
        } else {
          fAVencer += v;
        }
      }
      const fEmAberto = peds.reduce((sum, p) => sum + (Number(p.valor) || 0), 0);

      if (hasDupFilter && dups.length === 0 && peds.length === 0) continue;

      rows.push({
        ...c,
        fEmAberto,
        fAVencer,
        fVencido,
        fRecebido,
        fQtdDuplicatas: dups.length,
        fQtdPagas,
        fQtdVencidas,
        fQtdPedidos: peds.length,
      });
    }

    rows.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === 'cliente') {
        av = (a.cliente || '').toLowerCase();
        bv = (b.cliente || '').toLowerCase();
      } else if (sortKey === 'totalEmAberto') { av = a.fEmAberto; bv = b.fEmAberto; }
      else if (sortKey === 'totalAVencer') { av = a.fAVencer; bv = b.fAVencer; }
      else if (sortKey === 'totalVencido') { av = a.fVencido; bv = b.fVencido; }
      else if (sortKey === 'totalRecebido') { av = a.fRecebido; bv = b.fRecebido; }
      else {
        av = a[sortKey] as number;
        bv = b[sortKey] as number;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return rows;
  }, [clientes, dupsFiltradas, pedidosFiltrados, search, classFilter, sortKey, sortDir, hasDupFilter]);

  const counts = useMemo(() => {
    const c: Record<ClassificacaoCliente, number> = {
      EXCELENTE: 0, BOM: 0, ATENCAO: 0, CRITICO: 0,
    };
    for (const cl of clientes) c[cl.classificacao]++;
    return c;
  }, [clientes]);

  const totalAbertoGeral = clientes.reduce((s, c) => s + c.totalAberto, 0);
  const top10 = [...clientes].sort((a, b) => b.totalAberto - a.totalAberto).slice(0, 10);
  const concentracaoTop10 = totalAbertoGeral > 0
    ? (top10.reduce((s, c) => s + c.totalAberto, 0) / totalAbertoGeral) * 100
    : 0;

  const resetFilters = () => {
    setSearch('');
    setClassFilter('TODOS');
    setStatusFilter('todos');
    setEmpresaFilter('todas');
    setDataInicio('');
    setDataFim('');
    setAtrasoFilter('todos');
  };

  const hasAnyFilter =
    search || classFilter !== 'TODOS' || hasDupFilter;

  return (
    <div className="space-y-4">
      {/* Sumário de classificação */}
      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <ClassButton
            label="Todos"
            count={clientes.length}
            percent={null}
            active={classFilter === 'TODOS'}
            onClick={() => setClassFilter('TODOS')}
            className="bg-muted/50 text-foreground border-border"
          />
          {(Object.keys(CLASS_LABELS) as ClassificacaoCliente[]).map((k) => (
            <ClassButton
              key={k}
              label={CLASS_LABELS[k]}
              count={counts[k]}
              percent={clientes.length > 0 ? (counts[k] / clientes.length) * 100 : 0}
              active={classFilter === k}
              onClick={() => setClassFilter(k)}
              className={CLASS_COLORS[k]}
            />
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground font-mono flex flex-wrap gap-x-4 gap-y-1">
          <span>
            <Users className="inline h-3 w-3 mr-1" />
            {formatInteger(filtered.length)} de {formatInteger(clientes.length)} clientes
          </span>
          <span>
            Concentração Top 10:{' '}
            <span className="text-foreground font-semibold">{formatPercent(concentracaoTop10)}</span> da carteira em aberto
          </span>
        </div>
      </Card>

      {/* Filtros */}
      <Card className="p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="a_vencer">A vencer</SelectItem>
              <SelectItem value="vence_hoje">Vence hoje</SelectItem>
              <SelectItem value="vencida">Vencidas</SelectItem>
              <SelectItem value="pago">Pagas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Filial" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as filiais</SelectItem>
              {empresas.map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={atrasoFilter} onValueChange={(v) => setAtrasoFilter(v as AtrasoFilter)}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Dias atraso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Qualquer atraso</SelectItem>
              <SelectItem value="sem_atraso">Sem atraso</SelectItem>
              <SelectItem value="1_30">1 a 30 dias</SelectItem>
              <SelectItem value="31_60">31 a 60 dias</SelectItem>
              <SelectItem value="61_90">61 a 90 dias</SelectItem>
              <SelectItem value="90_mais">+90 dias</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="h-9 w-[150px]"
              title="Vencimento de"
            />
            <span className="text-xs text-muted-foreground">até</span>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="h-9 w-[150px]"
              title="Vencimento até"
            />
          </div>

          {hasAnyFilter && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9">
              <X className="h-4 w-4 mr-1" /> Limpar
            </Button>
          )}
        </div>
      </Card>

      {/* Tabela */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-14 gap-2 px-4 py-3 bg-muted/40 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground" style={{ gridTemplateColumns: '3fr 0.7fr 1.4fr 1.4fr 1.4fr 1.4fr 0.8fr 0.8fr' }}>
          <SortHeader align="left" label="Cliente" colKey="cliente" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
          <SortHeader align="center" label="Score" colKey="pontualidadeScore" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
          <SortHeader align="right" label="Em Aberto" colKey="totalEmAberto" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
          <SortHeader align="right" label="Fat. a Vencer" colKey="totalAVencer" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
          <SortHeader align="right" label="Fat. Vencido" colKey="totalVencido" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
          <SortHeader align="right" label="Recebido" colKey="totalRecebido" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
          <SortHeader align="right" label="% No prazo" colKey="percentualNoPrazo" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
          <SortHeader align="right" label="Atraso méd." colKey="atrasoMedioHistorico" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
        </div>
        <div className="divide-y divide-border max-h-[640px] overflow-y-auto">
          {filtered.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
          )}
          {filtered.map((c) => (
            <button
              key={c.codCliente || c.cliente}
              onClick={() => setSelected(c)}
              className="w-full text-left grid gap-2 px-4 py-3 hover:bg-muted/40 transition-colors items-center"
              style={{ gridTemplateColumns: '3fr 0.7fr 1.4fr 1.4fr 1.4fr 1.4fr 0.8fr 0.8fr' }}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{c.cliente || '—'}</div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  {formatInteger(c.fQtdPedidos)} ped · {formatInteger(c.fQtdDuplicatas)} dup · {formatInteger(c.fQtdPagas)} pagas · {formatInteger(c.fQtdVencidas)} venc
                </div>
              </div>
              <div className="flex justify-center">
                <ScoreBadge score={c.pontualidadeScore} classificacao={c.classificacao} />
              </div>
              <div className={cn('text-right font-mono text-sm tabular-nums', c.fEmAberto > 0 && 'text-sky-600 dark:text-sky-400')}>
                {formatCurrency(c.fEmAberto)}
              </div>
              <div className={cn('text-right font-mono text-sm tabular-nums', c.fAVencer > 0 && 'text-foreground font-medium')}>
                {formatCurrency(c.fAVencer)}
              </div>
              <div className={cn('text-right font-mono text-sm tabular-nums', c.fVencido > 0 && 'text-rose-600 dark:text-rose-400 font-semibold')}>
                {formatCurrency(c.fVencido)}
              </div>
              <div className={cn('text-right font-mono text-sm tabular-nums', c.fRecebido > 0 && 'text-emerald-600 dark:text-emerald-400')}>
                {formatCurrency(c.fRecebido)}
              </div>
              <div className="text-right text-xs font-mono text-muted-foreground tabular-nums">
                {formatPercent(c.percentualNoPrazo)}
              </div>
              <div className="text-right text-xs font-mono text-muted-foreground tabular-nums">
                {formatInteger(c.atrasoMedioHistorico)}d
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Drawer de detalhe */}
      <ClienteDetalheDrawer
        cliente={selected}
        duplicatas={duplicatas}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function ClassButton({
  label, count, percent, active, onClick, className,
}: { label: string; count: number; percent: number | null; active: boolean; onClick: () => void; className: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'p-3 rounded-md border text-left transition-all',
        className,
        active ? 'ring-2 ring-offset-2 ring-foreground/30 ring-offset-background' : 'opacity-80 hover:opacity-100',
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <div className="font-mono text-2xl font-bold tabular-nums">{formatInteger(count)}</div>
        {percent !== null && (
          <div className="font-mono text-xs font-semibold tabular-nums opacity-80">
            {percent.toFixed(1)}%
          </div>
        )}
      </div>
    </button>
  );
}

function SortHeader({
  label, colKey, sortKey, sortDir, onClick, className, align,
}: {
  label: string;
  colKey: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onClick: (key: SortKey) => void;
  className?: string;
  align: 'left' | 'center' | 'right';
}) {
  const active = sortKey === colKey;
  const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onClick(colKey)}
      className={cn(
        'flex items-center gap-1 hover:text-foreground transition-colors',
        justify,
        active && 'text-foreground',
        className,
      )}
    >
      <span>{label}</span>
      <Icon className={cn('h-3 w-3', active ? 'opacity-100' : 'opacity-40')} />
    </button>
  );
}

function ScoreBadge({ score, classificacao }: { score: number; classificacao: ClassificacaoCliente }) {
  return (
    <div
      className={cn(
        'flex size-10 rounded items-center justify-center font-mono font-bold text-sm border',
        CLASS_COLORS[classificacao],
      )}
      title={`${CLASS_LABELS[classificacao]} (${score}/100)`}
    >
      {score}
    </div>
  );
}

/* ============== Drawer ============== */

function ClienteDetalheDrawer({
  cliente, duplicatas, onClose,
}: { cliente: ClienteAnalytics | null; duplicatas: DuplicataAgregada[]; onClose: () => void }) {
  const open = !!cliente;

  const dupsCliente = useMemo(() => {
    if (!cliente) return [];
    return duplicatas
      .filter((d) => (d.codCliente || d.cliente) === (cliente.codCliente || cliente.cliente))
      .sort((a, b) => {
        const da = a.dataVencimento ? new Date(a.dataVencimento).getTime() : 0;
        const db = b.dataVencimento ? new Date(b.dataVencimento).getTime() : 0;
        return db - da;
      });
  }, [cliente, duplicatas]);

  if (!cliente) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-1">
              Perfil de Cliente
            </div>
            <div className="text-xl font-medium">{cliente.cliente || '—'}</div>
          </SheetTitle>
        </SheetHeader>

        {/* Score Hero */}
        <div className={cn('mt-5 p-5 rounded-lg border', CLASS_COLORS[cliente.classificacao])}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">Classificação</div>
              <div className="text-lg font-semibold mt-0.5">{CLASS_LABELS[cliente.classificacao]}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">Score</div>
              <div className="font-mono text-4xl font-bold tabular-nums">{cliente.pontualidadeScore}</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 bg-background/40 rounded-full overflow-hidden">
            <div className="h-full bg-current rounded-full" style={{ width: `${cliente.pontualidadeScore}%` }} />
          </div>
        </div>

        {/* Métricas-chave */}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <Metric label="Em aberto" value={formatCurrency(cliente.totalAberto)} />
          <Metric label="Vencido" value={formatCurrency(cliente.totalVencido)} tone="bad" />
          <Metric label="Recebido (histórico)" value={formatCurrency(cliente.totalRecebido)} tone="ok" />
          <Metric label="Maior atraso" value={`${formatInteger(cliente.maiorAtraso)} dias`} />
          <Metric label="% Pagas no prazo" value={formatPercent(cliente.percentualNoPrazo)} />
          <Metric label="Atraso médio histórico" value={`${formatInteger(cliente.atrasoMedioHistorico)} dias`} />
        </div>

        {/* Comparativo prazo acordado vs real */}
        <div className="mt-5 p-4 rounded-lg bg-muted/40 border border-border">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Prazo Acordado vs Real
          </div>
          <PrazoBar label="Acordado" value={cliente.prazoMedioAcordado} max={Math.max(cliente.prazoMedioAcordado, cliente.prazoMedioReal, 1)} />
          <div className="h-2" />
          <PrazoBar
            label="Real"
            value={cliente.prazoMedioReal}
            max={Math.max(cliente.prazoMedioAcordado, cliente.prazoMedioReal, 1)}
            tone={cliente.prazoMedioReal > cliente.prazoMedioAcordado ? 'bad' : 'ok'}
          />
          <p className="text-[11px] text-muted-foreground mt-3">
            {cliente.prazoMedioReal > cliente.prazoMedioAcordado
              ? `Cliente paga em média ${formatInteger(cliente.prazoMedioReal - cliente.prazoMedioAcordado)} dias APÓS o vencimento.`
              : cliente.prazoMedioReal < cliente.prazoMedioAcordado && cliente.prazoMedioReal > 0
                ? `Cliente costuma antecipar pagamentos em ${formatInteger(cliente.prazoMedioAcordado - cliente.prazoMedioReal)} dias.`
                : 'Cliente paga próximo da data combinada.'}
          </p>
        </div>

        {/* Timeline */}
        <div className="mt-5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Histórico de Duplicatas ({dupsCliente.length})
          </div>
          <div className="border-l-2 border-border ml-2 pl-4 space-y-3 max-h-[400px] overflow-y-auto">
            {dupsCliente.map((d) => {
              const tone =
                d.situacao === 'pago' ? 'emerald' :
                d.situacao === 'vencida' ? 'rose' :
                d.situacao === 'vence_hoje' ? 'amber' : 'sky';
              return (
                <div key={d.id} className="relative">
                  <div
                    className={cn(
                      'absolute -left-[22px] size-3 rounded-full border-2 border-background',
                      tone === 'emerald' && 'bg-emerald-500',
                      tone === 'rose' && 'bg-rose-500',
                      tone === 'amber' && 'bg-amber-500',
                      tone === 'sky' && 'bg-sky-500',
                    )}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {d.situacao === 'pago' && 'Pago'}
                        {d.situacao === 'vencida' && `Vencido há ${formatInteger(d.diasAtraso)}d`}
                        {d.situacao === 'vence_hoje' && 'Vence hoje'}
                        {d.situacao === 'a_vencer' && 'A vencer'}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        venc {d.dataVencimento ? new Date(d.dataVencimento).toLocaleDateString('pt-BR') : '—'}
                        {d.dataPagamento && ` · pago ${new Date(d.dataPagamento).toLocaleDateString('pt-BR')}`}
                      </div>
                    </div>
                    <div className="text-sm font-mono font-semibold tabular-nums shrink-0">
                      {formatCurrency(d.valor)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'ok' | 'bad' }) {
  return (
    <div className="p-3 rounded-md bg-muted/40 border border-border">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          'font-mono text-sm font-bold mt-1 tabular-nums',
          tone === 'ok' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'bad' && 'text-rose-600 dark:text-rose-400',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function PrazoBar({ label, value, max, tone = 'neutral' }: { label: string; value: number; max: number; tone?: 'neutral' | 'ok' | 'bad' }) {
  const w = (value / max) * 100;
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-xs text-muted-foreground">{label}</div>
      <div className="flex-1 h-2.5 bg-background rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full',
            tone === 'ok' && 'bg-emerald-500',
            tone === 'bad' && 'bg-rose-500',
            tone === 'neutral' && 'bg-sky-500',
          )}
          style={{ width: `${Math.max(w, 2)}%` }}
        />
      </div>
      <div className="w-20 text-right font-mono text-xs font-semibold tabular-nums">
        {formatInteger(value)} dias
      </div>
    </div>
  );
}
