import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { Download, History, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  parseNumero,
  type AutenticacaoStatus,
  type LinhaPlanilha,
  type LinhaPlanilhaCliente,
  type ResultadoComparacao,
} from '@/utils/autenticacaoComparator';
import { formatCurrency } from '@/utils/formatters';

import { AuthDropzone } from '@/components/autenticacao/AuthDropzone';
import { AuthExecutiveDashboard } from '@/components/autenticacao/AuthExecutiveDashboard';
import { AuthDataGrid } from '@/components/autenticacao/AuthDataGrid';
import { AuthDetailsDrawer } from '@/components/autenticacao/AuthDetailsDrawer';
import { AuthEmptyState } from '@/components/autenticacao/AuthEmptyState';
import { statusLabel } from '@/components/autenticacao/StatusBadge';

function inferirPeriodo(linhas: LinhaPlanilha[]): { inicio: string; fim: string } | null {
  const datas = linhas.map((l) => l.data).filter((d): d is string => !!d);
  if (!datas.length) return null;
  const ts = datas
    .map((d) => {
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? null : dt;
    })
    .filter((d): d is Date => !!d);
  if (!ts.length) return null;
  const min = new Date(Math.min(...ts.map((d) => d.getTime())));
  const max = new Date(Math.max(...ts.map((d) => d.getTime())));
  return { inicio: format(min, 'yyyy-MM-dd'), fim: format(max, 'yyyy-MM-dd') };
}

