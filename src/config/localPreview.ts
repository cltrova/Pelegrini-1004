import type { User } from '@supabase/supabase-js';
import type { Profile, AppRole } from '@/types/auth';
import type { Empresa } from '@/hooks/useEmpresaConfig';
import type { UserModulePermissions } from '@/hooks/useUserModulePermissions';

type EnvLike = Record<string, string | boolean | undefined>;
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export const LOCAL_PREVIEW_EMPRESA_STORAGE_KEY = 'pelegrini-local-preview-empresa';
export const LOCAL_PREVIEW_USERS_STORAGE_KEY = 'pelegrini-local-preview-users';
export const LOCAL_PREVIEW_ACTIVE_USER_STORAGE_KEY = 'pelegrini-local-preview-active-user';
export const LOCAL_PREVIEW_MOTIVOS_PERDA_STORAGE_KEY = 'pelegrini-local-preview-motivos-perda';

export interface LocalPreviewUserAccount {
  user: User;
  profile: Profile;
  roles: AppRole[];
  permissions: UserModulePermissions;
  tempPassword?: string;
}

export interface LocalPreviewUserInput {
  email: string;
  nome: string;
  role: AppRole;
  codEmpresaBi?: string | null;
  permissions?: UserModulePermissions;
  userId?: string;
  filialId?: string | null;
  filiaisPermitidas?: string[] | null;
}

