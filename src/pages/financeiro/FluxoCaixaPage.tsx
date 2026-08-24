import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CollapsibleFilterBar } from '@/components/common/CollapsibleFilterBar';
import { FinanceiroSearchPrompt } from '@/components/financeiro/FinanceiroSearchPrompt';
import { useFinanceiroSearch } from '@/contexts/FinanceiroSearchContext';

import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import {
  ArrowDownCircle, ArrowUpCircle, ChevronDown, Search, Wallet,
  TrendingUp, TrendingDown, Landmark, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFluxoCaixaData, FluxoMovimentoRecord } from '@/hooks/useFluxoCaixaData';
import { formatCurrency, formatCurrencyCompact, formatInteger } from '@/utils/formatters';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';

function fmtDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function dateKey(s: string | null): string {
  if (!s) return '';
  return s.slice(0, 10);
}

function uniq(arr: (string | null | undefined)[]): string[] {
  return Array.from(new Set(arr.filter((x): x is string => !!x && x.trim() !== ''))).sort();
}

interface Filters {
  anos: string[];
  bancos: string[];
  fontes: string[];
  meses: number[];
  semanas: number[];
  dataIni: string;
  dataFim: string;
}

const ANO_ATUAL = new Date().getFullYear();
const EMPTY_FILTERS: Filters = {
  anos: [], bancos: [], fontes: [], meses: [], semanas: [], dataIni: '', dataFim: '',
};

