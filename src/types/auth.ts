// Tipos para autenticação e perfis de usuário

export type AppRole = 'master' | 'gerencial' | 'vendedor';

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  nome: string | null;
  cod_empresa_bi: string | null;
  filial_id?: string | null;
  filiais_permitidas?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface UserWithProfile {
  id: string;
  email: string;
  profile: Profile | null;
  roles: AppRole[];
}

// Permissões por role
export const ROLE_PERMISSIONS = {
  master: {
    label: 'Master',
    description: 'Acesso total a todas as empresas e configurações',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-500/10',
    canAccessSettings: true,
    canManageUsers: true,
    canManageEmpresas: true,
    canViewAllConversations: true,
    canViewDashboards: true,
    canViewReports: true,
    requiresCompany: false,
  },
  gerencial: {
    label: 'Gerencial',
    description: 'Relatórios e gestão de vendedores da empresa',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    canAccessSettings: false,
    canManageUsers: true, // apenas vendedores da mesma empresa
    canManageEmpresas: false,
    canViewAllConversations: true, // da empresa
    canViewDashboards: true,
    canViewReports: true,
    requiresCompany: true,
  },
  vendedor: {
    label: 'Vendedor',
    description: 'Acesso às próprias conversas e perfil',
    color: 'text-green-600',
    bgColor: 'bg-green-500/10',
    canAccessSettings: false,
    canManageUsers: false,
    canManageEmpresas: false,
    canViewAllConversations: false, // apenas próprias
    canViewDashboards: false,
    canViewReports: false,
    requiresCompany: true,
  },
} as const;

export type RolePermissions = typeof ROLE_PERMISSIONS[AppRole];
