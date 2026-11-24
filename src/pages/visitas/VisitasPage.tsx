import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, LogOut, RefreshCw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PelegriniFilterBar } from '@/components/pelegrini/PelegriniFilterBar';
import { useAuth } from '@/contexts/AuthContext';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { getFilialAccessState } from '@/utils/filialAccess';
import { getFilialPorId } from '@/config/filiaisEmpresa';
import { enviarVisita, listarVisitas } from './visitasApi';

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
const porPagina = 20;
const dataHoje = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const dataBr = (data: string) => data.split('-').reverse().join('/');

type Escopo = { empresa: string; filial: string; usuario: string };

function Formulario({ escopo, onEnviado }: { escopo: Escopo; onEnviado: () => void }) {
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
        cod_empresa_bi: escopo.empresa,
        filial_id: escopo.filial,
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

function Historico({ escopo, gerencial }: { escopo: Escopo; gerencial: boolean }) {
  const [pagina, setPagina] = useState(0);
  const [filtros, setFiltros] = useState(filtrosVazios);
  const ativos = Object.values(filtros).filter(Boolean).length;
  const query = useQuery({
    queryKey: ['relatorios-visitas', escopo.usuario, escopo.empresa, escopo.filial, gerencial, filtros, pagina],
    retry: false,
    refetchOnWindowFocus: gerencial,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        escopo: gerencial ? 'gerencia' : 'meus',
        offset: String(pagina * porPagina),
        limit: String(porPagina),
      });
      if (gerencial) {
        params.set('cod_empresa_bi', escopo.empresa);
        params.set('filial_id', escopo.filial);
      }
      for (const [key, value] of Object.entries(filtros)) {
        if (value) params.set(key, value);
      }
      return listarVisitas(params, signal);
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
    <section aria-label="Histórico de visitas" className="min-w-0 space-y-3">
      <form onSubmit={buscar} onReset={() => { setPagina(0); setFiltros(filtrosVazios); }}>
        <PelegriniFilterBar activeCount={ativos} actions={<>
          <Button type="reset" size="sm" variant="ghost">Limpar</Button>
          <Button type="submit" size="sm">Aplicar</Button>
        </>}>
          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0 space-y-1"><Label htmlFor="busca-cliente">Cliente</Label>
              <Input id="busca-cliente" name="cliente" type="search" maxLength={200} /></div>
            {gerencial && <div className="min-w-0 space-y-1"><Label htmlFor="busca-visitador">Visitador</Label>
              <Input id="busca-visitador" name="visitador" type="search" maxLength={200} /></div>}
            <div className="min-w-0 space-y-1"><Label htmlFor="busca-inicio">De</Label><Input id="busca-inicio" name="inicio" type="date" /></div>
            <div className="min-w-0 space-y-1"><Label htmlFor="busca-fim">Até</Label><Input id="busca-fim" name="fim" type="date" /></div>
          </div>
        </PelegriniFilterBar>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <p className="text-sm text-muted-foreground">{query.data && (query.data.total === 1 ? '1 relatório' : `${query.data.total} relatórios`)}</p>
        <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Atualizar relatórios"
          disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw aria-hidden="true" className="h-4 w-4" /></Button>
      </div>
      {query.isPending && <p role="status" className="p-4 text-sm text-muted-foreground">Carregando relatórios…</p>}
      {query.isError && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
          <p role="alert" className="text-sm text-destructive">Não foi possível carregar os relatórios.</p>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Tentar novamente</Button>
        </div>
      )}
      {query.data?.total === 0 && <p className="rounded-lg border p-4 text-sm text-muted-foreground">Nenhum relatório encontrado.</p>}
      {query.data?.rows.map((relatorio) => (
        <details key={relatorio.id} className="group min-w-0 rounded-sm border bg-card">
          <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 space-y-0.5">
              <strong className="block break-words text-sm">{relatorio.nome_cliente}</strong>
              <span className="block break-words text-xs text-muted-foreground">{[
              dataBr(relatorio.data_visita), relatorio.cidade,
              gerencial ? relatorio.visitador_nome : getFilialPorId(relatorio.cod_empresa_bi, relatorio.filial_id)?.nome,
              ].filter(Boolean).join(' · ')}</span>
            </span>
            <ChevronDown aria-hidden="true" className="h-4 w-4 text-muted-foreground group-open:rotate-180" />
          </summary>
          <div className="space-y-3 border-t px-4 py-3">
            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {dadosCliente.filter(({ key }) => key !== 'nome_cliente' && key !== 'data_visita').map(({ key, label }) => (
                <div key={key} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="break-words">{relatorio[key] || '—'}</dd></div>
              ))}
            </dl>
            <div className="grid gap-3 md:grid-cols-2">
              {itens.map((item) => {
                const detalhes = relatorio.avaliacoes[item];
                return <div key={item} className="min-w-0 rounded-sm border p-3 text-sm">
                  <h3 className="mb-2 font-semibold">{item}</h3>
                  <dl className="space-y-2">{campos.map((campo, index) => {
                    const valor = Array.isArray(detalhes) ? detalhes[index] : null;
                    return <div key={campo}><dt className="text-muted-foreground">{campo}</dt>
                      <dd className="whitespace-pre-wrap break-words">{typeof valor === 'string' && valor ? valor : '—'}</dd></div>;
                  })}</dl>
                </div>;
              })}
            </div>
          </div>
        </details>
      ))}
      {!!query.data?.total && query.data.total > porPagina && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
          <span>Página {pagina + 1} de {Math.ceil(query.data.total / porPagina)}</span>
          <Button variant="outline" size="sm" disabled={(pagina + 1) * porPagina >= query.data.total}
            onClick={() => setPagina(pagina + 1)}>Próxima</Button>
        </div>
      )}
    </section>
  );
}

