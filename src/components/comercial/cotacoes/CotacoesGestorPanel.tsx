import { ArrowRight, CircleAlert, Clock3 } from 'lucide-react';
import type { MotivoPerdaRegistro } from '@/hooks/useMotivosPerda';
import type { CotacaoComercial, CotacaoOrigem } from '@/types/cotacoesComerciais';
import {
  calcularRadarGestor,
  gerarAcoesGestor,
  motivoMaisFrequenteDetalhe,
} from '@/utils/cotacoesComerciais';
import { formatCurrency, formatInteger } from '@/utils/formatters';

type MotivosPerdaMap = ReadonlyMap<string, Pick<MotivoPerdaRegistro, 'motivo' | 'observacao'>>;

interface CotacoesGestorPanelProps {
  mode: CotacaoOrigem;
  rows: readonly CotacaoComercial[];
  motivos: MotivosPerdaMap;
  onSelectCotacao?: (row: CotacaoComercial) => void;
}

function findQuote(rows: readonly CotacaoComercial[], id?: string) {
  if (!id) return null;
  return rows.find((row) => row.idCotacao === id) ?? null;
}

function formatToday(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
}

function findLongestOpenQuote(rows: readonly CotacaoComercial[]): CotacaoComercial | null {
  return rows.reduce<CotacaoComercial | null>((longestOpen, row) => {
    if (!longestOpen) return row;
    if (row.diasEmAberto > longestOpen.diasEmAberto) return row;
    if (row.diasEmAberto === longestOpen.diasEmAberto && row.dataCotacao < longestOpen.dataCotacao) return row;
    return longestOpen;
  }, null);
}

