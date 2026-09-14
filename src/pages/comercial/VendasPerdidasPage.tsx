import { useMemo, useRef, useState } from 'react';
import { CircleAlert, Download, RefreshCw } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { CotacaoDetailDrawer } from '@/components/comercial/cotacoes/CotacaoDetailDrawer';
import { CotacoesFilters, type CotacoesFilterOption } from '@/components/comercial/cotacoes/CotacoesFilters';
import { CotacoesGestorPanel } from '@/components/comercial/cotacoes/CotacoesGestorPanel';
import { CotacoesKpis } from '@/components/comercial/cotacoes/CotacoesKpis';
import { CotacoesTable } from '@/components/comercial/cotacoes/CotacoesTable';
import { MotivoPerdaDialog } from '@/components/comercial/cotacoes/MotivoPerdaDialog';
import {
  ComercialCommandBar,
  ComercialCompactPage,
  ComercialDataViewport,
} from '@/components/comercial/compact';
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

interface ResolvedLostSalesView {
  rows: readonly CotacaoComercial[];
  reasons: readonly MotivoPerdaRegistro[];
  filters: CotacoesFiltros;
  period: PeriodoCotacoes;
}

const emptyRows: readonly CotacaoComercial[] = [];
const emptyReasons: readonly MotivoPerdaRegistro[] = [];

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
  const resolvedViewRef = useRef<ResolvedLostSalesView | null>(null);

  const consulta = useMemo(() => appliedPeriod ? ({
    dataIni: appliedPeriod.dataIni,
    dataFim: appliedPeriod.dataFim,
    codVendedor: queryFilterValue(appliedFilters.vendedores),
    codCliente: queryFilterValue(appliedFilters.clientes),
  }) : null, [appliedFilters.clientes, appliedFilters.vendedores, appliedPeriod]);

  const erpQuery = useVendasPerdidas(consulta);
  const candidateRows = consulta
    && erpQuery.data !== undefined
    && !erpQuery.isLoading
    && !erpQuery.isPlaceholderData
    && !erpQuery.isError
    ? erpQuery.data
    : null;
  const rowsForReasons = candidateRows ?? resolvedViewRef.current?.rows ?? emptyRows;
  const queryQuoteIds = useMemo(() => rowsForReasons.map((row) => canonicalQuoteId(row.idCotacao)), [rowsForReasons]);
  const reasonsQuery = useMotivosPerda10041(queryQuoteIds);
  const candidateReasons = candidateRows?.length === 0
    ? emptyReasons
    : !reasonsQuery.isLoading
      && !reasonsQuery.isPlaceholderData
      && !reasonsQuery.isError
      && reasonsQuery.data !== undefined
      ? reasonsQuery.data
      : null;
  if (candidateRows !== null && candidateReasons !== null && appliedPeriod !== null) {
    resolvedViewRef.current = {
      rows: candidateRows,
      reasons: candidateReasons,
      filters: appliedFilters,
      period: appliedPeriod,
    };
  }
  const resolvedView = consulta ? resolvedViewRef.current : null;
  const hasResolvedView = resolvedView !== null;
  const rows = resolvedView?.rows ?? emptyRows;
  const reasonRows = resolvedView?.reasons ?? emptyReasons;
  const visibleFilters = resolvedView?.filters ?? appliedFilters;

  const reasons = useMemo(() => {
    const currentQuoteIds = new Set(rows.map((row) => canonicalQuoteId(row.idCotacao)));
    const joinedReasons = new Map<string, MotivoPerdaRegistro>();
    reasonRows.forEach((reason) => {
      const id = canonicalQuoteId(reason.id_cotacao);
      if (currentQuoteIds.has(id)) joinedReasons.set(id, reason);
    });
    return joinedReasons;
  }, [reasonRows, rows]);

  const vendedores = useMemo(() => getFilterOptions(rows, 'vendedor'), [rows]);
  const clientes = useMemo(() => getFilterOptions(rows, 'cliente'), [rows]);
  const filteredRows = useMemo(
    () => filtrarCotacoes(rows, visibleFilters, reasons),
    [reasons, rows, visibleFilters],
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
    resolvedViewRef.current = null;
  };

  const retryQueries = () => {
    void erpQuery.refetch();
    void reasonsQuery.refetch();
  };

  const exportCurrentRows = () => {
    if (!resolvedView) return;
    exportCotacoesExcel({
      mode: 'perdidas',
      rows: filteredRows,
      motivos: filteredReasons,
      dataIni: resolvedView.period.dataIni,
      dataFim: resolvedView.period.dataFim,
    });
  };

  const hasError = erpQuery.isError || reasonsQuery.isError;
  const showBlockingError = consulta !== null && hasError && !hasResolvedView;
  const showRefreshError = consulta !== null && hasError && hasResolvedView;
  const showInitialLoading = consulta !== null && !hasResolvedView && (erpQuery.isLoading || reasonsQuery.isLoading);
  const isRefreshing = consulta !== null && hasResolvedView && (
    erpQuery.isLoading
    || erpQuery.isFetching
    || erpQuery.isPlaceholderData
    || reasonsQuery.isLoading
    || reasonsQuery.isFetching
    || reasonsQuery.isPlaceholderData
  );
  const error = erpQuery.isError ? erpQuery.error : reasonsQuery.error;
  const errorTitle = erpQuery.isError
    ? (erpQuery.error as { kind?: string } | null)?.kind === 'configuration'
      ? 'Configuração da integração necessária'
      : 'Erro ao carregar vendas perdidas'
    : 'Erro ao carregar motivos das perdas';

  return (
    <ComercialCompactPage className="commercial-lost-sales">
      <ComercialCommandBar
        title="Vendas perdidas"
        actions={(
          <Button type="button" variant="outline" size="sm" onClick={exportCurrentRows} disabled={!consulta || showInitialLoading || showBlockingError || filteredRows.length === 0}>
            <Download aria-hidden="true" className="h-4 w-4" />
            Exportar Excel
          </Button>
        )}
      />

      <section aria-label="Período de vendas perdidas" className="flex flex-wrap items-end gap-2 border-b border-border pb-2">
        <div className="space-y-1">
          <label htmlFor="perdidas-data-inicial" className="mb-1 block text-xs text-muted-foreground">Data inicial</label>
          <input
            id="perdidas-data-inicial"
            type="date"
            value={pendingPeriod.dataIni}
            onChange={(event) => setPendingPeriod((period) => ({ ...period, dataIni: event.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm tabular-nums"
          />
        </div>
        <div className="space-y-1">
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
        isApplying={showInitialLoading || isRefreshing}
      />

      {showRefreshError && (
        <div role="alert" className="flex items-center gap-3 border border-destructive/35 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">Não foi possível atualizar as vendas perdidas. {error instanceof Error ? error.message : 'Tente novamente.'}</span>
          <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 gap-2 text-destructive hover:text-destructive" onClick={retryQueries}>
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
            Tentar novamente
          </Button>
        </div>
      )}

      {consulta && !showInitialLoading && !showBlockingError && (
        <>
          <CotacoesKpis mode="perdidas" kpis={kpis} />
          <CotacoesGestorPanel mode="perdidas" rows={filteredRows} motivos={filteredReasons} onSelectCotacao={setDetailQuote} />
        </>
      )}

      <ComercialDataViewport className="commercial-table-frame">
        {!consulta ? (
          <EmptyState
            title="Consulta ainda não realizada"
            message="Aplique os filtros para consultar as vendas perdidas."
            className="min-h-72 border border-border px-4"
          />
        ) : showBlockingError ? (
          <ErrorState
            title={errorTitle}
            message={error instanceof Error ? error.message : 'Não foi possível carregar as vendas perdidas.'}
            onRetry={retryQueries}
          />
        ) : showInitialLoading ? (
          <CotacoesLoading />
        ) : (
          <CotacoesTable mode="perdidas" rows={filteredRows} motivos={filteredReasons} onEditMotivo={setSelectedQuote} onSelectCotacao={setDetailQuote} />
        )}
      </ComercialDataViewport>

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
    </ComercialCompactPage>
  );
}
