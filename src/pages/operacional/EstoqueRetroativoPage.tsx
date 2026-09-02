import { useMemo, useState } from 'react';
import { Loader2, Search, FileSpreadsheet, CalendarDays, Package, Boxes, Building2, CircleDollarSign } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { resolveCodEmpresaBiParam } from '@/utils/filialEndpoint';
import { filtrarEstoqueCasaChevrolet10041 } from '@/utils/estoque10041';
import { buildApiProxyUrl } from '@/utils/apiEndpointResolver';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

interface EstoqueItem {
  CodEmpresa_bi?: string | number;
  empresa_codigo?: string | number;
  empresa_estoque?: string;
  empresa_nome?: string;
  cod_produto?: string | number;
  descricao?: string;
  numero_original?: string;
  numero_fabricante?: string;
  marca?: string;
  unidade?: string;
  saldo_estoque?: number | string;
  valor_unitario?: number | string;
  preco_venda_unitario?: number | string;
}

type ValorExcel = 'custo' | 'venda';

const toNumber = (v: any): number => {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

const getValorUnitario = (row: EstoqueItem, tipo: ValorExcel): number =>
  toNumber(tipo === 'custo' ? row.valor_unitario : row.preco_venda_unitario);

const pad7 = (v: any) => String(v ?? '').replace(/\D/g, '').padStart(7, '0').slice(-7);

const getFilialKey = (r: any): string => {
  const ec = String(r?.empresa_codigo ?? '').trim();
  const ee = String(r?.empresa_estoque ?? '').trim();
  return `${ec}|${ee}`;
};

const getEmpresaNome = (r: any): string => {
  return String(r?.empresa_nome ?? '').trim() || getFilialKey(r);
};

const getFilialLabel = (r: any): string => {
  const codigo = String(r?.empresa_codigo ?? '').trim();
  const nome = getEmpresaNome(r);
  return codigo ? `${codigo} - ${nome}` : nome;
};

export default function EstoqueRetroativoPage() {
  const { empresa } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();
  const codEmpresaBi = resolveCodEmpresaBiParam(empresa as any, filialAtiva);

  const [dataEstoque, setDataEstoque] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<EstoqueItem[]>([]);
  const [filialFiltro, setFilialFiltro] = useState<string>('__all__');
  const [busca, setBusca] = useState('');
  const [ultimaData, setUltimaData] = useState('');
  const [valorExcel, setValorExcel] = useState<ValorExcel>('venda');

  const filiaisDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      const key = getFilialKey(r);
      if (key === '|') return;
      if (!map.has(key)) map.set(key, getFilialLabel(r));
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (filialFiltro !== '__all__' && getFilialKey(r) !== filialFiltro) {
        return false;
      }
      if (!q) return true;
      return (
        String(r.cod_produto ?? '').toLowerCase().includes(q) ||
        String(r.descricao ?? '').toLowerCase().includes(q) ||
        String(r.numero_original ?? '').toLowerCase().includes(q) ||
        String(r.numero_fabricante ?? '').toLowerCase().includes(q) ||
        String(r.marca ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, filialFiltro, busca]);

  const consultar = async () => {
    if (!dataEstoque) {
      toast.error('Selecione a data do estoque');
      return;
    }
    if (!empresa) {
      toast.error('Empresa não identificada');
      return;
    }
    if (!codEmpresaBi) {
      toast.error('Empresa ativa sem código BI configurado');
      return;
    }
    setLoading(true);
    setRows([]);
    try {
      const url = buildApiProxyUrl(
        empresa,
        `/operacional/estoque/retroativo?data_estoque=${dataEstoque}&cod_empresa_bi=${codEmpresaBi}`
      );
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!resp.ok) throw new Error(`Erro ${resp.status}`);
      const data = await resp.json();
      const list: EstoqueItem[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.data)
        ? (data as any).data
        : [];
      // Segurança extra: nunca misturar CodEmpresa_bi diferentes do contexto ativo
      const filteredByBi = list.filter((r) => {
        const bi = String(r?.CodEmpresa_bi ?? '').trim();
        return !bi || bi === String(codEmpresaBi);
      });
      const filteredByContext = filtrarEstoqueCasaChevrolet10041(
        filteredByBi as unknown as Array<Record<string, unknown>>,
        String(codEmpresaBi),
      ) as unknown as EstoqueItem[];
      setRows(filteredByContext);
      setUltimaData(dataEstoque);
      setFilialFiltro('__all__');
      toast.success(`${filteredByContext.length} itens carregados`);
    } catch (e: any) {
      console.error('[EstoqueRetroativo] Erro ao consultar:', e);
      toast.error(`Falha ao consultar: ${e?.message ?? 'erro'}`);
    } finally {
      setLoading(false);
    }
  };

  const gerarExcel = () => {
    if (!filtered.length) {
      toast.error('Sem dados para exportar');
      return;
    }
    const aoa: any[][] = [
      [
        'CODIGO',
        'DESCRICAO',
        'NUM ORIGINAL',
        'NUM FABRICANTE',
        'MARCA',
        'UN',
        'QUANTIDADE',
        'VL.UNITARIO',
      ],
    ];
    filtered.forEach((r) => {
      aoa.push([
        pad7(r.cod_produto),
        r.descricao ?? '',
        r.numero_original ?? '',
        r.numero_fabricante ?? '',
        r.marca ?? '',
        r.unidade ?? '',
        Number(toNumber(r.saldo_estoque).toFixed(2)),
        Number(getValorUnitario(r, valorExcel).toFixed(2)),
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const range = XLSX.utils.decode_range(ws['!ref']!);
    for (let R = 1; R <= range.e.r; R++) {
      ['G', 'H'].forEach((col) => {
        const cell = ws[`${col}${R + 1}`];
        if (cell && typeof cell.v === 'number') {
          cell.t = 'n';
          cell.z = '0.00';
        }
      });
    }
    ws['!cols'] = [
      { wch: 10 },
      { wch: 42 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 6 },
      { wch: 12 },
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    const dd = ultimaData.split('-').reverse().join('-');
    XLSX.writeFile(wb, `ESTOQUE_PELEGRINI_${dd}.xlsx`);
  };

  const resumo = useMemo(() => {
    const quantidade = filtered.reduce((total, row) => total + toNumber(row.saldo_estoque), 0);
    const valor = filtered.reduce(
      (total, row) => total + toNumber(row.saldo_estoque) * getValorUnitario(row, valorExcel),
      0,
    );
    const filiais = new Set(filtered.map(getFilialKey).filter(key => key !== '|')).size;
    return { quantidade, valor, filiais };
  }, [filtered, valorExcel]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-5 px-4 py-5 sm:px-6 lg:py-6">
      <header className="ml-10 flex flex-col gap-1 sm:ml-0 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Estoque Retroativo</h1>
          <p className="text-sm text-muted-foreground">Consulte o saldo registrado em uma data específica.</p>
        </div>
        {codEmpresaBi ? <span className="text-xs text-muted-foreground">Empresa {codEmpresaBi}</span> : null}
      </header>

      <section aria-label="Consulta retroativa" className="flex flex-col gap-3 rounded-md border bg-card p-3 sm:flex-row sm:items-end">
        <div className="w-full sm:w-auto">
          <Label htmlFor="data_estoque" className="text-xs">Data do estoque</Label>
          <div className="relative mt-1.5">
            <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="data_estoque" type="date" value={dataEstoque} onChange={event => setDataEstoque(event.target.value)} className="w-full pl-9 sm:w-48" />
          </div>
        </div>
        <Button onClick={consultar} disabled={loading || !dataEstoque} className="gap-2 sm:w-auto">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? 'Consultando' : 'Consultar'}
        </Button>
      </section>

      {!ultimaData ? (
        <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed px-4 text-center text-sm text-muted-foreground">
          Selecione uma data para consultar a posição do estoque.
        </div>
      ) : rows.length === 0 ? (
        <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed px-4 text-center text-sm text-muted-foreground">
          Nenhum item encontrado para a data consultada.
        </div>
      ) : (
        <>
          <section aria-label="Resumo da consulta" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {[
              { icon: Package, label: 'Produtos', value: `${filtered.length} ${filtered.length === 1 ? 'produto' : 'produtos'}` },
              { icon: Boxes, label: 'Saldo total', value: resumo.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
              { icon: CircleDollarSign, label: valorExcel === 'venda' ? 'Valor de venda' : 'Valor de custo', value: resumo.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
              { icon: Building2, label: 'Filiais', value: resumo.filiais.toLocaleString('pt-BR') },
            ].map(item => (
              <div key={item.label} className="flex min-h-20 items-center gap-3 rounded-md border bg-card p-3">
                <item.icon className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0"><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 truncate text-sm font-semibold tabular-nums sm:text-base">{item.value}</p></div>
              </div>
            ))}
          </section>

          <section aria-label="Filtros dos resultados" className="grid gap-2 rounded-md border bg-card p-3 sm:grid-cols-2 xl:grid-cols-[220px_minmax(260px,1fr)_220px_auto]">
            <Select value={filialFiltro} onValueChange={setFilialFiltro}>
              <SelectTrigger aria-label="Filial"><SelectValue placeholder="Todas as filiais" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as filiais</SelectItem>
                {filiaisDisponiveis.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="search" aria-label="Buscar nos resultados" placeholder="Buscar código, descrição ou marca" value={busca} onChange={event => setBusca(event.target.value)} />
            <Select value={valorExcel} onValueChange={value => setValorExcel(value as ValorExcel)}>
              <SelectTrigger aria-label="Base de valor"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="venda">Preço de venda</SelectItem><SelectItem value="custo">Custo do fornecedor</SelectItem></SelectContent>
            </Select>
            <Button onClick={gerarExcel} variant="outline" className="gap-2"><FileSpreadsheet className="h-4 w-4" /> Exportar</Button>
          </section>

          <Card className="overflow-hidden">
            <div className="divide-y md:hidden">
              {filtered.slice(0, 500).map((row, index) => (
                <article key={`${getFilialKey(row)}-${row.cod_produto}-${index}`} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate text-sm font-semibold">{row.descricao || 'Produto sem descrição'}</p><p className="mt-0.5 text-xs text-muted-foreground">{pad7(row.cod_produto)} · {row.marca || 'Sem marca'}</p></div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{toNumber(row.saldo_estoque).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span className="truncate">{getFilialLabel(row)}</span><span className="whitespace-nowrap font-medium text-foreground tabular-nums">{getValorUnitario(row, valorExcel).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                </article>
              ))}
            </div>
            <div className="hidden max-h-[65vh] overflow-auto md:block">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>CÓDIGO</TableHead>
                    <TableHead>DESCRIÇÃO</TableHead>
                    <TableHead>Nº ORIGINAL</TableHead>
                    <TableHead>Nº FABRICANTE</TableHead>
                    <TableHead>MARCA</TableHead>
                    <TableHead>UN</TableHead>
                    <TableHead className="text-right">QUANTIDADE</TableHead>
                    <TableHead className="text-right">VL.UNITÁRIO</TableHead>
                    <TableHead>FILIAL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 500).map((r, i) => (
                    <TableRow key={`${getFilialKey(r)}-${r.cod_produto}-${i}`}>
                      <TableCell className="font-mono text-xs">{pad7(r.cod_produto)}</TableCell>
                      <TableCell className="max-w-[320px] truncate">{r.descricao}</TableCell>
                      <TableCell className="text-xs">{r.numero_original}</TableCell>
                      <TableCell className="text-xs">{r.numero_fabricante}</TableCell>
                      <TableCell className="text-xs">{r.marca}</TableCell>
                      <TableCell className="text-xs">{r.unidade}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {toNumber(r.saldo_estoque).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {getValorUnitario(r, valorExcel).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-xs">{getFilialLabel(r)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filtered.length > 500 ? <div className="border-t p-3 text-center text-xs text-muted-foreground">Exibindo os primeiros 500 registros. Refine os filtros ou exporte para consultar todos.</div> : null}
          </Card>
        </>
      )}
    </div>
  );
}
