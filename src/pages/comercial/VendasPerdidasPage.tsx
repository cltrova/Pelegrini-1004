import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { CotacaoDetailDrawer } from '@/components/comercial/cotacoes/CotacaoDetailDrawer';
import { CotacoesFilters, type CotacoesFilterOption } from '@/components/comercial/cotacoes/CotacoesFilters';
import { CotacoesGestorPanel } from '@/components/comercial/cotacoes/CotacoesGestorPanel';
import { CotacoesKpis } from '@/components/comercial/cotacoes/CotacoesKpis';
import { CotacoesTable } from '@/components/comercial/cotacoes/CotacoesTable';
import { MotivoPerdaDialog } from '@/components/comercial/cotacoes/MotivoPerdaDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useVendasPerdidas } from '@/hooks/useCotacoesComerciais';
import {
  useMotivosPerda10041,
  type MotivoPerda,
  type MotivoPerdaRegistro,
} from '@/hooks/useMotivosPerda';
import type { CotacaoComercial, CotacoesFiltros } from '@/types/cotacoesComerciais';
import {
  calcularCotacoesKpis,
  filtrarCotacoes,
  motivoMaisFrequente,
  MOTIVO_PERDA_LABELS,
} from '@/utils/cotacoesComerciais';
import { exportCotacoesExcel } from '@/utils/cotacoesExcel';

interface PeriodoCotacoes {
  dataIni: string;
  dataFim: string;
}

const emptyRows: readonly CotacaoComercial[] = [];
const emptyReasons: readonly MotivoPerdaRegistro[] = [];
const emptyReasonsMap = new Map<string, MotivoPerdaRegistro>();

const motivoOptions: readonly CotacoesFilterOption<MotivoPerda>[] = ([
  'preco',
  'prazo_entrega',
  'condicao_pagamento',
  'concorrencia',
  'indisponibilidade_produto',
  'cliente_desistiu',
  'cotacao_vencida',
  'outro',
] satisfies readonly MotivoPerda[]).map((value) => ({ value, label: MOTIVO_PERDA_LABELS[value] }));

function canonicalQuoteId(value: unknown): string {
  return String(value ?? '').trim();
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createCurrentMonthPeriod(): PeriodoCotacoes {
  const today = new Date();
  return {
    dataIni: formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
    dataFim: formatDateInput(today),
  };
}

function createEmptyFilters(): CotacoesFiltros {
  return {
    busca: '',
    vendedores: [],
    clientes: [],
    status: [],
    motivos: [],
    diasMin: null,
    diasMax: null,
  };
}

function queryFilterValue(values: readonly string[]): string | null {
  return values.length === 1 ? values[0] : null;
}

function getFilterOptions(rows: readonly CotacaoComercial[], field: 'vendedor' | 'cliente'): CotacoesFilterOption[] {
  const options = new Map<string, string>();
  rows.forEach((row) => {
    const value = field === 'vendedor' ? row.codVendedor : row.codCliente;
    const label = field === 'vendedor' ? row.nomeVendedor : row.nomeCliente;
    if (value && label) options.set(value, label);
  });
  return Array.from(options, ([value, label]) => ({ value, label }));
}

function CotacoesLoading() {
  return (
    <section aria-label="Carregando vendas perdidas" className="space-y-3" aria-busy="true">
      <div className="grid grid-cols-2 gap-px border border-border sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-20 rounded-none" />)}
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-80 w-full" />
    </section>
  );
}

