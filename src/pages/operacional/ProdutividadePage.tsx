import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, SlidersHorizontal } from 'lucide-react';

import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { ProdutividadeAtividades } from '@/components/operacional/ProdutividadeAtividades';
import { ProdutividadeDashboard, type ProdutividadeLinha, type ProdutividadeResumo } from '@/components/operacional/ProdutividadeDashboard';
import type { ProdutividadeColaborador } from '@/components/operacional/produtividadeColaborador';
import type { ProdutividadePeriodo } from '@/components/operacional/produtividadeExcel';
import { PelegriniTabs } from '@/components/pelegrini/PelegriniTabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import type { Empresa } from '@/hooks/useEmpresaConfig';
import { supabase } from '@/integrations/supabase/client';
import { resolveCodEmpresaBiParam } from '@/utils/filialEndpoint';

type Dados = {
  cod_empresa_bi: number;
  cod_empresas: number[];
  atualizado_em: string;
  resumo: ProdutividadeResumo;
  por_dia_responsavel: ProdutividadeLinha[];
};

type Filtros = ProdutividadePeriodo;
const overviewTab = 'produtividade-visao-geral';
const activityTab = 'produtividade-atividades';

function filtrosIniciais(): Filtros {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const prefixo = ano + '-' + String(mes + 1).padStart(2, '0') + '-';
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  return { inicio: prefixo + '01', fim: prefixo + ultimoDia, filial: '' };
}

function formatDate(date: string) {
  return date.split('-').reverse().join('/');
}

export async function buscarProdutividade(_empresa: Empresa, inicio: string, fim: string, filial: string, signal?: AbortSignal): Promise<Dados> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Entre novamente para consultar a produtividade.');

  const params = new URLSearchParams({ cod_empresa_bi: '10041', data_ini: inicio, data_fim: fim });
  if (filial) params.set('cod_empresa', filial);
  const response = await fetch('/api/produtividade/diario?' + params, {
    signal, cache: 'no-store', headers: { Authorization: 'Bearer ' + token },
  });
  if (!response.ok || response.headers.get('x-proxy-upstream-error') === 'true') {
    throw new Error('Não foi possível consultar a produtividade (HTTP ' + response.status + ').');
  }
  const result = await response.json() as Dados;
  const filialPermitida = (id: number) => [2, 3].includes(Number(id)) && (!filial || Number(id) === Number(filial));
  if (result.cod_empresa_bi !== 10041 || !Array.isArray(result.cod_empresas) ||
      result.cod_empresas.some(id => !filialPermitida(id)) || !result.resumo || !Array.isArray(result.por_dia_responsavel) ||
      result.por_dia_responsavel.some(row => Number(row.cod_empresa_bi) !== 10041 || !filialPermitida(row.cod_empresa))) {
    throw new Error('A resposta não corresponde à Casa Chevrolet selecionada.');
  }
  return result;
}

