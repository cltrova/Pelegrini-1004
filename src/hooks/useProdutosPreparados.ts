import { useEffect, useState } from 'react';
import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query';
import { getDefaultFilters } from '@/components/comercial/comercialFiltersLogic';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { ComercialFilters } from '@/types/comercial';
import type { CategoriaAgg, MarcaAgg, ProdutoSemGiro, ResumoVendaLinha, TopProdutoAgg } from '@/types/comercialProdutos';
import { getFiltroVendedoresChevrolet10041 } from '@/utils/vendedores1004';

const rota = '/api/comercial/preparado/produtos';
const limiteIdade = 60_000;
export const tamanhoPaginaProdutos = 50;

export type ProdutoDetalhesPreparados = {
  receita: number;
  custo: number;
  lucro: number;
  margem: number;
  pedidos: number;
  topClientes: { nome: string; receita: number; pedidos: number }[];
  evolucaoMensal: { mes: string; valor: number }[];
  ultimasNFs: ResumoVendaLinha[];
};

type VisaoGeral = {
  porMarca: MarcaAgg[];
  totalMarcas: number;
  totalSkus: number;
  totalSkusVisiveis: number;
  semGiro: number;
  encontrouDados: boolean;
};

export type RankingPreparado = {
  produtos: TopProdutoAgg[];
  total: number;
  somaReceita: number;
  somaQuantidade: number;
};

type Abas = {
  marcas: VisaoGeral;
  top: RankingPreparado;
  categoria: { categorias: CategoriaAgg[] };
  'sem-giro': { produtos: ProdutoSemGiro[]; total: number };
  resumo: { linhas: ResumoVendaLinha[]; total: number };
  produto: ProdutoDetalhesPreparados;
  filtros: { anos: string[]; vendedores: { codigo: string; nome: string }[] };
};

type Resposta<T> = T & { versao: string; origem: string };
export type AbaProdutos = 'marcas' | 'top' | 'categoria' | 'sem-giro' | 'resumo';

class ConsultaProdutosErro extends Error {
  constructor(readonly status: number) {
    super('Não foi possível obter uma leitura atual dos produtos.');
  }
}

export function dadosProdutosAtuais(origem: string, agora = Date.now()) {
  const idade = agora - Date.parse(origem);
  return Number.isFinite(idade) && idade >= 0 && idade < limiteIdade;
}

async function carregar<T>(url: string, usuario: string, signal: AbortSignal): Promise<Resposta<T>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user.id !== usuario) throw new ConsultaProdutosErro(401);
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json', Authorization: `Bearer ${session.access_token}` },
    signal,
  });
  if (!response.ok) throw new ConsultaProdutosErro(response.status);
  const dados = await response.json() as Resposta<T>;
  const origem = response.headers.get('X-Data-As-Of');
  if (origem !== dados.origem || response.headers.get('X-Data-Version') !== dados.versao ||
    !dadosProdutosAtuais(dados.origem)) throw new ConsultaProdutosErro(503);
  return dados;
}

function paramsDaConsulta(empresa: string | undefined, filtros: ComercialFilters) {
  const params = new URLSearchParams(empresa ? { cod_empresa_bi: empresa } : undefined);
  if (filtros.periodo?.inicio) params.set('inicio', filtros.periodo.inicio);
  if (filtros.periodo?.fim) params.set('fim', filtros.periodo.fim);
  if (filtros.tipo === 'DEVOLUCAO') params.set('movimento', '1');
  if (filtros.tipo === 'PEDIDO') params.set('movimento', '2');
  const selecionados = (filtros.vendedores?.length ? filtros.vendedores : filtros.vendedor ? [filtros.vendedor] : [])
    .map(String).filter(Boolean);
  const vendedores = empresa === '10041' ? getFiltroVendedoresChevrolet10041(selecionados, empresa) : selecionados;
  if (vendedores?.length) params.set('vendedores', JSON.stringify(vendedores));
  return params;
}

function consultaVisao(usuario: string | undefined, consulta: string) {
  return queryOptions({
    queryKey: ['produtos-preparados', usuario, consulta, 'marcas'],
    queryFn: ({ signal }) => carregar<Abas['marcas']>(`${rota}?${consulta}&painel=marcas`, usuario!, signal),
    staleTime: 5_000,
    retry: false,
  });
}

export function anteciparProdutosPreparados(client: QueryClient, usuario: string, filial: string | null) {
  if (filial !== 'transmissao' && filial !== 'chevrolet') return;
  const empresa = filial === 'transmissao' ? '1004' : '10041';
  void client.prefetchQuery(consultaVisao(usuario, paramsDaConsulta(empresa, getDefaultFilters()).toString()));
}

type Parametros = {
  empresa?: string;
  filtros: ComercialFilters;
  aba: AbaProdutos;
  busca: string;
  marca: string | null;
  tipo: 'receitas' | 'devolucoes';
  pagina: number;
  abrirFiltros: boolean;
  codigoDetalhe: string | null;
  paginaRanking: number;
  buscaRanking: string;
};

