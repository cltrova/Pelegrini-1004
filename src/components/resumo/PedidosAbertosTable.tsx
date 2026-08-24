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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Search, Package } from 'lucide-react';
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
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b bg-amber-500/5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/15 border border-amber-500/30">
            <Package className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Em Aberto (não faturados)
              <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 text-[10px]">
                aguardando faturamento
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              {formatInteger(sorted.length)} pedidos
              {temValor && <> · {formatCurrency(totalValor)} estimado</>}
            </p>
          </div>
        </div>
        <div className="relative w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pedido..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9 h-9"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20">
              <TableHead className="w-[120px]">Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="w-[120px]">Data</TableHead>
              {temValor && <TableHead className="text-right w-[140px]">Valor estimado</TableHead>}
              <TableHead className="w-[120px] text-center">Em aberto</TableHead>
              <TableHead className="w-[160px]">Filial</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={temValor ? 6 : 5} className="text-center py-12 text-muted-foreground">
                  Nenhum pedido em aberto.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.codPedido}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{p.cliente}</div>
                    <div className="text-[11px] text-muted-foreground">{p.codCliente}</div>
                  </TableCell>
                  <TableCell className="text-sm">{fmtDate(p.data)}</TableCell>
                  {temValor && (
                    <TableCell className="text-right font-mono text-sm tabular-nums text-amber-700 dark:text-amber-400">
                      {p.valor ? formatCurrency(p.valor) : '—'}
                    </TableCell>
                  )}
                  <TableCell className="text-center">
                    <Badge variant={p.diasEmAberto > 30 ? 'destructive' : 'secondary'}>
                      {formatInteger(p.diasEmAberto)} dias
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.empresa}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
    </Card>
  );
}
