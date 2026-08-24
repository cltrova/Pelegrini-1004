import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, TrendingUp, AlertTriangle, Tag } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import type { TopProdutoAgg, CategoriaAgg, ProdutoSemGiro } from '@/types/comercialProdutos';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ProdutosSectionProps {
  topProdutos: TopProdutoAgg[];
  porCategoria: CategoriaAgg[];
  produtosSemGiro: ProdutoSemGiro[];
  isLoading?: boolean;
}

export function ProdutosSectionLegacy({ topProdutos, porCategoria, produtosSemGiro, isLoading }: ProdutosSectionProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          Análise de Produtos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="top" className="w-full">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="top" className="text-xs gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Top Produtos
            </TabsTrigger>
            <TabsTrigger value="categoria" className="text-xs gap-1.5">
              <Tag className="h-3.5 w-3.5" /> Por Categoria/Marca
            </TabsTrigger>
            <TabsTrigger value="sem-giro" className="text-xs gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Sem Giro
              {produtosSemGiro.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1.5">
                  {produtosSemGiro.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* TOP PRODUTOS */}
          <TabsContent value="top">
            {topProdutos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum produto vendido no período.</p>
            ) : (
              <div className="overflow-y-auto max-h-[480px] rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Produto</th>
                      <th className="px-3 py-2 font-medium">Marca/Categoria</th>
                      <th className="px-3 py-2 font-medium text-right">Qtd</th>
                      <th className="px-3 py-2 font-medium text-right">Faturamento</th>
                      <th className="px-3 py-2 font-medium text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProdutos.slice(0, 50).map((p, i) => (
                      <tr key={String(p.cod_produto)} className="border-t border-border hover:bg-muted/40">
                        <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{i + 1}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium leading-tight">{p.descricao}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">#{p.cod_produto}</div>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {[p.marca, p.categoria || p.grupo].filter(Boolean).join(' • ') || '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatNumber(p.quantidade)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">{formatCurrency(p.faturamento)}</td>
                        <td className="px-3 py-2 text-right text-xs text-muted-foreground tabular-nums">
                          {p.participacao.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* POR CATEGORIA */}
          <TabsContent value="categoria">
            {porCategoria.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados de categoria/marca.</p>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto">
                {porCategoria.map((c) => (
                  <div key={c.chave} className="p-3 rounded-md border border-border bg-muted/20">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-medium text-sm">{c.chave}</span>
                      <span className="text-sm tabular-nums font-semibold">{formatCurrency(c.faturamento)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                      <span>{c.produtos} produtos • {formatNumber(c.quantidade)} unid.</span>
                      <span>{c.participacao.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, c.participacao)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* SEM GIRO */}
          <TabsContent value="sem-giro">
            {produtosSemGiro.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Todos os produtos do catálogo tiveram movimento no período. 🎯
              </p>
            ) : (
              <div className="overflow-y-auto max-h-[480px] rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Produto</th>
                      <th className="px-3 py-2 font-medium">Marca/Categoria</th>
                      <th className="px-3 py-2 font-medium">Última Venda</th>
                      <th className="px-3 py-2 font-medium text-right">Dias parado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtosSemGiro.slice(0, 100).map((p) => (
                      <tr key={String(p.cod_produto)} className="border-t border-border hover:bg-muted/40">
                        <td className="px-3 py-2">
                          <div className="font-medium leading-tight">{p.descricao}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">#{p.cod_produto}</div>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {[p.marca, p.categoria].filter(Boolean).join(' • ') || '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                          {p.ultimaVenda ? new Date(p.ultimaVenda).toLocaleDateString('pt-BR') : 'Nunca'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {p.diasSemVenda !== undefined ? (
                            <Badge
                              variant="outline"
                              className={
                                p.diasSemVenda > 90
                                  ? 'border-destructive/50 text-destructive'
                                  : p.diasSemVenda > 30
                                  ? 'border-warning/50 text-warning'
                                  : ''
                              }
                            >
                              {p.diasSemVenda}d
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
