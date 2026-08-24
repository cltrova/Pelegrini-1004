import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Target, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/utils/formatters';

interface VendedorComMeta {
  codigo: string | number;
  nome: string;
  metaMensal: number;
  faturamentoMesAtual: number;
  valorTotal: number;
  percentualMetaFaturado: number;
  metaDiaria: number;
  metaEsperada: number;
}

interface KpisGerais {
  totalMeta: number;
  totalFaturado: number;
  totalMetaEsperada: number;
  percentualFaturado: number;
  faltaFaturado: number;
  acimaMeta: number;
  proximoMeta: number;
  abaixoMeta: number;
}

interface Props {
  vendedoresComMeta: VendedorComMeta[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pedidos: any[];
  kpisGerais: KpisGerais;
  periodoFiltros: { ano: number; mes: number };
  diasUteisNoMes: number;
  diasUteisDecorridos: number;
}

/**
 * Legacy view (pré-Premium) usada por todas as empresas != 1004.
 * Layout simples: KPIs consolidados + tabela com progress bars.
 */
export function MetasViewLegacy({
  vendedoresComMeta,
  kpisGerais,
  periodoFiltros,
  diasUteisNoMes,
  diasUteisDecorridos,
}: Props) {
  const mesFormatado = useMemo(
    () => new Date(periodoFiltros.ano, periodoFiltros.mes - 1)
      .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    [periodoFiltros]
  );

  const ranking = useMemo(
    () => [...vendedoresComMeta]
      .filter(v => v.metaMensal > 0 || Math.abs(v.faturamentoMesAtual) > 0)
      .sort((a, b) => b.percentualMetaFaturado - a.percentualMetaFaturado)
      .slice(0, 10),
    [vendedoresComMeta]
  );

  return (
    <div className="space-y-6">
      {/* KPIs Consolidados */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Meta do mês</span>
              <Target className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xl font-bold mt-2">{formatCurrency(kpisGerais.totalMeta)}</p>
            <p className="text-[10px] text-muted-foreground mt-1 capitalize">{mesFormatado}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Faturado</span>
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
            <p className="text-xl font-bold mt-2">{formatCurrency(kpisGerais.totalFaturado)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {formatPercent(kpisGerais.percentualFaturado / 100)} da meta
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Meta esperada</span>
              <Target className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xl font-bold mt-2">{formatCurrency(kpisGerais.totalMetaEsperada)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {diasUteisDecorridos}/{diasUteisNoMes} dias úteis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Falta para meta</span>
              {kpisGerais.faltaFaturado > 0
                ? <TrendingDown className="h-4 w-4 text-warning" />
                : <TrendingUp className="h-4 w-4 text-success" />}
            </div>
            <p className={cn(
              'text-xl font-bold mt-2',
              kpisGerais.faltaFaturado <= 0 && 'text-success'
            )}>
              {kpisGerais.faltaFaturado > 0
                ? formatCurrency(kpisGerais.faltaFaturado)
                : 'Atingida ✓'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {kpisGerais.acimaMeta} acima · {kpisGerais.abaixoMeta} abaixo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de vendedores */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top 10 metas por vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Meta</TableHead>
                  <TableHead className="text-right">Faturado</TableHead>
                  <TableHead className="text-right">Meta esperada</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                  <TableHead className="w-[200px] text-right">Atingimento</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.map(v => {
                  const diferenca = v.faturamentoMesAtual - v.metaEsperada;
                  const atingimento = Math.min(v.percentualMetaFaturado, 150);
                  const statusLabel = v.percentualMetaFaturado >= 100
                    ? 'Acima'
                    : v.percentualMetaFaturado >= 90 ? 'Próximo' : 'Abaixo';
                  const statusColor = v.percentualMetaFaturado >= 100
                    ? 'bg-success/15 text-success border-success/30'
                    : v.percentualMetaFaturado >= 90
                      ? 'bg-warning/15 text-warning border-warning/30'
                      : 'bg-destructive/15 text-destructive border-destructive/30';
                  return (
                    <TableRow key={v.codigo}>
                      <TableCell className="font-medium">{v.nome}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(v.metaMensal)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(v.faturamentoMesAtual)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatCurrency(v.metaEsperada)}
                      </TableCell>
                      <TableCell className={cn(
                        'text-right tabular-nums',
                        diferenca >= 0 ? 'text-success' : 'text-destructive'
                      )}>
                        {diferenca >= 0 ? '+' : ''}{formatCurrency(diferenca)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={atingimento} className="h-2 flex-1" />
                          <span className="text-xs tabular-nums w-12 text-right">
                            {v.percentualMetaFaturado.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn('text-[10px]', statusColor)}>
                          {statusLabel}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
