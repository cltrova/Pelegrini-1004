import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  CLIENTE_CODIGOS_EMPRESA_BI,
  resolveCliente1004,
} from '@/config/cliente1004';
import {
  isLocalPreviewEnabled,
  readLocalPreviewEmpresa,
  saveLocalPreviewEmpresa,
} from '@/config/localPreview';

export interface Empresa {
  id: string;
  cod_empresa_bi: string;
  nome: string;
  endpoint_url: string;
  modulo_dre: boolean;
  modulo_variacao: boolean;
  modulo_comercial: boolean;
  modulo_assistente_ia: boolean;
  modulo_whatsapp: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  // Caminhos JSON para desenvolvimento (alternativa ao endpoint)
  json_path_dre?: string | null;
  json_path_variacao?: string | null;
  json_path_comercial?: string | null;
  // Paths customizáveis para endpoints
  endpoint_path_dre?: string | null;
  endpoint_path_variacao?: string | null;
  endpoint_path_comercial_pedidos?: string | null;
  endpoint_path_comercial_devolucoes?: string | null;
  endpoint_path_comercial_produtos?: string | null;
  // Endpoints totalizadores (cálculos consolidados no SQL)
  endpoint_path_comercial_totais?: string | null;
  endpoint_path_comercial_pedidos_total?: string | null;
  endpoint_path_comercial_devolucoes_total?: string | null;
  endpoint_path_comercial_produtos_total?: string | null;
  endpoint_path_comercial_agrupado?: string | null;
  endpoint_path_comercial_clientes_analise?: string | null;
  // Variantes Casa da Chevrolet (Pelegrini 1004 — filial chevrolet)
  endpoint_path_comercial_pedidos_ch?: string | null;
  endpoint_path_comercial_devolucoes_ch?: string | null;
  endpoint_path_comercial_produtos_ch?: string | null;
  json_path_comercial_ch?: string | null;
  json_path_comercial_produtos_ch?: string | null;
  // Segundo JSON do módulo Comercial (itens dos pedidos)
  json_path_comercial_produtos?: string | null;
  // Flag para controle de layout comercial
  possui_meta_vendedor?: boolean;
  // Módulo Operacional
  modulo_operacional?: boolean;
  endpoint_path_estoque_giro?: string | null;
  endpoint_path_estoque_consolidado?: string | null;
  endpoint_path_estoque_detalhado?: string | null;
  json_path_estoque_giro?: string | null;
  json_path_estoque_consolidado?: string | null;
  json_path_estoque_detalhado?: string | null;
  // Módulo Resumo (Financeiro - visão consolidada)
  modulo_resumo?: boolean;
  json_path_resumo?: string | null;
  endpoint_path_resumo?: string | null;
  // Duplicatas / contas a receber
  json_path_duplicatas?: string | null;
  endpoint_path_duplicatas?: string | null;
  // VPS intermediária (API RSYS)
  usar_vps_intermediaria?: boolean;
  vps_base_url?: string | null;
  vps_cliente_identificador?: string | null;
}

export type EmpresaModuloKey = 'dre' | 'variacao' | 'comercial' | 'assistente_ia' | 'whatsapp' | 'operacional' | 'resumo' | 'financeiro';

export function useEmpresaConfig(codEmpresaBi?: string) {
  const { isMaster, user } = useAuth();
  const localPreview = isLocalPreviewEnabled();
  
  const empresaCode = resolveCliente1004(codEmpresaBi);

  const { data: empresa, isLoading, error } = useQuery({
    queryKey: ['empresa-config', empresaCode, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .eq('cod_empresa_bi', empresaCode)
        .maybeSingle();
      
      if (error) throw error;
      return data as Empresa | null;
    },
    enabled: !localPreview && !!user,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const effectiveEmpresa = localPreview ? readLocalPreviewEmpresa() : empresa;
  const effectiveIsMaster = localPreview || isMaster;

  const hasModulo = (modulo: EmpresaModuloKey): boolean => {
    // Master sempre tem acesso a todos os módulos
    if (effectiveIsMaster) return true;
    
    if (!effectiveEmpresa) return false;
    
    switch (modulo) {
      case 'dre':
        return effectiveEmpresa.modulo_dre;
      case 'variacao':
        return effectiveEmpresa.modulo_variacao;
      case 'comercial':
        return effectiveEmpresa.modulo_comercial;
      case 'assistente_ia':
        return effectiveEmpresa.modulo_assistente_ia;
      case 'whatsapp':
        return effectiveEmpresa.modulo_whatsapp;
      case 'operacional':
        return effectiveEmpresa.modulo_operacional ?? false;
      case 'resumo':
        return effectiveEmpresa.modulo_resumo ?? false;
      case 'financeiro':
        return effectiveEmpresa.modulo_dre || effectiveEmpresa.modulo_variacao || (effectiveEmpresa.modulo_resumo ?? false) || effectiveEmpresa.modulo_assistente_ia;
      default:
        return false;
    }
  };

  return {
    empresa: effectiveEmpresa,
    hasModulo,
    isLoading: localPreview ? false : isLoading,
    error,
    isMaster: effectiveIsMaster,
  };
}

export function useEmpresas() {
  const { user } = useAuth();
  const localPreview = isLocalPreviewEnabled();
  
  return useQuery({
    queryKey: ['empresas', user?.id],
    queryFn: async () => {
      if (localPreview) return [readLocalPreviewEmpresa()];

      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .in('cod_empresa_bi', [...CLIENTE_CODIGOS_EMPRESA_BI])
        .order('nome');
      
      if (error) throw error;
      return data as Empresa[];
    },
    enabled: localPreview || !!user,
    staleTime: 1000 * 60 * 5,
  });
}

export function useEmpresaMutations() {
  const createEmpresa = async (empresa: Omit<Empresa, 'id' | 'created_at' | 'updated_at'>) => {
    if (isLocalPreviewEnabled()) {
      return saveLocalPreviewEmpresa({
        ...readLocalPreviewEmpresa(),
        ...empresa,
      } as Empresa);
    }

    const { data, error } = await supabase
      .from('empresas')
      .insert(empresa)
      .select()
      .single();
    
    if (error) throw error;
    return data as Empresa;
  };

  const updateEmpresa = async (id: string, empresa: Partial<Omit<Empresa, 'id' | 'created_at' | 'updated_at'>>) => {
    if (isLocalPreviewEnabled()) {
      return saveLocalPreviewEmpresa({
        ...readLocalPreviewEmpresa(),
        ...empresa,
        id,
      } as Empresa);
    }

    const { data, error } = await supabase
      .from('empresas')
      .update(empresa)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Empresa;
  };

  const deleteEmpresa = async (id: string) => {
    if (isLocalPreviewEnabled()) return;

    const { error } = await supabase
      .from('empresas')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  };

  return {
    createEmpresa,
    updateEmpresa,
    deleteEmpresa,
  };
}
