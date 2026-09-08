import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Search, Download, Receipt, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatInteger, formatNumber } from '@/utils/formatters';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { cn } from '@/lib/utils';
import type { ProdutoItem } from '@/types/comercialProdutos';
import {
  getVendedorCasaChevrolet10041FromRecord,
  isServicoForaRelatorioChevrolet10041,
  normalizeVendedor1004,
  vendedorPertenceRelatorioChevrolet10041,
} from '@/utils/vendedores1004';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtos: ProdutoItem[];
  totalEsperado: number;
  isLoading?: boolean;
  error?: unknown;
  isContextoChevrolet10041?: boolean;
}

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  width?: string;
  numeric?: boolean;
  currency?: boolean;
  get: (p: ProdutoItem) => string | number | undefined;
}

const PAGE_SIZE = 50;

function fmtDate(iso?: string) {
  if (!iso) return '—';
  const d = String(iso).substring(0, 10);
  const [y, m, dd] = d.split('-');
  if (!y || !m || !dd) return String(iso);
  return `${dd}/${m}/${y}`;
}

const COLUMNS: Column[] = [
  { key: 'cod_pedido',        label: 'Cód. Pedido',   width: '110px', get: (p) => p.cod_pedido },
  { key: 'num_nf',            label: 'NF',            width: '90px',  get: (p) => p.num_nf },
  { key: 'data_pedido',       label: 'Dt. Pedido',    width: '110px', get: (p) => p.data_pedido },
  { key: 'data_faturamento',  label: 'Dt. Faturam.',  width: '110px', get: (p) => p.data_faturamento },
  { key: 'data_movimento',    label: 'Dt. Movimento', width: '110px', get: (p) => String((p as Record<string, unknown>).data_movimento ?? p.data_faturamento ?? '') },
  { key: 'tipo',              label: 'Tipo',          width: '100px', align: 'center', get: (p) => p.tipo },
  { key: 'vendedor_nome',     label: 'Vendedor',      width: '160px', get: (p) => p.vendedor_nome || p.nome_interno || p.nome_externo },
  { key: 'vendedor_codigo',   label: 'Cód. Vend.',    width: '90px',  get: (p) => p.vendedor_codigo },
  { key: 'cliente_razao',     label: 'Cliente',       width: '220px', get: (p) => p.cliente_razao },
  { key: 'cliente_codigo',    label: 'Cód. Cliente',  width: '100px', get: (p) => p.cliente_codigo },
  { key: 'filial_nome',       label: 'Filial',        width: '140px', get: (p) => p.filial_nome || p.filial_codigo },
  { key: 'descricao',         label: 'Produto',       width: '260px', get: (p) => p.descricao },
  { key: 'cod_produto',       label: 'Cód. Produto',  width: '100px', get: (p) => p.cod_produto },
  { key: 'marca',             label: 'Marca',         width: '130px', get: (p) => p.marca },
  { key: 'grupo',             label: 'Grupo',         width: '140px', get: (p) => p.grupo || p.nome_grupo },
  { key: 'cfop',              label: 'CFOP',          width: '80px',  align: 'center', get: (p) => String((p as Record<string, unknown>).cfop ?? '') },
  { key: 'quantidade',        label: 'Qtd',           width: '80px',  align: 'right', numeric: true, get: (p) => p.quantidade },
  { key: 'valor_venda_item',  label: 'Vlr. Venda',    width: '120px', align: 'right', currency: true, get: (p) => p.valor_venda_item ?? 0 },
  { key: 'valor_desconto',    label: 'Desc. Item',    width: '120px', align: 'right', currency: true, get: (p) => p.valor_desconto ?? 0 },
  { key: 'valor_devolucao_item', label: 'Vlr. Devol.', width: '120px', align: 'right', currency: true, get: (p) => p.valor_devolucao_item ?? 0 },
  { key: 'valor_liquido_final_item', label: 'Vlr. Líq. Final', width: '130px', align: 'right', currency: true, get: (p) => Number((p as Record<string, unknown>).valor_liquido_final_item ?? 0) },
  { key: 'valor_bruto_item',  label: 'Vlr. Bruto',    width: '120px', align: 'right', currency: true, get: (p) => p.valor_bruto_item ?? 0 },
  { key: 'valor_total',       label: 'Vlr. Líquido',  width: '130px', align: 'right', currency: true, get: (p) => p.valor_total ?? 0 },
  { key: 'valor_custo',       label: 'Custo',         width: '120px', align: 'right', currency: true, get: (p) => p.valor_custo ?? 0 },
  { key: 'valor_total_nf',    label: 'Vlr. Total NF', width: '130px', align: 'right', currency: true, get: (p) => p.valor_total_nf ?? 0 },
];

