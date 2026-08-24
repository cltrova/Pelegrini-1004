import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import type { TopProdutoAgg } from '@/types/comercialProdutos';

interface Props {
  produtos: TopProdutoAgg[];
  selectedMarca: string | null;
  onSelectMarca: (marca: string | null) => void;
}

const PAGE_SIZE = 50;

/**
 * Legacy view (pré-Premium) — tabela paginada simples.
 */
export function TopProdutosLegacy({ produtos, selectedMarca, onSelectMarca }: Props) {
  const [page, setPage] = useState(0);

  const sorted = useMemo(
    () => [...produtos].sort((a, b) => b.faturamento - a.faturamento),
    [produtos]
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const slice = sorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Top produtos {selectedMarca && (
            <Badge variant="secondary" className="text-[10px]">marca: {selectedMarca}</Badge>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {sorted.length} produto{sorted.length !== 1 ? 's' : ''} no período
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-y-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">% Mix</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice.map((p, i) => (
                <TableRow key={String(p.cod_produto) + i}>
                  <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                    {currentPage * PAGE_SIZE + i + 1}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium leading-tight">{p.descricao}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">#{p.cod_produto}</div>
                  </TableCell>
                  <TableCell>
                    {p.marca ? (
                      <button
                        onClick={() => onSelectMarca(p.marca === selectedMarca ? null : p.marca!)}
                        className={cn(
                          'text-xs underline-offset-2 hover:underline',
                          selectedMarca === p.marca && 'text-primary font-semibold'
                        )}
                      >
                        {p.marca}
                      </button>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(p.quantidade)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(p.faturamento)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(p.pedidos)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {p.participacao.toFixed(2)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-muted-foreground">
              Página {currentPage + 1} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage === totalPages - 1}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
