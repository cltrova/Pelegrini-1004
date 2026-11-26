import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronDown, Filter, RefreshCw } from 'lucide-react';
import { ComercialDataViewport } from '@/components/comercial/compact';
import { LoadingState } from '@/components/common/LoadingState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCnpjDisplay, formatPeriod } from '@/utils/formatters';
import type { CarregarOficinas, SessaoVisitas, StatusOficina } from './visitasApi';

const statusLabels = {
  visitada: 'Com visita registrada',
  sem_visita: 'Sem visita registrada',
  a_conferir: 'A conferir',
} satisfies Record<StatusOficina, string>;
const filtrosStatus = { todas: 'Todas', ...statusLabels };
const statusVisiveis = ['todas', 'visitada', 'sem_visita'] as const;
const filtrosVazios = { busca: '', uf: '', cidade: '' };
const porPagina = 25;

type Props = {
  usuario: string;
  filial: SessaoVisitas['filiais'][number];
  carregar: CarregarOficinas;
  acoesContainer: HTMLDivElement | null;
};

export function OficinasVisitas({ usuario, filial, carregar, acoesContainer }: Props) {
  const [status, setStatus] = useState<(typeof statusVisiveis)[number]>('todas');
  const [filtros, setFiltros] = useState(filtrosVazios);
  const [pagina, setPagina] = useState(0);
  const query = useQuery({
    queryKey: ['oficinas-visitas', usuario, filial, status, filtros, pagina],
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ ...filial, status, limit: String(porPagina), offset: String(pagina * porPagina) });
      for (const [key, value] of Object.entries(filtros)) if (value) params.set(key, value);
      return carregar(params, signal);
    },
  });
  const catalogo = query.data?.catalogo;
  const total = query.data?.total ?? 0;
  const paginas = Math.ceil(total / porPagina);
  const carregando = query.isPending || query.isPlaceholderData;

  useEffect(() => {
    if (query.isSuccess && !carregando) setPagina((atual) => Math.min(atual, Math.max(paginas - 1, 0)));
  }, [carregando, paginas, query.isSuccess]);

  function aplicar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const valor = (campo: string) => String(form.get(campo) ?? '').trim();
    setPagina(0);
    setFiltros({ busca: valor('busca'), uf: valor('uf'), cidade: valor('cidade') });
  }

  return (
    <Collapsible asChild>
      <section aria-label="Busca de oficinas" className="flex min-h-0 min-w-0 flex-1 flex-col">
        {acoesContainer && createPortal(
          <div role="group" aria-label="Ações de oficinas" className="flex items-center gap-1.5">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" size="sm" disabled={!catalogo}
                className="group h-8 gap-1.5 px-2.5 text-xs data-[state=open]:border-primary/35 data-[state=open]:text-primary [&_svg]:size-3.5">
                <Filter aria-hidden="true" /> Filtros
                <ChevronDown aria-hidden="true" className="group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <Button type="button" aria-label="Atualizar oficinas" aria-busy={query.isFetching || undefined}
              variant="outline" size="icon" className="size-8 [&_svg]:size-3.5"
              disabled={query.isFetching} onClick={() => void query.refetch()}>
              <RefreshCw aria-hidden="true" className={query.isFetching ? 'motion-safe:animate-spin' : undefined} />
            </Button>
          </div>,
          acoesContainer,
        )}
        {catalogo && (
          <CollapsibleContent asChild forceMount>
            <form aria-label="Filtros de oficinas" onSubmit={aplicar} onReset={() => { setFiltros(filtrosVazios); setPagina(0); }}
              className="grid max-h-[45dvh] shrink-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-2 overflow-y-auto border-b bg-card px-3 py-2 data-[state=closed]:hidden sm:px-4 md:grid-cols-[5rem_minmax(0,11rem)_minmax(0,24rem)_auto] md:items-end md:justify-end">
              <div className="space-y-1">
                <Label htmlFor="oficina-uf">UF</Label>
                <select id="oficina-uf" name="uf" className="h-8 w-full rounded-sm border bg-background px-2 text-sm">
                  <option value={catalogo.uf}>{catalogo.uf}</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="oficina-cidade">Cidade</Label>
                <select id="oficina-cidade" name="cidade" className="h-8 w-full rounded-sm border bg-background px-2 text-sm">
                  <option value={catalogo.cidade}>{catalogo.cidade}</option>
                </select>
              </div>
              <div className="col-span-2 space-y-1 md:col-span-1">
                <Label htmlFor="oficina-busca">Nome ou CNPJ</Label>
                <Input id="oficina-busca" type="search" name="busca" maxLength={200} className="h-8" />
              </div>
              <div className="col-span-2 flex justify-end gap-2 md:col-span-1">
                <Button type="reset" variant="ghost" size="sm" className="h-8">Limpar</Button>
                <Button type="submit" size="sm" className="h-8">Aplicar</Button>
              </div>
            </form>
          </CollapsibleContent>
        )}
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3 py-1.5 sm:px-4">
          <div role="group" aria-label="Situação da visita"
            className="inline-grid min-w-0 max-w-full grid-cols-[auto_repeat(2,minmax(0,1fr))] gap-0.5 rounded-md border bg-muted/60 p-0.5">
            {statusVisiveis.map((opcao) => (
              <Button key={opcao} type="button" size="sm" variant="ghost" aria-pressed={status === opcao}
                className="h-auto min-h-8 whitespace-normal rounded-sm border border-transparent px-2 py-1 text-xs leading-tight text-muted-foreground hover:bg-background/70 hover:text-foreground focus-visible:z-10 focus-visible:ring-offset-0 aria-pressed:border-primary/25 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm sm:min-h-7 sm:px-2.5"
                onClick={() => { setStatus(opcao); setPagina(0); }}>
                {filtrosStatus[opcao]}
              </Button>
            ))}
          </div>
          {catalogo && (
            <span className="text-xs text-muted-foreground sm:ml-auto">
              {catalogo.cidade} · {catalogo.uf} · <a className="underline-offset-2 hover:underline focus:underline"
                href={catalogo.fonte} target="_blank" rel="noreferrer">Receita Federal · {formatPeriod(catalogo.competencia)}</a>
            </span>
          )}
        </div>
        <ComercialDataViewport ariaLabel="Resultados da busca de oficinas" className="flex-1 px-3 py-2 sm:px-4">
          {carregando && <LoadingState message="Carregando oficinas" variant="content" className="min-h-full" />}
          {query.isError && <p role="alert" className="rounded-sm border bg-card p-3 text-sm text-destructive">{query.error.message}</p>}
          {!carregando && query.isSuccess && (total === 0 ? (
            <p className="rounded-sm border bg-card p-3 text-sm text-muted-foreground">Nenhuma oficina encontrada com os filtros selecionados.</p>
          ) : (
            <table className="w-full min-w-[39rem] text-sm">
              <caption className="sr-only">Oficinas e histórico da filial</caption>
              <thead className="sticky top-0 z-10 bg-card text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Oficina</th>
                  {['CNPJ', 'Bairro', 'Situação', 'Última visita'].map((label) => (
                    <th key={label} scope="col" className="whitespace-nowrap px-3 py-2 text-center font-medium">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.oficinas.map((oficina) => (
                  <tr key={oficina.id} className="border-b hover:bg-muted/40">
                    <td className="px-3 py-2 text-left">
                      <div className="font-medium">{oficina.nome}</div>
                      {oficina.origem === 'historico' && <span className="text-xs text-muted-foreground">Só no histórico</span>}
                      {oficina.razao_social && oficina.razao_social !== oficina.nome && (
                        <span className="text-xs text-muted-foreground">{oficina.razao_social}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-center tabular-nums">{formatCnpjDisplay(oficina.cnpj) || '—'}</td>
                    <td className="px-3 py-2 text-center">{oficina.bairro || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-center">
                      <Badge variant={oficina.status === 'sem_visita' ? 'secondary' : 'outline'}
                        title={oficina.status === 'a_conferir' ? 'Possível vínculo com um relatório sem CNPJ confirmado' : undefined}
                        className={oficina.status === 'visitada'
                          ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                          : oficina.status === 'a_conferir' ? 'border-amber-500/40 text-amber-700 dark:text-amber-400' : undefined}>
                        {statusLabels[oficina.status]}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-center tabular-nums">
                      {oficina.ultima_visita ? oficina.ultima_visita.split('-').reverse().join('/') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </ComercialDataViewport>
        {query.isSuccess && !carregando && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground sm:px-4">
            <span role="status">{total === 1 ? '1 resultado' : `${total.toLocaleString('pt-BR')} resultados`}</span>
            {paginas > 1 && (
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
                <span>Página {pagina + 1} de {paginas}</span>
                <Button type="button" variant="outline" size="sm" disabled={pagina + 1 >= paginas} onClick={() => setPagina(pagina + 1)}>Próxima</Button>
              </div>
            )}
          </div>
        )}
      </section>
    </Collapsible>
  );
}
