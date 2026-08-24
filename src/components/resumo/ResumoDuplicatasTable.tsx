import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ChevronLeft, ChevronRight, Building2, FileText } from 'lucide-react';
import { DuplicataAgregada } from '@/types/resumo';
import { formatCurrency, formatInteger } from '@/utils/formatters';
import { cn } from '@/lib/utils';

interface Props {
  duplicatas: DuplicataAgregada[];
}

type SortKey = 'cliente' | 'valor' | 'dataVencimento' | 'diasAtraso' | 'situacao';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 25;

function fmtDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function SituacaoBadge({ d }: { d: DuplicataAgregada }) {
  switch (d.situacao) {
    case 'pago':
      return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15">Pago</Badge>;
    case 'vencida':
      return <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/15">Vencida ({d.diasAtraso}d)</Badge>;
    case 'vence_hoje':
      return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/15">Vence hoje</Badge>;
    default:
      return <Badge variant="outline">A vencer</Badge>;
  }
}

export function ResumoDuplicatasTable({ duplicatas }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('dataVencimento');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const arr = [...duplicatas];
    arr.sort((a, b) => {
      let va: any = a[sortKey as keyof DuplicataAgregada];
      let vb: any = b[sortKey as keyof DuplicataAgregada];
      if (sortKey === 'dataVencimento') {
        va = a.dataVencimento ? new Date(a.dataVencimento).getTime() : 0;
        vb = b.dataVencimento ? new Date(b.dataVencimento).getTime() : 0;
      }
      if (va == null) va = '';
      if (vb == null) vb = '';
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [duplicatas, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const totalsVisible = useMemo(() => {
    let aberto = 0, recebido = 0;
    for (const d of sorted) {
      if (d.status === 'PAGO') recebido += d.valorRecebido;
      else aberto += d.valor;
    }
    return { aberto, recebido };
  }, [sorted]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(0);
  };

  const SortHead = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={cn('cursor-pointer select-none', className)} onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={cn('h-3 w-3 opacity-50', sortKey === k && 'opacity-100 text-primary')} />
      </span>
    </TableHead>
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b bg-sky-500/5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500/15 border border-sky-500/30">
            <FileText className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Faturado a Receber
              <Badge variant="outline" className="bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-400 text-[10px]">
                já faturado · aguarda pagamento
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              {formatInteger(sorted.length)} duplicatas · Aberto {formatCurrency(totalsVisible.aberto)} · Recebido {formatCurrency(totalsVisible.recebido)}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20">
              <TableHead className="w-[110px]">Duplicata</TableHead>
              <SortHead k="cliente">Cliente</SortHead>
              <SortHead k="dataVencimento" className="w-[120px]">Vencimento</SortHead>
              <SortHead k="valor" className="text-right w-[140px]">Valor</SortHead>
              <SortHead k="situacao" className="w-[130px]">Situação</SortHead>
              <TableHead className="w-[140px]">Pedidos</TableHead>
              <TableHead className="w-[140px]">Filial</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  Nenhuma duplicata encontrada com os filtros atuais.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((d) => (
                <TableRow key={d.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-xs">{d.id}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm leading-tight">{d.cliente}</div>
                    <div className="text-[11px] text-muted-foreground">{d.codCliente}</div>
                  </TableCell>
                  <TableCell className="text-sm">{fmtDate(d.dataVencimento)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(d.status === 'PAGO' ? d.valorRecebido : d.valor)}
                  </TableCell>
                  <TableCell><SituacaoBadge d={d} /></TableCell>
                  <TableCell>
                    {d.pedidosVinculados.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span className="text-xs font-mono" title={d.pedidosVinculados.join(', ')}>
                        {d.pedidosVinculados.slice(0, 2).join(', ')}
                        {d.pedidosVinculados.length > 2 && ` +${d.pedidosVinculados.length - 2}`}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      {d.empresas.length === 1 ? d.empresas[0] : `${d.empresas.length} filiais`}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground">
            Página {safePage + 1} de {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
