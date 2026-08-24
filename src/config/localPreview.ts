import type { User } from '@supabase/supabase-js';
import type { Profile, AppRole } from '@/types/auth';
import type { Empresa } from '@/hooks/useEmpresaConfig';
import type { UserModulePermissions } from '@/hooks/useUserModulePermissions';

type EnvLike = Record<string, string | boolean | undefined>;

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
  };
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
