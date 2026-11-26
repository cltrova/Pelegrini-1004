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

async function request<T>(path: string, init: RequestInit, status: number, fallback?: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  const response = await fetch(path, { ...init, headers, credentials: headers.has('Authorization') ? 'omit' : 'same-origin', cache: 'no-store' });
  if (response.status !== status) {
    if (response.status === 401) throw new VisitasAuthError('Sua sessão expirou. Entre novamente.');
    if (fallback) {
      const body = await response.json().catch(() => null);
      throw new Error(typeof body?.detail === 'string' ? body.detail : fallback);
    }
    if (response.status === 403) throw new Error('Seu perfil não tem acesso à empresa ou à filial selecionada.');
    if (response.status === 409) throw new Error('Confira o perfil e as filiais salvas no Comercial.');
    throw new Error('Não foi possível acessar os relatórios de visitas.');
  }
  return status === 204 ? undefined as T : response.json() as Promise<T>;
}

const visitadores = '/operacional/visitas/visitadores';
export type CadastroVisitador = { nome: string; email: string; cod_empresa_bi: string; filiais: string[] };
export type VisitadorCadastrado = CadastroVisitador & { id: string };
type CredencialTemporaria = { id: string; senha_temporaria: string };

export function cadastrarVisitador(payload: CadastroVisitador, accessToken: string) {
  return request<CredencialTemporaria>(visitadores, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, 201, 'Não foi possível cadastrar o visitador. Confira o e-mail e as filiais.');
}

export async function listarVisitadores(accessToken: string, signal: AbortSignal) {
  const data = await request<{ visitadores: VisitadorCadastrado[] }>(visitadores, {
    headers: { Authorization: `Bearer ${accessToken}` }, signal,
  }, 200, 'Não foi possível carregar os visitadores.');
  if (!Array.isArray(data.visitadores)) throw new Error('Resposta inválida ao consultar os visitadores.');
  return data.visitadores;
}

export function redefinirSenhaVisitador(id: string, accessToken: string) {
  return request<CredencialTemporaria>(`${visitadores}/${encodeURIComponent(id)}/senha`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}` },
  }, 200, 'Não foi possível gerar a senha temporária.');
}

export function confirmarGerenciaVisitas(
  payload: { usuario_id: string; cod_empresa_bi: string; filiais: string[] },
  accessToken: string,
) {
  return request<void>('/operacional/visitas/gerencia/permissoes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, 204);
}

export async function enviarVisita(payload: Visita) {
  const result = await request<{ id: string }>(rota, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }, 201);
  if (typeof result.id !== 'string' || !result.id) throw new Error('A API não confirmou a gravação.');
  return result.id;
}

export async function listarVisitas(params: URLSearchParams, signal: AbortSignal, accessToken?: string) {
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
  const result = await request<Pagina>(`${rota}?${params}`, { signal, headers }, 200);
  if (!Array.isArray(result.relatorios) || !Number.isInteger(result.total) || result.total < 0) {
    throw new Error('Resposta inválida ao consultar os relatórios.');
  }
  return { rows: result.relatorios, total: result.total };
}

export type StatusOficina = 'visitada' | 'sem_visita' | 'a_conferir';

type Oficina = {
  id: string;
  cnpj: string | null;
  nome: string;
  razao_social: string | null;
  bairro: string | null;
  status: StatusOficina;
  ultima_visita: string | null;
  origem: 'receita' | 'historico';
};

type PaginaOficinas = {
  catalogo: { uf: string; cidade: string; competencia: string; fonte: string };
  oficinas: Oficina[];
  total: number;
};

export type CarregarOficinas = (params: URLSearchParams, signal: AbortSignal) => Promise<PaginaOficinas>;

export async function listarOficinas(params: URLSearchParams, signal: AbortSignal, accessToken: string) {
  const fallback = 'Não foi possível consultar as oficinas.';
  try {
    const data = await request<PaginaOficinas>(`/operacional/visitas/oficinas?${params}`, {
      signal, headers: { Authorization: `Bearer ${accessToken}` },
    }, 200, fallback);
    if (!data.catalogo?.cidade || !data.catalogo.uf || !Array.isArray(data.oficinas)
        || !Number.isInteger(data.total) || data.total < 0) throw new Error(fallback);
    return data;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(fallback);
    throw error;
  }
}


class VisitasAuthError extends Error {}

export type SessaoVisitas = {
  id: string;
  nome: string;
  perfil: 'visitador' | 'gerencial';
  filiais: { cod_empresa_bi: string; filial_id: string }[];
  troca_senha_pendente?: boolean;
};

const sessao = '/operacional/visitas/sessao';

export async function consultarSessaoVisitas(accessToken?: string, signal?: AbortSignal) {
  try {
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
    return await request<SessaoVisitas>(sessao, { signal, headers }, 200);
  } catch (error) {
    if (error instanceof VisitasAuthError) return null;
    throw error;
  }
}

export async function entrarVisitas(email: string, senha: string, signal?: AbortSignal) {
  try {
    return await request<SessaoVisitas>(sessao, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha }), signal,
    }, 200);
  } catch (error) {
    if (error instanceof VisitasAuthError) throw new Error('E-mail ou senha inválidos.');
    throw error;
  }
}

export function trocarSenhaVisitas(senha: string) {
  return request<SessaoVisitas>(`${sessao}/senha`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senha }),
  }, 200, 'Não foi possível salvar a senha. Use de 12 a 256 caracteres.');
}

export const sairVisitas = () => request<void>(sessao, { method: 'DELETE' }, 204);