export default function VendasPerdidasPage() {
  const [pendingPeriod, setPendingPeriod] = useState(createCurrentMonthPeriod);
  const [appliedPeriod, setAppliedPeriod] = useState<PeriodoCotacoes | null>(null);
  const [pendingFilters, setPendingFilters] = useState<CotacoesFiltros>(createEmptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<CotacoesFiltros>(createEmptyFilters);
  const [selectedQuote, setSelectedQuote] = useState<CotacaoComercial | null>(null);
  const [detailQuote, setDetailQuote] = useState<CotacaoComercial | null>(null);

  const consulta = useMemo(() => appliedPeriod ? ({
    dataIni: appliedPeriod.dataIni,
    dataFim: appliedPeriod.dataFim,
    codVendedor: queryFilterValue(appliedFilters.vendedores),
    codCliente: queryFilterValue(appliedFilters.clientes),
  }) : null, [appliedFilters.clientes, appliedFilters.vendedores, appliedPeriod]);

  const erpQuery = useVendasPerdidas(consulta);
  const rows = consulta ? erpQuery.data ?? emptyRows : emptyRows;
  const quoteIds = useMemo(() => rows.map((row) => canonicalQuoteId(row.idCotacao)), [rows]);
  const reasonsQuery = useMotivosPerda10041(quoteIds);
  const reasonRows = reasonsQuery.data ?? emptyReasons;

  const reasons = useMemo(() => {
    if (reasonsQuery.isError) return emptyReasonsMap;
    const currentQuoteIds = new Set(quoteIds);
    const joinedReasons = new Map<string, MotivoPerdaRegistro>();
    reasonRows.forEach((reason) => {
      const id = canonicalQuoteId(reason.id_cotacao);
      if (currentQuoteIds.has(id)) joinedReasons.set(id, reason);
    });
    return joinedReasons;
  }, [quoteIds, reasonRows, reasonsQuery.isError]);

  const vendedores = useMemo(() => getFilterOptions(rows, 'vendedor'), [rows]);
  const clientes = useMemo(() => getFilterOptions(rows, 'cliente'), [rows]);
  const filteredRows = useMemo(
    () => filtrarCotacoes(rows, appliedFilters, reasons),
    [appliedFilters, reasons, rows],
  );
  const filteredReasons = useMemo(() => {
    const filteredIds = new Set(filteredRows.map((row) => canonicalQuoteId(row.idCotacao)));
    return new Map(Array.from(reasons).filter(([id]) => filteredIds.has(id)));
  }, [filteredRows, reasons]);
  const kpis = useMemo(() => ({
    ...calcularCotacoesKpis(filteredRows, new Map()),
    motivoMaisFrequente: motivoMaisFrequente(filteredRows, filteredReasons),
  }), [filteredReasons, filteredRows]);

  const applyFilters = (filters: CotacoesFiltros) => {
    setAppliedPeriod({ ...pendingPeriod });
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    const period = createCurrentMonthPeriod();
    const filters = createEmptyFilters();
    setPendingPeriod(period);
    setAppliedPeriod(null);
    setPendingFilters(filters);
    setAppliedFilters(filters);
  };

  const retryQueries = () => {
    void erpQuery.refetch();
    void reasonsQuery.refetch();
  };

  const exportCurrentRows = () => {
    if (!appliedPeriod) return;
    exportCotacoesExcel({
      mode: 'perdidas',
      rows: filteredRows,
      motivos: filteredReasons,
      dataIni: appliedPeriod.dataIni,
      dataFim: appliedPeriod.dataFim,
    });
  };

  const hasError = erpQuery.isError || reasonsQuery.isError;
  const isLoading = erpQuery.isLoading || (rows.length > 0 && reasonsQuery.isLoading);
  const error = erpQuery.isError ? erpQuery.error : reasonsQuery.error;
  const errorTitle = erpQuery.isError
    ? (erpQuery.error as { kind?: string } | null)?.kind === 'configuration'
      ? 'Configuração da integração necessária'
      : 'Erro ao carregar vendas perdidas'
    : 'Erro ao carregar motivos das perdas';

  return (
    <div className="enterprise-page-shell">
      <header className="flex shrink-0 flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-normal">Vendas perdidas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Análise das perdas e registro dos motivos no período selecionado.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={exportCurrentRows} disabled={!consulta || isLoading || hasError || filteredRows.length === 0}>
          <Download aria-hidden="true" className="h-4 w-4" />
          Exportar Excel
        </Button>
      </header>

      <section aria-label="Período de vendas perdidas" className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="perdidas-data-inicial" className="mb-1 block text-xs text-muted-foreground">Data inicial</label>
          <input
            id="perdidas-data-inicial"
            type="date"
            value={pendingPeriod.dataIni}
            onChange={(event) => setPendingPeriod((period) => ({ ...period, dataIni: event.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm tabular-nums"
          />
        </div>
        <div>
          <label htmlFor="perdidas-data-final" className="mb-1 block text-xs text-muted-foreground">Data final</label>
          <input
            id="perdidas-data-final"
            type="date"
            value={pendingPeriod.dataFim}
            onChange={(event) => setPendingPeriod((period) => ({ ...period, dataFim: event.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm tabular-nums"
          />
        </div>
      </section>

      <CotacoesFilters
        mode="perdidas"
        pendingFilters={pendingFilters}
        onPendingFiltersChange={setPendingFilters}
        vendedores={vendedores}
        clientes={clientes}
        motivos={motivoOptions}
        onApply={applyFilters}
        onClear={clearFilters}
      />

      <CotacoesGestorPanel mode="perdidas" rows={filteredRows} motivos={filteredReasons} onSelectCotacao={setDetailQuote} />

      <div className="min-h-0 flex-1 overflow-auto pr-1">
        {!consulta ? (
          <EmptyState
            title="Consulta ainda não realizada"
            message="Aplique os filtros para consultar as vendas perdidas."
            className="min-h-72 border border-border px-4"
          />
        ) : hasError ? (
          <ErrorState
            title={errorTitle}
            message={error instanceof Error ? error.message : 'Não foi possível carregar as vendas perdidas.'}
            onRetry={retryQueries}
          />
        ) : isLoading ? (
          <CotacoesLoading />
        ) : (
          <div className="space-y-3">
            <CotacoesKpis mode="perdidas" kpis={kpis} />
            <CotacoesTable mode="perdidas" rows={filteredRows} motivos={filteredReasons} onEditMotivo={setSelectedQuote} onSelectCotacao={setDetailQuote} />
          </div>
        )}
      </div>

      <CotacaoDetailDrawer
        open={detailQuote !== null}
        onOpenChange={(open) => {
          if (!open) setDetailQuote(null);
        }}
        mode="perdidas"
        cotacao={detailQuote}
        motivos={filteredReasons}
      />

      <MotivoPerdaDialog
        open={selectedQuote !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedQuote(null);
        }}
        cotacao={selectedQuote}
        registro={selectedQuote ? reasons.get(canonicalQuoteId(selectedQuote.idCotacao)) ?? null : null}
      />
    </div>
  );
}
