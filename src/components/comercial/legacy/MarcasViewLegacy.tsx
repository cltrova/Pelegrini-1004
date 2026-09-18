import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import type { MarcaAgg } from '@/types/comercialProdutos';

interface Props {
  porMarca: MarcaAgg[];
  selectedMarca: string | null;
  onSelectMarca: (marca: string | null) => void;
}

/**
 * Legacy view (pré-Premium) — gráfico de barras + tabela simples.
 */
export function MarcasViewLegacy({ porMarca, selectedMarca, onSelectMarca }: Props) {
  const top = [...porMarca].sort((a, b) => b.faturamento - a.faturamento).slice(0, 15);

  const handleClickMarca = (marca: string) => {
    onSelectMarca(selectedMarca === marca ? null : marca);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            Receita por marca (top 15)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={top} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="marca"
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
                onClick={(d: { marca?: string }) => d.marca && handleClickMarca(d.marca)}
                cursor="pointer"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tabela de marcas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-y-auto max-h-[500px] rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marca</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">SKUs</TableHead>
                  <TableHead className="text-right">% Mix</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porMarca.map(m => (
                  <TableRow
                    key={m.marca}
                    className={cn(
                      'cursor-pointer',
                      selectedMarca === m.marca && 'bg-primary/10'
                    )}
                    onClick={() => handleClickMarca(m.marca)}
                  >
                    <TableCell className="font-medium">
                      {m.marca}
                      {selectedMarca === m.marca && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">selecionada</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(m.faturamento)}</TableCell>
                    <TableCell className={cn(
                      'text-right tabular-nums',
                      m.lucro < 0 && 'text-destructive'
                    )}>
                      {formatCurrency(m.lucro)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.margem.toFixed(1)}%</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(m.quantidade)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(m.produtos)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {m.participacao.toFixed(1)}%
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
