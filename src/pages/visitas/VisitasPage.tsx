import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Filter, LogOut, RefreshCw, Send } from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';
import { ComercialDataViewport, ComercialFilterBar } from '@/components/comercial/compact';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getFilialPorId } from '@/config/filiaisEmpresa';
import { enviarVisita, listarVisitas, type SessaoVisitas } from './visitasApi';

const dadosCliente = [
  { key: 'nome_cliente', label: 'Nome do cliente', required: true },
  { key: 'data_visita', label: 'Data da visita', required: true },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'segmento', label: 'Segmento' },
  { key: 'diesel', label: 'Diesel' },
  { key: 'responsaveis_compras', label: 'Responsáveis por compras' },
  { key: 'funcao', label: 'Função' },
] as const;

const itens = ['Atendimento', 'Entrega', 'Preço', 'Prazo'] as const;
const campos = ['Observações / oportunidades', 'Ações', 'Responsáveis'] as const;
const filtrosVazios = { cliente: '', visitador: '', inicio: '', fim: '' };
type FilialVisitas = SessaoVisitas['filiais'][number];
const porPagina = 20;
const dataHoje = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const dataBr = (data: string) => data.split('-').reverse().join('/');

function Formulario({ filial, onEnviado }: { filial: FilialVisitas; onEnviado: () => void }) {
  const [erro, setErro] = useState('');
  const mutation = useMutation({
    retry: false,
    mutationFn: async (form: FormData) => {
      const valor = (key: string) => String(form.get(key) ?? '').trim();
      if (!valor('nome_cliente')) throw new Error('Informe o nome do cliente.');
      const avaliacoes = Object.fromEntries(itens.map((item) => [
        item, campos.map((campo) => valor(`${item}:${campo}`)),
      ]));
      await enviarVisita({
        ...filial,
        nome_cliente: valor('nome_cliente'),
        data_visita: valor('data_visita'),
        cnpj: valor('cnpj'),
        cidade: valor('cidade'),
        segmento: valor('segmento'),
        diesel: valor('diesel'),
        responsaveis_compras: valor('responsaveis_compras'),
        funcao: valor('funcao'),
        avaliacoes,
      });
    },
    onSuccess: onEnviado,
    onError: (error) => setErro(error instanceof Error ? error.message :
      'Não foi possível enviar o relatório. Seus dados continuam no formulário.'),
  });

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;
    setErro('');
    mutation.mutate(new FormData(event.currentTarget));
  }

  return (
    <form onSubmit={enviar} className="space-y-5">
      <fieldset disabled={mutation.isPending} className="min-w-0 space-y-4">
        <div className="grid min-w-0 gap-3 rounded-sm border bg-card p-3 md:grid-cols-2 xl:grid-cols-4">
          {dadosCliente.map(({ key, label, ...field }) => (
            <div key={key} className="min-w-0 space-y-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input id={key} name={key} required={'required' in field}
                type={key === 'data_visita' ? 'date' : 'text'}
                defaultValue={key === 'data_visita' ? dataHoje() : undefined}
                maxLength={key === 'cnpj' ? 24 : 200} />
            </div>
          ))}
        </div>
        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          {itens.map((item, i) => (
            <fieldset key={item} className="min-w-0 rounded-sm border bg-card">
              <legend className="ml-3 px-1 text-sm font-semibold">{item}</legend>
              <div className="grid min-w-0 gap-3 p-3 pt-2 sm:grid-cols-2">
                {campos.map((campo, j) => (
                  <div key={campo} className={j === 0 ? 'min-w-0 space-y-1.5 sm:col-span-2' : 'min-w-0 space-y-1.5'}>
                    <Label htmlFor={`avaliacao-${i}-${j}`}>{campo}</Label>
                    <Textarea id={`avaliacao-${i}-${j}`} name={`${item}:${campo}`} rows={2} maxLength={3000} className="min-h-16 resize-y" />
                  </div>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}><Send className="mr-2 h-4 w-4" />
            {mutation.isPending ? 'Enviando…' : 'Enviar relatório'}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

function Historico({ usuario, filial, carregar = listarVisitas, acoes }: {
  usuario: string;
  filial?: FilialVisitas;
  carregar?: typeof listarVisitas;
  acoes?: ReactNode;
}) {
  const gerencial = !!filial;
  const [pagina, setPagina] = useState(0);
  const [filtros, setFiltros] = useState(filtrosVazios);
  const ativos = Object.values(filtros).filter(Boolean).length;
  const query = useQuery({
    queryKey: ['relatorios-visitas', usuario, filial, filtros, pagina],
    retry: false,
    refetchOnWindowFocus: gerencial,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        escopo: gerencial ? 'gerencia' : 'meus',
        offset: String(pagina * porPagina),
        limit: String(porPagina),
        ...filial,
      });
      for (const [key, value] of Object.entries(filtros)) {
        if (value) params.set(key, value);
      }
      return carregar(params, signal);
    },
  });

  function buscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const campo = (key: string) => String(form.get(key) ?? '').trim();
    setPagina(0);
    setFiltros({ cliente: campo('cliente'), visitador: campo('visitador'), inicio: campo('inicio'), fim: campo('fim') });
  }

  return (
    <Collapsible asChild>
      <section aria-label="Histórico de visitas" className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ComercialFilterBar
          ariaLabel="Filtros de visitas"
          className="shrink-0 !grid-cols-[minmax(0,1fr)_auto] !items-center px-3 sm:px-4"
          search={
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="group gap-2">
                  <Filter aria-hidden="true" className="h-3.5 w-3.5" />
                  Filtros
                  {ativos > 0 && <span className="rounded-sm bg-primary/10 px-1.5 text-xs text-primary">
                    {ativos === 1 ? '1 ativo' : `${ativos} ativos`}
                  </span>}
                  <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 group-data-[state=open]:rotate-180" />
                </Button>
              </CollapsibleTrigger>
              {query.isSuccess && (
                <p className="text-xs text-muted-foreground" role="status">
                  {query.data.total === 1 ? '1 relatório' : `${query.data.total} relatórios`}
                </p>
              )}
            </div>
          }
          actions={
            <>
              <Button type="button" variant="outline" size="icon" className="h-9 w-9" aria-label="Atualizar relatórios"
                disabled={query.isFetching} onClick={() => void query.refetch()}>
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
              </Button>
              {acoes}
            </>
          }
        />
        <CollapsibleContent asChild forceMount>
          <form onSubmit={buscar} onReset={() => { setPagina(0); setFiltros(filtrosVazios); }}
            className="max-h-[50dvh] shrink-0 space-y-2 overflow-y-auto border-b bg-card px-3 py-2 data-[state=closed]:hidden sm:px-4">
            <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="min-w-0 space-y-1">
                <Label htmlFor="busca-cliente">Cliente</Label>
                <Input id="busca-cliente" name="cliente" type="search" maxLength={200} />
              </div>
              {gerencial && (
                <div className="min-w-0 space-y-1">
                  <Label htmlFor="busca-visitador">Visitador</Label>
                  <Input id="busca-visitador" name="visitador" type="search" maxLength={200} />
                </div>
              )}
              <div className="min-w-0 space-y-1">
                <Label htmlFor="busca-inicio">De</Label>
                <Input id="busca-inicio" name="inicio" type="date" />
              </div>
              <div className="min-w-0 space-y-1">
                <Label htmlFor="busca-fim">Até</Label>
                <Input id="busca-fim" name="fim" type="date" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="reset" size="sm" variant="ghost">Limpar</Button>
              <Button type="submit" size="sm">Aplicar</Button>
            </div>
          </form>
        </CollapsibleContent>
        <ComercialDataViewport ariaLabel="Resultados dos relatórios de visitas" className="space-y-2 px-3 py-3 sm:px-4">
          {query.isPending && <LoadingState message="Carregando relatórios" variant="content" className="min-h-full" />}
          {query.isError && (
            <div className="flex flex-wrap items-center gap-3 rounded-sm border p-4">
              <p role="alert" className="text-sm text-destructive">Não foi possível carregar os relatórios.</p>
              <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Tentar novamente</Button>
            </div>
          )}
          {query.isSuccess && query.data.total === 0 && (
            <p className="w-full rounded-sm border bg-card p-4 text-sm text-muted-foreground">Nenhum relatório encontrado.</p>
          )}
          {query.isSuccess && query.data.rows.map((relatorio) => (
            <details key={relatorio.id} className="group min-w-0 rounded-sm border bg-card">
              <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 space-y-0.5">
                  <strong className="block break-words text-sm">{relatorio.nome_cliente}</strong>
                  <span className="block break-words text-xs text-muted-foreground">
                    {[dataBr(relatorio.data_visita), relatorio.cidade, gerencial ? relatorio.visitador_nome : null]
                      .filter(Boolean).join(' · ')}
                  </span>
                </span>
                <ChevronDown aria-hidden="true" className="h-4 w-4 text-muted-foreground group-open:rotate-180" />
              </summary>
              <div className="space-y-3 border-t px-4 py-3">
                <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  {dadosCliente.filter(({ key }) => key !== 'nome_cliente' && key !== 'data_visita').map(({ key, label }) => (
                    <div key={key} className="min-w-0">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="break-words">{relatorio[key] || '—'}</dd>
                    </div>
                  ))}
                </dl>
                <div className="grid gap-3 md:grid-cols-2">
                  {itens.map((item) => {
                    const detalhes = relatorio.avaliacoes[item];
                    return (
                      <div key={item} className="min-w-0 rounded-sm border p-3 text-sm">
                        <h3 className="mb-2 font-semibold">{item}</h3>
                        <dl className="space-y-2">
                          {campos.map((campo, index) => {
                            const valor = Array.isArray(detalhes) ? detalhes[index] : null;
                            return (
                              <div key={campo}>
                                <dt className="text-muted-foreground">{campo}</dt>
                                <dd className="whitespace-pre-wrap break-words">{typeof valor === 'string' && valor ? valor : '—'}</dd>
                              </div>
                            );
                          })}
                        </dl>
                      </div>
                    );
                  })}
                </div>
              </div>
            </details>
          ))}
          {query.isSuccess && query.data.total > porPagina && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
              <span>Página {pagina + 1} de {Math.ceil(query.data.total / porPagina)}</span>
              <Button variant="outline" size="sm" disabled={(pagina + 1) * porPagina >= query.data.total}
                onClick={() => setPagina(pagina + 1)}>Próxima</Button>
            </div>
          )}
        </ComercialDataViewport>
      </section>
    </Collapsible>
  );
}

function AreaVisitas({ usuario, filial, gerencial, carregar, acoes }: {
  usuario: string;
  filial: FilialVisitas;
  gerencial: boolean;
  carregar?: typeof listarVisitas;
  acoes?: ReactNode;
}) {
  const [aba, setAba] = useState('novo');
  const [enviado, setEnviado] = useState(false);
  const queryClient = useQueryClient();
  if (gerencial) return <Historico usuario={usuario} filial={filial} carregar={carregar} acoes={acoes} />;
  return (
    <Tabs className="flex min-h-0 flex-1 flex-col overflow-hidden" value={aba}
      onValueChange={(tab) => { setAba(tab); setEnviado(false); }}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2 sm:px-4">
        <TabsList className="flex h-auto w-fit max-w-full flex-wrap justify-start rounded-sm">
          <TabsTrigger value="novo">Novo relatório</TabsTrigger>
          <TabsTrigger value="historico">Meus relatórios</TabsTrigger>
        </TabsList>
        {acoes}
      </div>
      <TabsContent value="novo" className="mt-0 min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        <Formulario filial={filial} onEnviado={() => {
          void queryClient.invalidateQueries({ queryKey: ['relatorios-visitas'] });
          setEnviado(true);
          setAba('historico');
        }} />
      </TabsContent>
      <TabsContent value="historico" className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
        {enviado && <p role="status" className="shrink-0 px-3 pt-2 text-sm text-primary sm:px-4">Relatório enviado. Ele já está disponível para a gerência.</p>}
        <Historico usuario={usuario} />
      </TabsContent>
    </Tabs>
  );
}

