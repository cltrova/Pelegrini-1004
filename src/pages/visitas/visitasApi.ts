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

async function request<T>(path: string, init: RequestInit, status: number): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin', cache: 'no-store' });
  if (response.status !== status) {
    if (response.status === 401) throw new VisitasAuthError('Sua sessão expirou. Entre novamente.');
    if (response.status === 403) throw new Error('Seu perfil não tem acesso à empresa ou à filial selecionada.');
    throw new Error('Não foi possível acessar os relatórios de visitas.');
  }
  return status === 204 ? undefined as T : response.json() as Promise<T>;
}

export async function enviarVisita(payload: Visita) {
  const result = await request<{ id: string }>(rota, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }, 201);
  if (typeof result.id !== 'string' || !result.id) throw new Error('A API não confirmou a gravação.');
  return result.id;
}

export async function listarVisitas(params: URLSearchParams, signal: AbortSignal) {
  const result = await request<Pagina>(`${rota}?${params}`, { signal }, 200);
  if (!Array.isArray(result.relatorios) || !Number.isInteger(result.total) || result.total < 0) {
    throw new Error('Resposta inválida ao consultar os relatórios.');
  }
  return { rows: result.relatorios, total: result.total };
}


class VisitasAuthError extends Error {}

export type SessaoVisitas = {
  id: string;
  nome: string;
  perfil: 'visitador' | 'gerencial';
  filiais: { cod_empresa_bi: string; filial_id: string }[];
};

const sessao = '/operacional/visitas/sessao';

export async function consultarSessaoVisitas() {
  try {
    return await request<SessaoVisitas>(sessao, {}, 200);
  } catch (error) {
    if (error instanceof VisitasAuthError) return null;
    throw error;
  }
}

export async function entrarVisitas(email: string, senha: string) {
  try {
    return await request<SessaoVisitas>(sessao, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha }),
    }, 200);
  } catch (error) {
    if (error instanceof VisitasAuthError) throw new Error('E-mail ou senha inválidos.');
    throw error;
  }
}

export const sairVisitas = () => request<void>(sessao, { method: 'DELETE' }, 204);
