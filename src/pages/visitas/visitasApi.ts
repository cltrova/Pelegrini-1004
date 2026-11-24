import { supabase } from '@/integrations/supabase/client';

export type Visita = {
  cod_empresa_bi: string;
  filial_id: string;
  nome_cliente: string;
  data_visita: string;
  cnpj: string;
  cidade: string;
  segmento: string;
  diesel: string;
  responsaveis_compras: string;
  funcao: string;
  avaliacoes: Record<string, string[]>;
};

type Relatorio = Visita & { id: string; visitador_nome: string };
type Pagina = { relatorios: Relatorio[]; total: number };
const rota = '/operacional/visitas/relatorios';

async function request<T>(usuario: string, path: string, init: RequestInit, status: number): Promise<T> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token || session.user.id !== usuario) {
    throw new Error('Sua sessão do Pelegrini expirou. Entre novamente.');
  }
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${session.access_token}`);
  const response = await fetch(path, { ...init, headers, credentials: 'omit', cache: 'no-store' });
  if (response.status !== status) {
    if (response.status === 401) throw new Error('Sua sessão do Pelegrini expirou. Entre novamente.');
    if (response.status === 403) throw new Error('Seu perfil não tem acesso à empresa ou à filial selecionada.');
    throw new Error('Não foi possível acessar os relatórios de visitas.');
  }
  return response.json() as Promise<T>;
}

export async function enviarVisita(usuario: string, payload: Visita) {
  const result = await request<{ id: string }>(usuario, rota, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }, 201);
  if (typeof result.id !== 'string' || !result.id) throw new Error('A API não confirmou a gravação.');
  return result.id;
}

export async function listarVisitas(usuario: string, params: URLSearchParams, signal: AbortSignal) {
  const result = await request<Pagina>(usuario, `${rota}?${params}`, { signal }, 200);
  if (!Array.isArray(result.relatorios) || !Number.isInteger(result.total) || result.total < 0) {
    throw new Error('Resposta inválida ao consultar os relatórios.');
  }
  return { rows: result.relatorios, total: result.total };
}


export type SessaoVisitas = {
  id: string;
  perfil: 'visitador' | 'gerencial';
  filiais: { cod_empresa_bi: string; filial_id: string }[];
};

export async function consultarSessaoVisitas(usuario: string, signal: AbortSignal) {
  const result = await request<SessaoVisitas>(usuario, '/operacional/visitas/sessao', { signal }, 200);
  if (result.id !== usuario || !Array.isArray(result.filiais)) throw new Error('Identidade de Visitas inválida.');
  return result;
}