export interface LocalPreviewMotivoPerdaRegistro {
  id: string;
  cod_empresa_bi: '10041';
  id_cotacao: string;
  motivo: string;
  observacao: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function isLocalPreviewEnabled(env: EnvLike = import.meta.env) {
  return env.VITE_LOCAL_PREVIEW !== 'false' && env.VITE_LOCAL_PREVIEW !== false;
}

export function createLocalPreviewPermissions(): UserModulePermissions {
  return {
    modulo_whatsapp: true,
    modulo_comercial: true,
    modulo_operacional: true,
    modulo_resumo: true,
    modulo_dre: true,
    modulo_variacao: true,
    modulo_assistente_ia: true,
  };
}

export function createLocalPreviewEmpresa(): Empresa {
  return {
    id: 'local-preview-pelegrini',
    cod_empresa_bi: '1004',
    nome: 'Pelegrini',
    endpoint_url: '',
    modulo_dre: true,
    modulo_variacao: true,
    modulo_comercial: true,
    modulo_assistente_ia: true,
    modulo_whatsapp: true,
    modulo_operacional: true,
    modulo_resumo: true,
    ativo: true,
    created_at: '2026-08-24T00:00:00.000Z',
    updated_at: '2026-08-24T00:00:00.000Z',
    possui_meta_vendedor: true,
    endpoint_path_dre: '/financeiro/dre',
    endpoint_path_variacao: '/financeiro/variacao',
    endpoint_path_comercial_pedidos: '/comercial/pedidos',
    endpoint_path_comercial_devolucoes: '/comercial/devolucoes',
    endpoint_path_comercial_produtos: '/comercial/produtos',
    endpoint_path_comercial_pedidos_ch: '/comercial/pedidos_ch',
    endpoint_path_comercial_devolucoes_ch: '/comercial/devolucoes_ch',
    endpoint_path_comercial_produtos_ch: '/comercial/produtos_ch',
    endpoint_path_comercial_cotacoes_abertas_ch: '/comercial/cotacoes_abertas_ch',
    endpoint_path_comercial_vendas_perdidas_ch: '/comercial/vendas_perdidas_ch',
    endpoint_path_comercial_totais: '/comercial/totais',
    endpoint_path_comercial_pedidos_total: '/comercial/pedidos/total',
    endpoint_path_comercial_devolucoes_total: '/comercial/devolucoes/total',
    endpoint_path_comercial_produtos_total: '/comercial/produtos/total',
    endpoint_path_comercial_agrupado: '/comercial/agrupado',
    endpoint_path_comercial_clientes_analise: '/comercial/clientes/analise',
    endpoint_path_estoque_giro: '/operacional/estoque/giro',
    endpoint_path_estoque_consolidado: '/operacional/estoque/consolidado',
    endpoint_path_estoque_detalhado: '/operacional/estoque/detalhado',
    endpoint_path_resumo: '/financeiro/resumo',
    endpoint_path_duplicatas: '/financeiro/duplicatas',
    usar_vps_intermediaria: true,
    vps_base_url: 'http://187.77.203.16',
    vps_cliente_identificador: 'pelegrini',
  };
}

function getLocalStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

export function readLocalPreviewEmpresa(storage?: StorageLike): Empresa {
  const baseEmpresa = createLocalPreviewEmpresa();
  const targetStorage = getLocalStorage(storage);
  if (!targetStorage) return baseEmpresa;

  try {
    const stored = targetStorage.getItem(LOCAL_PREVIEW_EMPRESA_STORAGE_KEY);
    if (!stored) return baseEmpresa;
    const parsed = JSON.parse(stored) as Partial<Empresa>;
    return {
      ...baseEmpresa,
      ...parsed,
      id: baseEmpresa.id,
      cod_empresa_bi: '1004',
      nome: parsed.nome || baseEmpresa.nome,
      updated_at: new Date().toISOString(),
    };
  } catch {
    return baseEmpresa;
  }
}

export function saveLocalPreviewEmpresa(empresa: Empresa, storage?: StorageLike): Empresa {
  const targetStorage = getLocalStorage(storage);
  const nextEmpresa: Empresa = {
    ...readLocalPreviewEmpresa(storage),
    ...empresa,
    id: 'local-preview-pelegrini',
    cod_empresa_bi: '1004',
    nome: empresa.nome || 'Pelegrini',
    updated_at: new Date().toISOString(),
  };

  targetStorage?.setItem(LOCAL_PREVIEW_EMPRESA_STORAGE_KEY, JSON.stringify(nextEmpresa));
  return nextEmpresa;
}

export function createLocalPreviewProfile(): Profile {
  return {
    id: 'local-preview-profile',
    user_id: 'local-preview-user',
    email: 'preview@pelegrini.local',
    nome: 'Preview Pelegrini',
    cod_empresa_bi: '1004',
    created_at: '2026-08-24T00:00:00.000Z',
    updated_at: '2026-08-24T00:00:00.000Z',
  };
}

export function createLocalPreviewUser(): User {
  return {
    id: 'local-preview-user',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'preview@pelegrini.local',
    app_metadata: {},
    user_metadata: { nome: 'Preview Pelegrini' },
    created_at: '2026-08-24T00:00:00.000Z',
    updated_at: '2026-08-24T00:00:00.000Z',
  } as User;
}

export const localPreviewRoles: AppRole[] = ['master'];

export function createLocalPreviewUserAccount(input?: Partial<LocalPreviewUserInput>): LocalPreviewUserAccount {
  const email = input?.email || 'preview@pelegrini.local';
  const nome = input?.nome || 'Preview Pelegrini';
  const role = input?.role || 'master';
  const codEmpresaBi = role === 'master' ? null : input?.codEmpresaBi ?? '1004';
  const userId = input?.userId || `local-preview-${email.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  const now = new Date().toISOString();

  return {
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      app_metadata: {},
      user_metadata: { nome },
      created_at: now,
      updated_at: now,
    } as User,
    profile: {
      id: `${userId}-profile`,
      user_id: userId,
      email,
      nome,
      cod_empresa_bi: codEmpresaBi,
      filial_id: input?.filialId ?? null,
      filiais_permitidas: input?.filiaisPermitidas ?? null,
      created_at: now,
      updated_at: now,
    },
    roles: [role],
    permissions: input?.permissions || createLocalPreviewPermissions(),
    tempPassword: 'preview123',
  };
}

export function getDefaultLocalPreviewUserAccount(): LocalPreviewUserAccount {
  return createLocalPreviewUserAccount({
    email: 'preview@pelegrini.local',
    nome: 'Preview Pelegrini',
    role: 'master',
    userId: 'local-preview-user',
  });
}

type UsersStorageLike = StorageLike & Partial<Pick<Storage, 'removeItem'>>;

export function readLocalPreviewUserAccounts(storage?: StorageLike): LocalPreviewUserAccount[] {
  const targetStorage = getLocalStorage(storage);
  const defaultUser = getDefaultLocalPreviewUserAccount();
  if (!targetStorage) return [defaultUser];

  try {
    const stored = targetStorage.getItem(LOCAL_PREVIEW_USERS_STORAGE_KEY);
    if (!stored) return [defaultUser];
    const parsed = JSON.parse(stored) as LocalPreviewUserAccount[];
    const accounts = Array.isArray(parsed) ? parsed : [];
    const hasDefault = accounts.some((account) => account.user.id === defaultUser.user.id);
    return hasDefault ? accounts : [defaultUser, ...accounts];
  } catch {
    return [defaultUser];
  }
}

function writeLocalPreviewUserAccounts(accounts: LocalPreviewUserAccount[], storage?: StorageLike) {
  const targetStorage = getLocalStorage(storage);
  targetStorage?.setItem(LOCAL_PREVIEW_USERS_STORAGE_KEY, JSON.stringify(accounts));
}

export function saveLocalPreviewUserAccount(account: LocalPreviewUserAccount, storage?: StorageLike): LocalPreviewUserAccount {
  const accounts = readLocalPreviewUserAccounts(storage);
  const nextAccount = {
    ...account,
    profile: {
      ...account.profile,
      updated_at: new Date().toISOString(),
    },
  };
  const nextAccounts = accounts.some((item) => item.user.id === nextAccount.user.id)
    ? accounts.map((item) => item.user.id === nextAccount.user.id ? nextAccount : item)
    : [nextAccount, ...accounts];

  writeLocalPreviewUserAccounts(nextAccounts, storage);
  return nextAccount;
}

export function deleteLocalPreviewUserAccount(userId: string, storage?: UsersStorageLike) {
  const defaultUserId = getDefaultLocalPreviewUserAccount().user.id;
  if (userId === defaultUserId) return;

  const accounts = readLocalPreviewUserAccounts(storage).filter((account) => account.user.id !== userId);
  writeLocalPreviewUserAccounts(accounts, storage);

  const targetStorage = getLocalStorage(storage);
  if (targetStorage?.getItem(LOCAL_PREVIEW_ACTIVE_USER_STORAGE_KEY) === userId) {
    targetStorage.setItem(LOCAL_PREVIEW_ACTIVE_USER_STORAGE_KEY, defaultUserId);
  }
}

export function setActiveLocalPreviewUserAccount(userId: string, storage?: StorageLike) {
  const targetStorage = getLocalStorage(storage);
  targetStorage?.setItem(LOCAL_PREVIEW_ACTIVE_USER_STORAGE_KEY, userId);
}

export function getActiveLocalPreviewUserAccount(storage?: StorageLike): LocalPreviewUserAccount {
  const accounts = readLocalPreviewUserAccounts(storage);
  const targetStorage = getLocalStorage(storage);
  const activeUserId = targetStorage?.getItem(LOCAL_PREVIEW_ACTIVE_USER_STORAGE_KEY);

  return accounts.find((account) => account.user.id === activeUserId) || accounts[0] || getDefaultLocalPreviewUserAccount();
}

export function readLocalPreviewMotivosPerda(storage?: StorageLike): LocalPreviewMotivoPerdaRegistro[] {
  const targetStorage = getLocalStorage(storage);
  if (!targetStorage) return [];

  try {
    const stored = targetStorage.getItem(LOCAL_PREVIEW_MOTIVOS_PERDA_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is LocalPreviewMotivoPerdaRegistro => (
        item?.cod_empresa_bi === '10041'
        && typeof item.id_cotacao === 'string'
        && typeof item.motivo === 'string'
      ))
      : [];
  } catch {
    return [];
  }
}

export function saveLocalPreviewMotivoPerda(
  motivoPerda: Omit<LocalPreviewMotivoPerdaRegistro, 'id' | 'created_at' | 'updated_at'>,
  storage?: StorageLike,
): LocalPreviewMotivoPerdaRegistro {
  const targetStorage = getLocalStorage(storage);
  const registros = readLocalPreviewMotivosPerda(storage);
  const idCotacao = String(motivoPerda.id_cotacao).trim();
  const now = new Date().toISOString();
  const existente = registros.find((item) => item.id_cotacao === idCotacao);
  const nextRegistro: LocalPreviewMotivoPerdaRegistro = {
    ...motivoPerda,
    id: existente?.id || `local-preview-motivo-10041-${idCotacao}`,
    cod_empresa_bi: '10041',
    id_cotacao: idCotacao,
    created_at: existente?.created_at || now,
    updated_at: now,
  };
  const nextRegistros = registros.some((item) => item.id_cotacao === idCotacao)
    ? registros.map((item) => item.id_cotacao === idCotacao ? nextRegistro : item)
    : [nextRegistro, ...registros];

  targetStorage?.setItem(LOCAL_PREVIEW_MOTIVOS_PERDA_STORAGE_KEY, JSON.stringify(nextRegistros));
  return nextRegistro;
}
