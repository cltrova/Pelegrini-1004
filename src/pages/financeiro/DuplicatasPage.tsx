import { useMemo, useState, Fragment } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CollapsibleFilterBar } from '@/components/common/CollapsibleFilterBar';
import { FinanceiroSearchPrompt } from '@/components/financeiro/FinanceiroSearchPrompt';
import { useFinanceiroSearch } from '@/contexts/FinanceiroSearchContext';

import {
  Search, ChevronDown, ArrowDownCircle, ArrowUpCircle, CheckCircle2,
  AlertTriangle, FileText, TrendingUp, TrendingDown, Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDuplicatasData, getStatusVencto, DuplicataRecord, StatusVencto } from '@/hooks/useDuplicatasData';
import { formatCurrency, formatCurrencyCompact, formatInteger } from '@/utils/formatters';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, PieChart, Pie, Cell,
} from 'recharts';

const STATUS_LABEL: Record<StatusVencto, string> = {
  EM_DIA: 'A vencer',
  VENCE_HOJE: 'Vence hoje',
  VENCIDA: 'Vencida',
  PAGA: 'Liquidada',
  SEM_VENCTO: 'Sem vencto',
};

const STATUS_COLOR: Record<StatusVencto, string> = {
  EM_DIA: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  VENCE_HOJE: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  VENCIDA: 'bg-destructive/10 text-destructive border-destructive/30',
  PAGA: 'bg-success/10 text-success border-success/30',
  SEM_VENCTO: 'bg-muted text-muted-foreground border-border',
};

const STATUS_OPCOES: { value: StatusVencto; label: string }[] = [
  { value: 'EM_DIA', label: 'A vencer' },
  { value: 'VENCE_HOJE', label: 'Vence hoje' },
  { value: 'VENCIDA', label: 'Vencidas' },
  { value: 'PAGA', label: 'Liquidadas' },
  { value: 'SEM_VENCTO', label: 'Sem vencto' },
];

function fmtDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function uniq(arr: (string | null | undefined)[]): string[] {
  return Array.from(new Set(arr.filter((x): x is string => !!x && x.trim() !== ''))).sort();
}

interface Filters {
  search: string;
  anos: string[];
  meses: string[];
  empresas: string[];
  bancos: string[];
  origens: string[];
  fontes: string[];
  clientes: string[];
  statuses: StatusVencto[];
  dataIni: string;
  dataFim: string;
  docIni: string;
  docFim: string;
}

const ANO_ATUAL = new Date().getFullYear();
const DOC_INI_DEFAULT = `${ANO_ATUAL}-01-01`;
const DOC_FIM_DEFAULT = `${ANO_ATUAL}-12-31`;

const EMPTY_FILTERS: Filters = {
  search: '', anos: [], meses: [], empresas: [], bancos: [], origens: [], fontes: [], clientes: [], statuses: [],
  dataIni: '', dataFim: '',
  docIni: DOC_INI_DEFAULT, docFim: DOC_FIM_DEFAULT,
};