export default function VisitasPage({ sessao, logout, carregar, filialAtiva }: {
  sessao: SessaoVisitas;
  logout?: () => Promise<void>;
  carregar?: typeof listarVisitas;
  filialAtiva?: string;
}) {
  const gerencial = sessao.perfil === 'gerencial';
  const [filialEscolhida, setFilialEscolhida] = useState('');
  const filiais = sessao.filiais.filter(({ cod_empresa_bi, filial_id }) => getFilialPorId(cod_empresa_bi, filial_id));
  const filial = filiais.find((item) => item.filial_id === (filialAtiva ?? filialEscolhida)) ??
    (filialAtiva ? undefined : filiais[0]);
  const [erroSaida, setErroSaida] = useState(false);
  const sair = logout && (
    <Button size="sm" variant="outline" onClick={() => void logout().catch(() => setErroSaida(true))}>
      <LogOut aria-hidden="true" className="mr-2 h-4 w-4" />Sair
    </Button>
  );
  const acoes = logout && (
    <div className="flex flex-wrap items-center gap-2">
      {filial && filiais.length > 1 && (
        <select aria-label="Filial" className="h-9 rounded-sm border bg-background px-2 text-sm"
          value={filial.filial_id} onChange={(event) => setFilialEscolhida(event.target.value)}>
          {filiais.map(({ cod_empresa_bi, filial_id }) => (
            <option key={filial_id} value={filial_id}>{getFilialPorId(cod_empresa_bi, filial_id)?.nome}</option>
          ))}
        </select>
      )}
      {sair}
    </div>
  );

  return (
    <section aria-label="Conteúdo dos relatórios de visitas"
      className={`flex min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background ${logout ? 'h-dvh' : 'h-[calc(100dvh-5rem)] md:h-auto md:flex-1'}`}>
      {filial ? (
        <AreaVisitas key={`${sessao.id}:${sessao.perfil}:${gerencial ? filial.filial_id : ''}`}
          usuario={sessao.id} filial={filial} gerencial={gerencial} carregar={carregar} acoes={acoes} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p role="alert" className="text-sm text-muted-foreground">Seu acesso a Visitas precisa ser liberado.</p>
          {sair}
        </div>
      )}
      {erroSaida && <p role="alert" className="shrink-0 px-3 py-2 text-sm text-destructive">Não foi possível encerrar a sessão. Tente de novo.</p>}
    </section>
  );
}