function FiltrosProdutividade({ value, onApply }: { value: Filtros; onApply: (filtros: Filtros) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const defaults = filtrosIniciais();
  const hasPeriod = value.inicio !== defaults.inicio || value.fim !== defaults.fim;
  const activeCount = Number(hasPeriod) + Number(Boolean(value.filial));
  const valid = Boolean(draft.inicio && draft.fim && draft.inicio <= draft.fim);

  return (
    <Popover open={open} onOpenChange={next => {
      if (next) setDraft(value);
      setOpen(next);
    }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-2">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filtros{activeCount > 0 && ' (' + activeCount + ')'}
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label="Filtros de produtividade" align="end" className="operational-overlay w-[min(92vw,24rem)] p-3">
        <form className="space-y-3" onSubmit={event => {
          event.preventDefault();
          if (!valid) return;
          onApply(draft);
          setOpen(false);
        }}>
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="produtividade-inicio" className="text-xs">Data inicial</Label>
              <Input id="produtividade-inicio" required type="date" value={draft.inicio} className="h-8 min-w-0 px-2 text-sm"
                onChange={event => setDraft(current => ({ ...current, inicio: event.target.value }))} />
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor="produtividade-fim" className="text-xs">Data final</Label>
              <Input id="produtividade-fim" required type="date" value={draft.fim} className="h-8 min-w-0 px-2 text-sm"
                onChange={event => setDraft(current => ({ ...current, fim: event.target.value }))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="produtividade-filial" className="text-xs">Filial</Label>
            <select id="produtividade-filial" value={draft.filial} className="block h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              onChange={event => setDraft(current => ({ ...current, filial: event.target.value }))}>
              <option value="">Todas</option>
              <option value="2">Filial 2</option>
              <option value="3">Filial 3</option>
            </select>
          </div>
          {!valid && <p role="alert" className="text-xs text-destructive">Informe um período com data inicial anterior ou igual à final.</p>}
          <div className="flex justify-end gap-2 border-t pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(filtrosIniciais())}>Limpar</Button>
            <Button type="submit" size="sm" disabled={!valid}>Aplicar</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export default function ProdutividadePage() {
  const { empresa, isLoading } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();
  const companhia = resolveCodEmpresaBiParam(empresa, filialAtiva);
  const [filters, setFilters] = useState(filtrosIniciais);
  const [activeTab, setActiveTab] = useState(overviewTab);
  const [collaborator, setCollaborator] = useState<ProdutividadeColaborador | null>(null);
  const activityPanel = useRef<HTMLElement>(null);
  const focusActivity = useRef(false);
  const { inicio, fim, filial } = filters;
  const query = useQuery({
    queryKey: ['produtividade-chevrolet', empresa?.id, companhia, inicio, fim, filial],
    queryFn: ({ signal }) => buscarProdutividade(empresa!, inicio, fim, filial, signal),
    enabled: !!empresa && companhia === '10041',
    staleTime: 30_000,
    retry: false,
  });

  useEffect(() => {
    if (activeTab === activityTab && focusActivity.current) {
      activityPanel.current?.focus();
      focusActivity.current = false;
    }
  }, [activeTab]);

  function openCollaboratorActivity(person: ProdutividadeColaborador) {
    focusActivity.current = true;
    setCollaborator(person);
    setActiveTab(activityTab);
  }

  if (isLoading) return <LoadingState message="Carregando empresa" />;
  if (companhia !== '10041') {
    return <main className="p-4 text-sm text-muted-foreground" aria-label="Produtividade diária">Selecione a Casa Chevrolet para consultar a produtividade.</main>;
  }

  const periodo = inicio === fim ? formatDate(inicio) : formatDate(inicio) + ' a ' + formatDate(fim);
  return (
    <main className="operational-dashboard flex h-full min-h-0 min-w-0 flex-col overflow-auto" aria-label="Produtividade diária">
      <div className="operational-workspace-header flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b bg-card px-2 py-1 sm:px-3">
        <PelegriniTabs ariaLabel="Visões de produtividade" className="estoque-tabs min-w-0 grow basis-full sm:basis-0"
          value={activeTab} onValueChange={setActiveTab}
          items={[
            { value: overviewTab, label: 'Visão geral' },
            { value: activityTab, label: 'Atividades por dia e responsável' },
          ]} />
        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          <div className="text-xs text-muted-foreground" aria-live="polite">
            <span className="font-medium tabular-nums text-foreground">{periodo} · {filial ? 'Filial ' + filial : 'Todas as filiais'}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <FiltrosProdutividade value={filters} onApply={setFilters} />
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" title="Atualizar dados"
              aria-label="Atualizar dados" disabled={query.isFetching} onClick={() => void query.refetch()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
      {query.isLoading && <LoadingState message="Carregando produtividade" variant="content" />}
      {query.isError && <ErrorState message={query.error instanceof Error ? query.error.message : 'Não foi possível consultar os dados.'} onRetry={() => query.refetch()} />}
      <section id={'pelegrini-tabpanel-' + overviewTab} aria-labelledby={'pelegrini-tab-' + overviewTab}
        role="tabpanel" tabIndex={0} hidden={activeTab !== overviewTab}
        className={activeTab === overviewTab ? 'flex flex-1 flex-col gap-2 p-2 outline-none sm:p-3' : 'hidden'}>
        {activeTab === overviewTab && query.data && (
          <ProdutividadeDashboard key={[inicio, fim, filial].join('|')} rows={query.data.por_dia_responsavel}
            resumo={query.data.resumo} onCollaborator={openCollaboratorActivity} />
        )}
      </section>
      <section id={'pelegrini-tabpanel-' + activityTab} aria-labelledby={'pelegrini-tab-' + activityTab}
        ref={activityPanel} role="tabpanel" tabIndex={0} hidden={activeTab !== activityTab} className="p-2 outline-none sm:p-3">
        {activeTab === activityTab && query.data && (
          <ProdutividadeAtividades rows={query.data.por_dia_responsavel} periodo={filters}
            collaborator={collaborator} onClearCollaborator={() => setCollaborator(null)} />
        )}
      </section>
    </main>
  );
}
