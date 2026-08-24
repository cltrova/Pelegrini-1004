import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook para centralizar lógica de acesso por empresa e role
 */
export function useUserAccess() {
  const { 
    profile, 
    isMaster, 
    isGerencial, 
    isVendedor, 
    codEmpresa,
    canViewAllConversations,
    user,
  } = useAuth();

  return {
    // Se pode ver todas as empresas
    canAccessAllEmpresas: isMaster,
    
    // Código da empresa do usuário (null para master)
    defaultEmpresa: codEmpresa,
    
    // Se deve mostrar seletor de empresa
    showEmpresaSelector: isMaster,
    
    // Perfil do usuário
    profile,

    // Roles
    isMaster,
    isGerencial,
    isVendedor,

    // Permissões específicas
    canViewAllConversations,

    /**
     * Filtra dados por empresa baseado no acesso do usuário
     * @param data Array de dados com campo de empresa
     * @param empresaField Nome do campo que contém o código da empresa
     * @param empresaSelecionada Empresa selecionada (apenas para masters)
     */
    filterByEmpresa: <T extends Record<string, unknown>>(
      data: T[],
      empresaField: string,
      empresaSelecionada?: string
    ): T[] => {
      if (!data || data.length === 0) return [];

      // Master com empresa selecionada
      if (isMaster && empresaSelecionada) {
        return data.filter(item => item[empresaField] === empresaSelecionada);
      }

      // Master sem seleção - retorna todos
      if (isMaster && !empresaSelecionada) {
        return data;
      }

      // Gerencial ou Vendedor - filtra pela empresa do perfil
      if (codEmpresa) {
        return data.filter(item => item[empresaField] === codEmpresa);
      }

      // Sem acesso definido - retorna vazio
      return [];
    },

    /**
     * Filtra conversas baseado no role do usuário
     * Vendedores só veem suas próprias conversas
     * @param data Array de conversas
     * @param assignedToField Nome do campo de atribuição
     */
    filterConversations: <T extends Record<string, unknown>>(
      data: T[],
      assignedToField: string = 'assigned_to'
    ): T[] => {
      if (!data || data.length === 0) return [];

      // Master e Gerencial veem todas as conversas (da empresa)
      if (isMaster || isGerencial) {
        return data;
      }

      // Vendedor só vê suas próprias conversas
      if (isVendedor && user) {
        return data.filter(item => item[assignedToField] === user.id);
      }

      return [];
    },

    /**
     * Extrai lista única de empresas dos dados
     */
    extractEmpresas: <T extends Record<string, unknown>>(
      data: T[],
      empresaField: string
    ): string[] => {
      if (!data || data.length === 0) return [];
      
      const empresas = new Set<string>();
      data.forEach(item => {
        const value = item[empresaField];
        if (typeof value === 'string' && value) {
          empresas.add(value);
        }
      });
      
      return Array.from(empresas).sort();
    }
  };
}
