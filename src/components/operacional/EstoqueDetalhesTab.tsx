import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EstoqueRecord, EstoqueFiltersState } from '@/types/estoque';
import { ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';

interface Props {
  data: EstoqueRecord[];
  filters: EstoqueFiltersState;
  setFilters: React.Dispatch<React.SetStateAction<EstoqueFiltersState>>;
  filterOptions: {
    empresas: string[];
    marcas: string[];
    grupos: string[];
    curvasABC: string[];
  };
  onExport: () => void;
}

type SortField = 'produto' | 'marca' | 'classe_abc' | 'quantidade_estoque' | 'valor_estoque' | 'custo_medio' | 'data_ultima_venda' | 'diasSemVenda';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const formatDate = (d: string | null) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
};

function getDiasSemVenda(d: string | null): number {
  if (!d) return 9999;
  return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
}

function getBadgeColor(abc: string) {
  switch (abc) {
    case 'A': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'B': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'C': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'D': return 'bg-red-500/20 text-red-400 border-red-500/30';
    default: return '';
  }
}

export function EstoqueDetalhesTab({ data, filters, setFilters, filterOptions, onExport }: Props) {
  const [sortField, setSortField] = useState<SortField>('valor_estoque');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      let va: any, vb: any;
      if (sortField === 'diasSemVenda') {
        va = getDiasSemVenda(a.data_ultima_venda);
        vb = getDiasSemVenda(b.data_ultima_venda);
      } else if (sortField === 'data_ultima_venda') {
        va = a.data_ultima_venda || '';
        vb = b.data_ultima_venda || '';
      } else {
        va = (a as any)[sortField];
        vb = (b as any)[sortField];
      }
      if (typeof va === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [data, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <button onClick={() => toggleSort(field)} className="ml-1 inline-flex">
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-amber-500' : 'text-muted-foreground'}`} />
    </button>
  );

  return (
    <div className="space-y-4">
      <Card className="premium-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {sorted.length} produtos encontrados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="min-w-[60px]">Código</TableHead>
                  <TableHead className="min-w-[200px]">Produto <SortIcon field="produto" /></TableHead>
                  <TableHead>Marca <SortIcon field="marca" /></TableHead>
                  <TableHead className="text-center">ABC <SortIcon field="classe_abc" /></TableHead>
                  <TableHead className="text-right">Qtd <SortIcon field="quantidade_estoque" /></TableHead>
                  <TableHead className="text-right">Valor Estoque <SortIcon field="valor_estoque" /></TableHead>
                  <TableHead className="text-right">Custo Médio <SortIcon field="custo_medio" /></TableHead>
                  <TableHead>Última Venda <SortIcon field="data_ultima_venda" /></TableHead>
                  <TableHead className="text-right">Dias s/ Venda <SortIcon field="diasSemVenda" /></TableHead>
                  <TableHead>Filial</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.slice(0, visibleCount).map((r, i) => {
                  const dias = getDiasSemVenda(r.data_ultima_venda);
                  const isExpanded = expandedRow === i;
                  return (
                    <>
                      <TableRow
                        key={`row-${i}`}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedRow(isExpanded ? null : i)}
                      >
                        <TableCell>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.cod_produto}</TableCell>
                        <TableCell className="font-medium text-sm max-w-[200px] truncate">{r.produto}</TableCell>
                        <TableCell className="text-xs">{r.marca}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`text-xs ${getBadgeColor(r.classe_abc)}`}>
                            {r.classe_abc}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{r.quantidade_estoque}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatCurrency(r.valor_estoque)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatCurrency(r.custo_medio)}</TableCell>
                        <TableCell className="text-xs">{formatDate(r.data_ultima_venda)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={`text-xs ${
                            dias <= 30 ? 'text-emerald-400' :
                            dias <= 60 ? 'text-amber-400' :
                            dias <= 90 ? 'text-orange-400' : 'text-red-400'
                          }`}>
                            {dias >= 9999 ? 'N/A' : `${dias}d`}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{r.empresa.replace(/^CASPPER\s*/i, '')}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`detail-${i}`}>
                          <TableCell colSpan={11} className="bg-muted/30 p-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground text-xs">Grupo</p>
                                <p className="font-medium">{r.grupo}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Cód. Fabricante</p>
                                <p className="font-mono">{r.cod_fabricante}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Custo Fornecedor</p>
                                <p className="font-mono">{formatCurrency(r.custo_fornecedor)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Custo Última Compra</p>
                                <p className="font-mono">{formatCurrency(r.custo_ultima_compra)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Última Compra</p>
                                <p>{formatDate(r.data_ultima_compra)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Qtd. Comprada</p>
                                <p className="font-mono">{r.quantidade_compra_produto}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Cliente Última Venda</p>
                                <p>{r.cliente_ultima_venda || '—'}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Aplicação</p>
                                <p>{r.aplicacao_produto || '—'}</p>
                              </div>
                              {r.localizacao_produto && (
                                <div>
                                  <p className="text-muted-foreground text-xs">Localização</p>
                                  <p className="font-mono">{r.localizacao_produto}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-muted-foreground text-xs">Última Transferência</p>
                                <p>{formatDate(r.data_ultima_transferencia)}</p>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {visibleCount < sorted.length && (
            <div className="flex items-center justify-center gap-3 py-4 border-t border-border/50">
              <span className="text-xs text-muted-foreground">
                Mostrando {Math.min(visibleCount, sorted.length)} de {sorted.length}
              </span>
              <Button variant="outline" size="sm" onClick={() => setVisibleCount(v => Math.min(v + 50, sorted.length))}>
                Carregar mais 50
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setVisibleCount(sorted.length)}>
                Ver todos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
