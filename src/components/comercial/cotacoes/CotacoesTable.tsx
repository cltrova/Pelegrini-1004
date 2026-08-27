import { Eye, MessageSquarePlus, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { MotivoPerdaRegistro } from '@/hooks/useMotivosPerda';
import type { CotacaoComercial, CotacaoOrigem, CotacaoStatus } from '@/types/cotacoesComerciais';
import { consolidarMotivoPerda } from '@/utils/cotacoesComerciais';
import { formatCurrency, formatInteger } from '@/utils/formatters';

type MotivosPerdaMap = ReadonlyMap<string, Pick<MotivoPerdaRegistro, 'motivo' | 'observacao'>>;

interface CotacoesTableProps {
  mode: CotacaoOrigem;
  rows: readonly CotacaoComercial[];
  motivos: MotivosPerdaMap;
  onEditMotivo?: (row: CotacaoComercial) => void;
  onSelectCotacao?: (row: CotacaoComercial) => void;
}

const statusLabels: Record<CotacaoStatus, string> = {
  aberta: 'Aberta',
  cancelada: 'Cancelada',
  recusada: 'Recusada',
  vencida: 'Vencida',
};

const statusVariants: Record<CotacaoStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  aberta: 'default',
  cancelada: 'secondary',
  recusada: 'destructive',
  vencida: 'outline',
};

function formatDate(value: string | null): string {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '--';
}

function getMotivoLabel(row: CotacaoComercial, motivos: MotivosPerdaMap): string {
  return consolidarMotivoPerda(row, motivos).label;
}

