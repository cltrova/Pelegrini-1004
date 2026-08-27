import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getActiveLocalPreviewUserAccount, isLocalPreviewEnabled } from '@/config/localPreview';

export type UserModuleKey = 'whatsapp' | 'comercial' | 'operacional' | 'resumo' | 'dre' | 'variacao' | 'assistente_ia' | 'financeiro';

export interface UserModulePermissions {
  modulo_dre: boolean;
  modulo_variacao: boolean;
  modulo_comercial: boolean;
  modulo_assistente_ia: boolean;
  modulo_whatsapp: boolean;
  modulo_operacional: boolean;
  modulo_resumo: boolean;
}

export function useUserModulePermissions() {
  const { user, isMaster } = useAuth();
  const localPreview = isLocalPreviewEnabled();

  const { data: permissions, isLoading, error } = useQuery({
    queryKey: ['user-module-permissions', user?.id],
    queryFn: async () => {
      if (localPreview) return getActiveLocalPreviewUserAccount().permissions;

      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_module_permissions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as UserModulePermissions | null;
    },
    enabled: localPreview || !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const activeLocalPreviewUser = localPreview ? getActiveLocalPreviewUserAccount() : null;
  const effectivePermissions = activeLocalPreviewUser ? activeLocalPreviewUser.permissions : permissions;
  const effectiveIsMaster = activeLocalPreviewUser ? activeLocalPreviewUser.roles.includes('master') : isMaster;

  const hasModuleAccess = (modulo: keyof UserModulePermissions): boolean => {
    // Master tem acesso a tudo
    if (effectiveIsMaster) return true;
    
    // Se não tem permissões definidas, não tem acesso
    if (!effectivePermissions) return false;
    
    return effectivePermissions[modulo] ?? false;
  };

  const hasAnyFinancialAccess =
    effectiveIsMaster ||
    !!effectivePermissions?.modulo_resumo ||
    !!effectivePermissions?.modulo_dre ||
    !!effectivePermissions?.modulo_variacao;

  const hasUserModuleAccess = (modulo: UserModuleKey): boolean => {
    if (effectiveIsMaster) return true;

    switch (modulo) {
      case 'whatsapp': return effectivePermissions?.modulo_whatsapp ?? false;
      case 'comercial': return effectivePermissions?.modulo_comercial ?? false;
      case 'operacional': return effectivePermissions?.modulo_operacional ?? false;
      case 'resumo': return effectivePermissions?.modulo_resumo ?? false;
      case 'dre': return effectivePermissions?.modulo_dre ?? false;
      case 'variacao': return effectivePermissions?.modulo_variacao ?? false;
      case 'assistente_ia': return effectivePermissions?.modulo_assistente_ia ?? false;
      case 'financeiro': return hasAnyFinancialAccess;
      default: return false;
    }
  };

  return {
    permissions: effectivePermissions,
    hasModuleAccess,
    hasUserModuleAccess,
    isLoading: localPreview ? false : isLoading,
    error,
    // Helpers específicos
    canAccessWhatsApp: effectiveIsMaster || (effectivePermissions?.modulo_whatsapp ?? false),
    canAccessComercial: effectiveIsMaster || (effectivePermissions?.modulo_comercial ?? false),
    canAccessDRE: effectiveIsMaster || (effectivePermissions?.modulo_dre ?? false),
    canAccessVariacao: effectiveIsMaster || (effectivePermissions?.modulo_variacao ?? false),
    canAccessAssistenteIA: effectiveIsMaster || (effectivePermissions?.modulo_assistente_ia ?? false),
    canAccessOperacional: effectiveIsMaster || (effectivePermissions?.modulo_operacional ?? false),
    canAccessResumo: effectiveIsMaster || (effectivePermissions?.modulo_resumo ?? false),
    canAccessFinanceiro: hasAnyFinancialAccess,
  };
}
