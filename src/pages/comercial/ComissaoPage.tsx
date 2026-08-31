import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, BadgeDollarSign, AlertCircle } from 'lucide-react';
import { formatCurrency, formatInteger } from '@/utils/formatters';
import { useComissaoVendedores, type ComissaoFiltros } from '@/hooks/useComissaoVendedores';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { ComissaoVendedorFilter } from '@/components/comercial/ComissaoVendedorFilter';
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
  const hoje = new Date();

  const [ano, setAno] = useState<number>(hoje.getFullYear());
  const [mes, setMes] = useState<number>(hoje.getMonth() + 1);
  const [codMeta, setCodMeta] = useState('');
  const [deduzirDevolucao, setDeduzirDevolucao] = useState(true);
  const [calculaSt, setCalculaSt] = useState(false);
  const [exibirMargem, setExibirMargem] = useState(true);
  const [vendedoresSel, setVendedoresSel] = useState<string[]>([]);
  const [operacaoFiscalInicial, setOperacaoFiscalInicial] = useState('');
  const [operacaoFiscalFinal, setOperacaoFiscalFinal] = useState('');

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

  const { data, isLoading, isFetching, error } = useComissaoVendedores(aplicado);
  const todasLinhas = data ?? [];

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
        objetivoAteHoje: acc.objetivoAteHoje + l.objetivoAteHoje,
        faturadoAteHoje: acc.faturadoAteHoje + l.faturadoAteHoje,
        valorTotal: acc.valorTotal + l.valorTotal,
        pedidosAberto: acc.pedidosAberto + l.pedidosAberto,
        devolucao: acc.devolucao + l.devolucao,
        st: acc.st + l.st,
      }),
      { objetivoMensal: 0, objetivoAteHoje: 0, faturadoAteHoje: 0, valorTotal: 0, pedidosAberto: 0, devolucao: 0, st: 0 },
    );
  }, [linhas]);

  const mostrarMargem = !!aplicado?.exibir_valores_margem;
  const mostrarST = !!aplicado?.calcula_st;
  const mostrarDevolucao = linhas.some((l) => l.devolucao !== 0);

  const th = 'py-2.5 px-3 text-right font-semibold whitespace-nowrap';
  const td = 'py-2.5 px-3 text-right tabular-nums whitespace-nowrap border-l border-border/40';

  return (
    <div className="p-4 md:p-6 space-y-5">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <BadgeDollarSign className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight">Comissão</h1>
          <p className="text-xs text-muted-foreground">
            Metas e comissão de vendedores — base {filialAtiva === 'chevrolet' ? 'Casa da Chevrolet (CH)' : 'Casa da Transmissão (CT)'}
          </p>
        </div>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
            <div className="space-y-1.5">
              <Label className="text-xs">Ano</Label>
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger className="h-10 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mês</Label>
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger className="h-10 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vendedor</Label>
              <ComissaoVendedorFilter
                vendedores={opcoesVendedores}
                selecionados={vendedoresSel}
                onChange={setVendedoresSel}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Código da meta</Label>
              <Input className="h-10" value={codMeta} onChange={(e) => setCodMeta(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="operacao-fiscal-inicial">Operação fiscal inicial</Label>
              <Input id="operacao-fiscal-inicial" className="h-10" inputMode="numeric" value={operacaoFiscalInicial} onChange={(e) => setOperacaoFiscalInicial(e.target.value)} placeholder="Ex.: 0" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="operacao-fiscal-final">Operação fiscal final</Label>
              <Input id="operacao-fiscal-final" className="h-10" inputMode="numeric" value={operacaoFiscalFinal} onChange={(e) => setOperacaoFiscalFinal(e.target.value)} placeholder="Ex.: 62" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={deduzirDevolucao} onCheckedChange={setDeduzirDevolucao} id="dev" />
              <Label htmlFor="dev" className="text-xs">Deduzir devolução</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={calculaSt} onCheckedChange={setCalculaSt} id="st" />
              <Label htmlFor="st" className="text-xs">Calcular ST</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={exibirMargem} onCheckedChange={setExibirMargem} id="mg" />
              <Label htmlFor="mg" className="text-xs">Exibir valores de margem</Label>
            </div>
            <Button className="ml-auto gap-2" onClick={buscar} disabled={isFetching}>
              <Search className="h-4 w-4" />
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="flex items-center gap-2 py-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            Não foi possível carregar as comissões. {(error as Error).message}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            Comissão por vendedor {linhas.length > 0 && <span className="text-muted-foreground font-normal">({linhas.length})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : !aplicado ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Selecione o ano e o mês e clique em <strong>Buscar</strong> para carregar os dados.
            </p>
          ) : linhas.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhum registro encontrado no período.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">Vendedor</th>
                    <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">Nome</th>
                    <th className={th}>Obj. mensal</th>
                    <th className={th}>Obj. diário</th>
                    <th className={th}>Obj. até hoje</th>
                    <th className={th}>Faturado até hoje</th>
                    <th className={th}>A faturar</th>
                    <th className={th}>Valor total</th>
                    <th className={th}>Pedidos em aberto</th>
                    <th className={th}>Projeção</th>
                    <th className={th}>Nova projeção</th>
                    <th className={th}>PMV</th>
                    {mostrarMargem && <th className={th}>Margem</th>}
                    {mostrarDevolucao && <th className={th}>Devolução</th>}
                    {mostrarST && <th className={th}>ST</th>}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr
                      key={`${l.vendedor}-${i}`}
                      className={cn(
                        'border-t border-border/60 transition-colors hover:bg-primary/5',
                        i % 2 === 1 && 'bg-muted/40',
                      )}
                    >
                      <td className="py-2.5 px-3 font-semibold tabular-nums whitespace-nowrap">{l.vendedor}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap border-l border-border/40">{l.nome}</td>
                      <td className={td}>{formatCurrency(l.objetivoMensal)}</td>
                      <td className={td}>{formatCurrency(l.objetivoDiario)}</td>
                      <td className={td}>{formatCurrency(l.objetivoAteHoje)}</td>
                      <td className={cn(td, 'font-semibold text-foreground')}>{formatCurrency(l.faturadoAteHoje)}</td>
                      <td className={td}>{formatCurrency(l.aFaturar)}</td>
                      <td className={td}>{formatCurrency(l.valorTotal)}</td>
                      <td className={td}>{formatCurrency(l.pedidosAberto)}</td>
                      <td className={td}>{formatCurrency(l.projecao)}</td>
                      <td className={td}>{formatCurrency(l.novaProjecao)}</td>
                      <td className={td}>{formatInteger(l.pmv)}</td>
                      {mostrarMargem && <td className={td}>{formatCurrency(l.margem)}</td>}
                      {mostrarDevolucao && <td className={td}>{formatCurrency(l.devolucao)}</td>}
                      {mostrarST && <td className={td}>{formatCurrency(l.st)}</td>}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/70 font-semibold">
                    <td className="py-2.5 px-3" colSpan={2}>Total</td>
                    <td className={td}>{formatCurrency(totais.objetivoMensal)}</td>
                    <td className={td} />
                    <td className={td}>{formatCurrency(totais.objetivoAteHoje)}</td>
                    <td className={td}>{formatCurrency(totais.faturadoAteHoje)}</td>
                    <td className={td} />
                    <td className={td}>{formatCurrency(totais.valorTotal)}</td>
                    <td className={td}>{formatCurrency(totais.pedidosAberto)}</td>
                    <td className={td} colSpan={mostrarMargem ? 4 : 3} />
                    {mostrarDevolucao && <td className={td}>{formatCurrency(totais.devolucao)}</td>}
                    {mostrarST && <td className={td}>{formatCurrency(totais.st)}</td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
