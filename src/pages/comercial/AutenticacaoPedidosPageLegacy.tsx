import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { Upload, FileCheck2, FileX2, AlertTriangle, FileQuestion, Download, History, Loader2, FileSpreadsheet, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useComercialData } from '@/hooks/useComercialData';
import { supabase } from '@/integrations/supabase/client';
import { useHistoricoAutenticacao, carregarResultados } from '@/hooks/useAutenticacaoPedidos';
import {
  compararLinhas,
  compararPorCliente,
  detectarColunas,
  normalizarNumeroPedido,
  parseNumero,
  type AutenticacaoStatus,
  type LinhaPlanilha,
  type LinhaPlanilhaCliente,
  type ResultadoComparacao,
} from '@/utils/autenticacaoComparator';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';

function inferirPeriodo(linhas: LinhaPlanilha[]): { inicio: string; fim: string } | null {
  const datas = linhas.map(l => l.data).filter((d): d is string => !!d);
  if (!datas.length) return null;
  const ts = datas
    .map(d => {
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? null : dt;
    })
    .filter((d): d is Date => !!d);
  if (!ts.length) return null;
  const min = new Date(Math.min(...ts.map(d => d.getTime())));
  const max = new Date(Math.max(...ts.map(d => d.getTime())));
  return { inicio: format(min, 'yyyy-MM-dd'), fim: format(max, 'yyyy-MM-dd') };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const STATUS_META: Record<AutenticacaoStatus, { label: string; cls: string; icon: typeof FileCheck2 }> = {
  autenticado: { label: 'Autenticado', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30', icon: FileCheck2 },
  divergente: { label: 'Divergente', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30', icon: AlertTriangle },
  nao_encontrado: { label: 'Não encontrado', cls: 'bg-red-500/15 text-red-500 border-red-500/30', icon: FileX2 },
  extra_sistema: { label: 'Extra no sistema', cls: 'bg-muted text-muted-foreground border-border', icon: FileQuestion },
};

export default function AutenticacaoPedidosPageLegacy() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const inputRef = useRef<HTMLInputElement>(null);

  const [linhasPlanilha, setLinhasPlanilha] = useState<LinhaPlanilha[]>([]);
  const [linhasCliente, setLinhasCliente] = useState<LinhaPlanilhaCliente[]>([]);
  const [modo, setModo] = useState<'pedido' | 'cliente'>('pedido');
  const [arquivoNome, setArquivoNome] = useState<string>('');
  const [arquivoTamanho, setArquivoTamanho] = useState<number>(0);
  const [periodo, setPeriodo] = useState<{ inicio: string; fim: string } | null>(null);
  const [processando, setProcessando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoComparacao[]>([]);
  const [statusFiltro, setStatusFiltro] = useState<AutenticacaoStatus | 'todos'>('todos');
  const [busca, setBusca] = useState('');
  const [dataIni, setDataIni] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [agruparPor, setAgruparPor] = useState<'nenhum' | 'cliente' | 'pedido' | 'data'>('nenhum');
  const [importacaoIdAtual, setImportacaoIdAtual] = useState<string | null>(null);

  // dados do sistema para o período da planilha
  // Ampliamos a janela enviada ao endpoint (que filtra por data_faturamento)
  // para capturar pedidos emitidos no período da planilha mas faturados
  // semanas depois. O filtro client-side continua usando data_pedido.
  const periodoBusca = useMemo(() => {
    if (!periodo) return null;
    const ini = new Date(periodo.inicio);
    const fim = new Date(periodo.fim);
    if (isNaN(ini.getTime()) || isNaN(fim.getTime())) return null;
    ini.setDate(ini.getDate() - 7);
    fim.setDate(fim.getDate() + 90);
    return { inicio: format(ini, 'yyyy-MM-dd'), fim: format(fim, 'yyyy-MM-dd') };
  }, [periodo]);
  const { pedidos, isLoading: loadingSistema } = useComercialData(
    periodoBusca ? { periodo: periodoBusca } : undefined
  );

  const { data: historico, refetch: refetchHistorico } = useHistoricoAutenticacao();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        if (!rows.length) {
          toast({ title: 'Planilha vazia', description: 'Nenhuma linha encontrada na primeira aba.', variant: 'destructive' });
          return;
        }
        const cols = detectarColunas(rows);

        // Modo "pedido" requer coluna de número; senão tentamos modo "cliente"
        // (relatório agregado por cliente: VENDA, DEVOLUÇÃO, VENDA DESCONTANDO DEVOLUÇÃO)
        const temModoCliente = !!cols.cliente && (!!cols.valor || !!cols.valor_venda);

        if (!cols.numero && !temModoCliente) {
          const colunasDisponiveis = Object.keys(rows[0]).join(', ');
          toast({
            title: 'Colunas não reconhecidas',
            description: `Esperado "Número do Pedido"/"NF" ou "Cliente"+"Venda". Colunas encontradas: ${colunasDisponiveis}`,
            variant: 'destructive',
          });
          return;
        }

        const lerData = (raw: unknown): string | undefined => {
          if (raw instanceof Date) return format(raw, 'yyyy-MM-dd');
          if (typeof raw === 'number' && Number.isFinite(raw)) {
            const dt = XLSX.SSF.parse_date_code(raw);
            if (dt) return format(new Date(dt.y, dt.m - 1, dt.d), 'yyyy-MM-dd');
          }
          if (!raw) return undefined;
          const s = String(raw).trim();
          const br = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
          if (br) {
            const [, dd, mm, yyyy] = br;
            const ano = yyyy.length === 2 ? `20${yyyy}` : yyyy;
            return `${ano}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
          }
          const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
          if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
          const dt = new Date(s);
          if (!isNaN(dt.getTime())) return format(dt, 'yyyy-MM-dd');
          return s;
        };

        let totalLinhas = 0;

        if (cols.numero) {
          const linhas: LinhaPlanilha[] = rows.map(r => ({
            numero_pedido: String(r[cols.numero!] ?? '').trim(),
            cliente: cols.cliente ? String(r[cols.cliente] ?? '').trim() || undefined : undefined,
            valor: cols.valor ? parseNumero(r[cols.valor]) : undefined,
            data: cols.data ? lerData(r[cols.data]) : undefined,
            raw: r,
          })).filter(l => l.numero_pedido);
          setModo('pedido');
          setLinhasPlanilha(linhas);
          setLinhasCliente([]);
          setPeriodo(inferirPeriodo(linhas));
          totalLinhas = linhas.length;
        } else {
          const linhas: LinhaPlanilhaCliente[] = rows.map(r => {
            const cliente = String(r[cols.cliente!] ?? '').trim();
            const venda = cols.valor_venda ? parseNumero(r[cols.valor_venda]) : undefined;
            const dev = cols.valor_devolucao ? parseNumero(r[cols.valor_devolucao]) : undefined;
            const liquidoCol = cols.valor ? parseNumero(r[cols.valor]) : undefined;
            const liquido =
              liquidoCol !== undefined
                ? liquidoCol
                : (venda ?? 0) - Math.abs(dev ?? 0);
            return {
              cliente,
              valor_venda: venda,
              valor_devolucao: dev !== undefined ? Math.abs(dev) : undefined,
              valor_liquido: liquido,
              data: cols.data ? lerData(r[cols.data]) : undefined,
              raw: r,
            };
          }).filter(l => l.cliente);
          setModo('cliente');
          setLinhasCliente(linhas);
          setLinhasPlanilha([]);
          // período por datas dessas linhas
          const datas = linhas.map(l => l.data).filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d));
          if (datas.length) {
            const ts = datas.map(d => new Date(d).getTime());
            const min = new Date(Math.min(...ts));
            const max = new Date(Math.max(...ts));
            min.setDate(min.getDate() - 1);
            max.setDate(max.getDate() + 1);
            setPeriodo({
              inicio: format(min, 'yyyy-MM-dd'),
              fim: format(max, 'yyyy-MM-dd'),
            });
          } else {
            setPeriodo(null);
          }
          totalLinhas = linhas.length;
        }

        setArquivoNome(file.name);
        setArquivoTamanho(file.size);
        setResultados([]);
        setImportacaoIdAtual(null);
        toast({
          title: 'Planilha carregada',
          description: `${totalLinhas} ${cols.numero ? 'pedidos' : 'clientes'} detectados.`,
        });
      } catch (err) {
        console.error(err);
        toast({ title: 'Erro ao ler planilha', description: String(err), variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function executarAutenticacao() {
    const totalEntrada = modo === 'pedido' ? linhasPlanilha.length : linhasCliente.length;
    if (!user || !codEmpresaAtiva || !totalEntrada) return;
    setProcessando(true);
    try {
      const comp =
        modo === 'pedido'
          ? compararLinhas(linhasPlanilha, pedidos)
          : compararPorCliente(linhasCliente, pedidos, {
              porData: false,
            });

      const totais = comp.reduce(
        (acc, r) => {
          acc[r.status] = (acc[r.status] ?? 0) + 1;
          return acc;
        },
        {} as Record<AutenticacaoStatus, number>
      );

      // 1) cria importação
      const { data: imp, error: impErr } = await supabase
        .from('autenticacao_importacoes')
        .insert({
          cod_empresa_bi: codEmpresaAtiva,
          cod_filial: null,
          usuario_id: user.id,
          arquivo_nome: arquivoNome,
          arquivo_tamanho: arquivoTamanho,
          data_ini: periodo?.inicio ?? null,
          data_fim: periodo?.fim ?? null,
          total_linhas: totalEntrada,
          total_autenticados: totais.autenticado ?? 0,
          total_divergentes: totais.divergente ?? 0,
          total_nao_encontrados: totais.nao_encontrado ?? 0,
          total_extras: totais.extra_sistema ?? 0,
          status: 'concluida',
        })
        .select()
        .single();
      if (impErr) throw impErr;

      // 2) salva linhas (em chunks de 500)
      const linhasInsert =
        modo === 'pedido'
          ? linhasPlanilha.map(l => ({
              importacao_id: imp.id,
              numero_pedido: l.numero_pedido,
              cliente: l.cliente ?? null,
              valor_planilha: l.valor ?? null,
              data_pedido: l.data && /^\d{4}-\d{2}-\d{2}$/.test(l.data) ? l.data : null,
            }))
          : linhasCliente.map(l => ({
              importacao_id: imp.id,
              numero_pedido: l.cliente,
              cliente: l.cliente,
              valor_planilha: l.valor_liquido,
              data_pedido: l.data && /^\d{4}-\d{2}-\d{2}$/.test(l.data) ? l.data : null,
            }));
      for (let i = 0; i < linhasInsert.length; i += 500) {
        const { error } = await supabase.from('autenticacao_linhas').insert(linhasInsert.slice(i, i + 500));
        if (error) throw error;
      }

      // 3) salva resultados
      const resInsert = comp.map(r => ({
        importacao_id: imp.id,
        numero_pedido: r.numero_pedido,
        cliente_planilha: r.cliente_planilha ?? null,
        cliente_sistema: r.cliente_sistema ?? null,
        valor_planilha: r.valor_planilha ?? null,
        valor_sistema: r.valor_sistema ?? null,
        status: r.status,
        divergencias: r.divergencias,
      }));
      for (let i = 0; i < resInsert.length; i += 500) {
        const { error } = await supabase.from('autenticacao_resultados').insert(resInsert.slice(i, i + 500));
        if (error) throw error;
      }

      setResultados(comp);
      setImportacaoIdAtual(imp.id);
      refetchHistorico();
      toast({
        title: 'Autenticação concluída',
        description: `${totais.autenticado ?? 0} OK · ${totais.divergente ?? 0} divergentes · ${totais.nao_encontrado ?? 0} não encontrados · ${totais.extra_sistema ?? 0} extras.`,
      });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro na autenticação', description: getErrorMessage(e), variant: 'destructive' });
    } finally {
      setProcessando(false);
    }
  }

  const totais = useMemo(() => {
    return resultados.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      },
      { autenticado: 0, divergente: 0, nao_encontrado: 0, extra_sistema: 0 } as Record<AutenticacaoStatus, number>
    );
  }, [resultados]);

  // Em modo cliente, quando há filtro de data, recomputamos com pedidos/linhas
  // restritos ao intervalo — caso contrário valor_sistema continuaria sendo o
  // total do período inteiro auditado.
  const resultadosBase = useMemo(() => {
    if (!resultados.length) return resultados;
    const temFiltroData = !!(dataIni || dataFim);
    if (!temFiltroData) return resultados;

    // Normaliza qualquer formato (yyyy-mm-dd, dd/mm/yyyy, ISO com hora) para yyyy-mm-dd
    const normData = (raw?: string): string | undefined => {
      if (!raw) return undefined;
      const s = String(raw).trim();
      const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
      const br = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
      if (br) {
        const [, dd, mm, yyyy] = br;
        const ano = yyyy.length === 2 ? `20${yyyy}` : yyyy;
        return `${ano}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
      }
      return undefined;
    };
    const dentro = (d?: string) => {
      const nd = normData(d);
      if (!nd) return false;
      if (dataIni && nd < dataIni) return false;
      if (dataFim && nd > dataFim) return false;
      return true;
    };
    const dataPedido = (p: typeof pedidos[number]) =>
      normData(p.data_pedido) ?? normData(p.data_faturamento);

    if (modo === 'cliente' && linhasCliente.length && pedidos.length) {
      const linhasFiltradas = linhasCliente.filter(l => dentro(l.data));
      const pedidosFiltrados = pedidos.filter(p => {
        const d = dataPedido(p);
        return d ? dentro(d) : false;
      });
      console.log('[Auditoria] filtro data', { dataIni, dataFim, linhasFiltradas: linhasFiltradas.length, pedidosFiltrados: pedidosFiltrados.length, totalPedidos: pedidos.length, amostraDatas: pedidos.slice(0, 5).map(p => ({ pedido: p.data_pedido, fat: p.data_faturamento })) });
      return compararPorCliente(linhasFiltradas, pedidosFiltrados, { porData: false });
    }
    if (modo === 'pedido' && linhasPlanilha.length && pedidos.length) {
      const linhasFiltradas = linhasPlanilha.filter(l => dentro(l.data));
      const pedidosFiltrados = pedidos.filter(p => {
        const d = dataPedido(p);
        return d ? dentro(d) : false;
      });
      console.log('[Auditoria] filtro data', { dataIni, dataFim, linhasFiltradas: linhasFiltradas.length, pedidosFiltrados: pedidosFiltrados.length, totalPedidos: pedidos.length });
      return compararLinhas(linhasFiltradas, pedidosFiltrados);
    }
    return resultados;
  }, [resultados, modo, dataIni, dataFim, linhasCliente, linhasPlanilha, pedidos]);

  const resultadosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return resultadosBase.filter(r => {
      if (statusFiltro !== 'todos' && r.status !== statusFiltro) return false;
      if (q) {
        const blob = `${r.numero_pedido} ${r.cliente_planilha ?? ''} ${r.cliente_sistema ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [resultadosBase, statusFiltro, busca]);

  const grupos = useMemo(() => {
    if (agruparPor === 'nenhum') return null;
    const map = new Map<string, ResultadoComparacao[]>();
    for (const r of resultadosFiltrados) {
      let chave = '';
      if (agruparPor === 'cliente') chave = r.cliente_planilha || r.cliente_sistema || '— sem cliente —';
      else if (agruparPor === 'pedido') chave = r.numero_pedido || '— sem pedido —';
      else if (agruparPor === 'data') chave = r.data || '— sem data —';
      const arr = map.get(chave) ?? [];
      arr.push(r);
      map.set(chave, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [resultadosFiltrados, agruparPor]);

  function exportar(formato: 'xlsx' | 'csv') {
    if (!resultados.length) return;
    const rows = resultados.map(r => ({
      'Número do Pedido': r.numero_pedido,
      'Cliente (Planilha)': r.cliente_planilha ?? '',
      'Cliente (Sistema)': r.cliente_sistema ?? '',
      'Valor Planilha': r.valor_planilha ?? '',
      'Valor Sistema': r.valor_sistema ?? '',
      'Status': STATUS_META[r.status].label,
      'Divergências': r.divergencias.join(' · '),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Autenticação');
    const fileBase = `autenticacao-pedidos-${format(new Date(), 'yyyyMMdd-HHmm')}`;
    if (formato === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileBase}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      XLSX.writeFile(wb, `${fileBase}.xlsx`);
    }
  }

  async function abrirImportacaoHistorico(id: string) {
    try {
      const rows = await carregarResultados(id);
      const comp: ResultadoComparacao[] = rows.map(r => ({
        numero_pedido: r.numero_pedido,
        cliente_planilha: r.cliente_planilha ?? undefined,
        cliente_sistema: r.cliente_sistema ?? undefined,
        valor_planilha: r.valor_planilha ?? undefined,
        valor_sistema: r.valor_sistema ?? undefined,
        status: r.status as AutenticacaoStatus,
        divergencias: r.divergencias ?? [],
      }));
      setResultados(comp);
      setImportacaoIdAtual(id);
      setStatusFiltro('todos');
      setBusca('');
      toast({ title: 'Importação carregada', description: `${comp.length} resultados.` });
    } catch (e) {
      toast({ title: 'Erro ao carregar', description: getErrorMessage(e), variant: 'destructive' });
    }
  }

  const renderLinha = (r: ResultadoComparacao, key: string) => {
    const meta = STATUS_META[r.status];
    const Icon = meta.icon;
    return (
      <TableRow
        key={key}
        className={cn(
          r.status === 'divergente' && 'bg-amber-500/5',
          r.status === 'nao_encontrado' && 'border-l-2 border-l-red-500',
          r.status === 'extra_sistema' && 'opacity-80'
        )}
      >
        <TableCell className="font-mono text-xs">{r.numero_pedido}</TableCell>
        <TableCell className="text-sm">{r.cliente_planilha || r.cliente_sistema || '—'}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{r.data || '—'}</TableCell>
        <TableCell className="text-right text-sm tabular-nums">
          {r.valor_planilha !== undefined ? formatCurrency(r.valor_planilha) : '—'}
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums">
          {r.valor_sistema !== undefined ? formatCurrency(r.valor_sistema) : '—'}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={cn('gap-1', meta.cls)}>
            <Icon className="h-3 w-3" />
            {meta.label}
          </Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground max-w-[420px]">
          {r.divergencias.join(' · ') || '—'}
        </TableCell>
      </TableRow>
    );
  };


  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auditoria de Pedidos</h1>
          <p className="text-sm text-muted-foreground">
            Compare uma planilha de pedidos com os dados do sistema para conferir divergências.
          </p>
        </div>
      </div>

      <Tabs defaultValue="novo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="novo"><Upload className="h-4 w-4 mr-2" />Nova auditoria</TabsTrigger>
          <TabsTrigger value="historico"><History className="h-4 w-4 mr-2" />Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="novo" className="space-y-4">
          {/* Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" /> 1. Importar planilha (.xlsx)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => inputRef.current?.click()} variant="outline">
                  <Upload className="h-4 w-4 mr-2" /> Selecionar arquivo
                </Button>
                {arquivoNome && (
                  <span className="text-sm text-muted-foreground">
                    {arquivoNome} · {modo === 'pedido' ? linhasPlanilha.length : linhasCliente.length}{' '}
                    {modo === 'pedido' ? 'pedidos' : 'clientes'}
                    {periodo && ` · período ${periodo.inicio} → ${periodo.fim}`}
                  </span>
                )}
              </div>
              {(linhasPlanilha.length > 0 || linhasCliente.length > 0) && (
                <div className="text-xs text-muted-foreground">
                  {modo === 'pedido'
                    ? <>Modo <strong>por pedido</strong> — comparando número, cliente e valor.</>
                    : <>Modo <strong>por cliente</strong> — comparando totais (venda, devolução e líquido) por cliente{linhasCliente.some(l => l.data) ? ' e data' : ''}.</>}
                </div>
              )}
              <div className="pt-2">
                <Button
                  onClick={executarAutenticacao}
                  disabled={(!linhasPlanilha.length && !linhasCliente.length) || processando || loadingSistema}
                >
                  {(processando || loadingSistema) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Auditar
                </Button>
                {loadingSistema && (linhasPlanilha.length > 0 || linhasCliente.length > 0) && (
                  <span className="ml-3 text-xs text-muted-foreground">Carregando pedidos do sistema…</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* KPIs e resultados */}
          {resultados.length > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard label="Total" value={resultados.length} />
                <KpiCard label="Autenticados" value={totais.autenticado} cls="text-emerald-500" />
                <KpiCard label="Divergentes" value={totais.divergente} cls="text-amber-500" />
                <KpiCard label="Não encontrados" value={totais.nao_encontrado} cls="text-red-500" />
                <KpiCard label="Extras no sistema" value={totais.extra_sistema} cls="text-muted-foreground" />
              </div>

              <Card>
                <CardHeader className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
                  <CardTitle className="text-base">Resultados</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar pedido/cliente"
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                        className="pl-8 w-56 h-9"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">De</span>
                      <Input
                        type="date"
                        value={dataIni}
                        onChange={e => setDataIni(e.target.value)}
                        className="h-9 w-[140px]"
                      />
                      <span className="text-xs text-muted-foreground">até</span>
                      <Input
                        type="date"
                        value={dataFim}
                        onChange={e => setDataFim(e.target.value)}
                        className="h-9 w-[140px]"
                      />
                      {(dataIni || dataFim) && (
                        <Button size="sm" variant="ghost" onClick={() => { setDataIni(''); setDataFim(''); }}>
                          Limpar
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Agrupar:</span>
                      {(['nenhum', 'cliente', 'pedido', 'data'] as const).map(g => (
                        <Button
                          key={g}
                          size="sm"
                          variant={agruparPor === g ? 'default' : 'outline'}
                          onClick={() => setAgruparPor(g)}
                        >
                          {g === 'nenhum' ? 'Nenhum' : g.charAt(0).toUpperCase() + g.slice(1)}
                        </Button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(['todos', 'autenticado', 'divergente', 'nao_encontrado', 'extra_sistema'] as const).map(s => (
                        <Button
                          key={s}
                          size="sm"
                          variant={statusFiltro === s ? 'default' : 'outline'}
                          onClick={() => setStatusFiltro(s)}
                        >
                          {s === 'todos' ? 'Todos' : STATUS_META[s].label}
                        </Button>
                      ))}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => exportar('xlsx')}>
                      <Download className="h-4 w-4 mr-2" /> Excel
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => exportar('csv')}>
                      <Download className="h-4 w-4 mr-2" /> CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor Planilha</TableHead>
                        <TableHead className="text-right">Valor Sistema</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Divergência</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grupos
                        ? grupos.flatMap(([chave, itens]) => {
                            const totPlan = itens.reduce((a, x) => a + (x.valor_planilha ?? 0), 0);
                            const totSis = itens.reduce((a, x) => a + (x.valor_sistema ?? 0), 0);
                            return [
                              <TableRow key={`g-${chave}`} className="bg-muted/40">
                                <TableCell colSpan={3} className="font-semibold text-sm">
                                  {chave} <span className="text-xs text-muted-foreground">({itens.length})</span>
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums font-semibold">
                                  {formatCurrency(totPlan)}
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums font-semibold">
                                  {formatCurrency(totSis)}
                                </TableCell>
                                <TableCell colSpan={2} />
                              </TableRow>,
                              ...itens.slice(0, 1000).map((r, i) => renderLinha(r, `${chave}-${i}`)),
                            ];
                          })
                        : resultadosFiltrados.slice(0, 1000).map((r, i) => renderLinha(r, `${r.numero_pedido}-${i}`))}
                    </TableBody>
                  </Table>
                  {!grupos && resultadosFiltrados.length > 1000 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Mostrando 1000 de {resultadosFiltrados.length} resultados. Use os filtros para refinar ou exporte.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Importações anteriores</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Linhas</TableHead>
                    <TableHead className="text-right">OK</TableHead>
                    <TableHead className="text-right">Diverg.</TableHead>
                    <TableHead className="text-right">Não enc.</TableHead>
                    <TableHead className="text-right">Extras</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(historico ?? []).map(h => (
                    <TableRow key={h.id} className={importacaoIdAtual === h.id ? 'bg-primary/5' : ''}>
                      <TableCell className="text-xs">{format(new Date(h.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell className="text-xs">{h.arquivo_nome}</TableCell>
                      <TableCell className="text-xs">
                        {h.data_ini && h.data_fim ? `${h.data_ini} → ${h.data_fim}` : '—'}
                      </TableCell>
                      <TableCell className="text-right text-xs">{h.total_linhas}</TableCell>
                      <TableCell className="text-right text-xs text-emerald-500">{h.total_autenticados}</TableCell>
                      <TableCell className="text-right text-xs text-amber-500">{h.total_divergentes}</TableCell>
                      <TableCell className="text-right text-xs text-red-500">{h.total_nao_encontrados}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{h.total_extras}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => abrirImportacaoHistorico(h.id)}>
                          Abrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!historico?.length && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                        Nenhuma autenticação registrada ainda.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ label, value, cls }: { label: string; value: number; cls?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn('text-2xl font-bold tabular-nums', cls)}>{value}</div>
      </CardContent>
    </Card>
  );
}