export function useProdutosPreparados({ empresa, filtros, aba, busca, marca, tipo, pagina, abrirFiltros,
  codigoDetalhe, paginaRanking, buscaRanking }: Parametros) {
  const { user } = useAuth();
  const usuario = user?.id;
  const enabled = !!empresa && !!usuario;
  const [buscaAdiada, setBuscaAdiada] = useState(busca);
  const [buscaRankingAdiada, setBuscaRankingAdiada] = useState(buscaRanking);
  useEffect(() => {
    const timer = window.setTimeout(() => setBuscaAdiada(busca), 200);
    return () => window.clearTimeout(timer);
  }, [busca]);
  useEffect(() => {
    const timer = window.setTimeout(() => setBuscaRankingAdiada(buscaRanking), 200);
    return () => window.clearTimeout(timer);
  }, [buscaRanking]);

  const params = paramsDaConsulta(empresa, filtros);
  const base = params.toString();
  if (buscaAdiada.trim()) params.set('busca', buscaAdiada.trim().slice(0, 160));
  if (marca) params.set('marca', marca);
  const consulta = params.toString();

  const overview = useQuery({
    ...consultaVisao(usuario, consulta),
    enabled,
    refetchInterval: 20_000,
  });
  const versao = overview.data?.versao;
  const activeParams = new URLSearchParams(consulta);
  if (versao) activeParams.set('versao', versao);
  if (aba === 'resumo' || aba === 'top') {
    activeParams.set('limit', String(tamanhoPaginaProdutos));
    activeParams.set('offset', String((aba === 'top' ? paginaRanking : pagina) * tamanhoPaginaProdutos));
    if (aba === 'resumo') activeParams.set('tipo', tipo === 'devolucoes' ? '1' : '2');
    else if (buscaRankingAdiada.trim()) activeParams.set('busca_top', buscaRankingAdiada.trim().slice(0, 160));
  }
  const tab = useQuery({
    queryKey: ['produtos-preparados', usuario, activeParams.toString(), aba],
    queryFn: ({ signal }) => carregar<Abas[Exclude<AbaProdutos, 'marcas'>]>(
      `${rota}?${activeParams}&painel=${aba}`, usuario!, signal),
    enabled: enabled && !!versao && aba !== 'marcas',
    retry: false,
    refetchInterval: 20_000,
  });
  const opcoes = useQuery({
    queryKey: ['produtos-preparados-filtros', usuario, empresa, versao],
    queryFn: ({ signal }) => carregar<Abas['filtros']>(
      `${rota}?cod_empresa_bi=${empresa}&painel=filtros`, usuario!, signal),
    enabled: enabled && abrirFiltros,
    retry: false,
    refetchInterval: 20_000,
  });
  const detalhesParams = new URLSearchParams(base);
  if (versao) detalhesParams.set('versao', versao);
  if (codigoDetalhe) detalhesParams.set('codigo', codigoDetalhe);
  const detalhe = useQuery({
    queryKey: ['produtos-preparados-detalhe', usuario, detalhesParams.toString()],
    queryFn: ({ signal }) => carregar<Abas['produto']>(`${rota}?${detalhesParams}&painel=produto`, usuario!, signal),
    enabled: enabled && !!versao && aba === 'top' && !!codigoDetalhe,
    retry: false,
    refetchInterval: 20_000,
  });

  // Expire each visible response even if refreshing fails or the user leaves the tab open.
  const [, relogio] = useState(0);
  const origens = [overview.data?.origem, tab.data?.origem, opcoes.data?.origem, detalhe.data?.origem];
  const proximoVencimento = Math.min(...origens.filter((x): x is string => !!x && dadosProdutosAtuais(x))
    .map((x) => Date.parse(x) + limiteIdade));
  useEffect(() => {
    const atualizar = () => relogio((x) => x + 1);
    const timeout = Number.isFinite(proximoVencimento)
      ? window.setTimeout(atualizar, Math.max(0, proximoVencimento - Date.now())) : undefined;
    document.addEventListener('visibilitychange', atualizar);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, [proximoVencimento]);
  useEffect(() => {
    if (tab.error instanceof ConsultaProdutosErro && tab.error.status === 409 ||
        detalhe.error instanceof ConsultaProdutosErro && detalhe.error.status === 409) void overview.refetch();
  }, [tab.error, detalhe.error, overview.refetch]);
  const atual = <T,>(value: Resposta<T> | undefined, erro: Error | null) => enabled && value
    && !(erro instanceof ConsultaProdutosErro && [401, 403, 409].includes(erro.status)) && dadosProdutosAtuais(value.origem)
    ? value : undefined;
  const visao = atual(overview.data, overview.error);

  return {
    visao,
    tab: atual(tab.data, tab.error),
    opcoes: atual(opcoes.data, opcoes.error),
    detalhe: atual(detalhe.data, detalhe.error),
    carregando: overview.isPending || overview.isFetching || buscaAdiada !== busca,
    erro: overview.error ?? (overview.data && !visao ? new ConsultaProdutosErro(503) : null),
    erroAba: tab.error,
    erroDetalhe: detalhe.error,
    erroFiltros: opcoes.error,
    atualizar: () => void Promise.all([
      overview.refetch(),
      ...(aba !== 'marcas' ? [tab.refetch()] : []),
      ...(abrirFiltros ? [opcoes.refetch()] : []),
    ]),
  };
}