export default function DuplicatasPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const { hasSearched, markSearched, resetSearch } = useFinanceiroSearch();
  const { data, isLoading, error, refetch } = useDuplicatasData({
    dataIni: appliedFilters.docIni || undefined,
    dataFim: appliedFilters.docFim || undefined,
  });
  const [isFilterBarOpen, setIsFilterBarOpen] = useState(false);


  const allRecords = data ?? [];

  const opts = useMemo(() => ({
    anos: uniq(allRecords.map(r => r.DataDCTO?.slice(0, 4))),
    meses: uniq(allRecords.map(r => r.DataDCTO?.slice(5, 7))),
    empresas: uniq(allRecords.map(r => r.Empresa)),
    bancos: uniq(allRecords.map(r => r.Banco)),
    origens: uniq(allRecords.map(r => r.Origem)),
    fontes: uniq(allRecords.map(r => r.Fonte)),
    clientes: uniq(allRecords.map(r => r.Cliente)),
  }), [allRecords]);

  const records = useMemo(() => {
    const s = appliedFilters.search.trim().toLowerCase();
    const di = appliedFilters.dataIni ? new Date(appliedFilters.dataIni) : null;
    const df = appliedFilters.dataFim ? new Date(appliedFilters.dataFim) : null;
    const docI = appliedFilters.docIni ? new Date(appliedFilters.docIni) : null;
    const docF = appliedFilters.docFim ? new Date(appliedFilters.docFim) : null;
    return allRecords.filter(r => {
      if (appliedFilters.empresas.length && !appliedFilters.empresas.includes(r.Empresa)) return false;
      if (appliedFilters.bancos.length && !appliedFilters.bancos.includes(r.Banco)) return false;
      if (appliedFilters.origens.length && !appliedFilters.origens.includes(r.Origem)) return false;
      if (appliedFilters.fontes.length && !appliedFilters.fontes.includes(r.Fonte)) return false;
      if (appliedFilters.clientes.length && !appliedFilters.clientes.includes(r.Cliente)) return false;
      if (appliedFilters.statuses.length && !appliedFilters.statuses.includes(getStatusVencto(r))) return false;
      if (appliedFilters.anos.length || appliedFilters.meses.length) {
        if (!r.DataDCTO) return false;
        const ano = r.DataDCTO.slice(0, 4);
        const mes = r.DataDCTO.slice(5, 7);
        if (appliedFilters.anos.length && !appliedFilters.anos.includes(ano)) return false;
        if (appliedFilters.meses.length && !appliedFilters.meses.includes(mes)) return false;
      }
      if (di || df) {
        if (!r.DataVencimento) return false;
        const v = new Date(r.DataVencimento);
        if (di && v < di) return false;
        if (df && v > df) return false;
      }
      if (docI || docF) {
        if (!r.DataDCTO) return false;
        const d = new Date(r.DataDCTO);
        if (docI && d < docI) return false;
        if (docF && d > docF) return false;
      }
      if (s) {
        const hay = `${r.CodDuplicata} ${r.Cliente} ${r.CodCliente} ${r.Banco} ${r.Complemento ?? ''} ${r.Observacao ?? ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [allRecords, appliedFilters]);


  const kpis = useMemo(() => {
    let aReceber = 0, aPagar = 0, recebido = 0, pago = 0;
    let qReceber = 0, qPagar = 0, qRecebido = 0, qPago = 0, vencidas = 0, valorVencido = 0;
    for (const r of records) {
      const valor = Number(r.ValorDuplicata) || 0;
      const recVal = Number(r.ValorRecebimento) || 0;
      const isReceber = r.Tipo === 'RECEBER';
      const liquidada = !!r.DataPagamento;
      if (liquidada) {
        if (isReceber) { recebido += recVal || valor; qRecebido++; }
        else { pago += recVal || valor; qPago++; }
      } else {
        if (isReceber) { aReceber += valor; qReceber++; }
        else { aPagar += valor; qPagar++; }
        if (getStatusVencto(r) === 'VENCIDA') { vencidas++; valorVencido += valor; }
      }
    }
    return {
      aReceber, aPagar, recebido, pago,
      diferenca: (aReceber + recebido) - (aPagar + pago),
      diferencaLiquido: recebido - pago,
      saldoAberto: aReceber - aPagar,
      total: records.length,
      qReceber, qPagar, qRecebido, qPago, vencidas, valorVencido,
    };
  }, [records]);

  const chartCompare = useMemo(() => ([
    { name: 'A Pagar', Pagar: kpis.aPagar, Receber: 0 },
    { name: 'A Receber', Pagar: 0, Receber: kpis.aReceber },
    { name: 'Pago', Pagar: kpis.pago, Receber: 0 },
    { name: 'Recebido', Pagar: 0, Receber: kpis.recebido },
  ]), [kpis]);

  const bancoData = useMemo(() => {
    const map = new Map<string, { banco: string; receber: number; pagar: number }>();
    for (const r of records) {
      const k = r.Banco || '—';
      if (!map.has(k)) map.set(k, { banco: k, receber: 0, pagar: 0 });
      const slot = map.get(k)!;
      const v = Number(r.ValorDuplicata) || 0;
      if (r.Tipo === 'RECEBER') slot.receber += v; else slot.pagar += v;
    }
    return Array.from(map.values()).sort((a, b) => (b.receber + b.pagar) - (a.receber + a.pagar)).slice(0, 8);
  }, [records]);

  const topClientes = useMemo(() => {
    const map = new Map<string, { cliente: string; aberto: number; vencido: number; qtd: number }>();
    for (const r of records) {
      if (r.Tipo !== 'RECEBER' || r.DataPagamento) continue;
      const k = r.Cliente || '—';
      if (!map.has(k)) map.set(k, { cliente: k, aberto: 0, vencido: 0, qtd: 0 });
      const slot = map.get(k)!;
      const v = Number(r.ValorDuplicata) || 0;
      slot.aberto += v; slot.qtd++;
      if (getStatusVencto(r) === 'VENCIDA') slot.vencido += v;
    }
    return Array.from(map.values()).sort((a, b) => b.aberto - a.aberto).slice(0, 10);
  }, [records]);

  const statusBreakdown = useMemo(() => {
    const m: Record<StatusVencto, number> = { EM_DIA: 0, VENCE_HOJE: 0, VENCIDA: 0, PAGA: 0, SEM_VENCTO: 0 };
    for (const r of records) m[getStatusVencto(r)] += Number(r.ValorDuplicata) || 0;
    return Object.entries(m).map(([k, v]) => ({ name: STATUS_LABEL[k as StatusVencto], value: v, key: k }));
  }, [records]);

  const PIE_COLORS = ['hsl(217 91% 60%)', 'hsl(38 92% 50%)', 'hsl(0 84% 60%)', 'hsl(142 71% 45%)', 'hsl(220 9% 60%)'];

  // Resumo / contagem de filtros ativos
  const docDefault = appliedFilters.docIni === DOC_INI_DEFAULT && appliedFilters.docFim === DOC_FIM_DEFAULT;
  const activeFiltersCount =
    (appliedFilters.search ? 1 : 0) +
    appliedFilters.anos.length + appliedFilters.meses.length +
    appliedFilters.empresas.length + appliedFilters.bancos.length + appliedFilters.origens.length +
    appliedFilters.fontes.length + appliedFilters.clientes.length + appliedFilters.statuses.length +
    (appliedFilters.dataIni ? 1 : 0) + (appliedFilters.dataFim ? 1 : 0) +
    (!docDefault && (appliedFilters.docIni || appliedFilters.docFim) ? 1 : 0);

  const filterSummary = useMemo(() => {
    const s: { label: string; value: string | number }[] = [];
    if (appliedFilters.anos.length) s.push({ label: 'Ano', value: appliedFilters.anos.join(', ') });
    if (appliedFilters.meses.length) s.push({ label: 'Mês', value: appliedFilters.meses.length });
    if (appliedFilters.empresas.length) s.push({ label: 'Empresa', value: appliedFilters.empresas.length });
    if (appliedFilters.bancos.length) s.push({ label: 'Banco', value: appliedFilters.bancos.length });
    if (appliedFilters.origens.length) s.push({ label: 'Origem', value: appliedFilters.origens.length });
    if (appliedFilters.statuses.length) s.push({ label: 'Status', value: appliedFilters.statuses.length });
    if (appliedFilters.fontes.length) s.push({ label: 'Fonte', value: appliedFilters.fontes.length });
    if (appliedFilters.clientes.length) s.push({ label: 'Cliente', value: appliedFilters.clientes.length });
    if (appliedFilters.dataIni || appliedFilters.dataFim) s.push({ label: 'Vencimento', value: `${appliedFilters.dataIni || '...'} → ${appliedFilters.dataFim || '...'}` });
    if (appliedFilters.docIni || appliedFilters.docFim) s.push({ label: 'Documento', value: `${appliedFilters.docIni || '...'} → ${appliedFilters.docFim || '...'}` });
    return s;
  }, [appliedFilters]);

  const isDirty = JSON.stringify(filters) !== JSON.stringify(appliedFilters);
  const handleBuscar = () => {
    setAppliedFilters(filters);
    markSearched();
    setIsFilterBarOpen(false);
  };
  const handleLimpar = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    resetSearch();
  };


  if (hasSearched && isLoading) return <div className="enterprise-page-shell"><LoadingState message="Carregando duplicatas..." /></div>;
  if (hasSearched && error) return <div className="enterprise-page-shell"><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></div>;

  return (
    <div className="enterprise-page-shell">
      {/* Header */}
      <div className="flex shrink-0 items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Duplicatas</h1>
          <p className="text-sm text-muted-foreground">Contas a pagar e a receber — análise financeira detalhada.</p>
        </div>
        <div className="text-sm text-muted-foreground">
          {formatInteger(records.length)} de {formatInteger(allRecords.length)} duplicatas
        </div>
      </div>

      {/* Filtros no padrão DRE — TOPO */}
      <CollapsibleFilterBar
        title="Filtros"
        activeFiltersCount={activeFiltersCount}
        summary={filterSummary}
        onClear={handleLimpar}
        isOpen={isFilterBarOpen}
        onOpenChange={setIsFilterBarOpen}
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Busca */}
          <div className="relative w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar duplicata, cliente, observação..."
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              className="pl-9 h-10"
            />
          </div>

          <MultiPopover
            label="Ano"
            singular="ano(s)"
            options={opts.anos}
            selected={filters.anos}
            onChange={(v) => setFilters(f => ({ ...f, anos: v }))}
            width="w-[160px]"
          />

          <MultiPopover
            label="Mês"
            singular="mês(es)"
            options={opts.meses}
            selected={filters.meses}
            onChange={(v) => setFilters(f => ({ ...f, meses: v }))}
            width="w-[160px]"
          />

          <MultiPopover
            label="Empresa"
            singular="empresa(s)"
            options={opts.empresas}
            selected={filters.empresas}
            onChange={(v) => setFilters(f => ({ ...f, empresas: v }))}
          />

          <MultiPopover
            label="Banco"
            singular="banco(s)"
            options={opts.bancos}
            selected={filters.bancos}
            onChange={(v) => setFilters(f => ({ ...f, bancos: v }))}
            width="w-[200px]"
          />

          <MultiPopover
            label="Origem"
            singular="origem(ns)"
            options={opts.origens}
            selected={filters.origens}
            onChange={(v) => setFilters(f => ({ ...f, origens: v }))}
          />

          {/* Status Vencto */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-between h-10">
                {filters.statuses.length > 0 ? (
                  <span className="flex items-center gap-1">
                    <Badge variant="secondary" className="px-1.5 py-0 text-xs">{filters.statuses.length}</Badge>
                    <span className="text-sm truncate">status</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Status Vencto</span>
                )}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-2" align="start">
              <div className="space-y-1">
                {STATUS_OPCOES.map((opt) => {
                  const isSelected = filters.statuses.includes(opt.value);
                  return (
                    <div
                      key={opt.value}
                      onClick={() => setFilters(f => ({
                        ...f,
                        statuses: isSelected ? f.statuses.filter(s => s !== opt.value) : [...f.statuses, opt.value],
                      }))}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted transition-colors',
                        isSelected && 'bg-primary/10'
                      )}
                    >
                      <Checkbox checked={isSelected} />
                      <span className="text-sm">{opt.label}</span>
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          <MultiPopover
            label="Fonte"
            singular="fonte(s)"
            options={opts.fontes}
            selected={filters.fontes}
            onChange={(v) => setFilters(f => ({ ...f, fontes: v }))}
          />

          <MultiPopover
            label="Cliente"
            singular="cliente(s)"
            options={opts.clientes}
            selected={filters.clientes}
            onChange={(v) => setFilters(f => ({ ...f, clientes: v }))}
            width="w-[240px]"
            searchable
          />

          {/* Período (Data Vencimento) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[220px] justify-between h-10">
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

          {/* Data Documento (padrão: ano atual) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[240px] justify-between h-10">
                <span className="text-sm truncate">
                  <span className="text-muted-foreground mr-1">Documento:</span>
                  {filters.docIni || '...'} → {filters.docFim || '...'}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-3" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-sm font-medium">Data Documento</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilters(f => ({ ...f, docIni: DOC_INI_DEFAULT, docFim: DOC_FIM_DEFAULT }))}
                    className="h-6 text-xs px-2"
                  >
                    Ano atual
                  </Button>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">De</label>
                  <Input type="date" value={filters.docIni} onChange={(e) => setFilters(f => ({ ...f, docIni: e.target.value }))} className="h-9" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Até</label>
                  <Input type="date" value={filters.docFim} onChange={(e) => setFilters(f => ({ ...f, docFim: e.target.value }))} className="h-9" />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Ações */}
          <div className="ml-auto flex items-center gap-2">
            {isDirty && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 hidden md:inline">
                Filtros não aplicados
              </span>
            )}
            <Button variant="outline" className="h-10" onClick={handleLimpar}>
              Limpar
            </Button>
            <Button className="h-10" onClick={handleBuscar}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </div>
        </div>
      </CollapsibleFilterBar>

      {!hasSearched ? (
        <div className="min-h-0 flex-1">
          <FinanceiroSearchPrompt />
        </div>
      ) : (
      <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">

      {/* Totalizadores — 3 colunas × 4 linhas (Totais, Realizados, Pendentes, Complementares) */}
      {(() => {
        const totalEntradas = kpis.aReceber + kpis.recebido;
        const totalSaidas = kpis.aPagar + kpis.pago;
        const total = totalEntradas - totalSaidas;
        const realizados = kpis.recebido - kpis.pago;
        const pendentes = kpis.aReceber - kpis.aPagar;
        const qtdEntradas = kpis.qReceber + kpis.qRecebido;
        const qtdSaidas = kpis.qPagar + kpis.qPago;

        const cell = 'px-3 py-2 rounded-md border bg-card flex flex-col gap-0.5';
        const entrada = 'border-blue-500/25';
        const saida = 'border-destructive/25';
        const neutro = 'border-border';
        const lblBlue = 'text-[11px] font-medium text-blue-600';
        const lblRed = 'text-[11px] font-medium text-destructive';
        const lblMute = 'text-[11px] font-medium text-muted-foreground';
        const valBlue = 'text-base font-bold mono-value text-blue-600';
        const valRed = 'text-base font-bold mono-value text-destructive';
        const sub = 'text-[10px] text-muted-foreground';

        return (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {/* Matriz 3x3 ocupando colunas 1-3 */}
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-2">
              {/* Linha 1 — Totais */}
              <div className={cn(cell, entrada)}>
                <span className={lblBlue}>Total Entradas</span>
                <span className={valBlue}>{formatCurrency(totalEntradas)}</span>
                <span className={sub}>{qtdEntradas} título(s) — abertos + recebidos</span>
              </div>
              <div className={cn(cell, saida)}>
                <span className={lblRed}>Total Saídas</span>
                <span className={valRed}>{formatCurrency(totalSaidas)}</span>
                <span className={sub}>{qtdSaidas} título(s) — abertos + pagos</span>
              </div>
              <div className={cn(cell, neutro)}>
                <span className={lblMute}>Total</span>
                <span className={cn('text-base font-bold mono-value', total >= 0 ? 'text-success' : 'text-destructive')}>
                  {formatCurrency(total)}
                </span>
                <span className={sub}>Entradas − Saídas</span>
              </div>

              {/* Linha 2 — Realizados */}
              <div className={cn(cell, entrada)}>
                <span className={lblBlue}>Recebidos</span>
                <span className={valBlue}>{formatCurrency(kpis.recebido)}</span>
                <span className={sub}>{kpis.qRecebido} liquidada(s)</span>
              </div>
              <div className={cn(cell, saida)}>
                <span className={lblRed}>Pagos</span>
                <span className={valRed}>{formatCurrency(kpis.pago)}</span>
                <span className={sub}>{kpis.qPago} liquidada(s)</span>
              </div>
              <div className={cn(cell, neutro)}>
                <span className={lblMute}>Realizados</span>
                <span className={cn('text-base font-bold mono-value', realizados >= 0 ? 'text-success' : 'text-destructive')}>
                  {formatCurrency(realizados)}
                </span>
                <span className={sub}>Recebidos − Pagos</span>
              </div>

              {/* Linha 3 — Pendentes */}
              <div className={cn(cell, entrada)}>
                <span className={lblBlue}>A Receber</span>
                <span className={valBlue}>{formatCurrency(kpis.aReceber)}</span>
                <span className={sub}>{kpis.qReceber} em aberto</span>
              </div>
              <div className={cn(cell, saida)}>
                <span className={lblRed}>A Pagar</span>
                <span className={valRed}>{formatCurrency(kpis.aPagar)}</span>
                <span className={sub}>{kpis.qPagar} em aberto</span>
              </div>
              <div className={cn(cell, neutro)}>
                <span className={lblMute}>Pendentes</span>
                <span className={cn('text-base font-bold mono-value', pendentes >= 0 ? 'text-success' : 'text-destructive')}>
                  {formatCurrency(pendentes)}
                </span>
                <span className={sub}>A Receber − A Pagar</span>
              </div>
            </div>

            {/* Coluna 4 — Complementares empilhados */}
            <div className="grid grid-cols-1 gap-2">
              <div className={cn(cell, neutro, 'flex-row items-center justify-between')}>
                <div className="flex flex-col gap-0.5">
                  <span className={lblMute}>Total de Duplicatas</span>
                  <span className="text-base font-bold mono-value">{formatInteger(kpis.total)}</span>
                  <span className={sub}>{kpis.qReceber + kpis.qPagar} abertos · {kpis.qRecebido + kpis.qPago} liquidadas</span>
                </div>
                <FileText className="h-5 w-5 text-primary/40 shrink-0" />
              </div>
              <div className={cn(cell, neutro, 'flex-row items-center justify-between')}>
                <div className="flex flex-col gap-0.5">
                  <span className={lblMute}>Valor vencido</span>
                  <span className="text-base font-bold mono-value text-destructive">{formatCurrency(kpis.valorVencido)}</span>
                  <span className={sub}>{kpis.vencidas} título(s) em atraso</span>
                </div>
                <AlertTriangle className="h-5 w-5 text-destructive/40 shrink-0" />
              </div>
              <div className={cn(cell, neutro, 'flex-row items-center justify-between')}>
                <div className="flex flex-col gap-0.5">
                  <span className={lblMute}>Saldo em aberto</span>
                  <span className={cn('text-base font-bold mono-value', kpis.saldoAberto >= 0 ? 'text-success' : 'text-destructive')}>
                    {formatCurrency(kpis.saldoAberto)}
                  </span>
                  <span className={sub}>A receber − A pagar (apenas abertos)</span>
                </div>
                {kpis.saldoAberto >= 0 ? <TrendingUp className="h-5 w-5 text-success/40 shrink-0" /> : <TrendingDown className="h-5 w-5 text-destructive/40 shrink-0" />}
              </div>
            </div>

            {/* Coluna 5 — Distribuição por Status */}
            <div className={cn(cell, neutro, 'p-3')}>
              <span className={lblMute}>Distribuição por Status</span>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={statusBreakdown.filter((s) => s.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    innerRadius={32}
                    label={(e) => `${(e.percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {statusBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

        );
      })()}




      {/* Detalhe por Banco — tabela expansível */}
      <BancoDetalheTable records={records} />
      </div>
      )}

    </div>
  );
}