function AreaVisitas({ escopo, gerencial }: { escopo: Escopo; gerencial: boolean }) {
  const [aba, setAba] = useState('novo');
  const [enviado, setEnviado] = useState(false);
  const queryClient = useQueryClient();
  if (gerencial) return <Historico escopo={escopo} gerencial />;
  return (
    <Tabs value={aba} onValueChange={(tab) => { setAba(tab); setEnviado(false); }}>
      <TabsList className="flex h-auto w-fit max-w-full flex-wrap justify-start rounded-sm">
        <TabsTrigger value="novo">Novo relatório</TabsTrigger>
        <TabsTrigger value="historico">Meus relatórios</TabsTrigger>
      </TabsList>
      <TabsContent value="novo">
        <Formulario escopo={escopo} onEnviado={() => {
          void queryClient.invalidateQueries({ queryKey: ['relatorios-visitas'] });
          setEnviado(true);
          setAba('historico');
        }} />
      </TabsContent>
      <TabsContent value="historico">
        {enviado && <p role="status" className="mb-3 text-sm text-primary">Relatório enviado. Ele já está disponível para a gerência da filial.</p>}
        <Historico escopo={escopo} gerencial={false} />
      </TabsContent>
    </Tabs>
  );
}

export default function VisitasPage({ gerencial = false }: { gerencial?: boolean }) {
  const { user, profile, logout, codEmpresa } = useAuth();
  const { filialAtiva, codEmpresaContexto, filialNome } = useFilialSelecionada();
  const [filialEscolhida, setFilialEscolhida] = useState('');
  const filiais = getFilialAccessState({
    codEmpresa, isMaster: false, filialPadrao: profile?.filial_id, filiaisPermitidas: profile?.filiais_permitidas,
  }).available;
  const filialVisitador = filiais.find(({ id }) => id === filialEscolhida) ?? filiais[0];
  const empresa = gerencial ? codEmpresaContexto : codEmpresa;
  const filial = gerencial ? filialAtiva : filialVisitador?.id;
  const unidade = gerencial ? filialNome : filialVisitador?.nome;

  return (
    <div className={`flex min-h-0 min-w-0 flex-col overflow-hidden bg-background ${gerencial ? 'h-full flex-1' : 'h-dvh'}`}>
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-card px-3 py-2.5 md:px-4">
        <div className="min-w-0">
          <h1 className="break-words text-lg font-bold leading-tight">Relatórios de visitas</h1>
          {unidade && <p className="break-words text-xs text-muted-foreground">{unidade}</p>}
        </div>
        {!gerencial && <Button size="sm" variant="outline" onClick={() => void logout()}><LogOut className="mr-2 h-4 w-4" />Sair</Button>}
      </header>
      <section aria-label="Conteúdo dos relatórios de visitas" tabIndex={0}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
      <div className="mx-auto w-full max-w-6xl space-y-3 p-3 pb-6 md:p-4 md:pb-6">
        {!gerencial && filiais.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="visita-filial">Filial</Label>
            <select id="visita-filial" value={filial} onChange={(event) => setFilialEscolhida(event.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm">
              {filiais.map(({ id, nome }) => <option key={id} value={id}>{nome}</option>)}
            </select>
          </div>
        )}
        {empresa && filial && user ? (
          <AreaVisitas key={`${user.id}:${empresa}:${filial}:${gerencial}`} gerencial={gerencial}
            escopo={{ empresa, filial, usuario: user.id }} />
        ) : <p className="rounded-lg border p-4 text-sm text-muted-foreground">É necessário ter uma filial atribuída para acessar os relatórios de visitas.</p>}
      </div>
      </section>
    </div>
  );
}
