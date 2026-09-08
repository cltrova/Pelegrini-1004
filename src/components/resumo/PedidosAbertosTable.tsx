import { useMemo, useState } from 'react';
import {
  EnterpriseBadge,
  EnterpriseDataPanel,
  EnterpriseSearchFilter,
  EnterpriseTable,
  EnterpriseTbody,
  EnterpriseTd,
  EnterpriseTh,
  EnterpriseThead,
  EnterpriseTr,
} from '@/components/enterprise';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { PedidoAberto } from '@/types/resumo';
import { formatCurrency, formatInteger } from '@/utils/formatters';
import { Badge } from '@/components/ui/badge';

interface Props {
  pedidos: PedidoAberto[];
}

const PAGE_SIZE = 15;

function fmtDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

export function PedidosAbertosTable({ pedidos }: Props) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search.trim()) return pedidos;
    const q = search.toLowerCase();
    return pedidos.filter(
      (p) => p.cliente.toLowerCase().includes(q) || p.codPedido.toLowerCase().includes(q) || p.codCliente.toLowerCase().includes(q),
    );
  }, [pedidos, search]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => b.diasEmAberto - a.diasEmAberto), [filtered]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const totalValor = useMemo(() => sorted.reduce((s, p) => s + (p.valor ?? 0), 0), [sorted]);
  const temValor = totalValor > 0;

  return (
    <EnterpriseDataPanel
      title="Em Aberto (nao faturados)"
      description={`${formatInteger(sorted.length)} pedidos${temValor ? ` | ${formatCurrency(totalValor)} estimado` : ''}`}
      actions={(
        <>
          <EnterpriseBadge tone="warning"><Package className="h-3 w-3" /> aguardando faturamento</EnterpriseBadge>
          <EnterpriseSearchFilter
            label="Pedido"
            onChange={(value) => { setSearch(value); setPage(0); }}
            placeholder="Buscar pedido..."
            value={search}
          />
        </>
      )}
      noPadding
    >

      <EnterpriseTable className="rounded-none border-0">
          <EnterpriseThead>
            <EnterpriseTr>
              <EnterpriseTh numeric className="w-[120px]">Pedido</EnterpriseTh>
              <EnterpriseTh>Cliente</EnterpriseTh>
              <EnterpriseTh numeric className="w-[120px]">Data</EnterpriseTh>
              {temValor && <EnterpriseTh numeric className="w-[140px]">Valor estimado</EnterpriseTh>}
              <EnterpriseTh numeric className="w-[120px]">Em aberto</EnterpriseTh>
              <EnterpriseTh className="w-[160px]">Filial</EnterpriseTh>
            </EnterpriseTr>
          </EnterpriseThead>
          <EnterpriseTbody>
            {visible.length === 0 ? (
              <EnterpriseTr>
                <EnterpriseTd colSpan={temValor ? 6 : 5} className="text-center py-12 text-muted-foreground">
                  Nenhum pedido em aberto.
                </EnterpriseTd>
              </EnterpriseTr>
            ) : (
              visible.map((p) => (
                <EnterpriseTr key={p.id}>
                  <EnterpriseTd numeric className="font-mono text-xs">{p.codPedido}</EnterpriseTd>
                  <EnterpriseTd>
                    <div className="font-medium text-sm">{p.cliente}</div>
                    <div className="text-[11px] text-muted-foreground">{p.codCliente}</div>
                  </EnterpriseTd>
                  <EnterpriseTd numeric className="text-sm">{fmtDate(p.data)}</EnterpriseTd>
                  {temValor && (
                    <EnterpriseTd numeric className="font-mono text-sm tabular-nums text-amber-700 dark:text-amber-400">
                      {p.valor ? formatCurrency(p.valor) : '—'}
                    </EnterpriseTd>
                  )}
                  <EnterpriseTd numeric>
                    <Badge variant={p.diasEmAberto > 30 ? 'destructive' : 'secondary'}>
                      {formatInteger(p.diasEmAberto)} dias
                    </Badge>
                  </EnterpriseTd>
                  <EnterpriseTd className="text-xs text-muted-foreground">{p.empresa}</EnterpriseTd>
                </EnterpriseTr>
              ))
            )}
          </EnterpriseTbody>
        </EnterpriseTable>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground">Página {safePage + 1} de {totalPages}</p>
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
