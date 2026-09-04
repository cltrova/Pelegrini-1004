import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, TrendingUp, AlertTriangle, Tag, Search, type LucideIcon } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import type { TopProdutoAgg, CategoriaAgg, ProdutoSemGiro } from '@/types/comercialProdutos';
import { cn } from '@/lib/utils';

interface ProdutosSectionProps {
  topProdutos: TopProdutoAgg[];
  porCategoria: CategoriaAgg[];
  produtosSemGiro: ProdutoSemGiro[];
  isLoading?: boolean;
}

type TabKey = 'top' | 'categoria' | 'sem-giro';

export function ProdutosSectionPremium({ topProdutos, porCategoria, produtosSemGiro }: ProdutosSectionProps) {
  const [tab, setTab] = useState<TabKey>('top');
  const [search, setSearch] = useState('');

  const tabs: { key: TabKey; label: string; icon: LucideIcon; count?: number; color: string }[] = [
    { key: 'top', label: 'Top Produtos', icon: TrendingUp, count: topProdutos.length, color: 'hsl(217 91% 60%)' },
    { key: 'categoria', label: 'Por Categoria', icon: Tag, count: porCategoria.length, color: 'hsl(280 65% 60%)' },
    { key: 'sem-giro', label: 'Sem Giro', icon: AlertTriangle, count: produtosSemGiro.length, color: 'hsl(0 72% 51%)' },
  ];

  const filteredTop = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return topProdutos;
    return topProdutos.filter(p =>
      p.descricao?.toLowerCase().includes(s) ||
      String(p.cod_produto).includes(s) ||
      p.marca?.toLowerCase().includes(s) ||
      p.categoria?.toLowerCase().includes(s)
    );
  }, [topProdutos, search]);

  const filteredSemGiro = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return produtosSemGiro;
    return produtosSemGiro.filter(p =>
      p.descricao?.toLowerCase().includes(s) ||
      String(p.cod_produto).includes(s)
    );
  }, [produtosSemGiro, search]);

  const filteredCategorias = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return porCategoria;
    return porCategoria.filter(c => c.chave?.toLowerCase().includes(s));
  }, [porCategoria, search]);

  return (
    <Card className="premium-card border-border/60 overflow-hidden stagger-4">
      <div className="relative overflow-hidden p-5 border-b border-border/40 bg-card">
        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-lg flex items-center justify-center border border-primary/20 bg-primary/10 text-primary">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Análise de Produtos</h3>
              <p className="text-xs text-muted-foreground">Drill-down por categoria, marca e giro</p>
            </div>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto, código, marca…"
              className="w-full h-9 pl-8 pr-3 text-xs rounded-lg bg-background border border-border/60 focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4 flex-wrap">
          {tabs.map(t => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'group relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-200 border',
                  isActive
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-border/40 bg-background text-muted-foreground hover:text-foreground hover:bg-muted/40'
                )}
              >
                <Icon className="h-3.5 w-3.5" style={isActive ? { color: t.color } : undefined} />
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span
                    className="ml-0.5 inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full text-[10px] font-bold"
                    style={{
                      background: isActive ? t.color : 'hsl(var(--muted))',
                      color: isActive ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                    }}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <CardContent className="p-4">
        {/* TOP PRODUTOS */}
        {tab === 'top' && (
          filteredTop.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhum produto encontrado.</p>
          ) : (
            <div className="overflow-y-auto max-h-[520px] rounded-lg border border-border/60 bg-card">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2.5 font-semibold w-10">#</th>
                    <th className="px-3 py-2.5 font-semibold">Produto</th>
                    <th className="px-3 py-2.5 font-semibold">Marca / Categoria</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Qtd</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Faturamento</th>
                    <th className="px-3 py-2.5 font-semibold text-right w-28">Participação</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTop.slice(0, 100).map((p, i) => {
                    const rank = i + 1;
                    const rankColor = rank === 1 ? 'hsl(38 92% 50%)' : rank === 2 ? 'hsl(217 91% 60%)' : rank === 3 ? 'hsl(173 80% 40%)' : undefined;
                    return (
                      <tr key={String(p.cod_produto)} className="border-t border-border/40 hover:bg-muted/30 transition group">
                        <td className="px-3 py-2.5">
                          <span
                            className="inline-flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold"
                            style={
                              rankColor
                                ? { background: `${rankColor}25`, color: rankColor, boxShadow: `0 0 8px ${rankColor}40` }
                                : { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }
                            }
                          >
                            {rank}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium leading-tight group-hover:text-primary transition">{p.descricao}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">#{p.cod_produto}</div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {[p.marca, p.categoria || p.grupo].filter(Boolean).join(' • ') || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(p.quantidade)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold mono-value">
                          {formatCurrency(p.faturamento)}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all duration-500"
                                style={{
                                  width: `${Math.min(100, p.participacao * 4)}%`,
                                }}
                              />
                            </div>
                            <span className="text-[11px] font-semibold tabular-nums w-10 text-right text-primary">
                              {p.participacao.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* CATEGORIA */}
        {tab === 'categoria' && (
          filteredCategorias.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Sem dados.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
              {filteredCategorias.map((c, i) => {
                const colors = ['hsl(217 91% 60%)', 'hsl(173 80% 40%)', 'hsl(142 71% 45%)', 'hsl(38 92% 50%)', 'hsl(280 65% 60%)', 'hsl(0 72% 51%)'];
                const color = colors[i % colors.length];
                return (
                  <div
                    key={c.chave}
                    className="group relative overflow-hidden p-3.5 rounded-lg border border-border/60 bg-card transition-colors duration-200 cursor-default hover:border-primary/30"
                    style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                  >
                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm truncate" style={{ color }}>{c.chave}</span>
                        <span className="text-sm tabular-nums font-bold mono-value">{formatCurrency(c.faturamento, true)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-2">
                        <span>{c.produtos} produtos · {formatNumber(c.quantidade)} unid.</span>
                        <span className="font-bold" style={{ color }}>{c.participacao.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(100, c.participacao)}%`,
                            background: color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* SEM GIRO */}
        {tab === 'sem-giro' && (
          filteredSemGiro.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Todos os produtos tiveram movimento no período. 🎯
            </p>
          ) : (
            <div className="overflow-y-auto max-h-[520px] rounded-lg border border-border/60 bg-card">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2.5 font-semibold">Produto</th>
                    <th className="px-3 py-2.5 font-semibold">Marca / Categoria</th>
                    <th className="px-3 py-2.5 font-semibold">Última Venda</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Dias Parado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSemGiro.slice(0, 200).map(p => (
                    <tr key={String(p.cod_produto)} className="border-t border-border/40 hover:bg-destructive/5 transition">
                      <td className="px-3 py-2.5">
                        <div className="font-medium leading-tight">{p.descricao}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">#{p.cod_produto}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {[p.marca, p.categoria].filter(Boolean).join(' • ') || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums">
                        {p.ultimaVenda ? new Date(p.ultimaVenda).toLocaleDateString('pt-BR') : 'Nunca'}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {p.diasSemVenda !== undefined ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              'font-bold tabular-nums',
                              p.diasSemVenda > 90 && 'border-destructive/60 text-destructive bg-destructive/10',
                              p.diasSemVenda > 30 && p.diasSemVenda <= 90 && 'border-warning/60 text-warning bg-warning/10',
                              p.diasSemVenda <= 30 && 'border-success/60 text-success bg-success/10',
                            )}
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
          )
        )}
      </CardContent>
    </Card>
  );
}
