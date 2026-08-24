import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { RotateCcw, Search, Package, FileText } from 'lucide-react';
import type { Devolucao } from '@/types/comercial';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  devolucoes: Devolucao[];
  periodoLabel?: string;
}

function formatarData(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString('pt-BR');
}

export function DevolucoesDetalheDialog({ open, onOpenChange, devolucoes, periodoLabel }: Props) {
  const [busca, setBusca] = useState('');

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return devolucoes;
    return devolucoes.filter(d => {
      const alvo = [
        d.cliente_razao, d.cliente_fantasia, d.vendedor_nome,
        (d as any).produto_nome, (d as any).produto_codigo,
        d.numero,
      ].filter(Boolean).join(' ').toLowerCase();
      return alvo.includes(q);
    });
  }, [devolucoes, busca]);

  const totalValor = useMemo(
    () => filtradas.reduce((acc, d) => acc + Math.abs(Number(d.valor_total || d.valor_liquido || 0)), 0),
    [filtradas]
  );
  const totalQtd = useMemo(
    () => filtradas.reduce((acc, d) => acc + Math.abs(Number((d as any).quantidade_devolvida || 0)), 0),
    [filtradas]
  );

  // Agrupamento por produto (quando disponível)
  const porProduto = useMemo(() => {
    const map = new Map<string, { codigo: string; nome: string; qtd: number; valor: number; ocorrencias: number }>();
    for (const d of filtradas) {
      const nome = String((d as any).produto_nome || '').trim();
      const codigo = String((d as any).produto_codigo || '').trim();
      if (!nome && !codigo) continue;
      const key = `${codigo}||${nome}`;
      const atual = map.get(key) || { codigo, nome: nome || '(sem nome)', qtd: 0, valor: 0, ocorrencias: 0 };
      atual.qtd += Math.abs(Number((d as any).quantidade_devolvida || 0));
      atual.valor += Math.abs(Number(d.valor_total || d.valor_liquido || 0));
      atual.ocorrencias += 1;
      map.set(key, atual);
    }
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
  }, [filtradas]);

  const temProdutos = porProduto.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <RotateCcw className="h-5 w-5" />
            Detalhamento de Devoluções
          </DialogTitle>
          <DialogDescription>
            {periodoLabel ? `Período: ${periodoLabel} · ` : ''}
            {formatNumber(filtradas.length)} lançamento(s) · Total {formatCurrency(totalValor)}
            {totalQtd > 0 ? ` · ${formatNumber(totalQtd)} unid.` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 py-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, vendedor, produto ou nº de devolução…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-8"
            />
          </div>
          {busca && (
            <Button variant="ghost" size="sm" onClick={() => setBusca('')}>Limpar</Button>
          )}
        </div>

        <Tabs defaultValue={temProdutos ? 'produtos' : 'lancamentos'} className="flex-1 flex flex-col overflow-hidden">
          <TabsList>
            {temProdutos && (
              <TabsTrigger value="produtos" className="gap-2">
                <Package className="h-4 w-4" /> Produtos ({porProduto.length})
              </TabsTrigger>
            )}
            <TabsTrigger value="lancamentos" className="gap-2">
              <FileText className="h-4 w-4" /> Lançamentos ({filtradas.length})
            </TabsTrigger>
          </TabsList>

          {temProdutos && (
            <TabsContent value="produtos" className="flex-1 overflow-auto mt-3">
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">Produto</th>
                      <th className="px-3 py-2 font-medium text-right">Qtd devolvida</th>
                      <th className="px-3 py-2 font-medium text-right">Ocorrências</th>
                      <th className="px-3 py-2 font-medium text-right">Valor devolvido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porProduto.map((p, i) => (
                      <tr key={`${p.codigo}-${i}`} className="border-t border-border/40 hover:bg-muted/20">
                        <td className="px-3 py-2">
                          <div className="font-medium">{p.nome}</div>
                          {p.codigo && <div className="text-[11px] text-muted-foreground">Cód: {p.codigo}</div>}
                        </td>
                        <td className="px-3 py-2 text-right mono-value">{formatNumber(p.qtd)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{p.ocorrencias}</td>
                        <td className="px-3 py-2 text-right mono-value text-destructive font-semibold">
                          {formatCurrency(p.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30 sticky bottom-0">
                    <tr>
                      <td className="px-3 py-2 font-semibold">Total</td>
                      <td className="px-3 py-2 text-right font-semibold mono-value">{formatNumber(totalQtd)}</td>
                      <td />
                      <td className="px-3 py-2 text-right font-bold mono-value text-destructive">{formatCurrency(totalValor)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </TabsContent>
          )}

          <TabsContent value="lancamentos" className="flex-1 overflow-auto mt-3">
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 sticky top-0">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Nº</th>
                    <th className="px-3 py-2 font-medium">Cliente</th>
                    <th className="px-3 py-2 font-medium">Vendedor</th>
                    <th className="px-3 py-2 font-medium">Produto</th>
                    <th className="px-3 py-2 font-medium text-right">Qtd</th>
                    <th className="px-3 py-2 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((d, i) => {
                    const valor = Math.abs(Number(d.valor_total || d.valor_liquido || 0));
                    const qtd = Math.abs(Number((d as any).quantidade_devolvida || 0));
                    return (
                      <tr key={`${d.id}-${i}`} className="border-t border-border/40 hover:bg-muted/20">
                        <td className="px-3 py-2 whitespace-nowrap">{formatarData(d.data)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{d.numero || '-'}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium truncate max-w-[220px]">{d.cliente_razao || d.cliente_fantasia || '-'}</div>
                          {d.cliente_cidade && (
                            <div className="text-[11px] text-muted-foreground">{d.cliente_cidade}{d.cliente_uf ? `/${d.cliente_uf}` : ''}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 truncate max-w-[160px]">{d.vendedor_nome || '-'}</td>
                        <td className="px-3 py-2">
                          {(d as any).produto_nome ? (
                            <>
                              <div className="truncate max-w-[220px]">{(d as any).produto_nome}</div>
                              {(d as any).produto_codigo && (
                                <div className="text-[11px] text-muted-foreground">Cód: {(d as any).produto_codigo}</div>
                              )}
                            </>
                          ) : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="px-3 py-2 text-right mono-value">{qtd ? formatNumber(qtd) : '-'}</td>
                        <td className="px-3 py-2 text-right mono-value text-destructive font-semibold">{formatCurrency(valor)}</td>
                      </tr>
                    );
                  })}
                  {filtradas.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                        Nenhuma devolução encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-muted/30 sticky bottom-0">
                  <tr>
                    <td colSpan={5} className="px-3 py-2 font-semibold">Total</td>
                    <td className="px-3 py-2 text-right font-semibold mono-value">{totalQtd ? formatNumber(totalQtd) : ''}</td>
                    <td className="px-3 py-2 text-right font-bold mono-value text-destructive">{formatCurrency(totalValor)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        {!temProdutos && (
          <Badge variant="outline" className="self-start text-[11px] text-muted-foreground">
            Este arquivo de devoluções não expõe detalhamento por produto — exibindo apenas totais por lançamento.
          </Badge>
        )}
      </DialogContent>
    </Dialog>
  );
}
