import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Profile, AppRole, RolePermissions } from '@/types/auth';
import { ROLE_PERMISSIONS } from '@/types/auth';
import {
  getActiveLocalPreviewUserAccount,
  isLocalPreviewEnabled,
} from '@/config/localPreview';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  mustChangePassword: boolean;

  
  // Role helpers
  isMaster: boolean;
  isGerencial: boolean;
  isVendedor: boolean;
  
  // Permission helpers
  canAccessSettings: boolean;
  canManageUsers: boolean;
  canManageEmpresas: boolean;
  canViewAllConversations: boolean;
  canViewDashboards: boolean;
  canViewReports: boolean;
  
  // Empresa do usuário
  codEmpresa: string | null;
  
  // Estado
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Ações
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  signup: (email: string, password: string, nome?: string) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
  
  // Helper para obter permissões do role atual
  getCurrentRolePermissions: () => RolePermissions;
  
  // Helper para verificar acesso a rotas
  canAccessRoute: (route: string) => boolean;
  
  // Rota inicial baseada no perfil
  getInitialRoute: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const localPreview = isLocalPreviewEnabled();
  const [user, setUser] = useState<User | null>(() => localPreview ? getActiveLocalPreviewUserAccount().user : null);
  const [profile, setProfile] = useState<Profile | null>(() => localPreview ? getActiveLocalPreviewUserAccount().profile : null);
  const [roles, setRoles] = useState<AppRole[]>(() => localPreview ? getActiveLocalPreviewUserAccount().roles : []);
  const [isLoading, setIsLoading] = useState(!localPreview);

  // Role helpers
  const isMaster = roles.includes('master');
  const isGerencial = roles.includes('gerencial');
  const isVendedor = roles.includes('vendedor');
  
  // Empresa do usuário
  const codEmpresa = profile?.cod_empresa_bi || null;
  const mustChangePassword = !!(profile as any)?.must_change_password;


  // Permission helpers - baseado na hierarquia de roles
  const canAccessSettings = isMaster;
  const canManageUsers = isMaster || isGerencial;
  const canManageEmpresas = isMaster;
  const canViewAllConversations = isMaster || isGerencial;
  const canViewDashboards = isMaster || isGerencial;
  const canViewReports = isMaster || isGerencial;

  // Carregar perfil e roles do usuário
  const loadUserData = async (userId: string) => {
    try {
      // Carregar perfil
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Erro ao carregar perfil:', profileError);
      } else {
        setProfile(profileData as Profile | null);
      }

      // Carregar roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) {
        console.error('Erro ao carregar roles:', rolesError);
      } else {
        const userRoles = (rolesData || []).map(r => r.role as AppRole);
        setRoles(userRoles);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
    }
  };

  // Configurar listener de auth state ANTES de getSession
  useEffect(() => {
    if (localPreview) {
      const activeAccount = getActiveLocalPreviewUserAccount();
      setUser(activeAccount.user);
      setProfile(activeAccount.profile);
      setRoles(activeAccount.roles);
      setIsLoading(false);
      return;
    }

    let mounted = true;
    
    // Primeiro verificar sessão existente
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (mounted && session?.user) {
        setUser(session.user);
        // Aguardar carregar perfil + roles ANTES de liberar a UI,
        // senão o RequireModule renderiza com isMaster=false momentâneo
        // e mostra "Módulo Bloqueado" indevidamente.
        await loadUserData(session.user.id);
      }
      if (mounted) setIsLoading(false);
    });

    // Depois configurar listener para mudanças
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event);
        
        if (!mounted) return;
        
        // Ignorar INITIAL_SESSION pois já tratamos com getSession
        if (event === 'INITIAL_SESSION') return;
        
        if (session?.user) {
          setUser(session.user);
          // Usar setTimeout para evitar deadlock com Supabase, e só liberar
          // o loading após perfil + roles carregarem.
          setTimeout(async () => {
            if (!mounted) return;
            await loadUserData(session.user.id);
            if (mounted) setIsLoading(false);
          }, 0);
        } else {
          setUser(null);
          setProfile(null);
          setRoles([]);
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [localPreview]);

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Erro ao fazer login' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRoles([]);
  };

  const signup = async (email: string, password: string, nome?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { nome }
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Atualizar nome no perfil se fornecido
      if (data.user && nome) {
        await supabase
          .from('profiles')
          .update({ nome })
          .eq('user_id', data.user.id);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Erro ao criar conta' };
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserData(user.id);
    }
  };

  // Obter permissões do role principal
  const getCurrentRolePermissions = (): RolePermissions => {
    if (isMaster) return ROLE_PERMISSIONS.master;
    if (isGerencial) return ROLE_PERMISSIONS.gerencial;
    return ROLE_PERMISSIONS.vendedor;
  };

  // Verificar acesso a rotas específicas
  const canAccessRoute = (route: string): boolean => {
    // Master pode acessar tudo
    if (isMaster) return true;

    // Rotas bloqueadas para não-masters
    const masterOnlyRoutes = [
      '/configuracoes',
      '/configuracoes/empresas',
    ];
    
    if (masterOnlyRoutes.some(r => route.startsWith(r))) {
      return false;
    }

    // Rotas bloqueadas para vendedores
    const restrictedForVendedor = [
      '/financeiro',
      '/comercial',
      '/whatsapp/relatorio',
      '/whatsapp/settings',
      '/configuracoes/usuarios',
    ];

    if (isVendedor && restrictedForVendedor.some(r => route.startsWith(r))) {
      return false;
    }

    return true;
  };

  // Rota inicial baseada no perfil
  const getInitialRoute = (): string => {
    if (isMaster) return '/';
    if (isGerencial) return '/';
    if (isVendedor) return '/whatsapp';
    return '/';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        roles,
        mustChangePassword,
        isMaster,

        isGerencial,
        isVendedor,
        canAccessSettings,
        canManageUsers,
        canManageEmpresas,
        canViewAllConversations,
        canViewDashboards,
        canViewReports,
        codEmpresa,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        signup,
        refreshProfile,
        getCurrentRolePermissions,
        canAccessRoute,
        getInitialRoute,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