export default function AutenticacaoPedidosPageExecutive() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { codEmpresaAtiva } = useEmpresaAtiva();

  const [linhasPlanilha, setLinhasPlanilha] = useState<LinhaPlanilha[]>([]);
  const [linhasCliente, setLinhasCliente] = useState<LinhaPlanilhaCliente[]>([]);
  const [modo, setModo] = useState<'pedido' | 'cliente'>('pedido');
  const [arquivoNome, setArquivoNome] = useState<string>('');
  const [arquivoTamanho, setArquivoTamanho] = useState<number>(0);
  const [periodo, setPeriodo] = useState<{ inicio: string; fim: string } | null>(null);
  const [processando, setProcessando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoComparacao[]>([]);
  const [importacaoIdAtual, setImportacaoIdAtual] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<ResultadoComparacao | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);

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
    periodoBusca ? { periodo: periodoBusca } : undefined,
  );
  const { data: historico, refetch: refetchHistorico } = useHistoricoAutenticacao();

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        if (!rows.length) {
          toast({ title: 'Planilha vazia', description: 'Nenhuma linha encontrada.', variant: 'destructive' });
          return;
        }
        const cols = detectarColunas(rows);
        const temModoCliente = !!cols.cliente && (!!cols.valor || !!cols.valor_venda);

        if (!cols.numero && !temModoCliente) {
          toast({
            title: 'Colunas não reconhecidas',
            description: `Esperado "Número do Pedido"/"NF" ou "Cliente"+"Venda".`,
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
          const br = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
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
          const linhas: LinhaPlanilha[] = rows
            .map((r) => ({
              numero_pedido: String(r[cols.numero!] ?? '').trim(),
              cliente: cols.cliente ? String(r[cols.cliente] ?? '').trim() || undefined : undefined,
              valor: cols.valor ? parseNumero(r[cols.valor]) : undefined,
              data: cols.data ? lerData(r[cols.data]) : undefined,
              raw: r,
            }))
            .filter((l) => l.numero_pedido);
          setModo('pedido');
          setLinhasPlanilha(linhas);
          setLinhasCliente([]);
          setPeriodo(inferirPeriodo(linhas));
          totalLinhas = linhas.length;
        } else {
          const linhas: LinhaPlanilhaCliente[] = rows
            .map((r) => {
              const cliente = String(r[cols.cliente!] ?? '').trim();
              const venda = cols.valor_venda ? parseNumero(r[cols.valor_venda]) : undefined;
              const dev = cols.valor_devolucao ? parseNumero(r[cols.valor_devolucao]) : undefined;
              const liquidoCol = cols.valor ? parseNumero(r[cols.valor]) : undefined;
              const liquido = liquidoCol !== undefined ? liquidoCol : (venda ?? 0) - Math.abs(dev ?? 0);
              return {
                cliente,
                valor_venda: venda,
                valor_devolucao: dev !== undefined ? Math.abs(dev) : undefined,
                valor_liquido: liquido,
                data: cols.data ? lerData(r[cols.data]) : undefined,
                raw: r,
              };
            })
            .filter((l) => l.cliente);
          setModo('cliente');
          setLinhasCliente(linhas);
          setLinhasPlanilha([]);
          const datas = linhas.map((l) => l.data).filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d));
          if (datas.length) {
            const ts = datas.map((d) => new Date(d).getTime());
            const min = new Date(Math.min(...ts));
            const max = new Date(Math.max(...ts));
            min.setDate(min.getDate() - 1);
            max.setDate(max.getDate() + 1);
            setPeriodo({ inicio: format(min, 'yyyy-MM-dd'), fim: format(max, 'yyyy-MM-dd') });
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

  function clearFile() {
    setLinhasPlanilha([]);
    setLinhasCliente([]);
    setArquivoNome('');
    setArquivoTamanho(0);
    setPeriodo(null);
    setResultados([]);
    setImportacaoIdAtual(null);
  }

  async function executarAutenticacao() {
    const totalEntrada = modo === 'pedido' ? linhasPlanilha.length : linhasCliente.length;
    if (!user || !codEmpresaAtiva || !totalEntrada) return;
    setProcessando(true);
    const t0 = performance.now();
    try {
      const comp =
        modo === 'pedido'
          ? compararLinhas(linhasPlanilha, pedidos)
          : compararPorCliente(linhasCliente, pedidos, { porData: false });

      const totais = comp.reduce(
        (acc, r) => {
          acc[r.status] = (acc[r.status] ?? 0) + 1;
          return acc;
        },
        {} as Record<AutenticacaoStatus, number>,
      );

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

      const linhasInsert =
        modo === 'pedido'
          ? linhasPlanilha.map((l) => ({
              importacao_id: imp.id,
              numero_pedido: l.numero_pedido,
              cliente: l.cliente ?? null,
              valor_planilha: l.valor ?? null,
              data_pedido: l.data && /^\d{4}-\d{2}-\d{2}$/.test(l.data) ? l.data : null,
            }))
          : linhasCliente.map((l) => ({
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

      const resInsert = comp.map((r) => ({
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
      setDurationMs(Math.round(performance.now() - t0));
      refetchHistorico();
      toast({
        title: 'Autenticação concluída',
        description: `${totais.autenticado ?? 0} OK · ${totais.divergente ?? 0} divergentes · ${totais.nao_encontrado ?? 0} não encontrados.`,
      });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro na autenticação', description: e.message ?? String(e), variant: 'destructive' });
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
      { autenticado: 0, divergente: 0, nao_encontrado: 0, extra_sistema: 0 } as Record<AutenticacaoStatus, number>,
    );
  }, [resultados]);

  const historicoAccuracy = useMemo(() => {
    const last = (historico ?? []).slice(0, 10).reverse();
    return last.map((h) => (h.total_linhas > 0 ? (h.total_autenticados / h.total_linhas) * 100 : 0));
  }, [historico]);

  function exportar(formato: 'xlsx' | 'csv') {
    if (!resultados.length) return;
    const rows = resultados.map((r) => ({
      'Número do Pedido': r.numero_pedido,
      'Cliente (Planilha)': r.cliente_planilha ?? '',
      'Cliente (Sistema)': r.cliente_sistema ?? '',
      'Valor Planilha': r.valor_planilha ?? '',
      'Valor Sistema': r.valor_sistema ?? '',
      Status: statusLabel(r.status),
      Divergências: r.divergencias.join(' · '),
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
      const comp: ResultadoComparacao[] = rows.map((r) => ({
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
      toast({ title: 'Importação carregada', description: `${comp.length} resultados.` });
    } catch (e: any) {
      toast({ title: 'Erro ao carregar', description: e.message ?? String(e), variant: 'destructive' });
    }
  }

  const hasFile = linhasPlanilha.length > 0 || linhasCliente.length > 0;
  const hasResults = resultados.length > 0;
  const hint = hasFile
    ? modo === 'pedido'
      ? `${linhasPlanilha.length} pedidos · período ${periodo?.inicio ?? '?'} → ${periodo?.fim ?? '?'}`
      : `${linhasCliente.length} clientes · período ${periodo?.inicio ?? '?'} → ${periodo?.fim ?? '?'}`
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-10 space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 animate-fade-in">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Auditoria inteligente
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              Autenticação de Pedidos
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Importe uma planilha de pedidos e compare automaticamente com os dados do sistema. Identifique divergências de valor, cliente e pedidos faltantes em segundos.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportar('xlsx')} disabled={!hasResults} className="rounded-xl">
              <Download className="h-4 w-4 mr-2" /> Exportar
            </Button>
            <Button onClick={clearFile} disabled={!hasFile && !hasResults} className="rounded-xl">
              <Sparkles className="h-4 w-4 mr-2" /> Nova autenticação
            </Button>
          </div>
        </header>

        <Tabs defaultValue="nova" className="space-y-6">
          <TabsList className="rounded-xl">
            <TabsTrigger value="nova" className="rounded-lg">Nova autenticação</TabsTrigger>
            <TabsTrigger value="historico" className="rounded-lg">
              <History className="h-4 w-4 mr-1.5" /> Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="nova" className="space-y-6">
            <AuthDropzone
              fileName={arquivoNome}
              fileSize={arquivoTamanho}
              hasData={hasFile}
              loading={processando || (loadingSistema && hasFile)}
              onFile={handleFile}
              onClear={clearFile}
              onRun={executarAutenticacao}
              canRun={hasFile}
              hint={hint}
            />

            {hasResults ? (
              <>
                <AuthExecutiveDashboard
                  resultados={resultados}
                  durationMs={durationMs}
                  historicoAccuracy={historicoAccuracy}
                />
                <AuthDataGrid data={resultados} onRowClick={setDetalhe} />
              </>
            ) : (
              !hasFile && <AuthEmptyState />
            )}

            {loadingSistema && hasFile && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando pedidos do sistema...
              </div>
            )}
          </TabsContent>

          <TabsContent value="historico">
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border/60">
                <h2 className="text-base font-semibold text-foreground">Importações anteriores</h2>
                <p className="text-xs text-muted-foreground">Clique em uma importação para reabri-la.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Data</th>
                      <th className="px-4 py-3 text-left font-semibold">Arquivo</th>
                      <th className="px-4 py-3 text-left font-semibold">Período</th>
                      <th className="px-4 py-3 text-right font-semibold">Linhas</th>
                      <th className="px-4 py-3 text-right font-semibold">OK</th>
                      <th className="px-4 py-3 text-right font-semibold">Diverg.</th>
                      <th className="px-4 py-3 text-right font-semibold">Não enc.</th>
                      <th className="px-4 py-3 text-right font-semibold">Extras</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {(historico ?? []).map((h) => (
                      <tr
                        key={h.id}
                        className={`hover:bg-muted/40 transition-colors ${importacaoIdAtual === h.id ? 'bg-primary/5' : ''}`}
                      >
                        <td className="px-4 py-3 text-xs">{format(new Date(h.created_at), 'dd/MM/yyyy HH:mm')}</td>
                        <td className="px-4 py-3 text-xs font-medium">{h.arquivo_nome}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {h.data_ini && h.data_fim ? `${h.data_ini} → ${h.data_fim}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-xs tabular-nums">{h.total_linhas}</td>
                        <td className="px-4 py-3 text-right text-xs tabular-nums text-success font-semibold">{h.total_autenticados}</td>
                        <td className="px-4 py-3 text-right text-xs tabular-nums text-warning font-semibold">{h.total_divergentes}</td>
                        <td className="px-4 py-3 text-right text-xs tabular-nums text-destructive font-semibold">{h.total_nao_encontrados}</td>
                        <td className="px-4 py-3 text-right text-xs tabular-nums text-muted-foreground">{h.total_extras}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="ghost" onClick={() => abrirImportacaoHistorico(h.id)}>
                            Abrir
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!historico?.length && (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                          Nenhuma autenticação registrada ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AuthDetailsDrawer open={!!detalhe} onOpenChange={(v) => !v && setDetalhe(null)} data={detalhe} />
    </div>
  );
}

// silence unused import in some builds
void formatCurrency;