function CotacoesAbertasPriorities({
  rows,
  motivos,
  onSelectCotacao,
}: Omit<CotacoesGestorPanelProps, 'mode'>) {
  const radar = calcularRadarGestor(rows, 'abertas', motivos);
  const acoes = gerarAcoesGestor(rows, 'abertas', motivos);
  const longestOpen = findLongestOpenQuote(rows);
  const vencidas = rows.filter((row) => row.dataValidade !== null && row.dataValidade < formatToday()).length;

  return (
    <section aria-label="Prioridades de cotacoes abertas" className="border-y border-border bg-card">
      <div className="flex min-h-10 items-center justify-between gap-3 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <Clock3 aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">Prioridades de cotacoes abertas</span>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatInteger(rows.length)} registro(s)</span>
      </div>

      <div className="grid min-w-0 border-t border-border md:grid-cols-2 lg:grid-cols-[10rem_minmax(14rem,1fr)_12rem_minmax(18rem,1.25fr)]">
        <div className="border-b border-border px-3 py-2 md:border-r lg:border-b-0">
          <span className="block text-xs text-muted-foreground">Vencidas</span>
          <strong className="mt-0.5 block text-sm tabular-nums text-destructive">{formatInteger(vencidas)}</strong>
        </div>
        <button
          type="button"
          className="min-w-0 border-b border-border px-3 py-2 text-left transition-colors hover:bg-muted/60 disabled:cursor-default md:border-b lg:border-r lg:border-b-0"
          disabled={!longestOpen}
          onClick={() => longestOpen && onSelectCotacao?.(longestOpen)}
        >
          <span className="block text-xs text-muted-foreground">Maior tempo em aberto</span>
          <span className="mt-0.5 block truncate text-sm font-semibold" title={longestOpen?.nomeCliente}>
            {longestOpen ? `${longestOpen.nomeCliente || `Cotacao ${longestOpen.numeroCotacao}`} · ${formatInteger(longestOpen.diasEmAberto)} dias` : 'Sem cotacoes no periodo'}
          </span>
        </button>
        <div className="border-b border-border px-3 py-2 md:border-r md:border-b-0">
          <span className="block text-xs text-muted-foreground">Valor vencido/quente</span>
          <strong className="mt-0.5 block truncate text-sm tabular-nums" title={formatCurrency(radar.valorCritico)}>{formatCurrency(radar.valorCritico)}</strong>
        </div>
        <div className="flex min-w-0 items-stretch divide-x divide-border md:border-b-0">
          {acoes.length === 0 ? (
            <span className="flex items-center px-3 py-2 text-xs text-muted-foreground">Aguardando dados para priorizar contatos.</span>
          ) : acoes.slice(0, 2).map((acao) => {
            const quote = findQuote(rows, acao.cotacaoId);
            return (
              <button
                key={`${acao.titulo}-${acao.cotacaoId ?? ''}`}
                type="button"
                onClick={() => quote && onSelectCotacao?.(quote)}
                className="min-w-0 flex-1 px-3 py-2 text-left transition-colors hover:bg-muted/60 disabled:cursor-default"
                disabled={!quote}
              >
                <span className="flex items-center gap-1 text-xs font-semibold">
                  <span className="truncate">{acao.titulo}</span>
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-primary" />
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground" title={acao.descricao}>{acao.descricao}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function findLargestLostSale(rows: readonly CotacaoComercial[]): CotacaoComercial | null {
  return rows.reduce<CotacaoComercial | null>((largestLoss, row) => (
    !largestLoss || row.valor > largestLoss.valor ? row : largestLoss
  ), null);
}

function findMostFrequentLossReason(rows: readonly CotacaoComercial[], motivos: MotivosPerdaMap) {
  return motivoMaisFrequenteDetalhe(rows, motivos);
}

function VendasPerdidasConcentration({
  rows,
  motivos,
  onSelectCotacao,
}: Omit<CotacoesGestorPanelProps, 'mode'>) {
  const motivoMaisFrequente = findMostFrequentLossReason(rows, motivos);
  const maiorPerda = findLargestLostSale(rows);

  return (
    <section aria-label="Concentracao de vendas perdidas" className="border-y border-border bg-card">
      <div className="flex min-h-10 items-center justify-between gap-3 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0 text-destructive" />
          <span className="truncate">Concentracao de vendas perdidas</span>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatInteger(rows.length)} registro(s)</span>
      </div>

      <div className="grid min-w-0 border-t border-border md:grid-cols-[minmax(14rem,1fr)_minmax(16rem,1.2fr)]">
        <div className="min-w-0 border-b border-border px-3 py-2 md:border-b-0 md:border-r">
          <span className="block text-xs text-muted-foreground">Motivo mais frequente</span>
          <strong className="mt-0.5 block truncate text-sm" title={motivoMaisFrequente?.label}>
            {motivoMaisFrequente?.label ?? 'Sem motivos registrados'}
          </strong>
          {motivoMaisFrequente && <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">{formatInteger(motivoMaisFrequente.quantidade)} perda(s)</span>}
        </div>
        <button
          type="button"
          className="min-w-0 px-3 py-2 text-left transition-colors hover:bg-muted/60 disabled:cursor-default"
          disabled={!maiorPerda}
          onClick={() => maiorPerda && onSelectCotacao?.(maiorPerda)}
        >
          <span className="block text-xs text-muted-foreground">Maior perda de valor</span>
          <span className="mt-0.5 block truncate text-sm font-semibold" title={maiorPerda?.nomeCliente}>
            {maiorPerda ? maiorPerda.nomeCliente || `Cotacao ${maiorPerda.numeroCotacao}` : 'Sem vendas perdidas no periodo'}
          </span>
          {maiorPerda && <span className="mt-0.5 block text-xs tabular-nums text-destructive">{formatCurrency(maiorPerda.valor)}</span>}
        </button>
      </div>
    </section>
  );
}

export function CotacoesGestorPanel({ mode, rows, motivos, onSelectCotacao }: CotacoesGestorPanelProps) {
  if (mode === 'abertas') {
    return <CotacoesAbertasPriorities rows={rows} motivos={motivos} onSelectCotacao={onSelectCotacao} />;
  }

  return <VendasPerdidasConcentration rows={rows} motivos={motivos} onSelectCotacao={onSelectCotacao} />;
}
