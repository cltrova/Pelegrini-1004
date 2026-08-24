import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

  const { data: permissions, isLoading, error } = useQuery({
    queryKey: ['user-module-permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_module_permissions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as UserModulePermissions | null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const hasModuleAccess = (modulo: keyof UserModulePermissions): boolean => {
    // Master tem acesso a tudo
    if (isMaster) return true;
    
    // Se não tem permissões definidas, não tem acesso
    if (!permissions) return false;
    
    return permissions[modulo] ?? false;
  };

  const hasAnyFinancialAccess =
    isMaster ||
    !!permissions?.modulo_resumo ||
    !!permissions?.modulo_dre ||
    !!permissions?.modulo_variacao;

  const hasUserModuleAccess = (modulo: UserModuleKey): boolean => {
    if (isMaster) return true;

    switch (modulo) {
      case 'whatsapp': return permissions?.modulo_whatsapp ?? false;
      case 'comercial': return permissions?.modulo_comercial ?? false;
      case 'operacional': return permissions?.modulo_operacional ?? false;
      case 'resumo': return permissions?.modulo_resumo ?? false;
      case 'dre': return permissions?.modulo_dre ?? false;
      case 'variacao': return permissions?.modulo_variacao ?? false;
      case 'assistente_ia': return permissions?.modulo_assistente_ia ?? false;
      case 'financeiro': return hasAnyFinancialAccess;
      default: return false;
    }
  };

  return {
    permissions,
    hasModuleAccess,
    hasUserModuleAccess,
    isLoading,
    error,
    // Helpers específicos
    canAccessWhatsApp: isMaster || (permissions?.modulo_whatsapp ?? false),
    canAccessComercial: isMaster || (permissions?.modulo_comercial ?? false),
    canAccessDRE: isMaster || (permissions?.modulo_dre ?? false),
    canAccessVariacao: isMaster || (permissions?.modulo_variacao ?? false),
    canAccessAssistenteIA: isMaster || (permissions?.modulo_assistente_ia ?? false),
    canAccessOperacional: isMaster || (permissions?.modulo_operacional ?? false),
    canAccessResumo: isMaster || (permissions?.modulo_resumo ?? false),
    canAccessFinanceiro: hasAnyFinancialAccess,
  };
}
