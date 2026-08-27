import { ArrowRight, CircleAlert, Crosshair, Gauge, Layers3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MotivoPerdaRegistro } from '@/hooks/useMotivosPerda';
import type { CotacaoComercial, CotacaoOrigem } from '@/types/cotacoesComerciais';
import {
  calcularCotacaoPrioridade,
  calcularRadarGestor,
  gerarAcoesGestor,
} from '@/utils/cotacoesComerciais';
import { formatCurrency, formatInteger } from '@/utils/formatters';

type MotivosPerdaMap = ReadonlyMap<string, Pick<MotivoPerdaRegistro, 'motivo' | 'observacao'>>;

interface CotacoesGestorPanelProps {
  mode: CotacaoOrigem;
  rows: readonly CotacaoComercial[];
  motivos: MotivosPerdaMap;
  onSelectCotacao?: (row: CotacaoComercial) => void;
}

const faixaColors = ['bg-primary/80', 'bg-sky-500/80', 'bg-amber-500/80', 'bg-destructive/80'];

function findQuote(rows: readonly CotacaoComercial[], id?: string) {
  if (!id) return null;
  return rows.find((row) => row.idCotacao === id) ?? null;
}

export function CotacoesGestorPanel({ mode, rows, motivos, onSelectCotacao }: CotacoesGestorPanelProps) {
  const radar = calcularRadarGestor(rows, mode, motivos);
  const acoes = gerarAcoesGestor(rows, mode, motivos);
  const melhorPrioridade = radar.melhorOportunidade
    ? calcularCotacaoPrioridade(radar.melhorOportunidade, mode)
    : null;
  const principalLabel = mode === 'abertas' ? 'Dinheiro parado' : 'Valor perdido';
  const criticLabel = mode === 'abertas' ? 'Valor vencido/quente' : 'Perdas críticas';

  return (
    <section aria-label="Radar do gestor" className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <Crosshair aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
              Radar do gestor
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Leitura executiva do que merece atenção no período filtrado.
            </p>
          </div>
          <div className="rounded-md border border-border bg-background px-2 py-1 text-xs tabular-nums text-muted-foreground">
            {formatInteger(rows.length)} registro(s)
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border border-border/70 bg-background/50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Layers3 aria-hidden="true" className="h-3.5 w-3.5" />
              {principalLabel}
            </div>
            <p className="mt-1 truncate text-base font-semibold tabular-nums" title={formatCurrency(radar.valorPrincipal)}>
              {formatCurrency(radar.valorPrincipal)}
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-background/50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CircleAlert aria-hidden="true" className="h-3.5 w-3.5" />
              {criticLabel}
            </div>
            <p className="mt-1 truncate text-base font-semibold tabular-nums" title={formatCurrency(radar.valorCritico)}>
              {formatCurrency(radar.valorCritico)}
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-background/50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Gauge aria-hidden="true" className="h-3.5 w-3.5" />
              Recuperável
            </div>
            <p className="mt-1 truncate text-base font-semibold tabular-nums" title={formatCurrency(radar.potencialRecuperavel)}>
              {formatCurrency(radar.potencialRecuperavel)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_12rem]">
          <div>
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              {radar.faixasIdade.map((faixa, index) => {
                const width = radar.valorPrincipal > 0 ? Math.max(4, (faixa.valor / radar.valorPrincipal) * 100) : 25;
                return (
                  <div key={faixa.label} className={faixaColors[index]} style={{ width: `${width}%` }} />
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {radar.faixasIdade.map((faixa, index) => (
                <div key={faixa.label} className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn('h-2 w-2 rounded-full', faixaColors[index])} />
                    {faixa.label}
                  </div>
                  <p className="mt-0.5 text-xs font-medium tabular-nums">{formatInteger(faixa.quantidade)} · {formatCurrency(faixa.valor)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-border/70 bg-background/50 p-3">
            <p className="text-xs text-muted-foreground">Melhor alvo</p>
            <p className="mt-1 truncate text-sm font-semibold" title={radar.melhorOportunidade?.nomeCliente || undefined}>
              {radar.melhorOportunidade?.nomeCliente || 'Sem alvo'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {melhorPrioridade ? `${melhorPrioridade.label} · ${melhorPrioridade.score}/100` : 'Aguardando dados'}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
          O que fazer hoje
        </div>
        <div className="mt-3 space-y-2">
          {acoes.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
              Aplique filtros ou aguarde dados para gerar ações.
            </p>
          ) : acoes.map((acao) => {
            const quote = findQuote(rows, acao.cotacaoId);
            return (
              <button
                key={`${acao.titulo}-${acao.cotacaoId ?? ''}`}
                type="button"
                onClick={() => quote && onSelectCotacao?.(quote)}
                className="w-full rounded-md border border-border/70 bg-background/45 p-3 text-left transition-colors hover:bg-muted/60 disabled:cursor-default"
                disabled={!quote}
              >
                <span className="block text-sm font-semibold">{acao.titulo}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{acao.descricao}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