const TABLE_COLUMN_KEYS = [
  'cod_pedido',
  'num_nf',
  'data_faturamento',
  'tipo',
  'vendedor_nome',
  'cliente_razao',
  'filial_nome',
  'descricao',
  'valor_total',
];

const TABLE_COLUMNS = TABLE_COLUMN_KEYS
  .map((key) => COLUMNS.find((column) => column.key === key))
  .filter((column): column is Column => Boolean(column))
  .map((column) => column.key === 'valor_total' ? { ...column, label: 'Valor', width: '130px' } : column);

const SEARCH_KEYS: Array<keyof ProdutoItem | string> = [
  'cod_pedido', 'num_nf', 'cliente_razao', 'vendedor_nome',
  'nome_interno', 'nome_externo', 'descricao', 'marca',
];

type TipoFiltro = 'todos' | 'PEDIDO' | 'DEVOLUCAO';

function deveAplicarEscopoChevrolet10041PorDados(produtos: ProdutoItem[]): boolean {
  if (!produtos.length) return false;

  const hasContextoForte = produtos.some((item) => {
    const record = item as unknown as Record<string, unknown>;
    const codEmpresa = String(record.cod_empresa_bi ?? record.CodEmpresa_bi ?? '').trim();
    const filial = normalizeVendedor1004(
      record.filial_nome ?? record.Filial ?? record.filial ?? record.filial_codigo ?? record.CodFilial,
    );

    return codEmpresa === '10041'
      || filial === '10041'
      || filial === 'CCH'
      || filial.includes('CHEVROLET');
  });
  if (hasContextoForte) return true;

  const hasFilialCh = produtos.some((item) => {
    const record = item as unknown as Record<string, unknown>;
    const filial = normalizeVendedor1004(
      record.filial_nome ?? record.Filial ?? record.filial ?? record.filial_codigo ?? record.CodFilial,
    );
    return filial === 'CH';
  });
  if (!hasFilialCh) return false;

  return produtos.some((item) => {
    const vendedor = getVendedorCasaChevrolet10041FromRecord(item as unknown as Record<string, unknown>);
    if (vendedorPertenceRelatorioChevrolet10041(vendedor)) return true;

    const nome = normalizeVendedor1004(vendedor?.nome ?? item.vendedor_nome ?? item.nome_interno ?? item.nome_externo);
    return [
      'BRUNO B',
      'WANDERSON VIANA',
      'NATA',
      'DAYVID',
      'THIAGO TOMAS',
      'THIAGO TOMAZ',
      'SERVICO DE TERCEIRO',
    ].some((bloqueado) => nome.includes(bloqueado));
  });
}

function getVendedorRelatorioChevrolet10041(item: ProdutoItem): { codigo: string; nome: string } | null {
  const record = item as unknown as Record<string, unknown>;
  const resolved = getVendedorCasaChevrolet10041FromRecord(record);
  if (resolved) return resolved;

  const codigo = String(
    item.vendedor_codigo ?? record.cod_vendedor ?? record.CodVendedor ?? '',
  ).trim();
  const nome = String(
    item.vendedor_nome ?? item.nome_interno ?? item.nome_externo ?? record.vendedor ?? record.Vendedor ?? '',
  ).trim();

  if (!codigo && !nome) return null;
  return { codigo, nome };
}

