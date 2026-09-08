import { useMemo, useState } from 'react';
import {
  EnterpriseBadge,
  EnterpriseDataPanel,
  EnterpriseTable,
  EnterpriseTbody,
  EnterpriseTd,
  EnterpriseTh,
  EnterpriseThead,
  EnterpriseTr,
} from '@/components/enterprise';
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
      let va: string | number = a[sortKey as keyof DuplicataAgregada] as string | number;
      let vb: string | number = b[sortKey as keyof DuplicataAgregada] as string | number;
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
    <EnterpriseTh className={cn('cursor-pointer select-none', className)} onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={cn('h-3 w-3 opacity-50', sortKey === k && 'opacity-100 text-primary')} />
      </span>
    </EnterpriseTh>
  );

  return (
    <EnterpriseDataPanel
      title="Faturado a Receber"
      description={`${formatInteger(sorted.length)} duplicatas | Aberto ${formatCurrency(totalsVisible.aberto)} | Recebido ${formatCurrency(totalsVisible.recebido)}`}
      actions={<EnterpriseBadge tone="info"><FileText className="h-3 w-3" /> ja faturado | aguarda pagamento</EnterpriseBadge>}
      noPadding
    >
      <EnterpriseTable className="rounded-none border-0">
          <EnterpriseThead>
            <EnterpriseTr>
              <EnterpriseTh className="w-[110px]">Duplicata</EnterpriseTh>
              <SortHead k="cliente">Cliente</SortHead>
              <SortHead k="dataVencimento" className="w-[120px]">Vencimento</SortHead>
              <SortHead k="valor" className="w-[140px] text-right">Valor</SortHead>
              <SortHead k="situacao" className="w-[130px]">Situação</SortHead>
              <EnterpriseTh className="w-[140px]">Pedidos</EnterpriseTh>
              <EnterpriseTh className="w-[140px]">Filial</EnterpriseTh>
            </EnterpriseTr>
          </EnterpriseThead>
          <EnterpriseTbody>
            {visible.length === 0 ? (
              <EnterpriseTr>
                <EnterpriseTd colSpan={7} className="text-center py-12 text-muted-foreground">
                  Nenhuma duplicata encontrada com os filtros atuais.
                </EnterpriseTd>
              </EnterpriseTr>
            ) : (
              visible.map((d) => (
                <EnterpriseTr key={d.id}>
                  <EnterpriseTd numeric className="font-mono text-xs">{d.id}</EnterpriseTd>
                  <EnterpriseTd>
                    <div className="font-medium text-sm leading-tight">{d.cliente}</div>
                    <div className="text-[11px] text-muted-foreground">{d.codCliente}</div>
                  </EnterpriseTd>
                  <EnterpriseTd numeric className="text-sm">{fmtDate(d.dataVencimento)}</EnterpriseTd>
                  <EnterpriseTd numeric className="font-semibold tabular-nums">
                    {formatCurrency(d.status === 'PAGO' ? d.valorRecebido : d.valor)}
                  </EnterpriseTd>
                  <EnterpriseTd><SituacaoBadge d={d} /></EnterpriseTd>
                  <EnterpriseTd>
                    {d.pedidosVinculados.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span className="text-xs font-mono" title={d.pedidosVinculados.join(', ')}>
                        {d.pedidosVinculados.slice(0, 2).join(', ')}
                        {d.pedidosVinculados.length > 2 && ` +${d.pedidosVinculados.length - 2}`}
                      </span>
                    )}
                  </EnterpriseTd>
                  <EnterpriseTd>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      {d.empresas.length === 1 ? d.empresas[0] : `${d.empresas.length} filiais`}
                    </span>
                  </EnterpriseTd>
                </EnterpriseTr>
              ))
            )}
          </EnterpriseTbody>
        </EnterpriseTable>

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
    </EnterpriseDataPanel>
  );
}
