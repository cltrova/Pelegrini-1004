import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Search, FileText, Receipt, Download } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatInteger } from '@/utils/formatters';
import type { Pedido } from '@/types/comercial';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedidos: Pedido[];
  onPedidoClick?: (numero: string) => void;
}

interface PedidoFaturado {
  key: string;
  numero: string;
  cliente: string;
  data_faturamento: string;
  valor: number;
  status: string;
}

const PAGE_SIZE = 20;

function fmtDate(iso: string) {
  if (!iso) return '—';
  const d = iso.substring(0, 10);
  const [y, m, dd] = d.split('-');
  if (!y || !m || !dd) return iso;
  return `${dd}/${m}/${y}`;
}

export function PedidosFaturadosDialog({ open, onOpenChange, pedidos, onPedidoClick }: Props) {
  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(0);

  const faturados = useMemo<PedidoFaturado[]>(() => {
    const grouped = new Map<string, PedidoFaturado>();
    for (const p of pedidos || []) {
      if ((p.tipo || 'PEDIDO') !== 'PEDIDO') continue;
      if (!p.data_faturamento) continue;
      const numero = String((p as any).numero ?? (p as any).num_nf ?? p.id ?? '').trim();
      const key = numero || String(p.id);
      const cliente = String(p.cliente_fantasia || p.cliente_razao || '—');
      const dataFat = String(p.data_faturamento).substring(0, 10);
      const valor = Number(p.valor_liquido || 0);
      const existing = grouped.get(key);
      if (existing) {
        existing.valor += valor;
        if (dataFat > existing.data_faturamento) existing.data_faturamento = dataFat;
      } else {
        grouped.set(key, {
          key,
          numero: numero || '—',
          cliente,
          data_faturamento: dataFat,
          valor,
          status: 'Faturado',
        });
      }
    }
    return Array.from(grouped.values()).sort((a, b) =>
      b.data_faturamento.localeCompare(a.data_faturamento)
    );
  }, [pedidos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return faturados;
    return faturados.filter(p =>
      p.cliente.toLowerCase().includes(q) || p.numero.toLowerCase().includes(q)
    );
  }, [faturados, busca]);

  const totalValor = useMemo(
    () => filtrados.reduce((acc, p) => acc + p.valor, 0),
    [filtrados]
  );

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageItems = filtrados.slice(pageSafe * PAGE_SIZE, (pageSafe + 1) * PAGE_SIZE);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setBusca(''); setPage(0); } }}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Pedidos Faturados
          </DialogTitle>
          <DialogDescription>
            Detalhamento dos pedidos efetivamente faturados no período filtrado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou número do pedido..."
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPage(0); }}
              className="pl-8"
            />
          </div>
          <Badge variant="outline" className="text-xs">
            {formatInteger(filtrados.length)} pedido{filtrados.length === 1 ? '' : 's'}
          </Badge>
          <Badge className="text-xs bg-emerald-500/15 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20">
            Total: {formatCurrency(totalValor)}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            disabled={!filtrados.length}
            onClick={() => {
              const rows = filtrados.map((p) => ({
                Cliente: p.cliente,
                'Nº Pedido': p.numero,
                'Data Faturamento': fmtDate(p.data_faturamento),
                'Valor Faturado': Number(p.valor.toFixed(2)),
                Status: p.status,
              }));
              const ws = XLSX.utils.json_to_sheet(rows);
              ws['!cols'] = [{ wch: 42 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 12 }];
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, 'Pedidos Faturados');
              XLSX.writeFile(wb, `pedidos-faturados-${new Date().toISOString().slice(0, 10)}.xlsx`);
            }}
          >
            <Download className="h-3.5 w-3.5" /> Exportar Excel
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto border rounded-md">
          {filtrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-3">
                <FileText className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold">Nenhum pedido faturado</p>
              <p className="text-xs text-muted-foreground mt-1">
                {busca ? 'Nenhum resultado para a busca.' : 'Não há pedidos faturados no período selecionado.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 backdrop-blur border-b">
                <tr className="text-xs uppercase text-muted-foreground">
                  <th className="text-left px-3 py-2 font-semibold">Cliente</th>
                  <th className="text-left px-3 py-2 font-semibold">Nº Pedido</th>
                  <th className="text-left px-3 py-2 font-semibold">Data Faturamento</th>
                  <th className="text-right px-3 py-2 font-semibold">Valor Faturado</th>
                  <th className="text-center px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p) => (
                  <tr key={p.key} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-medium truncate max-w-[280px]" title={p.cliente}>
                      {p.cliente}
                    </td>
                    <td className="px-3 py-2">
                      {onPedidoClick ? (
                        <button
                          onClick={() => onPedidoClick(p.numero)}
                          className="text-primary hover:underline font-mono text-xs"
                        >
                          {p.numero}
                        </button>
                      ) : (
                        <span className="font-mono text-xs">{p.numero}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(p.data_faturamento)}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-emerald-500">
                      {formatCurrency(p.valor)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-500">
                        {p.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Página {pageSafe + 1} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={pageSafe === 0}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={pageSafe >= totalPages - 1}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
