import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { resolveCodEmpresaBiParam } from '@/utils/filialEndpoint';
import { supabase } from '@/integrations/supabase/client';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import type { Empresa } from '@/hooks/useEmpresaConfig';

type Linha = { data_atividade: string; cod_empresa_bi: number; cod_empresa: number; identificacao_responsavel: string; nome_responsavel: string; pedidos_separados: number; unidades_separadas: number; pedidos_conferidos: number; unidades_pedidos_marcados_conferidos: number; unidades_conferidas_registradas: number; notas_lancadas: number; unidades_guardadas: number };
type Dados = { cod_empresa_bi: number; cod_empresas: number[]; atualizado_em: string; resumo: { pedidos_separados: number; unidades_separadas: number; pedidos_conferidos: number; unidades_pedidos_marcados_conferidos: number; unidades_conferidas_registradas: number; notas_lancadas: number; unidades_guardadas: number; notas_guarda_consideradas: number; notas_guarda_concluidas: number; nivel_servico_guarda_pct: number | null }; por_dia_responsavel: Linha[] };
const numero = (n: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(n);
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

export async function buscarProdutividade(_empresa: Empresa, inicio: string, fim: string, filial: string, signal?: AbortSignal): Promise<Dados> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Entre novamente para consultar a produtividade.');
  const params = new URLSearchParams({ cod_empresa_bi: '10041', data_ini: inicio, data_fim: fim });
  if (filial) params.set('cod_empresa', filial);
  const response = await fetch(`/api/produtividade/diario?${params}`, {
    signal, cache: 'no-store', headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok || response.headers.get('x-proxy-upstream-error') === 'true') throw new Error(`Não foi possível consultar a produtividade (HTTP ${response.status}).`);
  const result = await response.json() as Dados;
  if (result.cod_empresa_bi !== 10041 || !Array.isArray(result.cod_empresas) || result.cod_empresas.some(x => ![2,3].includes(Number(x)) || (filial && Number(x) !== Number(filial))) || !Array.isArray(result.por_dia_responsavel) || !result.resumo || result.por_dia_responsavel.some(x => Number(x.cod_empresa_bi) !== 10041 || ![2,3].includes(Number(x.cod_empresa)) || (filial && Number(x.cod_empresa) !== Number(filial)))) throw new Error('A resposta não corresponde à Casa Chevrolet selecionada.');
  return result;
}

export default function ProdutividadePage() {
  const { empresa, isLoading } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();
  const companhia = resolveCodEmpresaBiParam(empresa, filialAtiva);
  const [inicio, setInicio] = useState(hoje);
  const [fim, setFim] = useState(hoje);
  const [filial, setFilial] = useState('');
  const intervalo = Math.round((Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86400000);
  const valido = Number.isFinite(intervalo) && intervalo >= 0;
  const query = useQuery({ queryKey: ['produtividade-chevrolet', empresa?.id, companhia, inicio, fim, filial], queryFn: ({ signal }) => buscarProdutividade(empresa!, inicio, fim, filial, signal), enabled: !!empresa && companhia === '10041' && valido, staleTime: 30000, retry: false });
  if (isLoading) return <LoadingState message="Carregando empresa" />;
  if (companhia !== '10041') return <main className="p-4"><h1 className="text-xl font-semibold">Produtividade diária</h1><p className="mt-2 text-muted-foreground">Selecione a Casa Chevrolet para consultar a produtividade.</p></main>;
  const r = query.data?.resumo;
  const cards = r ? [
    ['Pedidos separados', numero(r.pedidos_separados)], ['Unidades separadas', numero(r.unidades_separadas)],
    ['Pedidos conferidos', numero(r.pedidos_conferidos)], ['Unidades dos pedidos conferidos', numero(r.unidades_pedidos_marcados_conferidos)],
    ['Unidades registradas por leitura', numero(r.unidades_conferidas_registradas)], ['Notas de compra lançadas', numero(r.notas_lancadas)],
    ['Unidades guardadas', numero(r.unidades_guardadas)], ['Guarda concluída', r.nivel_servico_guarda_pct == null ? 'Sem notas elegíveis' : `${numero(r.nivel_servico_guarda_pct)}%`],
  ] : [];
  return <main className="h-full overflow-auto p-4 space-y-4" aria-label="Produtividade diária">
    <header><h1 className="text-xl font-semibold">Produtividade diária</h1><p className="text-sm text-muted-foreground">Casa Chevrolet · dados do RSYS</p></header>
    <div className="flex flex-wrap gap-3 items-end rounded border bg-card p-3">
      <label className="text-sm">Data inicial<input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="block rounded border bg-background p-2" /></label>
      <label className="text-sm">Data final<input type="date" value={fim} onChange={e => setFim(e.target.value)} className="block rounded border bg-background p-2" /></label>
      <label className="text-sm">Filial<select value={filial} onChange={e => setFilial(e.target.value)} className="block rounded border bg-background p-2"><option value="">Todas</option><option value="2">Filial 2</option><option value="3">Filial 3</option></select></label>
      <button type="button" onClick={() => query.refetch()} disabled={!valido || query.isFetching} className="rounded border px-3 py-2 text-sm">Atualizar</button>
    </div>
    {!valido && <p role="alert" className="text-destructive">A data inicial deve ser anterior ou igual à data final.</p>}
    {valido && query.isLoading && <LoadingState message="Carregando produtividade" variant="content" />}
    {valido && query.isError && <ErrorState message={query.error instanceof Error ? query.error.message : 'Não foi possível consultar os dados.'} onRetry={() => query.refetch()} />}
    {valido && query.data && r && <>
      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">{cards.map(([label,value]) => <div key={label} className="rounded border bg-card p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}</div>
      <p className="text-sm text-muted-foreground">Guarda: {numero(r.notas_guarda_concluidas)} de {numero(r.notas_guarda_consideradas)} notas elegíveis concluídas. O cálculo usa a situação atual das notas lançadas no período, sem prazo.</p>
      <p className="text-sm text-muted-foreground">As unidades dos pedidos marcados conferidos usam a quantidade atendida atual. As unidades por leitura são apenas as registradas no log de conferência.</p>
      <div className="overflow-x-auto rounded border bg-card"><table className="w-full min-w-[1050px] text-sm text-left"><caption className="p-3 text-left font-semibold">Atividades por dia e responsável</caption><thead><tr className="border-b">{['Data','Filial','Responsável','Pedidos separados','Unidades separadas','Pedidos conferidos','Unidades dos pedidos','Unidades por leitura','Notas lançadas','Unidades guardadas'].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{query.data.por_dia_responsavel.map(row => <tr key={`${row.data_atividade}-${row.cod_empresa}-${row.identificacao_responsavel}`} className="border-b"><td className="p-2 whitespace-nowrap">{row.data_atividade.split('-').reverse().join('/')}</td><td className="p-2">{row.cod_empresa}</td><td className="p-2">{row.nome_responsavel}<span className="block text-xs text-muted-foreground">{row.identificacao_responsavel}</span></td>{[row.pedidos_separados,row.unidades_separadas,row.pedidos_conferidos,row.unidades_pedidos_marcados_conferidos,row.unidades_conferidas_registradas,row.notas_lancadas,row.unidades_guardadas].map((n,i) => <td key={i} className="p-2">{numero(n)}</td>)}</tr>)}</tbody></table>{query.data.por_dia_responsavel.length === 0 && <p className="p-4">Nenhuma atividade encontrada no período.</p>}</div>
      <p className="text-xs text-muted-foreground">Atualizado em {new Date(query.data.atualizado_em).toLocaleString('pt-BR')}. Totais de pedidos são distintos no período; as linhas são agrupadas por dia e responsável.</p>
    </>}
  </main>;
}
