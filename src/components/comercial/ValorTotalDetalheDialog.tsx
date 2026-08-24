import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Search, DollarSign, FileText, Download, ChevronDown, ChevronRight } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatInteger } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { Pedido } from '@/types/comercial';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedidos: Pedido[];
  totalEsperado?: number;
  periodoLabel?: string;
}

interface PedidoRow {
  key: string;
  numero: string;
  data_pedido: string;
  data_faturamento?: string;
  status: string;
  valor: number;
}

interface ClienteGroup {
  codigo: string;
  nome: string;
  pedidos: PedidoRow[];
  totalPedidos: number;
  totalValor: number;
}

const PAGE_SIZE = 15;

function fmtDate(iso?: string) {
  if (!iso) return '—';
  const d = String(iso).substring(0, 10);
  const [y, m, dd] = d.split('-');
  if (!y || !m || !dd) return String(iso);
  return `${dd}/${m}/${y}`;
}

export function ValorTotalDetalheDialog({ open, onOpenChange, pedidos, totalEsperado, periodoLabel }: Props) {
  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const grupos = useMemo<ClienteGroup[]>(() => {
    const clientesMap = new Map<string, ClienteGroup>();
    const pedidosMap = new Map<string, Map<string, PedidoRow>>();

    for (const p of pedidos || []) {
      if ((p.tipo || 'PEDIDO') !== 'PEDIDO') continue;
      if (p.status === 'cancelado' || p.status === 'canceled') continue;

      const codCliente = String(p.cliente_codigo ?? '').trim() || 'sem-codigo';
      const nomeCliente = String(p.cliente_fantasia || p.cliente_razao || '—');
      const numero = String((p as any).numero ?? (p as any).num_nf ?? p.id ?? '').trim();
      if (numero === '0') continue;
      const pedidoKey = numero || String(p.id);
      const valor = Number(p.valor_liquido || 0);

      if (!clientesMap.has(codCliente)) {
        clientesMap.set(codCliente, {
          codigo: codCliente,
          nome: nomeCliente,
          pedidos: [],
          totalPedidos: 0,
          totalValor: 0,
        });
        pedidosMap.set(codCliente, new Map());
      }
      const grupo = clientesMap.get(codCliente)!;
      const pMap = pedidosMap.get(codCliente)!;

      const existing = pMap.get(pedidoKey);
      if (existing) {
        existing.valor += valor;
        if (p.data_faturamento && (!existing.data_faturamento || p.data_faturamento > existing.data_faturamento)) {
          existing.data_faturamento = String(p.data_faturamento).substring(0, 10);
        }
      } else {
        pMap.set(pedidoKey, {
          key: pedidoKey,
          numero: numero || '—',
          data_pedido: String(p.data_pedido || '').substring(0, 10),
          data_faturamento: p.data_faturamento ? String(p.data_faturamento).substring(0, 10) : undefined,
          status: p.status || (p.data_faturamento ? 'faturado' : 'pendente'),
          valor,
        });
      }
    }

    for (const [cod, grupo] of clientesMap.entries()) {
      const pMap = pedidosMap.get(cod)!;
      grupo.pedidos = Array.from(pMap.values()).sort((a, b) => b.data_pedido.localeCompare(a.data_pedido));
      grupo.totalPedidos = grupo.pedidos.length;
      grupo.totalValor = grupo.pedidos.reduce((s, r) => s + r.valor, 0);
    }

    return Array.from(clientesMap.values()).sort((a, b) => b.totalValor - a.totalValor);
  }, [pedidos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return grupos;
    return grupos.filter(g =>
      g.nome.toLowerCase().includes(q) ||
      g.codigo.toLowerCase().includes(q) ||
      g.pedidos.some(p => p.numero.toLowerCase().includes(q))
    );
  }, [grupos, busca]);

  const totalValor = useMemo(() => filtrados.reduce((s, g) => s + g.totalValor, 0), [filtrados]);
  const totalPedidos = useMemo(() => filtrados.reduce((s, g) => s + g.totalPedidos, 0), [filtrados]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageItems = filtrados.slice(pageSafe * PAGE_SIZE, (pageSafe + 1) * PAGE_SIZE);

  const toggleExpanded = (codigo: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
  };

  const exportExcel = () => {
    const rows: any[] = [];
    for (const g of filtrados) {
      for (const p of g.pedidos) {
        rows.push({
          'Cód. Cliente': g.codigo,
          Cliente: g.nome,
          'Nº Pedido': p.numero,
          'Data Pedido': fmtDate(p.data_pedido),
          'Data Faturamento': fmtDate(p.data_faturamento),
          Status: p.status,
          Valor: Number(p.valor.toFixed(2)),
        });
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Valor Total');
    XLSX.writeFile(wb, `valor-total-pedidos-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setBusca(''); setPage(0); setExpanded(new Set()); } }}>
      <DialogContent className="max-w-5xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Valor Total — Pedidos por Cliente
          </DialogTitle>
          <DialogDescription>
            Pedidos considerados no cálculo do Valor Total{periodoLabel ? ` (${periodoLabel})` : ''}. Clique em um cliente para expandir os pedidos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, código ou pedido..."
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPage(0); }}
              className="pl-8"
            />
          </div>
          <Badge variant="outline" className="text-xs">
            {formatInteger(filtrados.length)} cliente{filtrados.length === 1 ? '' : 's'}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {formatInteger(totalPedidos)} pedido{totalPedidos === 1 ? '' : 's'}
          </Badge>
          <Badge className="text-xs bg-primary/15 text-primary border-primary/30 hover:bg-primary/20">
            Total: {formatCurrency(totalValor)}
          </Badge>
          {typeof totalEsperado === 'number' && Math.abs(totalValor - totalEsperado) > 0.01 && (
            <Badge className="text-xs bg-amber-500/15 text-amber-500 border-amber-500/30">
              Diferença p/ card: {formatCurrency(totalValor - totalEsperado)}
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={exportExcel} disabled={!filtrados.length}>
            <Download className="h-3.5 w-3.5 mr-2" /> Exportar Excel
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto border rounded-md">
          {filtrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-3">
                <FileText className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold">Nenhum pedido encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">
                {busca ? 'Nenhum resultado para a busca.' : 'Não há pedidos no período selecionado.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/70 backdrop-blur border-b z-10">
                <tr className="text-xs uppercase text-muted-foreground">
                  <th className="w-8"></th>
                  <th className="text-left px-3 py-2 font-semibold">Cliente</th>
                  <th className="text-left px-3 py-2 font-semibold">Código</th>
                  <th className="text-right px-3 py-2 font-semibold">Pedidos</th>
                  <th className="text-right px-3 py-2 font-semibold">Valor Total</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((g) => {
                  const isOpen = expanded.has(g.codigo);
                  return (
                    <>
                      <tr
                        key={g.codigo}
                        className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => toggleExpanded(g.codigo)}
                      >
                        <td className="px-2 py-2 text-muted-foreground">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </td>
                        <td className="px-3 py-2 font-medium truncate max-w-[360px]" title={g.nome}>
                          {g.nome}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{g.codigo}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatInteger(g.totalPedidos)}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-primary">
                          {formatCurrency(g.totalValor)}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={`${g.codigo}-detail`} className="bg-muted/20 border-b">
                          <td colSpan={5} className="p-0">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-[10px] uppercase text-muted-foreground">
                                  <th className="text-left px-4 py-1.5 font-semibold">Nº Pedido</th>
                                  <th className="text-left px-3 py-1.5 font-semibold">Data Pedido</th>
                                  <th className="text-left px-3 py-1.5 font-semibold">Data Faturamento</th>
                                  <th className="text-center px-3 py-1.5 font-semibold">Status</th>
                                  <th className="text-right px-4 py-1.5 font-semibold">Valor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.pedidos.map((p) => (
                                  <tr key={p.key} className="border-t border-border/40">
                                    <td className="px-4 py-1.5 font-mono">{p.numero}</td>
                                    <td className="px-3 py-1.5 text-muted-foreground">{fmtDate(p.data_pedido)}</td>
                                    <td className="px-3 py-1.5 text-muted-foreground">{fmtDate(p.data_faturamento)}</td>
                                    <td className="px-3 py-1.5 text-center">
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          'text-[9px] uppercase',
                                          p.data_faturamento || p.status === 'faturado'
                                            ? 'border-emerald-500/40 text-emerald-500'
                                            : 'border-amber-500/40 text-amber-500'
                                        )}
                                      >
                                        {p.status}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-1.5 text-right tabular-nums font-semibold">
                                      {formatCurrency(p.valor)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Página {pageSafe + 1} de {totalPages}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={pageSafe === 0}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={pageSafe >= totalPages - 1}>
                Próxima
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
