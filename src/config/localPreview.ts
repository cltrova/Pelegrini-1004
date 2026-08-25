import type { User } from '@supabase/supabase-js';
import type { Profile, AppRole } from '@/types/auth';
import type { Empresa } from '@/hooks/useEmpresaConfig';
import type { UserModulePermissions } from '@/hooks/useUserModulePermissions';

type EnvLike = Record<string, string | boolean | undefined>;
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export const LOCAL_PREVIEW_EMPRESA_STORAGE_KEY = 'pelegrini-local-preview-empresa';

export function isLocalPreviewEnabled(env: EnvLike = import.meta.env) {
  return env.VITE_LOCAL_PREVIEW === 'true' || env.VITE_LOCAL_PREVIEW === true;
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
    usar_vps_intermediaria: false,
    vps_base_url: 'http://187.77.203.16',
    vps_cliente_identificador: '',
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
