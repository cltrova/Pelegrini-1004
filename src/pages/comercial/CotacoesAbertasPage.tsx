import { useMemo, useRef, useState } from 'react';
import { CircleAlert, Download, RefreshCw } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { CotacaoDetailDrawer } from '@/components/comercial/cotacoes/CotacaoDetailDrawer';
import { CotacoesFilters, type CotacoesFilterOption } from '@/components/comercial/cotacoes/CotacoesFilters';
import { CotacoesGestorPanel } from '@/components/comercial/cotacoes/CotacoesGestorPanel';
import { CotacoesKpis } from '@/components/comercial/cotacoes/CotacoesKpis';
import { CotacoesTable } from '@/components/comercial/cotacoes/CotacoesTable';
import {
  ComercialCommandBar,
  ComercialCompactPage,
  ComercialDataViewport,
} from '@/components/comercial/compact';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCotacoesAbertas } from '@/hooks/useCotacoesComerciais';
import type { CotacaoComercial, CotacoesFiltros } from '@/types/cotacoesComerciais';
import { calcularCotacoesKpis, filtrarCotacoes } from '@/utils/cotacoesComerciais';
import { exportCotacoesExcel } from '@/utils/cotacoesExcel';

interface PeriodoCotacoes {
  dataIni: string;
  dataFim: string;
}

interface ResolvedOpenQuotesView {
  rows: readonly CotacaoComercial[];
  filters: CotacoesFiltros;
  period: PeriodoCotacoes;
}

const emptyMotivos = new Map();
const emptyRows: readonly CotacaoComercial[] = [];

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

function sortOpenQuotes(rows: readonly CotacaoComercial[]): CotacaoComercial[] {
  return [...rows].sort((left, right) => (
    right.diasEmAberto - left.diasEmAberto
    || left.dataCotacao.localeCompare(right.dataCotacao)
  ));
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
    <section aria-label="Carregando cotacoes abertas" className="space-y-3" aria-busy="true">
      <div className="grid grid-cols-2 gap-px border border-border sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-20 rounded-none" />)}
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-80 w-full" />
    </section>
  );
}

