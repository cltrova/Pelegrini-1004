import { useMemo, useState } from 'react';
import { Loader2, Search, FileSpreadsheet, CalendarDays } from 'lucide-react';
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

  const getValorUnitario = (r: EstoqueItem): number => {
    const campo = valorExcel === 'custo' ? r.valor_unitario : r.preco_venda_unitario;
    return toNumber(campo);
  };

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
        Number(getValorUnitario(r).toFixed(2)),
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

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Estoque Retroativo</h1>
        <p className="text-sm text-muted-foreground">
          Consulta de saldo de estoque em uma data específica.
          {codEmpresaBi && (
            <span className="ml-1">Empresa ativa: <strong>{codEmpresaBi}</strong></span>
          )}
        </p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="data_estoque" className="text-xs">
              Data do estoque *
            </Label>
            <div className="relative">
              <CalendarDays className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="data_estoque"
                type="date"
                value={dataEstoque}
                onChange={(e) => setDataEstoque(e.target.value)}
                className="pl-8 w-[180px]"
              />
            </div>
          </div>
          <Button onClick={consultar} disabled={loading || !dataEstoque}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Consultando...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Consultar estoque
              </>
            )}
          </Button>
        </div>
      </Card>

      {rows.length > 0 && (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Filial</Label>
                <Select value={filialFiltro} onValueChange={setFilialFiltro}>
                  <SelectTrigger className="w-[240px]">
                    <SelectValue placeholder="Todas as filiais" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as filiais</SelectItem>
                    {filiaisDisponiveis.map((e) => (
                      <SelectItem key={e.value} value={e.value}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[240px]">
              <Label className="text-xs">Buscar</Label>
              <Input
                placeholder="Código, descrição, nº original, fabricante ou marca"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Valor do Excel *</Label>
              <Select value={valorExcel} onValueChange={(v) => setValorExcel(v as ValorExcel)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="venda">Preço de venda</SelectItem>
                  <SelectItem value="custo">Custo do fornecedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={gerarExcel} variant="default">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Gerar Excel
            </Button>
          </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {filtered.length} de {rows.length} itens
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="max-h-[65vh] overflow-auto">
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
                    <TableRow key={i}>
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
                      <TableCell className="text-right tabular-nums">
                        {toNumber(r.valor_unitario).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-xs">{getFilialLabel(r)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filtered.length > 500 && (
                <div className="p-3 text-xs text-muted-foreground text-center border-t">
                  Exibindo os primeiros 500 registros. Use os filtros ou exporte para Excel para ver todos.
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
