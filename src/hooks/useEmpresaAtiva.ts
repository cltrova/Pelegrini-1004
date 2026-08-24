import { useAuth } from '@/contexts/AuthContext';
import { useEmpresaSelecionada } from '@/contexts/EmpresaSelecionadaContext';
import { resolveCliente1004 } from '@/config/cliente1004';
import { useEmpresaConfig } from '@/hooks/useEmpresaConfig';

/**
 * Hook que retorna a empresa ativa atual.
 * - Para usuários master: usa a empresa selecionada no diálogo
 * - Para usuários comuns: usa a empresa do perfil
 */
export function useEmpresaAtiva() {
  const { isMaster } = useAuth();
  const { empresaSelecionada } = useEmpresaSelecionada();
  
  const codEmpresaAtiva = resolveCliente1004(empresaSelecionada);
  
  const { empresa, isLoading, error } = useEmpresaConfig(codEmpresaAtiva);

  return {
    codEmpresaAtiva,
    empresa,
    isLoading,
    error,
    isMaster,
    hasEmpresaSelecionada: !!codEmpresaAtiva,
  };
}
