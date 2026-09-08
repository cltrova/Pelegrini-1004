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
import { ClienteAgregado } from '@/types/resumo';
import { formatCurrency, formatInteger } from '@/utils/formatters';

interface Props {
  clientes: ClienteAgregado[];
  limit?: number;
}

export function TopInadimplentes({ clientes, limit = 10 }: Props) {
  const top = [...clientes]
    .filter((c) => c.totalVencido > 0)
    .sort((a, b) => b.totalVencido - a.totalVencido)
    .slice(0, limit);

  const maxVencido = top[0]?.totalVencido ?? 1;

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30">
        <h3 className="text-sm font-semibold">Top Inadimplentes</h3>
        <p className="text-xs text-muted-foreground">Clientes com maior valor vencido</p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20">
              <TableHead className="w-[40px]">#</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right w-[140px]">Vencido</TableHead>
              <TableHead className="text-right w-[120px]">Aberto Total</TableHead>
              <TableHead className="text-center w-[100px]">Atraso (d)</TableHead>
              <TableHead className="w-[160px]">Distribuição</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {top.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum cliente inadimplente. 🎉
                </TableCell>
              </TableRow>
            ) : (
              top.map((c, i) => {
                const pct = (c.totalVencido / maxVencido) * 100;
                return (
                  <TableRow key={c.codCliente} className="hover:bg-muted/30">
                    <TableCell className="text-muted-foreground font-mono text-xs">{i + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{c.cliente}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.codCliente} · {formatInteger(c.qtdVencidas)} de {formatInteger(c.qtdDuplicatas)} vencidas
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                      {formatCurrency(c.totalVencido)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(c.totalAberto)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={c.maiorAtraso > 60 ? 'destructive' : 'secondary'}>
                        {formatInteger(c.maiorAtraso)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
