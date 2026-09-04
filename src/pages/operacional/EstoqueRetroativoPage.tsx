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
import {
  EstoqueDataViewport,
  EstoqueToolbar,
  EstoqueWorkspace,
} from '@/components/operacional/estoque/EstoqueWorkspace';
import {
  EstoqueMetricStrip,
  type EstoqueMetric,
} from '@/components/operacional/estoque/EstoqueMetricStrip';
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

const toNumber = (v: unknown): number => {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

const getValorUnitario = (row: EstoqueItem, tipo: ValorExcel): number =>
  toNumber(tipo === 'custo' ? row.valor_unitario : row.preco_venda_unitario);

const pad7 = (v: unknown) => String(v ?? '').replace(/\D/g, '').padStart(7, '0').slice(-7);

const getFilialKey = (r: EstoqueItem): string => {
  const ec = String(r?.empresa_codigo ?? '').trim();
  const ee = String(r?.empresa_estoque ?? '').trim();
  return `${ec}|${ee}`;
};

const getEmpresaNome = (r: EstoqueItem): string => {
  return String(r?.empresa_nome ?? '').trim() || getFilialKey(r);
};

const getFilialLabel = (r: EstoqueItem): string => {
  const codigo = String(r?.empresa_codigo ?? '').trim();
  const nome = getEmpresaNome(r);
  return codigo ? `${codigo} - ${nome}` : nome;
};

export default function EstoqueRetroativoPage() {
  const { empresa } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();
  const codEmpresaBi = resolveCodEmpresaBiParam(empresa, filialAtiva);

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
      const data: unknown = await resp.json();
      const list: EstoqueItem[] = Array.isArray(data)
        ? data as EstoqueItem[]
        : typeof data === 'object' && data !== null && 'data' in data && Array.isArray(data.data)
        ? data.data as EstoqueItem[]
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
    } catch (e: unknown) {
      console.error('[EstoqueRetroativo] Erro ao consultar:', e);
      toast.error(`Falha ao consultar: ${e instanceof Error ? e.message : 'erro'}`);
    } finally {
      setLoading(false);
    }
  };

  const gerarExcel = () => {
    if (!filtered.length) {
      toast.error('Sem dados para exportar');
      return;
    }
    const aoa: Array<Array<string | number>> = [
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

  const metrics = useMemo<EstoqueMetric[]>(() => [
    {
      key: 'products',
      label: 'Produtos',
      value: `${filtered.length} ${filtered.length === 1 ? 'produto' : 'produtos'}`,
      description: 'Quantidade de produtos exibidos após os filtros da consulta retroativa.',
      icon: Package,
      tone: 'information',
      interactive: false,
    },
    {
      key: 'balance',
      label: 'Saldo total',
      value: resumo.quantidade.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      description: 'Soma das quantidades em estoque na data de referência.',
      icon: Boxes,
      tone: 'neutral',
      interactive: false,
    },
    {
      key: 'value',
      label: valorExcel === 'venda' ? 'Valor de venda' : 'Valor de custo',
      value: resumo.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      description: valorExcel === 'venda'
        ? 'Valor total estimado pelo preço de venda selecionado.'
        : 'Valor total estimado pelo custo do fornecedor selecionado.',
      icon: CircleDollarSign,
      tone: 'attention',
      interactive: false,
    },
    {
      key: 'branches',
      label: 'Filiais',
      value: resumo.filiais.toLocaleString('pt-BR'),
      description: 'Quantidade de filiais presentes nos resultados filtrados.',
      icon: Building2,
      tone: 'neutral',
      interactive: false,
    },
  ], [filtered.length, resumo, valorExcel]);

  return (
    <EstoqueWorkspace className="bg-background">
      <EstoqueToolbar aria-label="Comandos do estoque retroativo">
        <div className="relative shrink-0">
          <Label htmlFor="data_estoque" className="sr-only">Data do estoque</Label>
          <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 w-[10.5rem] pl-8"
            id="data_estoque"
            onChange={event => setDataEstoque(event.target.value)}
            type="date"
            value={dataEstoque}
          />
        </div>
        <Button className="h-8 shrink-0 gap-2 px-3" disabled={loading || !dataEstoque} onClick={consultar} size="sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? 'Consultando' : 'Consultar'}
        </Button>
        <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />
        <Select disabled={!ultimaData} value={filialFiltro} onValueChange={setFilialFiltro}>
          <SelectTrigger aria-label="Filial" className="h-8 w-44 shrink-0"><SelectValue placeholder="Todas as filiais" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as filiais</SelectItem>
            {filiaisDisponiveis.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative min-w-[13rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar nos resultados"
            className="h-8 pl-8"
            disabled={!ultimaData}
            onChange={event => setBusca(event.target.value)}
            placeholder="Buscar código, descrição ou marca"
            type="search"
            value={busca}
          />
        </div>
        <Select value={valorExcel} onValueChange={value => setValorExcel(value as ValorExcel)}>
          <SelectTrigger aria-label="Base de valor" className="h-8 w-44 shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="venda">Preço de venda</SelectItem><SelectItem value="custo">Custo do fornecedor</SelectItem></SelectContent>
        </Select>
        <Button className="h-8 shrink-0 gap-2 px-3" onClick={gerarExcel} size="sm" variant="outline">
          <FileSpreadsheet className="h-4 w-4" /> Exportar
        </Button>
      </EstoqueToolbar>

      {ultimaData && rows.length > 0 ? <EstoqueMetricStrip metrics={metrics} /> : null}

      <EstoqueDataViewport>
        {!ultimaData ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
            Selecione uma data para consultar a posição do estoque.
          </div>
        ) : rows.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
            Nenhum item encontrado para a data consultada.
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="divide-y md:hidden">
              {filtered.slice(0, 500).map((row, index) => (
                <article key={`${getFilialKey(row)}-${row.cod_produto}-${index}`} className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate text-sm font-semibold">{row.descricao || 'Produto sem descrição'}</p><p className="mt-0.5 text-xs text-muted-foreground">{pad7(row.cod_produto)} · {row.marca || 'Sem marca'}</p></div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{toNumber(row.saldo_estoque).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span className="truncate">{getFilialLabel(row)}</span><span className="whitespace-nowrap font-medium text-foreground tabular-nums">{getValorUnitario(row, valorExcel).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                </article>
              ))}
              </div>
              <div className="hidden min-w-max md:block">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
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
            </div>
            {filtered.length > 500 ? <div className="shrink-0 border-t px-3 py-2 text-center text-xs text-muted-foreground">Exibindo os primeiros 500 registros. Refine os filtros ou exporte para consultar todos.</div> : null}
          </>
        )}
      </EstoqueDataViewport>
    </EstoqueWorkspace>
  );
}
