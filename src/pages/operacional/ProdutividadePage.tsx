import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, RefreshCw, SlidersHorizontal } from 'lucide-react';

import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { ProdutividadeDashboard, type ProdutividadeLinha, type ProdutividadeResumo } from '@/components/operacional/ProdutividadeDashboard';
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

type Filtros = { inicio: string; fim: string; filial: string };

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

function filtrosIniciais(): Filtros {
  const date = new Date();
  const hoje = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(value => String(value).padStart(2, '0')).join('-');
  return { inicio: hoje, fim: hoje, filial: '' };
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

const columns = [
  ['pedidos_separados', 'Pedidos separados'],
  ['unidades_separadas', 'Unidades separadas'],
  ['pedidos_conferidos', 'Pedidos conferidos'],
  ['unidades_pedidos_marcados_conferidos', 'Unidades dos pedidos'],
  ['unidades_conferidas_registradas', 'Unidades por leitura'],
  ['notas_lancadas', 'Notas lançadas'],
  ['unidades_guardadas', 'Unidades guardadas'],
] as const;

function Atividades({ linhas }: { linhas: ProdutividadeLinha[] }) {
  return (
    <details className="group rounded-lg border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
        Atividades por dia e responsável
      </summary>
      {linhas.length === 0 ? <p className="border-t p-3 text-sm text-muted-foreground">Nenhuma atividade encontrada no período.</p> : (
        <div className="overflow-x-auto border-t">
          <table className="w-full min-w-[880px] text-left text-xs" aria-label="Atividades por dia e responsável">
            <thead className="bg-muted/40">
              <tr>
                {['Data', 'Filial', 'Responsável', ...columns.map(([, label]) => label)].map(label => <th key={label} scope="col" className="px-3 py-2 font-medium">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {linhas.map(row => (
                <tr key={[row.data_atividade, row.cod_empresa, row.identificacao_responsavel].join('|')} className="border-t">
                  <td className="whitespace-nowrap px-3 py-2">{formatDate(row.data_atividade)}</td>
                  <td className="px-3 py-2">{row.cod_empresa}</td>
                  <td className="px-3 py-2">{row.nome_responsavel}<span className="block text-muted-foreground">{row.identificacao_responsavel}</span></td>
                  {columns.map(([key]) => <td key={key} className="px-3 py-2 tabular-nums">{numero.format(row[key])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

export default function ProdutividadePage() {
  const { empresa, isLoading } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();
  const companhia = resolveCodEmpresaBiParam(empresa, filialAtiva);
  const [filters, setFilters] = useState(filtrosIniciais);
  const { inicio, fim, filial } = filters;
  const query = useQuery({
    queryKey: ['produtividade-chevrolet', empresa?.id, companhia, inicio, fim, filial],
    queryFn: ({ signal }) => buscarProdutividade(empresa!, inicio, fim, filial, signal),
    enabled: !!empresa && companhia === '10041',
    staleTime: 30_000,
    retry: false,
  });

  if (isLoading) return <LoadingState message="Carregando empresa" />;
  if (companhia !== '10041') {
    return <main className="p-4 text-sm text-muted-foreground" aria-label="Produtividade diária">Selecione a Casa Chevrolet para consultar a produtividade.</main>;
  }

  const periodo = inicio === fim ? formatDate(inicio) : formatDate(inicio) + ' a ' + formatDate(fim);
  const atualizado = query.data?.atualizado_em ? new Date(query.data.atualizado_em) : null;
  return (
    <main className="h-full space-y-2 overflow-auto p-2 sm:p-3" aria-label="Produtividade diária">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground" aria-live="polite">
          <span className="font-medium text-foreground">{periodo} · {filial ? 'Filial ' + filial : 'Todas as filiais'}</span>
          {atualizado && !Number.isNaN(atualizado.getTime()) && (
            <span title={atualizado.toLocaleString('pt-BR')}>Atualizado às {atualizado.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <FiltrosProdutividade value={filters} onApply={setFilters} />
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" title="Atualizar dados"
            aria-label="Atualizar dados" disabled={query.isFetching} onClick={() => void query.refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      {query.isLoading && <LoadingState message="Carregando produtividade" variant="content" />}
      {query.isError && <ErrorState message={query.error instanceof Error ? query.error.message : 'Não foi possível consultar os dados.'} onRetry={() => query.refetch()} />}
      {query.data && <>
        <ProdutividadeDashboard key={[inicio, fim, filial].join('|')} rows={query.data.por_dia_responsavel} resumo={query.data.resumo} />
        <Atividades linhas={query.data.por_dia_responsavel} />
      </>}
    </main>
  );
}