function KpiTile({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub: string; accent: string }) {
  return (
    <Card className="p-3">
      <div className={`flex items-center gap-1.5 text-xs ${accent}`}>{icon}<span className="font-medium">{label}</span></div>
      <p className="text-xl font-bold mono-value mt-1">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </Card>
  );
}

interface BancoAgg {
  banco: string;
  qtd: number;
  aReceber: number;
  aPagar: number;
  recebimentos: number;
  pagamentos: number;
  registros: DuplicataRecord[];
}

function BancoDetalheTable({ records }: { records: DuplicataRecord[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const bancos: BancoAgg[] = useMemo(() => {
    const map = new Map<string, BancoAgg>();
    for (const r of records) {
      const k = r.Banco || '—';
      if (!map.has(k)) map.set(k, { banco: k, qtd: 0, aReceber: 0, aPagar: 0, recebimentos: 0, pagamentos: 0, registros: [] });
      const slot = map.get(k)!;
      slot.qtd++;
      slot.registros.push(r);
      const val = Number(r.ValorDuplicata) || 0;
      const rec = Number(r.ValorRecebimento) || 0;
      const liquidada = !!r.DataPagamento;
      const isReceber = r.Tipo === 'RECEBER';
      if (liquidada) {
        if (isReceber) slot.recebimentos += rec || val;
        else slot.pagamentos += rec || val;
      } else {
        if (isReceber) slot.aReceber += val;
        else slot.aPagar += val;
      }
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => (b.aReceber + b.aPagar + b.recebimentos + b.pagamentos) - (a.aReceber + a.aPagar + a.recebimentos + a.pagamentos));
    return arr;
  }, [records]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return bancos;
    return bancos.filter(b => b.banco.toLowerCase().includes(s));
  }, [bancos, search]);

  const totais = useMemo(() => {
    return bancos.reduce((acc, b) => {
      acc.qtd += b.qtd;
      acc.aReceber += b.aReceber;
      acc.aPagar += b.aPagar;
      acc.recebimentos += b.recebimentos;
      acc.pagamentos += b.pagamentos;
      return acc;
    }, { qtd: 0, aReceber: 0, aPagar: 0, recebimentos: 0, pagamentos: 0 });
  }, [bancos]);

  const toggle = (banco: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(banco)) next.delete(banco); else next.add(banco);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(filtered.map(b => b.banco)));
  const collapseAll = () => setExpanded(new Set());

  const blue = 'text-blue-600 dark:text-blue-400';
  const red = 'text-destructive';

  const cellVal = (v: number, color: 'blue' | 'red' | 'auto' = 'auto') => {
    if (v === 0) return <span className="text-muted-foreground/40">—</span>;
    const cls = color === 'blue' ? blue : color === 'red' ? red : v >= 0 ? blue : red;
    return <span className={cn('mono-value', cls)}>{formatCurrency(v)}</span>;
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-4 border-b">
        <div>
          <h3 className="text-sm font-semibold">Detalhe por Banco</h3>
          <p className="text-xs text-muted-foreground">
            Clique em uma linha para expandir e ver as duplicatas. {formatInteger(bancos.length)} banco(s).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filtrar banco..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-xs"
            />
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={expandAll}>Expandir tudo</Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={collapseAll}>Recolher</Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table className="[&_th]:px-2 [&_th]:py-2 [&_th]:h-auto [&_td]:px-2 [&_td]:py-1.5 text-xs">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="min-w-[180px] text-[11px] whitespace-nowrap">Banco</TableHead>
              <TableHead className="text-right text-[11px] whitespace-nowrap">Qtde</TableHead>
              <TableHead className="text-right text-[11px] whitespace-nowrap">A Receber</TableHead>
              <TableHead className="text-right text-[11px] whitespace-nowrap">A Pagar</TableHead>
              <TableHead className="text-right text-[11px] whitespace-nowrap">Dif. Pend.</TableHead>
              <TableHead className="text-right text-[11px] whitespace-nowrap">Recebim.</TableHead>
              <TableHead className="text-right text-[11px] whitespace-nowrap">Pagam.</TableHead>
              <TableHead className="text-right text-[11px] whitespace-nowrap">Dif. Real.</TableHead>
              <TableHead className="text-right text-[11px] whitespace-nowrap">Total Receb.</TableHead>
              <TableHead className="text-right text-[11px] whitespace-nowrap">Total Pagam.</TableHead>
              <TableHead className="text-right text-[11px] whitespace-nowrap">Dif. Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((b) => {
              const difPendente = b.aReceber - b.aPagar;
              const difReal = b.recebimentos - b.pagamentos;
              const totalReceb = b.aReceber + b.recebimentos;
              const totalPagam = b.aPagar + b.pagamentos;
              const difTotal = totalReceb - totalPagam;
              const isOpen = expanded.has(b.banco);
              return (
                <Fragment key={b.banco}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/40 border-b"
                    onClick={() => toggle(b.banco)}
                  >
                    <TableCell className="font-medium text-xs">
                      <div className="flex items-center gap-1.5">
                        <ChevronDown className={cn('h-3 w-3 transition-transform text-muted-foreground shrink-0', !isOpen && '-rotate-90')} />
                        <span className="truncate" title={b.banco}>{b.banco}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right mono-value text-xs whitespace-nowrap">{formatInteger(b.qtd)}</TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">{cellVal(b.aReceber, 'blue')}</TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">{cellVal(b.aPagar, 'red')}</TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">{cellVal(difPendente)}</TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">{cellVal(b.recebimentos, 'blue')}</TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">{cellVal(b.pagamentos, 'red')}</TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">{cellVal(difReal)}</TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">{cellVal(totalReceb, 'blue')}</TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">{cellVal(totalPagam, 'red')}</TableCell>
                    <TableCell className={cn('text-right font-semibold mono-value text-xs whitespace-nowrap', difTotal >= 0 ? blue : red)}>
                      {formatCurrency(difTotal)}
                    </TableCell>
                  </TableRow>

                  {isOpen && (
                    <TableRow key={`${b.banco}-detail`} className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={11} className="p-0">
                        <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                          <Table>
                            <TableHeader className="sticky top-0 bg-muted/60 z-10">
                              <TableRow>
                                <TableHead className="text-xs">Cod Duplicata</TableHead>
                                <TableHead className="text-xs">Cliente</TableHead>
                                <TableHead className="text-xs">Tipo</TableHead>
                                <TableHead className="text-xs">Complemento</TableHead>
                                <TableHead className="text-xs">Observação</TableHead>
                                <TableHead className="text-xs">Vencimento</TableHead>
                                <TableHead className="text-xs">Pagamento</TableHead>
                                <TableHead className="text-xs text-right">Valor</TableHead>
                                <TableHead className="text-xs text-right">Recebido</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {b.registros.slice(0, 300).map((r, i) => {
                                const status = getStatusVencto(r);
                                return (
                                  <TableRow key={`${b.banco}-${r.CodDuplicata}-${i}`}>
                                    <TableCell className="font-mono text-xs">{r.CodDuplicata}</TableCell>
                                    <TableCell className="max-w-[200px] truncate text-xs" title={r.Cliente}>{r.Cliente}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className={cn('text-[10px]', r.Tipo === 'RECEBER' ? 'border-blue-500/40 text-blue-600' : 'border-destructive/40 text-destructive')}>
                                        {r.Tipo}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[140px] truncate text-xs" title={r.Complemento ?? ''}>{r.Complemento || '—'}</TableCell>
                                    <TableCell className="max-w-[180px] truncate text-xs" title={r.Observacao ?? ''}>{r.Observacao || '—'}</TableCell>
                                    <TableCell className="text-xs">{fmtDate(r.DataVencimento)}</TableCell>
                                    <TableCell className="text-xs">{fmtDate(r.DataPagamento)}</TableCell>
                                    <TableCell className="text-right mono-value text-xs">{formatCurrency(Number(r.ValorDuplicata) || 0)}</TableCell>
                                    <TableCell className="text-right mono-value text-xs text-success">{r.ValorRecebimento ? formatCurrency(Number(r.ValorRecebimento)) : '—'}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className={cn('text-[10px]', STATUS_COLOR[status])}>{STATUS_LABEL[status]}</Badge>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                          {b.registros.length > 300 && (
                            <p className="text-[11px] text-muted-foreground text-center py-2">
                              Mostrando 300 de {formatInteger(b.registros.length)} duplicatas deste banco.
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
            {/* Linha de totais */}
            {filtered.length > 0 && (() => {
              const difPend = totais.aReceber - totais.aPagar;
              const difReal = totais.recebimentos - totais.pagamentos;
              const totReceb = totais.aReceber + totais.recebimentos;
              const totPagam = totais.aPagar + totais.pagamentos;
              const difTot = totReceb - totPagam;
              return (
                <TableRow className="bg-primary/10 border-t-2 border-primary font-semibold">
                  <TableCell className="text-xs">Total</TableCell>
                  <TableCell className="text-right mono-value text-xs whitespace-nowrap">{formatInteger(totais.qtd)}</TableCell>
                  <TableCell className="text-right text-xs whitespace-nowrap">{cellVal(totais.aReceber, 'blue')}</TableCell>
                  <TableCell className="text-right text-xs whitespace-nowrap">{cellVal(totais.aPagar, 'red')}</TableCell>
                  <TableCell className="text-right text-xs whitespace-nowrap">{cellVal(difPend)}</TableCell>
                  <TableCell className="text-right text-xs whitespace-nowrap">{cellVal(totais.recebimentos, 'blue')}</TableCell>
                  <TableCell className="text-right text-xs whitespace-nowrap">{cellVal(totais.pagamentos, 'red')}</TableCell>
                  <TableCell className="text-right text-xs whitespace-nowrap">{cellVal(difReal)}</TableCell>
                  <TableCell className="text-right text-xs whitespace-nowrap">{cellVal(totReceb, 'blue')}</TableCell>
                  <TableCell className="text-right text-xs whitespace-nowrap">{cellVal(totPagam, 'red')}</TableCell>
                  <TableCell className={cn('text-right mono-value text-xs whitespace-nowrap', difTot >= 0 ? blue : red)}>
                    {formatCurrency(difTot)}
                  </TableCell>
                </TableRow>

              );
            })()}
          </TableBody>
        </Table>
      </div>
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
  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v]);
  };
  const toggleAll = () => {
    onChange(selected.length === options.length ? [] : [...options]);
  };
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