export default function FluxoCaixaPage() {
  const { data, isLoading, error, refetch } = useFluxoCaixaData();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const { hasSearched, markSearched, resetSearch } = useFinanceiroSearch();
  const [isFilterBarOpen, setIsFilterBarOpen] = useState(false);

  const saldos = data?.saldos ?? [];
  const movimentos = data?.movimentos ?? [];

  // Map CodBanco -> Banco (vem dos saldos)
  const bancoMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of saldos) {
      const k = String(s.CodBanco);
      if (s.Banco && !m.has(k)) m.set(k, s.Banco);
    }
    return m;
  }, [saldos]);

  const bancoLabel = (codBanco: number | string) => {
    const k = String(codBanco);
    return bancoMap.get(k) || (k === '0' ? '— sem banco —' : `Banco ${k}`);
  };

  // Options para filtros
  const opts = useMemo(() => {
    const bancosFromSaldos = saldos.map(s => s.Banco);
    const bancosFromMov = movimentos.map(m => bancoLabel(m.CodBanco));
    return {
      bancos: uniq([...bancosFromSaldos, ...bancosFromMov]),
      fontes: uniq(saldos.map(s => s.Fonte)),
      anos: uniq(movimentos.map(m => m.DataVencimento?.slice(0, 4))),
      meses: Array.from(new Set(movimentos.map(m => m.MesVencimento).filter((x): x is number => x != null))).sort((a, b) => a - b),
      semanas: Array.from(new Set(movimentos.map(m => m.SemanaVencimento).filter((x): x is number => x != null))).sort((a, b) => a - b),
    };
  }, [saldos, movimentos, bancoMap]);

  // Filtra saldos (somente Banco e Fonte se aplicam)
  const saldosFiltrados = useMemo(() => {
    return saldos.filter(s => {
      if (filters.bancos.length && !filters.bancos.includes(s.Banco)) return false;
      if (filters.fontes.length && (!s.Fonte || !filters.fontes.includes(s.Fonte))) return false;
      return true;
    });
  }, [saldos, filters.bancos, filters.fontes]);

  // Filtra movimentos
  const movFiltrados = useMemo(() => {
    return movimentos.filter(m => {
      const banco = bancoLabel(m.CodBanco);
      if (filters.bancos.length && !filters.bancos.includes(banco)) return false;
      if (filters.anos.length) {
        const ano = m.DataVencimento?.slice(0, 4);
        if (!ano || !filters.anos.includes(ano)) return false;
      }
      if (filters.meses.length && (m.MesVencimento == null || !filters.meses.includes(m.MesVencimento))) return false;
      if (filters.semanas.length && (m.SemanaVencimento == null || !filters.semanas.includes(m.SemanaVencimento))) return false;
      const k = dateKey(m.DataVencimento);
      if (filters.dataIni && k && k < filters.dataIni) return false;
      if (filters.dataFim && k && k > filters.dataFim) return false;
      return true;
    });
  }, [movimentos, filters, bancoMap]);

  // KPIs
  const kpis = useMemo(() => {
    const saldoInterno = saldosFiltrados.reduce((a, s) => a + (Number(s.SaldoInterno) || 0), 0);
    const saldoConciliado = saldosFiltrados.reduce((a, s) => a + (Number(s.SaldoConciliado) || 0), 0);
    const totalReceber = movFiltrados.reduce((a, m) => a + (Number(m.MovCaixaReceber) || 0), 0);
    const totalPagar = movFiltrados.reduce((a, m) => a + (Number(m.MovCaixaPagar) || 0), 0);
    const diferenca = totalReceber - totalPagar;
    return {
      saldoInterno, saldoConciliado, totalReceber, totalPagar, diferenca,
      diferencaSaldos: saldoInterno - saldoConciliado,
      qtdMov: movFiltrados.length,
      qtdBancos: saldosFiltrados.length,
    };
  }, [saldosFiltrados, movFiltrados]);

  // Série diária do gráfico
  const chartData = useMemo(() => {
    const m = new Map<string, { date: string; Receber: number; Pagar: number }>();
    for (const r of movFiltrados) {
      const k = dateKey(r.DataVencimento);
      if (!k) continue;
      if (!m.has(k)) m.set(k, { date: k, Receber: 0, Pagar: 0 });
      const slot = m.get(k)!;
      slot.Receber += Number(r.MovCaixaReceber) || 0;
      slot.Pagar += Number(r.MovCaixaPagar) || 0;
    }
    return Array.from(m.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ ...d, label: fmtDate(d.date) }));
  }, [movFiltrados]);

  // Matriz Banco x DataVencimento (linhas = banco, valor por data: Rec - Pag)
  const matriz = useMemo(() => {
    const datas = Array.from(new Set(movFiltrados.map(m => dateKey(m.DataVencimento)).filter(Boolean))).sort();
    const bancosSet = Array.from(new Set(movFiltrados.map(m => bancoLabel(m.CodBanco)))).sort();
    type Row = { banco: string; cells: Record<string, { rec: number; pag: number }>; totRec: number; totPag: number };
    const rows: Row[] = bancosSet.map(b => ({ banco: b, cells: {}, totRec: 0, totPag: 0 }));
    const rowsMap = new Map(rows.map(r => [r.banco, r]));
    for (const r of movFiltrados) {
      const b = bancoLabel(r.CodBanco);
      const k = dateKey(r.DataVencimento);
      if (!k) continue;
      const row = rowsMap.get(b)!;
      if (!row.cells[k]) row.cells[k] = { rec: 0, pag: 0 };
      const rec = Number(r.MovCaixaReceber) || 0;
      const pag = Number(r.MovCaixaPagar) || 0;
      row.cells[k].rec += rec;
      row.cells[k].pag += pag;
      row.totRec += rec;
      row.totPag += pag;
    }
    rows.sort((a, b) => (b.totRec + b.totPag) - (a.totRec + a.totPag));
    return { datas, rows };
  }, [movFiltrados, bancoMap]);

  const activeFiltersCount =
    filters.anos.length + filters.bancos.length + filters.fontes.length + filters.meses.length + filters.semanas.length +
    (filters.dataIni ? 1 : 0) + (filters.dataFim ? 1 : 0);

  const filterSummary = useMemo(() => {
    const s: { label: string; value: string | number }[] = [];
    if (filters.anos.length) s.push({ label: 'Ano', value: filters.anos.join(', ') });
    if (filters.bancos.length) s.push({ label: 'Bancos', value: filters.bancos.length });
    if (filters.fontes.length) s.push({ label: 'Fontes', value: filters.fontes.length });
    if (filters.meses.length) s.push({ label: 'Meses', value: filters.meses.length });
    if (filters.semanas.length) s.push({ label: 'Semanas', value: filters.semanas.length });
    if (filters.dataIni || filters.dataFim) s.push({ label: 'Período', value: `${filters.dataIni || '...'} → ${filters.dataFim || '...'}` });
    return s;
  }, [filters]);


  if (hasSearched && isLoading) return <div className="p-6"><LoadingState message="Carregando fluxo de caixa..." /></div>;
  if (error) return <div className="p-6"><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></div>;
  if (!saldos.length && !movimentos.length) {
    return <div className="p-6"><EmptyState title="Sem dados" message="Nenhum dado de fluxo de caixa retornado." /></div>;
  }

  const NOMES_MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Fluxo de Caixa</h1>
          <p className="text-sm text-muted-foreground">
            Saldos por banco e projeção de entradas e saídas.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {formatInteger(saldosFiltrados.length)} saldo(s) · {formatInteger(movFiltrados.length)} movimento(s)
        </div>
      </div>

      {/* Filtros padrão DRE — TOPO */}
      <CollapsibleFilterBar
        title="Filtros"
        activeFiltersCount={activeFiltersCount}
        summary={filterSummary}
        onClear={() => { setFilters(EMPTY_FILTERS); resetSearch(); }}
        isOpen={isFilterBarOpen}
        onOpenChange={setIsFilterBarOpen}
      >
        <div className="flex flex-wrap items-center gap-3">
          <MultiPopover
            label="Ano"
            singular="ano(s)"
            options={opts.anos}
            selected={filters.anos}
            onChange={(v) => setFilters(f => ({ ...f, anos: v }))}
            width="w-[160px]"
          />
          <MultiPopover
            label="Banco"
            singular="banco(s)"
            options={opts.bancos}
            selected={filters.bancos}
            onChange={(v) => setFilters(f => ({ ...f, bancos: v }))}
            width="w-[220px]"
            searchable
          />
          <MultiPopover
            label="Fonte"
            singular="fonte(s)"
            options={opts.fontes}
            selected={filters.fontes}
            onChange={(v) => setFilters(f => ({ ...f, fontes: v }))}
          />
          <MultiPopoverNumber
            label="Mês"
            singular="mês(es)"
            options={opts.meses}
            renderLabel={(n) => NOMES_MES[n - 1] || String(n)}
            selected={filters.meses}
            onChange={(v) => setFilters(f => ({ ...f, meses: v }))}
            width="w-[180px]"
          />
          <MultiPopoverNumber
            label="Semana"
            singular="semana(s)"
            options={opts.semanas}
            renderLabel={(n) => `S${n}`}
            selected={filters.semanas}
            onChange={(v) => setFilters(f => ({ ...f, semanas: v }))}
            width="w-[180px]"
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[240px] justify-between h-10">
                {(filters.dataIni || filters.dataFim) ? (
                  <span className="text-sm truncate">
                    {filters.dataIni || '...'} → {filters.dataFim || '...'}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Data Vencimento</span>
                )}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-3" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-sm font-medium">Data Vencimento</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilters(f => ({ ...f, dataIni: `${ANO_ATUAL}-01-01`, dataFim: `${ANO_ATUAL}-12-31` }))}
                    className="h-6 text-xs px-2"
                  >
                    Ano atual
                  </Button>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">De</label>
                  <Input type="date" value={filters.dataIni} onChange={(e) => setFilters(f => ({ ...f, dataIni: e.target.value }))} className="h-9" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Até</label>
                  <Input type="date" value={filters.dataFim} onChange={(e) => setFilters(f => ({ ...f, dataFim: e.target.value }))} className="h-9" />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" className="h-10" onClick={() => { setFilters(EMPTY_FILTERS); resetSearch(); }}>
            Limpar
          </Button>
          <Button className="h-10" onClick={() => { markSearched(); setIsFilterBarOpen(false); }}>
            Buscar
          </Button>
        </div>
      </CollapsibleFilterBar>

      {!hasSearched ? (
        <FinanceiroSearchPrompt />
      ) : (
      <>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          icon={<Wallet className="h-4 w-4" />}
          label="Saldo Interno"
          value={formatCurrency(kpis.saldoInterno)}
          sub={`${formatInteger(kpis.qtdBancos)} banco(s)`}
          accent="text-primary"
        />
        <KpiCard
          icon={<Landmark className="h-4 w-4" />}
          label="Saldo Conciliado"
          value={formatCurrency(kpis.saldoConciliado)}
          sub={`Δ ${formatCurrencyCompact(kpis.diferencaSaldos)}`}
          accent="text-primary"
        />
        <KpiCard
          icon={<ArrowDownCircle className="h-4 w-4" />}
          label="A Receber (futuro)"
          value={formatCurrency(kpis.totalReceber)}
          sub={`${formatInteger(kpis.qtdMov)} movimento(s)`}
          accent="text-blue-600 dark:text-blue-400"
        />
        <KpiCard
          icon={<ArrowUpCircle className="h-4 w-4" />}
          label="A Pagar (futuro)"
          value={formatCurrency(kpis.totalPagar)}
          sub="Saídas projetadas"
          accent="text-destructive"
        />
        <KpiCard
          icon={kpis.diferenca >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          label="Diferença Entrada×Saída"
          value={formatCurrency(kpis.diferenca)}
          sub="Receber − Pagar"
          accent={kpis.diferenca >= 0 ? 'text-success' : 'text-destructive'}
        />
        <KpiCard
          icon={<FileText className="h-4 w-4" />}
          label="Saldo Projetado"
          value={formatCurrency(kpis.saldoInterno + kpis.diferenca)}
          sub="Interno + (Rec − Pag)"
          accent={(kpis.saldoInterno + kpis.diferenca) >= 0 ? 'text-success' : 'text-destructive'}
        />
      </div>

      {/* Gráfico Receber × Pagar por data */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Receber × Pagar por Data de Vencimento</h3>
          <span className="text-xs text-muted-foreground">{formatInteger(chartData.length)} data(s)</span>
        </div>
        {chartData.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-10">Sem movimentos para o filtro aplicado.</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tickFormatter={(v) => formatCurrencyCompact(v)} className="text-xs" width={80} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={(l) => `Vencimento: ${l}`} />
              <Legend />
              <Bar dataKey="Receber" fill="hsl(142 71% 45%)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Pagar" fill="hsl(0 84% 60%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Saldos por Banco */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-sm font-semibold">Saldos por Banco</h3>
          <p className="text-xs text-muted-foreground">Saldo Interno × Saldo Conciliado.</p>
        </div>
        <div className="overflow-x-auto">
          <Table className="[&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-1.5 text-xs">
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="min-w-[220px] text-[11px]">Banco</TableHead>
                <TableHead className="text-[11px]">Fonte</TableHead>
                <TableHead className="text-right text-[11px] whitespace-nowrap">Saldo Interno</TableHead>
                <TableHead className="text-right text-[11px] whitespace-nowrap">Saldo Conciliado</TableHead>
                <TableHead className="text-right text-[11px] whitespace-nowrap">Diferença</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {saldosFiltrados.map((s, i) => {
                const si = Number(s.SaldoInterno) || 0;
                const sc = Number(s.SaldoConciliado) || 0;
                const diff = si - sc;
                return (
                  <TableRow key={`${s.CodBanco}-${s.CodEmpresa}-${s.Fonte}-${i}`} className="hover:bg-muted/40">
                    <TableCell className="font-medium text-xs">{s.Banco}</TableCell>
                    <TableCell className="text-xs">
                      {s.Fonte ? <Badge variant="outline" className="text-[10px]">{s.Fonte}</Badge> : '—'}
                    </TableCell>
                    <TableCell className={cn('text-right mono-value text-xs whitespace-nowrap', si >= 0 ? 'text-blue-600' : 'text-destructive')}>
                      {formatCurrency(si)}
                    </TableCell>
                    <TableCell className={cn('text-right mono-value text-xs whitespace-nowrap', sc >= 0 ? 'text-blue-600' : 'text-destructive')}>
                      {formatCurrency(sc)}
                    </TableCell>
                    <TableCell className={cn('text-right mono-value text-xs whitespace-nowrap', Math.abs(diff) < 0.01 ? 'text-muted-foreground/50' : 'text-amber-600')}>
                      {Math.abs(diff) < 0.01 ? '—' : formatCurrency(diff)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {saldosFiltrados.length > 0 && (
                <TableRow className="bg-primary/10 border-t-2 border-primary font-semibold">
                  <TableCell className="text-xs" colSpan={2}>Total</TableCell>
                  <TableCell className="text-right mono-value text-xs whitespace-nowrap">{formatCurrency(kpis.saldoInterno)}</TableCell>
                  <TableCell className="text-right mono-value text-xs whitespace-nowrap">{formatCurrency(kpis.saldoConciliado)}</TableCell>
                  <TableCell className="text-right mono-value text-xs whitespace-nowrap">{formatCurrency(kpis.diferencaSaldos)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Matriz Banco × Data */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Projeção por Banco × Data de Vencimento</h3>
            <p className="text-xs text-muted-foreground">
              Cada célula: <span className="text-blue-600">Receber</span> / <span className="text-destructive">Pagar</span>.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatInteger(matriz.rows.length)} banco(s) · {formatInteger(matriz.datas.length)} data(s)
          </span>
        </div>
        {matriz.rows.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-10">Sem dados para o filtro aplicado.</div>
        ) : (
          <div className="overflow-auto max-h-[520px]">
            <Table className="[&_th]:px-2 [&_th]:py-2 [&_td]:px-2 [&_td]:py-1.5 text-xs">
              <TableHeader className="sticky top-0 bg-muted/60 z-10">
                <TableRow>
                  <TableHead className="min-w-[200px] sticky left-0 bg-muted/60 z-20 text-[11px]">Banco</TableHead>
                  {matriz.datas.map(d => (
                    <TableHead key={d} className="text-right text-[11px] whitespace-nowrap">{fmtDate(d)}</TableHead>
                  ))}
                  <TableHead className="text-right text-[11px] whitespace-nowrap sticky right-0 bg-muted/60 z-20">Total Rec.</TableHead>
                  <TableHead className="text-right text-[11px] whitespace-nowrap sticky right-0 bg-muted/60 z-20">Total Pag.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matriz.rows.map((row) => (
                  <TableRow key={row.banco} className="hover:bg-muted/40">
                    <TableCell className="font-medium text-xs sticky left-0 bg-card z-10">{row.banco}</TableCell>
                    {matriz.datas.map(d => {
                      const c = row.cells[d];
                      if (!c || (c.rec === 0 && c.pag === 0)) {
                        return <TableCell key={d} className="text-right text-xs text-muted-foreground/30">—</TableCell>;
                      }
                      return (
                        <TableCell key={d} className="text-right text-xs whitespace-nowrap">
                          <div className="flex flex-col gap-0.5 items-end leading-tight">
                            {c.rec > 0 && <span className="mono-value text-blue-600">{formatCurrencyCompact(c.rec)}</span>}
                            {c.pag > 0 && <span className="mono-value text-destructive">−{formatCurrencyCompact(c.pag)}</span>}
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right mono-value text-xs text-blue-600 whitespace-nowrap font-semibold">{formatCurrency(row.totRec)}</TableCell>
                    <TableCell className="text-right mono-value text-xs text-destructive whitespace-nowrap font-semibold">{formatCurrency(row.totPag)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-primary/10 border-t-2 border-primary font-semibold">
                  <TableCell className="text-xs sticky left-0 bg-primary/10 z-10">Total</TableCell>
                  {matriz.datas.map(d => {
                    const r = matriz.rows.reduce((a, row) => a + (row.cells[d]?.rec || 0), 0);
                    const p = matriz.rows.reduce((a, row) => a + (row.cells[d]?.pag || 0), 0);
                    return (
                      <TableCell key={d} className="text-right text-xs whitespace-nowrap">
                        <div className="flex flex-col gap-0.5 items-end leading-tight">
                          {r > 0 && <span className="mono-value text-blue-600">{formatCurrencyCompact(r)}</span>}
                          {p > 0 && <span className="mono-value text-destructive">−{formatCurrencyCompact(p)}</span>}
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right mono-value text-xs text-blue-600 whitespace-nowrap">{formatCurrency(kpis.totalReceber)}</TableCell>
                  <TableCell className="text-right mono-value text-xs text-destructive whitespace-nowrap">{formatCurrency(kpis.totalPagar)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </Card>      </>
      )}

    </div>
  );
}

function KpiCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub: string; accent: string }) {
  return (
    <Card className="p-3">
      <div className={cn('flex items-center gap-1.5 text-xs', accent)}>
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      <p className={cn('text-xl font-bold mono-value mt-1', accent)}>{value}</p>
      <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
    </Card>
  );
}

interface MultiPopoverProps {
  label: string;
  singular: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  width?: string;
  searchable?: boolean;
}

function MultiPopover({ label, singular, options, selected, onChange, width = 'w-[180px]', searchable }: MultiPopoverProps) {
  const [q, setQ] = useState('');
  const filtered = useMemo(
    () => (q.trim() ? options.filter(o => o.toLowerCase().includes(q.toLowerCase())) : options),
    [options, q]
  );
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v]);
  const toggleAll = () => onChange(selected.length === options.length ? [] : [...options]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn(width, 'justify-between h-10')}>
          {selected.length > 0 ? (
            <span className="flex items-center gap-1">
              <Badge variant="secondary" className="px-1.5 py-0 text-xs">{selected.length}</Badge>
              <span className="text-sm truncate">{singular}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{label}</span>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-2" align="start">
        <div className="space-y-2">
          {searchable && (
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar..." className="pl-8 h-8 text-sm" />
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={toggleAll} className="w-full h-7 text-xs justify-start">
            {selected.length === options.length ? 'Limpar seleção' : 'Selecionar todos'}
          </Button>
          <div className="border-t border-border" />
          <ScrollArea className="h-[240px]">
            <div className="space-y-0.5 pr-2">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum item encontrado</p>
              ) : (
                filtered.map((o) => {
                  const isSelected = selected.includes(o);
                  return (
                    <div
                      key={o}
                      onClick={() => toggle(o)}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted transition-colors',
                        isSelected && 'bg-primary/10'
                      )}
                    >
                      <Checkbox checked={isSelected} className="flex-shrink-0" />
                      <span className="text-sm truncate" title={o}>{o}</span>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface MultiPopoverNumberProps {
  label: string;
  singular: string;
  options: number[];
  selected: number[];
  renderLabel: (n: number) => string;
  onChange: (v: number[]) => void;
  width?: string;
}

function MultiPopoverNumber({ label, singular, options, selected, renderLabel, onChange, width = 'w-[160px]' }: MultiPopoverNumberProps) {
  const toggle = (v: number) => onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v]);
  const toggleAll = () => onChange(selected.length === options.length ? [] : [...options]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn(width, 'justify-between h-10')}>
          {selected.length > 0 ? (
            <span className="flex items-center gap-1">
              <Badge variant="secondary" className="px-1.5 py-0 text-xs">{selected.length}</Badge>
              <span className="text-sm truncate">{singular}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{label}</span>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-2" align="start">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" onClick={toggleAll} className="w-full h-7 text-xs justify-start">
            {selected.length === options.length ? 'Limpar seleção' : 'Selecionar todos'}
          </Button>
          <div className="border-t border-border" />
          <ScrollArea className="h-[220px]">
            <div className="grid grid-cols-3 gap-1 pr-2">
              {options.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 col-span-3">Sem opções</p>
              ) : (
                options.map((o) => {
                  const isSelected = selected.includes(o);
                  return (
                    <div
                      key={o}
                      onClick={() => toggle(o)}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-xs',
                        isSelected && 'bg-primary/10'
                      )}
                    >
                      <Checkbox checked={isSelected} className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{renderLabel(o)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
