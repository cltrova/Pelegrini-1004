import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import type { VendedorPerformance, ClientePerformance, EvolucaoMensal } from '@/types/comercial';
import { AlertTriangle, TrendingDown, TrendingUp, Trophy, Users, MapPin, Activity, Target, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  vendedores: VendedorPerformance[];
  clientes: ClientePerformance[];
  evolucao: EvolucaoMensal[];
  distribuicaoUF: { uf: string; valor: number }[];
}

export function QuickDecisionsPanel({ vendedores, clientes, evolucao, distribuicaoUF }: Props) {
  const topVendedores = useMemo(
    () => [...vendedores].sort((a, b) => b.faturamentoLiquido - a.faturamentoLiquido).slice(0, 5),
    [vendedores]
  );

  const topClientes = useMemo(
    () => [...clientes].sort((a, b) => b.faturamentoLiquido - a.faturamentoLiquido).slice(0, 5),
    [clientes]
  );

  const clientesEmRisco = useMemo(() => {
    return [...clientes]
      .filter(c => (c.diasSemCompra ?? 0) >= 45 && c.faturamentoLiquido > 0)
      .sort((a, b) => b.faturamentoLiquido - a.faturamentoLiquido)
      .slice(0, 6);
  }, [clientes]);

  const vendedoresAltaDevolucao = useMemo(() => {
    return [...vendedores]
      .filter(v => v.valorFaturado > 0)
      .map(v => ({
        ...v,
        pctDev: v.totalDevolucoes > 0 ? (v.totalDevolucoes / (v.valorFaturado + v.totalDevolucoes)) : 0,
      }))
      .filter(v => v.pctDev > 0.02)
      .sort((a, b) => b.pctDev - a.pctDev)
      .slice(0, 5);
  }, [vendedores]);

  const topUFs = useMemo(() => distribuicaoUF.slice(0, 6), [distribuicaoUF]);
  const totalUF = useMemo(() => distribuicaoUF.reduce((a, b) => a + b.valor, 0), [distribuicaoUF]);

  const comparativoMes = useMemo(() => {
    if (evolucao.length < 2) return null;
    const atual = evolucao[evolucao.length - 1];
    const anterior = evolucao[evolucao.length - 2];
    const diff = anterior.liquido > 0 ? (atual.liquido - anterior.liquido) / anterior.liquido : 0;
    return { atual, anterior, diff };
  }, [evolucao]);

  const mediaHistorica = useMemo(() => {
    if (evolucao.length === 0) return 0;
    return evolucao.reduce((a, b) => a + b.liquido, 0) / evolucao.length;
  }, [evolucao]);

  return (
    <div className="space-y-4">
      {/* Faixa de decisões rápidas: cards de indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Activity className="h-3.5 w-3.5" /> Mês vs Anterior
            </div>
            {comparativoMes ? (
              <>
                <div className="text-lg font-bold">{formatCurrency(comparativoMes.atual.liquido)}</div>
                <div className={cn('text-xs font-semibold flex items-center gap-1', comparativoMes.diff >= 0 ? 'text-success' : 'text-destructive')}>
                  {comparativoMes.diff >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {formatPercent(comparativoMes.diff * 100)} vs {comparativoMes.anterior.mes}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Sem histórico</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-success/20 bg-gradient-to-br from-success/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Target className="h-3.5 w-3.5" /> Média Histórica
            </div>
            <div className="text-lg font-bold">{formatCurrency(mediaHistorica)}</div>
            <div className="text-xs text-muted-foreground">últimos {evolucao.length} meses</div>
          </CardContent>
        </Card>

        <Card className="border-warning/20 bg-gradient-to-br from-warning/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Clientes em Risco
            </div>
            <div className="text-lg font-bold">{clientesEmRisco.length}</div>
            <div className="text-xs text-muted-foreground">45+ dias sem compra</div>
          </CardContent>
        </Card>

        <Card className="border-accent/20 bg-gradient-to-br from-accent/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Zap className="h-3.5 w-3.5" /> Carteira Ativa
            </div>
            <div className="text-lg font-bold">{clientes.filter(c => c.faturamentoLiquido > 0).length}</div>
            <div className="text-xs text-muted-foreground">de {clientes.length} cadastrados</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabelas de decisão rápida */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Vendedores */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" /> Top Vendedores
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-xs">#</TableHead>
                  <TableHead className="h-8 text-xs">Vendedor</TableHead>
                  <TableHead className="h-8 text-xs text-right">Faturado</TableHead>
                  <TableHead className="h-8 text-xs text-right">Part.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topVendedores.map((v, i) => (
                  <TableRow key={String(v.codigo)}>
                    <TableCell className="py-2 text-xs font-mono">{i + 1}</TableCell>
                    <TableCell className="py-2 text-xs font-medium truncate max-w-[160px]">{v.nome}</TableCell>
                    <TableCell className="py-2 text-xs text-right font-mono">{formatCurrency(v.faturamentoLiquido)}</TableCell>
                    <TableCell className="py-2 text-xs text-right">
                      <Badge variant="outline" className="text-[10px]">{formatPercent(v.participacao)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {topVendedores.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">Sem dados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Top Clientes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Top Clientes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-xs">#</TableHead>
                  <TableHead className="h-8 text-xs">Cliente</TableHead>
                  <TableHead className="h-8 text-xs">UF</TableHead>
                  <TableHead className="h-8 text-xs text-right">Faturado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topClientes.map((c, i) => (
                  <TableRow key={String(c.codigo)}>
                    <TableCell className="py-2 text-xs font-mono">{i + 1}</TableCell>
                    <TableCell className="py-2 text-xs font-medium truncate max-w-[180px]">{c.fantasia || c.razao}</TableCell>
                    <TableCell className="py-2 text-xs">{c.uf || '—'}</TableCell>
                    <TableCell className="py-2 text-xs text-right font-mono">{formatCurrency(c.faturamentoLiquido)}</TableCell>
                  </TableRow>
                ))}
                {topClientes.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">Sem dados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Clientes em Risco */}
        <Card className="border-warning/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Clientes em Risco (recuperar)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-xs">Cliente</TableHead>
                  <TableHead className="h-8 text-xs text-right">Dias s/ compra</TableHead>
                  <TableHead className="h-8 text-xs text-right">Histórico</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientesEmRisco.map(c => (
                  <TableRow key={String(c.codigo)}>
                    <TableCell className="py-2 text-xs font-medium truncate max-w-[180px]">{c.fantasia || c.razao}</TableCell>
                    <TableCell className="py-2 text-xs text-right">
                      <Badge variant="destructive" className="text-[10px]">{c.diasSemCompra}d</Badge>
                    </TableCell>
                    <TableCell className="py-2 text-xs text-right font-mono">{formatCurrency(c.faturamentoLiquido)}</TableCell>
                  </TableRow>
                ))}
                {clientesEmRisco.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-4">Nenhum cliente em risco 🎉</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* UFs líderes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> Concentração Geográfica
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            {topUFs.map(u => {
              const pct = totalUF > 0 ? (u.valor / totalUF) * 100 : 0;
              return (
                <div key={u.uf} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{u.uf}</span>
                    <span className="font-mono text-muted-foreground">
                      {formatCurrency(u.valor)} · {pct.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
            {topUFs.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-4">Sem dados</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Devoluções críticas */}
      {vendedoresAltaDevolucao.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" /> Atenção: Devoluções Elevadas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-xs">Vendedor</TableHead>
                  <TableHead className="h-8 text-xs text-right">Faturado</TableHead>
                  <TableHead className="h-8 text-xs text-right">Devoluções</TableHead>
                  <TableHead className="h-8 text-xs text-right">% Dev.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendedoresAltaDevolucao.map(v => (
                  <TableRow key={String(v.codigo)}>
                    <TableCell className="py-2 text-xs font-medium">{v.nome}</TableCell>
                    <TableCell className="py-2 text-xs text-right font-mono">{formatCurrency(v.valorFaturado)}</TableCell>
                    <TableCell className="py-2 text-xs text-right font-mono text-destructive">{formatCurrency(v.totalDevolucoes)}</TableCell>
                    <TableCell className="py-2 text-xs text-right">
                      <Badge variant="destructive" className="text-[10px]">{(v.pctDev * 100).toFixed(1)}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