function MotivoAction({
  row,
  motivos,
  onEditMotivo,
}: {
  row: CotacaoComercial;
  motivos: MotivosPerdaMap;
  onEditMotivo?: (row: CotacaoComercial) => void;
}) {
  if (!onEditMotivo) return null;

  const hasMotivo = motivos.has(row.idCotacao);
  const label = hasMotivo ? 'Editar motivo da perda' : 'Registrar motivo da perda';
  const Icon = hasMotivo ? Pencil : MessageSquarePlus;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={label} onClick={() => onEditMotivo(row)}>
            <Icon aria-hidden="true" className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function DetailAction({
  row,
  onSelectCotacao,
}: {
  row: CotacaoComercial;
  onSelectCotacao?: (row: CotacaoComercial) => void;
}) {
  if (!onSelectCotacao) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Ver detalhes da cotação" onClick={() => onSelectCotacao(row)}>
            <Eye aria-hidden="true" className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ver detalhes da cotação</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StatusBadge({ status }: { status: CotacaoStatus }) {
  return <Badge variant={statusVariants[status]} className="whitespace-nowrap text-[11px]">{statusLabels[status]}</Badge>;
}

function EmptyState({ mode }: { mode: CotacaoOrigem }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-muted-foreground">
      {mode === 'abertas' ? 'Nenhuma cotacao aberta encontrada.' : 'Nenhuma venda perdida encontrada.'}
    </div>
  );
}

export function CotacoesTable({ mode, rows, motivos, onEditMotivo, onSelectCotacao }: CotacoesTableProps) {
  const isOpenQuotes = mode === 'abertas';

  return (
    <section aria-label="Lista de cotacoes">
      <div className="hidden overflow-x-auto border border-border md:block">
        {rows.length === 0 ? <EmptyState mode={mode} /> : (
          <div className="max-h-[34rem] min-w-[67rem] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-medium">Cotacao</th>
                  <th scope="col" className="px-3 py-2 font-medium">{isOpenQuotes ? 'Emissao' : 'Data'}</th>
                  {isOpenQuotes && <th scope="col" className="px-3 py-2 font-medium">Validade</th>}
                  <th scope="col" className="px-3 py-2 font-medium">Cliente</th>
                  <th scope="col" className="px-3 py-2 font-medium">Vendedor</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Valor</th>
                  <th scope="col" className="px-3 py-2 text-center font-medium">Status</th>
                  {isOpenQuotes ? (
                    <th scope="col" className="px-3 py-2 text-right font-medium">Dias em aberto</th>
                  ) : (
                    <th scope="col" className="px-3 py-2 font-medium">Motivo da perda</th>
                  )}
                  <th scope="col" className="w-12 px-2 py-2 text-center font-medium">Detalhes</th>
                  {!isOpenQuotes && <th scope="col" className="w-12 px-2 py-2 text-center font-medium">Acao</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.idCotacao} className="border-b border-border/70 last:border-b-0 hover:bg-muted/50">
                    <td className="px-3 py-2 font-medium tabular-nums">{row.numeroCotacao}</td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatDate(row.dataCotacao)}</td>
                    {isOpenQuotes && <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatDate(row.dataValidade)}</td>}
                    <td className="max-w-[15rem] px-3 py-2"><span className="block truncate" title={row.nomeCliente}>{row.nomeCliente || '--'}</span></td>
                    <td className="max-w-[13rem] px-3 py-2"><span className="block truncate" title={row.nomeVendedor}>{row.nomeVendedor || '--'}</span></td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{formatCurrency(row.valor)}</td>
                    <td className="px-3 py-2 text-center"><StatusBadge status={row.status} /></td>
                    {isOpenQuotes ? (
                      <td className="px-3 py-2 text-right tabular-nums">{formatInteger(row.diasEmAberto)}</td>
                    ) : (
                      <td className="max-w-[14rem] px-3 py-2"><span className="block truncate" title={getMotivoLabel(row, motivos)}>{getMotivoLabel(row, motivos)}</span></td>
                    )}
                    <td className="px-2 py-1 text-center"><DetailAction row={row} onSelectCotacao={onSelectCotacao} /></td>
                    {!isOpenQuotes && <td className="px-2 py-1 text-center"><MotivoAction row={row} motivos={motivos} onEditMotivo={onEditMotivo} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-2 md:hidden">
        {rows.length === 0 ? <div className="border border-border"><EmptyState mode={mode} /></div> : rows.map((row) => (
          <article key={row.idCotacao} className="border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold tabular-nums">Cotacao {row.numeroCotacao}</p>
                <p className="truncate text-sm text-muted-foreground" title={row.nomeCliente}>{row.nomeCliente || '--'}</p>
              </div>
              <StatusBadge status={row.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              {isOpenQuotes ? (
                <>
                  <div><dt className="text-xs text-muted-foreground">Data</dt><dd className="tabular-nums">{formatDate(row.dataCotacao)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Validade</dt><dd className="tabular-nums">{formatDate(row.dataValidade)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Valor</dt><dd className="font-medium tabular-nums">{formatCurrency(row.valor)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Dias em aberto</dt><dd className="tabular-nums">{formatInteger(row.diasEmAberto)}</dd></div>
                  <div className="col-span-2"><dt className="text-xs text-muted-foreground">Vendedor</dt><dd className="truncate" title={row.nomeVendedor}>{row.nomeVendedor || '--'}</dd></div>
                </>
              ) : (
                <>
                  <div><dt className="text-xs text-muted-foreground">Data</dt><dd className="tabular-nums">{formatDate(row.dataCotacao)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Valor</dt><dd className="font-medium tabular-nums">{formatCurrency(row.valor)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Vendedor</dt><dd className="truncate" title={row.nomeVendedor}>{row.nomeVendedor || '--'}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Motivo</dt><dd className="truncate" title={getMotivoLabel(row, motivos)}>{getMotivoLabel(row, motivos)}</dd></div>
                </>
              )}
            </dl>
            <div className="mt-3 flex justify-end gap-1">
              <DetailAction row={row} onSelectCotacao={onSelectCotacao} />
              {!isOpenQuotes && <MotivoAction row={row} motivos={motivos} onEditMotivo={onEditMotivo} />}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
