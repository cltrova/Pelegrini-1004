import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import type { CategoriaAgg } from '@/types/comercialProdutos';

interface Props {
  porCategoria: CategoriaAgg[];
  selectedCategoria?: string | null;
  onSelectCategoria?: (c: string | null) => void;
}

/**
 * Legacy view (pré-Premium) — barras + tabela.
 */
export function CategoriasViewLegacy({
  porCategoria,
  selectedCategoria,
  onSelectCategoria,
}: Props) {
  const top = [...porCategoria].sort((a, b) => b.faturamento - a.faturamento).slice(0, 15);

  const handleClick = (chave: string) => {
    onSelectCategoria?.(selectedCategoria === chave ? null : chave);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            Receita por categoria (top 15)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={top} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="chave"
                tick={{ fontSize: 11 }}
                angle={-25}
                textAnchor="end"
                height={70}
                interval={0}
              />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, true)} />
              <Tooltip
                formatter={(v: number) => formatCurrency(v)}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="faturamento"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tabela de categorias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-y-auto max-h-[500px] rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">SKUs</TableHead>
                  <TableHead className="text-right">% Mix</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porCategoria.map(c => (
                  <TableRow
                    key={c.chave}
                    onClick={() => handleClick(c.chave)}
                    className={cn(
                      'cursor-pointer',
                      selectedCategoria === c.chave && 'bg-primary/10'
                    )}
                  >
                    <TableCell className="font-medium">
                      {c.chave}
                      {selectedCategoria === c.chave && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">selecionada</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(c.faturamento)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(c.quantidade)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(c.produtos)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {c.participacao.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