export function ReceitaDetalheDialog({
  open,
  onOpenChange,
  produtos,
  isLoading,
  error,
  isContextoChevrolet10041 = false,
}: Props) {
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos');
  const [sortKey, setSortKey] = useState<string>('data_faturamento');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const produtosEscopo = useMemo(() => {
    const aplicarEscopoChevrolet10041 = isContextoChevrolet10041
      || deveAplicarEscopoChevrolet10041PorDados(produtos);
    if (!aplicarEscopoChevrolet10041) return produtos;

    return produtos.filter((item) => {
      if (isServicoForaRelatorioChevrolet10041(item as unknown as Record<string, unknown>)) return false;

      const vendedor = getVendedorRelatorioChevrolet10041(item);
      return vendedorPertenceRelatorioChevrolet10041(vendedor);
    });
  }, [isContextoChevrolet10041, produtos]);

  const filtradosPorBusca = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return produtosEscopo;
    return produtosEscopo.filter(p =>
      SEARCH_KEYS.some(k => String((p as Record<string, unknown>)[k] ?? '').toLowerCase().includes(q))
    );
  }, [produtosEscopo, busca]);

  const contagemTipo = useMemo(() => {
    const pedidos = filtradosPorBusca.filter((p) => p.tipo !== 'DEVOLUCAO').length;
    const devolucoes = filtradosPorBusca.filter((p) => p.tipo === 'DEVOLUCAO').length;
    return { todos: filtradosPorBusca.length, pedidos, devolucoes };
  }, [filtradosPorBusca]);

  const filtrados = useMemo(() => {
    if (tipoFiltro === 'todos') return filtradosPorBusca;
    return filtradosPorBusca.filter((p) => p.tipo === tipoFiltro);
  }, [filtradosPorBusca, tipoFiltro]);

  const ordenados = useMemo(() => {
    const col = COLUMNS.find(c => c.key === sortKey);
    if (!col) return filtrados;
    const arr = [...filtrados];
    arr.sort((a, b) => {
      const va = col.get(a);
      const vb = col.get(b);
      if (col.numeric || col.currency) {
        return ((Number(va) || 0) - (Number(vb) || 0)) * (sortDir === 'asc' ? 1 : -1);
      }
      return String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR', { numeric: true }) * (sortDir === 'asc' ? 1 : -1);
    });
    return arr;
  }, [filtrados, sortKey, sortDir]);

  const totais = useMemo(() => {
    let venda = 0, desconto = 0, devolucao = 0, liqFinal = 0, bruto = 0, liquido = 0, custo = 0, qtd = 0;
    for (const p of filtrados) {
      venda += Number(p.valor_venda_item ?? 0);
      desconto += Number(p.valor_desconto ?? 0);
      devolucao += Number(p.valor_devolucao_item ?? 0);
      liqFinal += Number((p as Record<string, unknown>).valor_liquido_final_item ?? 0);
      bruto += Number(p.valor_bruto_item ?? 0);
      liquido += Number(p.valor_total ?? 0);
      custo += Number(p.valor_custo ?? 0);
      qtd += Number(p.quantidade ?? 0);
    }
    return { venda, desconto, devolucao, liqFinal, bruto, liquido, custo, qtd, receita: liquido };
  }, [filtrados]);


  const totalPages = Math.max(1, Math.ceil(ordenados.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageItems = ordenados.slice(pageSafe * PAGE_SIZE, (pageSafe + 1) * PAGE_SIZE);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const exportExcel = () => {
    const header = TABLE_COLUMNS.map(c => c.label);
    const rows = ordenados.map(p => TABLE_COLUMNS.map(c => {
      const v = c.get(p);
      if (c.currency || c.numeric) return Number(v ?? 0);
      if (c.key.startsWith('data_')) return v ? String(v).substring(0, 10) : '';
      return v ?? '';
    }));
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws['!cols'] = TABLE_COLUMNS.map((column) => ({
      wch: Math.max(10, Math.round(Number.parseInt(column.width || '120', 10) / 9)),
    }));
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    const valorColumnIndex = TABLE_COLUMNS.findIndex((column) => column.key === 'valor_total');
    if (valorColumnIndex >= 0) {
      for (let rowIndex = 1; rowIndex <= rows.length; rowIndex += 1) {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: valorColumnIndex });
        if (ws[cellRef]) ws[cellRef].z = 'R$ #,##0.00';
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Receita 1004');
    const today = new Date().toISOString().substring(0, 10);
    XLSX.writeFile(wb, `receita-1004-detalhamento-${today}.xlsx`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { onOpenChange(v); if (!v) { setBusca(''); setTipoFiltro('todos'); setPage(0); } }}
    >
      <DialogContent className="flex h-[88vh] w-[92vw] max-w-[1280px] flex-col gap-4 border-border/60 bg-card p-4 text-foreground sm:rounded-lg [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/35 hover:[&::-webkit-scrollbar-thumb]:bg-primary/50">
        <DialogHeader className="border-b border-border/60 pb-3 [&>p]:hidden">
          <DialogTitle className="flex items-center gap-2 text-[0px] font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/20">
              <Receipt className="h-4 w-4" />
            </span>
            <span className="text-base">Detalhamento da Receita</span>
            Receita — Detalhamento dos itens (empresa 1004)
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <ResumoCard label="Receita bruta" value={formatCurrency(totais.receita)} destaque />
          <ResumoCard label="Registros" value={formatInteger(ordenados.length)} />
          <ResumoCard label="Pedidos" value={formatInteger(contagemTipo.pedidos)} />
          <ResumoCard label="Devolucoes" value={formatInteger(contagemTipo.devolucoes)} />
        </div>

        <div className="flex items-center gap-2 flex-wrap rounded-lg border border-border/50 bg-background/20 p-2">
          <div
            data-testid="receita-tipo-filtros"
            className="flex items-center gap-1 rounded-full border border-border/40 bg-muted/25 p-0.5"
          >
            {[
              { key: 'todos', label: 'Todos', count: contagemTipo.todos },
              { key: 'PEDIDO', label: 'Pedidos', count: contagemTipo.pedidos },
              { key: 'DEVOLUCAO', label: 'Devolucoes', count: contagemTipo.devolucoes },
            ].map((item) => (
              <Button
                key={item.key}
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  'h-7 rounded-full border border-transparent px-3 text-[11px] font-medium transition-colors',
                  tipoFiltro === item.key
                    ? 'border-primary/30 bg-primary/15 text-primary shadow-none hover:bg-primary/20'
                    : 'text-muted-foreground hover:bg-background/45 hover:text-foreground',
                )}
                onClick={() => { setTipoFiltro(item.key as TipoFiltro); setPage(0); }}
              >
                {item.label}
                <span className={cn(
                  'ml-1.5 rounded-full px-1.5 py-0.5 font-mono text-[9px]',
                  tipoFiltro === item.key ? 'bg-primary/15 text-primary' : 'bg-background/45 text-muted-foreground',
                )}>
                  {formatInteger(item.count)}
                </span>
              </Button>
            ))}
          </div>
          <div className="relative min-w-[260px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por pedido, NF, cliente, vendedor, produto ou marca..."
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPage(0); }}
              className="h-8 rounded-full border-border/50 bg-background/45 pl-9 pr-9 text-xs"
            />
            {busca && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Limpar busca"
                className="absolute right-1 top-1 h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
                onClick={() => { setBusca(''); setPage(0); }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <Button size="sm" variant="outline" className="h-8 rounded-full border-border/50 bg-background/45 px-3 text-xs" onClick={exportExcel} disabled={ordenados.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar Excel
          </Button>
        </div>

        <div
          data-testid="receita-tabela-scroll"
          className="flex-1 min-h-0 overflow-auto rounded-lg border border-border/50 bg-background/25 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-corner]:bg-transparent [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/35 hover:[&::-webkit-scrollbar-thumb]:bg-primary/50"
        >
          {isLoading ? (
            <LoadingState message="Carregando itens da receita..." />
          ) : error ? (
            <ErrorState message="Erro ao carregar itens." />
          ) : ordenados.length === 0 ? (
            <EmptyState
              title="Nenhum item encontrado"
              message={busca ? 'Nenhum resultado para a busca.' : 'Não há itens no período/filtros selecionados.'}
            />
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 border-b border-border/60 bg-muted">
                <tr className="text-[10px] uppercase text-muted-foreground">
                  {TABLE_COLUMNS.map(c => (
                    <th
                      key={c.key}
                      style={{ minWidth: c.width, width: c.width }}
                      className={cn(
                        'px-3 py-2.5 font-semibold cursor-pointer select-none whitespace-nowrap',
                        c.align === 'right' && 'text-right',
                        c.align === 'center' && 'text-center',
                        c.align !== 'right' && c.align !== 'center' && 'text-left',
                      )}
                      onClick={() => handleSort(c.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.label}
                        {sortKey === c.key
                          ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
                          : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p, idx) => {
                  const isDev = p.tipo === 'DEVOLUCAO';
                  return (
                    <tr
                      key={`${p.id}-${idx}`}
                      className={cn(
                        'border-b border-border/50 transition-colors hover:bg-primary/5',
                        isDev && 'bg-destructive/5 hover:bg-destructive/10'
                      )}
                    >
                      {TABLE_COLUMNS.map(c => {
                        const v = c.get(p);
                        let display: ReactNode = v ?? '—';
                        if (c.key.startsWith('data_')) display = fmtDate(v as string);
                        else if (c.currency) display = formatCurrency(Number(v ?? 0));
                        else if (c.numeric) display = formatNumber(Number(v ?? 0), 0);
                        else if (c.key === 'tipo') {
                          display = (
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[9px] uppercase',
                                isDev
                                  ? 'border-destructive/40 text-destructive'
                                  : 'border-emerald-500/40 text-emerald-500'
                              )}
                            >
                              {v as string}
                            </Badge>
                          );
                        }
                        return (
                          <td
                            key={c.key}
                            style={{ minWidth: c.width, width: c.width }}
                            className={cn(
                              'px-3 py-2 whitespace-nowrap',
                              c.align === 'right' && 'text-right tabular-nums',
                              c.align === 'center' && 'text-center',
                              c.currency && (Number(v) < 0 ? 'text-destructive' : ''),
                              c.currency && Number(v) >= 0 && 'font-semibold text-primary',
                              c.key === 'cod_pedido' && 'font-mono font-semibold text-foreground',
                              c.key === 'descricao' && 'truncate max-w-[260px]',
                              c.key === 'cliente_razao' && 'truncate max-w-[220px]',
                            )}
                            title={typeof display === 'string' ? display : undefined}
                          >
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 border-t border-border/60 bg-muted font-semibold">
                <tr className="text-xs">
                  {TABLE_COLUMNS.map((c) => {
                    let content: ReactNode = '';
                    if (c.key === 'cod_pedido') content = `TOTAL (${formatInteger(ordenados.length)})`;
                    else if (c.key === 'quantidade') content = formatNumber(totais.qtd, 0);
                    else if (c.key === 'valor_venda_item') content = formatCurrency(totais.venda);
                    else if (c.key === 'valor_desconto') content = formatCurrency(totais.desconto);
                    else if (c.key === 'valor_devolucao_item') content = formatCurrency(totais.devolucao);
                    else if (c.key === 'valor_liquido_final_item') content = formatCurrency(totais.liqFinal);
                    else if (c.key === 'valor_bruto_item') content = formatCurrency(totais.bruto);
                    else if (c.key === 'valor_total') content = formatCurrency(totais.liquido);
                    else if (c.key === 'valor_custo') content = formatCurrency(totais.custo);
                    return (
                      <td
                        key={c.key}
                        style={{ minWidth: c.width, width: c.width }}
                        className={cn(
                          'px-3 py-2.5 whitespace-nowrap',
                          c.align === 'right' && 'text-right tabular-nums',
                          c.align === 'center' && 'text-center',
                        )}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
            <span>Página {pageSafe + 1} de {totalPages}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 rounded-lg border-border/60 bg-background/50" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={pageSafe === 0}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" className="h-8 rounded-lg border-border/60 bg-background/50" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={pageSafe >= totalPages - 1}>
                Próxima
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResumoCard({ label, value, destaque = false }: { label: string; value: string; destaque?: boolean }) {
  return (
    <div className={cn(
      'rounded-lg border px-3 py-2.5 transition-colors',
      destaque
        ? 'border-primary/25 bg-primary/10 text-primary'
        : 'border-border/60 bg-background/35 text-foreground',
    )}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate font-mono text-base font-bold leading-none">
        {value}
      </div>
    </div>
  );
}
