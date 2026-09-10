import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertCircle, LoaderCircle, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import { useComissaoVendedores, type ComissaoFiltros } from '@/hooks/useComissaoVendedores';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { ComissaoVendedorFilter } from '@/components/comercial/ComissaoVendedorFilter';
import {
  ComercialCommandBar,
  ComercialCompactPage,
  ComercialDataViewport,
  ComercialFilterBar,
  ComercialMetricStrip,
} from '@/components/comercial/compact';
import { cn } from '@/lib/utils';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function ComissaoPage() {
  const { filialAtiva } = useFilialSelecionada();
  const hoje = useMemo(() => new Date(), []);

  const [ano, setAno] = useState<number>(hoje.getFullYear());
  const [mes, setMes] = useState<number>(hoje.getMonth() + 1);
  const [codMeta, setCodMeta] = useState('');
  const [deduzirDevolucao, setDeduzirDevolucao] = useState(true);
  const [calculaSt, setCalculaSt] = useState(false);
  const [exibirMargem, setExibirMargem] = useState(true);
  const [vendedoresSel, setVendedoresSel] = useState<string[]>([]);
  const [operacaoFiscalInicial, setOperacaoFiscalInicial] = useState('0');
  const [operacaoFiscalFinal, setOperacaoFiscalFinal] = useState('62');

  const [aplicado, setAplicado] = useState<ComissaoFiltros | null>(null);

  const anos = useMemo(() => {
    const atual = hoje.getFullYear();
    return Array.from({ length: 6 }, (_, i) => atual - i);
  }, [hoje]);

  const buscar = () => {
    const ultimoDia = new Date(ano, mes, 0).getDate();
    setAplicado({
      data_ini: `${ano}-${pad(mes)}-01`,
      data_fim: `${ano}-${pad(mes)}-${pad(ultimoDia)}`,
      cod_meta: codMeta || undefined,
      deduzir_devolucao: deduzirDevolucao,
      calcula_st: calculaSt,
      exibir_valores_margem: exibirMargem,
      operacao_fiscal_inicial: operacaoFiscalInicial || undefined,
      operacao_fiscal_final: operacaoFiscalFinal || undefined,
    });
  };

  const { data, isLoading, isFetching, error, refetch } = useComissaoVendedores(aplicado);
  const todasLinhas = useMemo(() => data ?? [], [data]);

  const opcoesVendedores = useMemo(() => {
    const map = new Map<string, string>();
    todasLinhas.forEach((l) => {
      const code = String(l.vendedor || '').trim();
      if (code) map.set(code, l.nome || code);
    });
    return Array.from(map, ([codigo, nome]) => ({ codigo, nome })).sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR'),
    );
  }, [todasLinhas]);

  const linhas = useMemo(
    () =>
      vendedoresSel.length === 0
        ? todasLinhas
        : todasLinhas.filter((l) => vendedoresSel.includes(String(l.vendedor).trim())),
    [todasLinhas, vendedoresSel],
  );

  const totais = useMemo(() => {
    return linhas.reduce(
      (acc, l) => ({
        objetivoMensal: acc.objetivoMensal + l.objetivoMensal,
        objetivoDiario: acc.objetivoDiario + l.objetivoDiario,
        objetivoAteHoje: acc.objetivoAteHoje + l.objetivoAteHoje,
        faturadoAteHoje: acc.faturadoAteHoje + l.faturadoAteHoje,
        aFaturar: acc.aFaturar + l.aFaturar,
        valorTotal: acc.valorTotal + l.valorTotal,
        pedidosAberto: acc.pedidosAberto === null || l.pedidosAberto === null
          ? null
          : acc.pedidosAberto + l.pedidosAberto,
        devolucao: acc.devolucao + l.devolucao,
        st: acc.st + l.st,
      }),
      { objetivoMensal: 0, objetivoDiario: 0, objetivoAteHoje: 0, faturadoAteHoje: 0, aFaturar: 0, valorTotal: 0, pedidosAberto: 0 as number | null, devolucao: 0, st: 0 },
    );
  }, [linhas]);

  const metricas = aplicado
    ? [
      {
        label: 'Objetivo mensal',
        value: formatCurrency(totais.objetivoMensal),
        tooltip: 'Soma das metas mensais dos vendedores exibidos.',
      },
      {
        label: 'Faturado até hoje',
        value: formatCurrency(totais.faturadoAteHoje),
        tooltip: 'Faturamento acumulado no período consultado.',
      },
      {
        label: 'Valor total',
        value: formatCurrency(totais.valorTotal),
        tooltip: 'Soma das vendas diretas e indiretas retornadas pela consulta.',
      },
      {
        label: 'Pedidos em aberto',
        value: totais.pedidosAberto === null ? 'Indisponível' : formatCurrency(totais.pedidosAberto),
        tooltip: 'Valor dos pedidos ainda não faturados no período.',
      },
    ]
    : [];

  const filtrosAvancadosAtivos = [
    codMeta && {
      label: `Meta: ${codMeta}`,
      onRemove: () => setCodMeta(''),
    },
    (operacaoFiscalInicial !== '0' || operacaoFiscalFinal !== '62') && {
      label: `Operação fiscal: ${operacaoFiscalInicial || '—'} a ${operacaoFiscalFinal || '—'}`,
      onRemove: () => {
        setOperacaoFiscalInicial('0');
        setOperacaoFiscalFinal('62');
      },
    },
    !deduzirDevolucao && {
      label: 'Sem deduzir devolução',
      onRemove: () => setDeduzirDevolucao(true),
    },
    calculaSt && {
      label: 'Calcular ST',
      onRemove: () => setCalculaSt(false),
    },
    !exibirMargem && {
      label: 'Margem oculta',
      onRemove: () => setExibirMargem(true),
    },
  ].filter(Boolean) as Array<{ label: string; onRemove: () => void }>;

  const th = 'py-2.5 px-3 text-right font-semibold whitespace-nowrap';
  const td = 'py-2.5 px-3 text-right tabular-nums whitespace-nowrap border-l border-border/40';

  return (
    <ComercialCompactPage className="comissao-page">
      <ComercialCommandBar
        title="Comissão"
        context={filialAtiva === 'chevrolet' ? 'Base CH' : 'Base CT'}
      />

      <ComercialFilterBar
        ariaLabel="Filtros de comissão"
        primary={(
          <>
            <div className="w-24">
              <Label className="sr-only" htmlFor="comissao-ano">Ano</Label>
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger id="comissao-ano" aria-label="Ano" className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Label className="sr-only" htmlFor="comissao-mes">Mês</Label>
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger id="comissao-mes" aria-label="Mês" className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div data-testid="comissao-vendedor-compact" className="min-w-52 flex-1 [&>div>button]:h-9">
              <Label className="sr-only">Vendedor</Label>
              <ComissaoVendedorFilter
                vendedores={opcoesVendedores}
                selecionados={vendedoresSel}
                onChange={setVendedoresSel}
              />
            </div>
          </>
        )}
        actions={(
          <Button className="min-w-28 gap-2" onClick={buscar} disabled={isFetching}>
            {isFetching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {isFetching ? 'Buscando' : 'Buscar'}
          </Button>
        )}
      >
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Mais filtros
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 max-h-[calc(100dvh-2rem)] space-y-4 overflow-y-auto" aria-label="Filtros avançados de comissão">
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="codigo-meta">Código da meta</Label>
              <Input id="codigo-meta" value={codMeta} onChange={(e) => setCodMeta(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="operacao-fiscal-inicial">Operação fiscal inicial</Label>
                <Input id="operacao-fiscal-inicial" inputMode="numeric" value={operacaoFiscalInicial} onChange={(e) => setOperacaoFiscalInicial(e.target.value)} placeholder="Ex.: 0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="operacao-fiscal-final">Operação fiscal final</Label>
                <Input id="operacao-fiscal-final" inputMode="numeric" value={operacaoFiscalFinal} onChange={(e) => setOperacaoFiscalFinal(e.target.value)} placeholder="Ex.: 62" />
              </div>
            </div>
            <div className="space-y-3 border-t border-border pt-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="dev" className="text-xs">Deduzir devolução</Label>
                <Switch checked={deduzirDevolucao} onCheckedChange={setDeduzirDevolucao} id="dev" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="st" className="text-xs">Calcular ST</Label>
                <Switch checked={calculaSt} onCheckedChange={setCalculaSt} id="st" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="mg" className="text-xs">Exibir valores de margem</Label>
                <Switch checked={exibirMargem} onCheckedChange={setExibirMargem} id="mg" />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </ComercialFilterBar>

      {filtrosAvancadosAtivos.length > 0 && (
        <div aria-label="Filtros avançados ativos" className="flex flex-wrap gap-2">
          {filtrosAvancadosAtivos.map((filtro) => (
            <span key={filtro.label} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">
              {filtro.label}
              <button
                type="button"
                aria-label={`Remover filtro ${filtro.label}`}
                className="rounded-sm p-0.5 text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={filtro.onRemove}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {aplicado && !isLoading && !error && <ComercialMetricStrip metrics={metricas} />}

      {error && (
        <div role="alert" className="comissao-error flex items-center gap-3 border border-destructive/35 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">
            {(error as Error).name === 'AbortError'
              ? 'A consulta demorou mais que o esperado. Tente novamente.'
              : 'Não foi possível carregar as comissões. Verifique a conexão com a API.'}
          </span>
          <Button variant="ghost" size="sm" className="h-8 shrink-0 gap-2 text-destructive hover:text-destructive" onClick={() => void refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Tentar novamente
          </Button>
        </div>
      )}

      <section
        data-testid="comissao-results"
        className={cn(
          'comissao-results flex min-h-0 flex-col border border-border/80 bg-card',
          linhas.length > 0 && 'flex-1',
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold">
            Comissão por vendedor {linhas.length > 0 && <span className="font-normal text-muted-foreground">({linhas.length})</span>}
          </h2>
          {aplicado && totais.pedidosAberto === null && (
            <p role="status" className="text-xs text-muted-foreground">
              Pedidos em aberto indisponíveis para um ou mais vendedores.
            </p>
          )}
        </div>
        <ComercialDataViewport
          ariaLabel="Tabela de comissões por vendedor"
          className={cn(linhas.length > 0 && 'comissao-data-populated')}
        >
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : !aplicado ? (
            <p className="flex min-h-44 items-center justify-center px-4 py-8 text-center text-sm text-muted-foreground">
              Selecione o ano e o mês e use o botão Buscar para carregar os dados.
            </p>
          ) : linhas.length === 0 ? (
            <div data-testid="comissao-empty-state" className="flex min-h-44 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Search className="h-4 w-4" />
              </span>
              <p className="text-sm font-medium text-foreground">Nenhuma comissão encontrada</p>
              <p className="text-xs text-muted-foreground">Revise o período ou os filtros selecionados.</p>
            </div>
          ) : (
              <table className="w-full min-w-[56rem] border-collapse text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="top-0 z-30 w-56 bg-muted py-2.5 px-3 text-left font-semibold whitespace-nowrap md:sticky md:left-0">Vendedor</th>
                    <th className={th}>Obj. mensal</th>
                    <th className={th}>Obj. diário</th>
                    <th className={th}>Pedidos em aberto</th>
                    <th className={th}>Faturado até hoje</th>
                    <th className={th}>Falta para a meta</th>
                    <th className={th}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr
                      key={`${l.vendedor}-${i}`}
                      className={cn(
                        'h-10 border-t border-border/60 transition-colors hover:bg-primary/5',
                        i % 2 === 1 && 'bg-muted/40',
                      )}
                    >
                      <td
                        className={cn('z-10 w-56 max-w-56 truncate py-2.5 px-3 font-semibold whitespace-nowrap md:sticky md:left-0', i % 2 === 1 ? 'bg-muted' : 'bg-card')}
                        title={l.nome}
                      >
                        {l.nome || l.vendedor}
                      </td>
                      <td className={td}>{formatCurrency(l.objetivoMensal)}</td>
                      <td className={td}>{formatCurrency(l.objetivoDiario)}</td>
                      <td className={td}>{l.pedidosAberto === null ? 'Indisponível' : formatCurrency(l.pedidosAberto)}</td>
                      <td className={cn(td, 'font-semibold text-foreground')}>{formatCurrency(l.faturadoAteHoje)}</td>
                      <td className={td}>{formatCurrency(l.aFaturar)}</td>
                      <td className={cn(td, 'font-semibold text-foreground')}>{formatCurrency(l.valorTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/70 font-semibold">
                    <td className="z-20 w-56 bg-muted py-2.5 px-3 md:sticky md:left-0">Total</td>
                    <td className={td}>{formatCurrency(totais.objetivoMensal)}</td>
                    <td className={td}>{formatCurrency(totais.objetivoDiario)}</td>
                    <td className={td}>{totais.pedidosAberto === null ? 'Indisponível' : formatCurrency(totais.pedidosAberto)}</td>
                    <td className={td}>{formatCurrency(totais.faturadoAteHoje)}</td>
                    <td className={td}>{formatCurrency(totais.aFaturar)}</td>
                    <td className={td}>{formatCurrency(totais.valorTotal)}</td>
                  </tr>
                </tfoot>
              </table>
          )}
        </ComercialDataViewport>
      </section>
    </ComercialCompactPage>
  );
}
