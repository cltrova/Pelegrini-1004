import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Download, Search, Layers, Package } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import type { ProdutoItem } from '@/types/comercialProdutos';

interface Props {
  produtos: ProdutoItem[];
  isLoading?: boolean;
  periodoLabel?: string;
}

interface ProdutoAgg {
  key: string;
  cod: string | number;
  descricao: string;
  qtde: number;
  faturamento: number;
}
interface ClienteAgg {
  key: string;
  cod: string | number | undefined;
  razao: string;
  qtde: number;
  faturamento: number;
  produtos: ProdutoAgg[];
}
interface MarcaAgg {
  key: string;
  marca: string;
  qtde: number;
  faturamento: number;
  clientes: ClienteAgg[];
}

function normMarca(p: ProdutoItem): string {
  const nome = (p.marca || '').toString().trim().toUpperCase();
  if (nome) return nome;
  const codMarca = (p as Record<string, unknown>).cod_marca;
  const cod = codMarca ? String(codMarca).trim() : '';
  return cod ? `MARCA ${cod}` : 'SEM MARCA';
}

export function ComposicaoVendasTab({ produtos, isLoading, periodoLabel }: Props) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [allOpen, setAllOpen] = useState(false);

  const marcas = useMemo<MarcaAgg[]>(() => {
    const mMap = new Map<string, MarcaAgg>();
    for (const it of produtos || []) {
      if (!it) continue;
      const q = Number(it.quantidade) || 0;
      const v = Number(it.valor_total) || 0;
      if (!q && !v) continue;

      const marcaNome = normMarca(it);
      let m = mMap.get(marcaNome);
      if (!m) {
        m = { key: marcaNome, marca: marcaNome, qtde: 0, faturamento: 0, clientes: [] };
        mMap.set(marcaNome, m);
      }

      const cliKey = String(it.cliente_codigo ?? it.cliente_razao ?? 'SEM_CLIENTE');
      let c = m.clientes.find((x) => x.key === cliKey);
      if (!c) {
        c = {
          key: cliKey,
          cod: it.cliente_codigo,
          razao: (it.cliente_razao || 'Sem cliente').toString(),
          qtde: 0,
          faturamento: 0,
          produtos: [],
        };
        m.clientes.push(c);
      }

      const prodKey = String(it.cod_produto ?? it.descricao ?? 'X');
      let p = c.produtos.find((x) => x.key === prodKey);
      if (!p) {
        p = {
          key: prodKey,
          cod: it.cod_produto,
          descricao: (it.descricao || '—').toString(),
          qtde: 0,
          faturamento: 0,
        };
        c.produtos.push(p);
      }
      p.qtde += q;
      p.faturamento += v;
      c.qtde += q;
      c.faturamento += v;
      m.qtde += q;
      m.faturamento += v;
    }

    const arr = Array.from(mMap.values());
    arr.sort((a, b) => b.faturamento - a.faturamento);
    for (const m of arr) {
      m.clientes.sort((a, b) => b.faturamento - a.faturamento);
      for (const c of m.clientes) c.produtos.sort((a, b) => b.faturamento - a.faturamento);
    }
    return arr;
  }, [produtos]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return marcas;
    return marcas
      .map((m) => {
        const marcaHit = m.marca.toLowerCase().includes(t);
        const clientes = m.clientes
          .map((c) => {
            const cliHit = c.razao.toLowerCase().includes(t) || String(c.cod ?? '').toLowerCase().includes(t);
            const produtos = c.produtos.filter(
              (p) =>
                marcaHit ||
                cliHit ||
                p.descricao.toLowerCase().includes(t) ||
                String(p.cod ?? '').toLowerCase().includes(t),
            );
            if (marcaHit || cliHit || produtos.length) return { ...c, produtos };
            return null;
          })
          .filter(Boolean) as ClienteAgg[];
        if (marcaHit || clientes.length) return { ...m, clientes };
        return null;
      })
      .filter(Boolean) as MarcaAgg[];
  }, [marcas, search]);

  const totalGeral = useMemo(
    () => filtered.reduce((acc, m) => ({ q: acc.q + m.qtde, v: acc.v + m.faturamento }), { q: 0, v: 0 }),
    [filtered],
  );

  const isOpen = (k: string) => (allOpen ? !expanded[k] : !!expanded[k]);
  const toggle = (k: string) => setExpanded((s) => ({ ...s, [k]: !s[k] }));

  const expandAll = () => {
    setAllOpen(true);
    setExpanded({});
  };
  const collapseAll = () => {
    setAllOpen(false);
    setExpanded({});
  };

  const exportXlsx = () => {
    const rows: (string | number)[][] = [];
    rows.push(['Produto_Marca', 'Cliente', 'Produto', 'Soma de Qtde', 'Soma de VendaLiq']);
    for (const m of filtered) {
      let firstMarca = true;
      for (const c of m.clientes) {
        let firstCli = true;
        for (const p of c.produtos) {
          rows.push([
            firstMarca ? m.marca : '',
            firstCli ? c.razao : '',
            p.descricao,
            p.qtde,
            Number(p.faturamento.toFixed(2)),
          ]);
          firstMarca = false;
          firstCli = false;
        }
        rows.push(['', '', 'Total', c.qtde, Number(c.faturamento.toFixed(2))]);
      }
      rows.push([`Total ${m.marca}`, '', '', m.qtde, Number(m.faturamento.toFixed(2))]);
    }
    rows.push(['Total Geral', '', '', totalGeral.q, Number(totalGeral.v.toFixed(2))]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 22 }, { wch: 46 }, { wch: 60 }, { wch: 14 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Composicao');
    XLSX.writeFile(wb, `composicao-vendas${periodoLabel ? '-' + periodoLabel : ''}.xlsx`);
  };

  const border = 'border-b border-white/5';
  const subRow = 'bg-white/[0.03]';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar marca, cliente ou produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={expandAll} className="h-9 gap-1.5">
          <Layers className="w-3.5 h-3.5" /> Expandir tudo
        </Button>
        <Button variant="outline" size="sm" onClick={collapseAll} className="h-9">
          Recolher tudo
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {filtered.length} marca(s) · {totalGeral.q.toLocaleString('pt-BR')} itens ·{' '}
            <span className="font-semibold text-foreground">{formatCurrency(totalGeral.v)}</span>
          </span>
          <Button size="sm" onClick={exportXlsx} disabled={!filtered.length} className="h-9 gap-1.5">
            <Download className="w-3.5 h-3.5" /> Exportar Excel
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 overflow-hidden bg-card">
        <div className="grid grid-cols-[minmax(200px,1.4fr)_minmax(220px,2fr)_minmax(260px,3fr)_110px_150px_90px] gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-white/[0.03] border-b border-white/10">
          <div>Marca</div>
          <div>Cliente</div>
          <div>Produto</div>
          <div className="text-right">Qtde</div>
          <div className="text-right">Faturamento</div>
          <div className="text-right">% marca</div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Carregando composição…</div>
          ) : !filtered.length ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhum registro encontrado no período com os filtros atuais.
            </div>
          ) : (
            filtered.map((m) => {
              const openM = isOpen('m:' + m.key);
              const partMarca = totalGeral.v ? (m.faturamento / totalGeral.v) * 100 : 0;
              return (
                <div key={m.key}>
                  <button
                    onClick={() => toggle('m:' + m.key)}
                    className={`w-full grid grid-cols-[minmax(200px,1.4fr)_minmax(220px,2fr)_minmax(260px,3fr)_110px_150px_90px] gap-2 px-3 py-2 items-center text-left hover:bg-white/[0.04] ${border}`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-sm">
                      {openM ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      {m.marca}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.clientes.length} cliente(s)
                    </div>
                    <div />
                    <div className="text-right text-sm tabular-nums font-semibold">{m.qtde.toLocaleString('pt-BR')}</div>
                    <div className="text-right text-sm tabular-nums font-semibold">{formatCurrency(m.faturamento)}</div>
                    <div className="text-right text-xs tabular-nums text-muted-foreground">{partMarca.toFixed(1)}%</div>
                  </button>

                  {openM &&
                    m.clientes.map((c) => {
                      const openC = isOpen('c:' + m.key + ':' + c.key);
                      const partCli = m.faturamento ? (c.faturamento / m.faturamento) * 100 : 0;
                      return (
                        <div key={c.key} className={subRow}>
                          <button
                            onClick={() => toggle('c:' + m.key + ':' + c.key)}
                            className={`w-full grid grid-cols-[minmax(200px,1.4fr)_minmax(220px,2fr)_minmax(260px,3fr)_110px_150px_90px] gap-2 px-3 py-1.5 items-center text-left hover:bg-white/[0.06] ${border}`}
                          >
                            <div />
                            <div className="flex items-center gap-1.5 text-sm pl-4">
                              {openC ? <ChevronDown className="w-3.5 h-3.5 text-primary" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                              <span className="truncate">{c.razao}</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground">{c.produtos.length} produto(s)</div>
                            <div className="text-right text-sm tabular-nums">{c.qtde.toLocaleString('pt-BR')}</div>
                            <div className="text-right text-sm tabular-nums">{formatCurrency(c.faturamento)}</div>
                            <div className="text-right text-xs tabular-nums text-muted-foreground">{partCli.toFixed(1)}%</div>
                          </button>

                          {openC &&
                            c.produtos.map((p) => (
                              <div
                                key={p.key}
                                className={`grid grid-cols-[minmax(200px,1.4fr)_minmax(220px,2fr)_minmax(260px,3fr)_110px_150px_90px] gap-2 px-3 py-1.5 items-center ${border} hover:bg-white/[0.03]`}
                              >
                                <div />
                                <div />
                                <div className="flex items-center gap-1.5 text-xs pl-8">
                                  <Package className="w-3 h-3 text-muted-foreground shrink-0" />
                                  <span className="truncate" title={p.descricao}>
                                    <span className="text-muted-foreground font-mono">#{p.cod}</span> {p.descricao}
                                  </span>
                                </div>
                                <div className="text-right text-xs tabular-nums text-muted-foreground">{p.qtde.toLocaleString('pt-BR')}</div>
                                <div className="text-right text-xs tabular-nums">{formatCurrency(p.faturamento)}</div>
                                <div className="text-right" />
                              </div>
                            ))}
                        </div>
                      );
                    })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