export default function CotacoesAbertasPage() {
  const [pendingPeriod, setPendingPeriod] = useState(createCurrentMonthPeriod);
  const [appliedPeriod, setAppliedPeriod] = useState<PeriodoCotacoes | null>(null);
  const [pendingFilters, setPendingFilters] = useState<CotacoesFiltros>(createEmptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<CotacoesFiltros>(createEmptyFilters);
  const [selectedQuote, setSelectedQuote] = useState<CotacaoComercial | null>(null);
  const resolvedViewRef = useRef<ResolvedOpenQuotesView | null>(null);

  const consulta = useMemo(() => appliedPeriod ? ({
    dataIni: appliedPeriod.dataIni,
    dataFim: appliedPeriod.dataFim,
    codVendedor: queryFilterValue(appliedFilters.vendedores),
    codCliente: queryFilterValue(appliedFilters.clientes),
  }) : null, [appliedFilters.clientes, appliedFilters.vendedores, appliedPeriod]);
  const { data, isLoading, isFetching, isPlaceholderData, isError, error, refetch } = useCotacoesAbertas(consulta);
  const hasSuccessfulResponse = consulta !== null
    && appliedPeriod !== null
    && data !== undefined
    && !isLoading
    && !isPlaceholderData
    && !isError;
  if (hasSuccessfulResponse) {
    resolvedViewRef.current = {
      rows: data,
      filters: appliedFilters,
      period: appliedPeriod,
    };
  }
  const resolvedView = consulta ? resolvedViewRef.current : null;
  const hasResolvedRows = resolvedView !== null;
  const showInitialLoading = consulta !== null && !hasResolvedRows && (isLoading || isFetching || isPlaceholderData);
  const isRefreshing = consulta !== null && hasResolvedRows && (isLoading || isFetching || isPlaceholderData);
  const showBlockingError = consulta !== null && isError && !hasResolvedRows;
  const showRefreshError = consulta !== null && isError && hasResolvedRows;
  const rows = resolvedView?.rows ?? emptyRows;
  const visibleFilters = resolvedView?.filters ?? appliedFilters;

  const vendedores = useMemo(() => getFilterOptions(rows, 'vendedor'), [rows]);
  const clientes = useMemo(() => getFilterOptions(rows, 'cliente'), [rows]);
  const filteredRows = useMemo(
    () => sortOpenQuotes(filtrarCotacoes(rows, visibleFilters)),
    [rows, visibleFilters],
  );
  const kpis = useMemo(() => {
    const today = formatDateInput(new Date());
    const base = calcularCotacoesKpis(filteredRows, emptyMotivos);
    const tempoMedioEmAberto = filteredRows.length
      ? filteredRows.reduce((total, row) => total + row.diasEmAberto, 0) / filteredRows.length
      : 0;

    return {
      ...base,
      tempoMedioEmAberto,
      cotacoesVencidas: filteredRows.filter((row) => row.dataValidade !== null && row.dataValidade < today).length,
    };
  }, [filteredRows]);

  const applyFilters = (filters: CotacoesFiltros) => {
    setAppliedPeriod({ ...pendingPeriod });
    setAppliedFilters(filters);
  };

  const clearPendingFilters = () => {
    const period = createCurrentMonthPeriod();
    const filters = createEmptyFilters();
    setPendingPeriod(period);
    setAppliedPeriod(null);
    setPendingFilters(filters);
    setAppliedFilters(filters);
    resolvedViewRef.current = null;
  };

  const exportCurrentRows = () => {
    if (!resolvedView) return;
    exportCotacoesExcel({
      mode: 'abertas',
      rows: filteredRows,
      dataIni: resolvedView.period.dataIni,
      dataFim: resolvedView.period.dataFim,
    });
  };

  return (
    <ComercialCompactPage className="commercial-quotes">
      <ComercialCommandBar
        title="Cotacoes abertas"
        actions={(
          <Button type="button" variant="outline" size="sm" onClick={exportCurrentRows} disabled={!consulta || showInitialLoading || showBlockingError || filteredRows.length === 0}>
          <Download aria-hidden="true" className="h-4 w-4" />
          Exportar Excel
          </Button>
        )}
      />

      <section aria-label="Periodo de cotacoes" className="flex flex-wrap items-end gap-2 border-b border-border pb-2">
        <div className="space-y-1">
          <label htmlFor="cotacoes-data-inicial" className="mb-1 block text-xs text-muted-foreground">Data inicial</label>
          <input
            id="cotacoes-data-inicial"
            type="date"
            value={pendingPeriod.dataIni}
            onChange={(event) => setPendingPeriod((period) => ({ ...period, dataIni: event.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm tabular-nums"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="cotacoes-data-final" className="mb-1 block text-xs text-muted-foreground">Data final</label>
          <input
            id="cotacoes-data-final"
            type="date"
            value={pendingPeriod.dataFim}
            onChange={(event) => setPendingPeriod((period) => ({ ...period, dataFim: event.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm tabular-nums"
          />
        </div>
      </section>

      <CotacoesFilters
        mode="abertas"
        pendingFilters={pendingFilters}
        onPendingFiltersChange={setPendingFilters}
        vendedores={vendedores}
        clientes={clientes}
        motivos={[]}
        onApply={applyFilters}
        onClear={clearPendingFilters}
        isApplying={showInitialLoading || isRefreshing}
      />

      {showRefreshError && (
        <div role="alert" className="flex items-center gap-3 border border-destructive/35 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">Não foi possível atualizar as cotações. {error instanceof Error ? error.message : 'Tente novamente.'}</span>
          <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 gap-2 text-destructive hover:text-destructive" onClick={() => void refetch()}>
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
            Tentar novamente
          </Button>
        </div>
      )}

      {consulta && !showInitialLoading && !showBlockingError && (
        <>
          <CotacoesKpis mode="abertas" kpis={kpis} />
          <CotacoesGestorPanel mode="abertas" rows={filteredRows} motivos={emptyMotivos} onSelectCotacao={setSelectedQuote} />
        </>
      )}

      <ComercialDataViewport className="commercial-table-frame">
        {!consulta ? (
          <EmptyState
            title="Consulta ainda não realizada"
            message="Aplique os filtros para consultar as cotacoes abertas."
            className="min-h-72 border border-border px-4"
          />
        ) : showBlockingError ? (
          <ErrorState
            title={(error as { kind?: string } | null)?.kind === 'configuration'
              ? 'Configuracao da integracao necessaria'
              : 'Erro ao carregar cotacoes abertas'}
            message={error instanceof Error ? error.message : 'Nao foi possivel carregar as cotacoes abertas.'}
            onRetry={() => refetch()}
          />
        ) : showInitialLoading ? (
          <CotacoesLoading />
        ) : (
          <CotacoesTable mode="abertas" rows={filteredRows} motivos={emptyMotivos} onSelectCotacao={setSelectedQuote} />
        )}
      </ComercialDataViewport>

      <CotacaoDetailDrawer
        open={selectedQuote !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedQuote(null);
        }}
        mode="abertas"
        cotacao={selectedQuote}
        motivos={emptyMotivos}
      />
    </ComercialCompactPage>
  );
}
