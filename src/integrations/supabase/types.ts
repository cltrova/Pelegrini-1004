export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      assignment_rules: {
        Row: {
          company_id: string
          created_at: string | null
          fixed_agent_id: string | null
          id: string
          instance_id: string | null
          is_active: boolean | null
          last_assigned_index: number | null
          participating_agents: string[] | null
          rule_type: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          fixed_agent_id?: string | null
          id?: string
          instance_id?: string | null
          is_active?: boolean | null
          last_assigned_index?: number | null
          participating_agents?: string[] | null
          rule_type: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          fixed_agent_id?: string | null
          id?: string
          instance_id?: string | null
          is_active?: boolean | null
          last_assigned_index?: number | null
          participating_agents?: string[] | null
          rule_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_rules_fixed_agent_id_fkey"
            columns: ["fixed_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_rules_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      autenticacao_importacoes: {
        Row: {
          arquivo_nome: string
          arquivo_tamanho: number | null
          cod_empresa_bi: string
          cod_filial: string | null
          created_at: string
          data_fim: string | null
          data_ini: string | null
          id: string
          status: string
          total_autenticados: number
          total_divergentes: number
          total_extras: number
          total_linhas: number
          total_nao_encontrados: number
          updated_at: string
          usuario_id: string
        }
        Insert: {
          arquivo_nome: string
          arquivo_tamanho?: number | null
          cod_empresa_bi: string
          cod_filial?: string | null
          created_at?: string
          data_fim?: string | null
          data_ini?: string | null
          id?: string
          status?: string
          total_autenticados?: number
          total_divergentes?: number
          total_extras?: number
          total_linhas?: number
          total_nao_encontrados?: number
          updated_at?: string
          usuario_id: string
        }
        Update: {
          arquivo_nome?: string
          arquivo_tamanho?: number | null
          cod_empresa_bi?: string
          cod_filial?: string | null
          created_at?: string
          data_fim?: string | null
          data_ini?: string | null
          id?: string
          status?: string
          total_autenticados?: number
          total_divergentes?: number
          total_extras?: number
          total_linhas?: number
          total_nao_encontrados?: number
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      autenticacao_linhas: {
        Row: {
          cliente: string | null
          created_at: string
          dados_extras: Json | null
          data_pedido: string | null
          id: string
          importacao_id: string
          numero_pedido: string
          valor_planilha: number | null
        }
        Insert: {
          cliente?: string | null
          created_at?: string
          dados_extras?: Json | null
          data_pedido?: string | null
          id?: string
          importacao_id: string
          numero_pedido: string
          valor_planilha?: number | null
        }
        Update: {
          cliente?: string | null
          created_at?: string
          dados_extras?: Json | null
          data_pedido?: string | null
          id?: string
          importacao_id?: string
          numero_pedido?: string
          valor_planilha?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "autenticacao_linhas_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "autenticacao_importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      autenticacao_resultados: {
        Row: {
          cliente_planilha: string | null
          cliente_sistema: string | null
          created_at: string
          divergencias: Json | null
          id: string
          importacao_id: string
          numero_pedido: string
          status: string
          valor_planilha: number | null
          valor_sistema: number | null
        }
        Insert: {
          cliente_planilha?: string | null
          cliente_sistema?: string | null
          created_at?: string
          divergencias?: Json | null
          id?: string
          importacao_id: string
          numero_pedido: string
          status: string
          valor_planilha?: number | null
          valor_sistema?: number | null
        }
        Update: {
          cliente_planilha?: string | null
          cliente_sistema?: string | null
          created_at?: string
          divergencias?: Json | null
          id?: string
          importacao_id?: string
          numero_pedido?: string
          status?: string
          valor_planilha?: number | null
          valor_sistema?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "autenticacao_resultados_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "autenticacao_importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas: {
        Row: {
          bonus_meta_geral: number
          cod_empresa_bi: string
          created_at: string
          criado_por: string | null
          data_fim: string
          data_inicio: string
          descricao: string | null
          id: string
          marca: string | null
          marcas: Json
          mensagem_equipe: string | null
          meta_geral_mensal: number
          meta_valor: number | null
          nome: string
          observacoes: string | null
          premiacao: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bonus_meta_geral?: number
          cod_empresa_bi: string
          created_at?: string
          criado_por?: string | null
          data_fim: string
          data_inicio: string
          descricao?: string | null
          id?: string
          marca?: string | null
          marcas?: Json
          mensagem_equipe?: string | null
          meta_geral_mensal?: number
          meta_valor?: number | null
          nome: string
          observacoes?: string | null
          premiacao?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bonus_meta_geral?: number
          cod_empresa_bi?: string
          created_at?: string
          criado_por?: string | null
          data_fim?: string
          data_inicio?: string
          descricao?: string | null
          id?: string
          marca?: string | null
          marcas?: Json
          mensagem_equipe?: string | null
          meta_geral_mensal?: number
          meta_valor?: number | null
          nome?: string
          observacoes?: string | null
          premiacao?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      cobranca_agente_config: {
        Row: {
          agente_nome: string
          cod_empresa_bi: string
          created_at: string
          enviar_atrasado: boolean
          enviar_d0: boolean
          enviar_d1: boolean
          enviar_d3: boolean
          id: string
          persona_prompt: string
          rodape: string
          template_atrasado: string
          template_d0: string
          template_d1: string
          template_d3: string
          updated_at: string
        }
        Insert: {
          agente_nome?: string
          cod_empresa_bi: string
          created_at?: string
          enviar_atrasado?: boolean
          enviar_d0?: boolean
          enviar_d1?: boolean
          enviar_d3?: boolean
          id?: string
          persona_prompt?: string
          rodape?: string
          template_atrasado?: string
          template_d0?: string
          template_d1?: string
          template_d3?: string
          updated_at?: string
        }
        Update: {
          agente_nome?: string
          cod_empresa_bi?: string
          created_at?: string
          enviar_atrasado?: boolean
          enviar_d0?: boolean
          enviar_d1?: boolean
          enviar_d3?: boolean
          id?: string
          persona_prompt?: string
          rodape?: string
          template_atrasado?: string
          template_d0?: string
          template_d1?: string
          template_d3?: string
          updated_at?: string
        }
        Relationships: []
      }
      cobranca_clientes_telefones: {
        Row: {
          cliente_nome: string | null
          cod_cliente: string
          cod_empresa_bi: string
          created_at: string
          id: string
          phone_e164: string
          updated_at: string
        }
        Insert: {
          cliente_nome?: string | null
          cod_cliente: string
          cod_empresa_bi: string
          created_at?: string
          id?: string
          phone_e164: string
          updated_at?: string
        }
        Update: {
          cliente_nome?: string | null
          cod_cliente?: string
          cod_empresa_bi?: string
          created_at?: string
          id?: string
          phone_e164?: string
          updated_at?: string
        }
        Relationships: []
      }
      cobranca_envios: {
        Row: {
          cliente_nome: string | null
          cod_cliente: string | null
          cod_empresa_bi: string
          conteudo: string
          created_at: string
          data_vencimento: string | null
          dias_atraso: number | null
          duplicata_id: string | null
          enviado_por: string | null
          erro: string | null
          gatilho: string
          id: string
          phone_e164: string
          status: string
          valor: number | null
        }
        Insert: {
          cliente_nome?: string | null
          cod_cliente?: string | null
          cod_empresa_bi: string
          conteudo: string
          created_at?: string
          data_vencimento?: string | null
          dias_atraso?: number | null
          duplicata_id?: string | null
          enviado_por?: string | null
          erro?: string | null
          gatilho: string
          id?: string
          phone_e164: string
          status?: string
          valor?: number | null
        }
        Update: {
          cliente_nome?: string | null
          cod_cliente?: string | null
          cod_empresa_bi?: string
          conteudo?: string
          created_at?: string
          data_vencimento?: string | null
          dias_atraso?: number | null
          duplicata_id?: string | null
          enviado_por?: string | null
          erro?: string | null
          gatilho?: string
          id?: string
          phone_e164?: string
          status?: string
          valor?: number | null
        }
        Relationships: []
      }
      cobranca_intervencoes: {
        Row: {
          agent_summary: string
          attachment_type: string | null
          attachment_url: string | null
          cliente_nome: string | null
          cod_cliente: string | null
          cod_empresa_bi: string
          contact_phone: string | null
          conversation_id: string | null
          created_at: string
          data_vencimento: string | null
          duplicata_id: string | null
          id: string
          instance_id: string | null
          metadata: Json
          pedido_numero: string | null
          prioridade: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          tipo: string
          ultima_mensagem_cliente: string | null
          updated_at: string
          user_response: string | null
          valor: number | null
        }
        Insert: {
          agent_summary?: string
          attachment_type?: string | null
          attachment_url?: string | null
          cliente_nome?: string | null
          cod_cliente?: string | null
          cod_empresa_bi: string
          contact_phone?: string | null
          conversation_id?: string | null
          created_at?: string
          data_vencimento?: string | null
          duplicata_id?: string | null
          id?: string
          instance_id?: string | null
          metadata?: Json
          pedido_numero?: string | null
          prioridade?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          tipo?: string
          ultima_mensagem_cliente?: string | null
          updated_at?: string
          user_response?: string | null
          valor?: number | null
        }
        Update: {
          agent_summary?: string
          attachment_type?: string | null
          attachment_url?: string | null
          cliente_nome?: string | null
          cod_cliente?: string | null
          cod_empresa_bi?: string
          contact_phone?: string | null
          conversation_id?: string | null
          created_at?: string
          data_vencimento?: string | null
          duplicata_id?: string | null
          id?: string
          instance_id?: string | null
          metadata?: Json
          pedido_numero?: string | null
          prioridade?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          tipo?: string
          ultima_mensagem_cliente?: string | null
          updated_at?: string
          user_response?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      dfc_line_config: {
        Row: {
          cod_empresa_bi: string
          contas: string[]
          created_at: string
          descricao: string
          fonte: string
          grupo: string | null
          id: string
          invert_sinal: boolean
          linha_id: string
          modo: string
          ordem: number
          secao: string
          updated_at: string
        }
        Insert: {
          cod_empresa_bi: string
          contas?: string[]
          created_at?: string
          descricao: string
          fonte?: string
          grupo?: string | null
          id?: string
          invert_sinal?: boolean
          linha_id: string
          modo?: string
          ordem?: number
          secao: string
          updated_at?: string
        }
        Update: {
          cod_empresa_bi?: string
          contas?: string[]
          created_at?: string
          descricao?: string
          fonte?: string
          grupo?: string | null
          id?: string
          invert_sinal?: boolean
          linha_id?: string
          modo?: string
          ordem?: number
          secao?: string
          updated_at?: string
        }
        Relationships: []
      }
      empresas: {
        Row: {
          ativo: boolean | null
          cod_empresa_bi: string
          created_at: string | null
          endpoint_path_comercial_agrupado: string | null
          endpoint_path_comercial_clientes_analise: string | null
          endpoint_path_comercial_devolucoes: string | null
          endpoint_path_comercial_devolucoes_ch: string | null
          endpoint_path_comercial_devolucoes_total: string | null
          endpoint_path_comercial_pedidos: string | null
          endpoint_path_comercial_pedidos_ch: string | null
          endpoint_path_comercial_pedidos_total: string | null
          endpoint_path_comercial_produtos: string | null
          endpoint_path_comercial_produtos_ch: string | null
          endpoint_path_comercial_produtos_total: string | null
          endpoint_path_comercial_totais: string | null
          endpoint_path_dre: string | null
          endpoint_path_duplicatas: string | null
          endpoint_path_estoque_consolidado: string | null
          endpoint_path_estoque_detalhado: string | null
          endpoint_path_estoque_giro: string | null
          endpoint_path_fluxo_caixa: string | null
          endpoint_path_fluxo_caixa_movimento: string | null
          endpoint_path_resumo: string | null
          endpoint_path_variacao: string | null
          endpoint_url: string
          id: string
          json_path_comercial: string | null
          json_path_comercial_ch: string | null
          json_path_comercial_devolucoes: string | null
          json_path_comercial_produtos: string | null
          json_path_comercial_produtos_ch: string | null
          json_path_dre: string | null
          json_path_duplicatas: string | null
          json_path_estoque_consolidado: string | null
          json_path_estoque_detalhado: string | null
          json_path_estoque_giro: string | null
          json_path_fluxo_caixa: string | null
          json_path_fluxo_caixa_movimento: string | null
          json_path_resumo: string | null
          json_path_variacao: string | null
          modulo_assistente_ia: boolean | null
          modulo_comercial: boolean | null
          modulo_dre: boolean | null
          modulo_operacional: boolean | null
          modulo_resumo: boolean | null
          modulo_variacao: boolean | null
          modulo_whatsapp: boolean | null
          nome: string
          possui_meta_vendedor: boolean | null
          updated_at: string | null
          usar_vps_intermediaria: boolean
          vps_base_url: string | null
          vps_cliente_identificador: string | null
        }
        Insert: {
          ativo?: boolean | null
          cod_empresa_bi: string
          created_at?: string | null
          endpoint_path_comercial_agrupado?: string | null
          endpoint_path_comercial_clientes_analise?: string | null
          endpoint_path_comercial_devolucoes?: string | null
          endpoint_path_comercial_devolucoes_ch?: string | null
          endpoint_path_comercial_devolucoes_total?: string | null
          endpoint_path_comercial_pedidos?: string | null
          endpoint_path_comercial_pedidos_ch?: string | null
          endpoint_path_comercial_pedidos_total?: string | null
          endpoint_path_comercial_produtos?: string | null
          endpoint_path_comercial_produtos_ch?: string | null
          endpoint_path_comercial_produtos_total?: string | null
          endpoint_path_comercial_totais?: string | null
          endpoint_path_dre?: string | null
          endpoint_path_duplicatas?: string | null
          endpoint_path_estoque_consolidado?: string | null
          endpoint_path_estoque_detalhado?: string | null
          endpoint_path_estoque_giro?: string | null
          endpoint_path_fluxo_caixa?: string | null
          endpoint_path_fluxo_caixa_movimento?: string | null
          endpoint_path_resumo?: string | null
          endpoint_path_variacao?: string | null
          endpoint_url: string
          id?: string
          json_path_comercial?: string | null
          json_path_comercial_ch?: string | null
          json_path_comercial_devolucoes?: string | null
          json_path_comercial_produtos?: string | null
          json_path_comercial_produtos_ch?: string | null
          json_path_dre?: string | null
          json_path_duplicatas?: string | null
          json_path_estoque_consolidado?: string | null
          json_path_estoque_detalhado?: string | null
          json_path_estoque_giro?: string | null
          json_path_fluxo_caixa?: string | null
          json_path_fluxo_caixa_movimento?: string | null
          json_path_resumo?: string | null
          json_path_variacao?: string | null
          modulo_assistente_ia?: boolean | null
          modulo_comercial?: boolean | null
          modulo_dre?: boolean | null
          modulo_operacional?: boolean | null
          modulo_resumo?: boolean | null
          modulo_variacao?: boolean | null
          modulo_whatsapp?: boolean | null
          nome: string
          possui_meta_vendedor?: boolean | null
          updated_at?: string | null
          usar_vps_intermediaria?: boolean
          vps_base_url?: string | null
          vps_cliente_identificador?: string | null
        }
        Update: {
          ativo?: boolean | null
          cod_empresa_bi?: string
          created_at?: string | null
          endpoint_path_comercial_agrupado?: string | null
          endpoint_path_comercial_clientes_analise?: string | null
          endpoint_path_comercial_devolucoes?: string | null
          endpoint_path_comercial_devolucoes_ch?: string | null
          endpoint_path_comercial_devolucoes_total?: string | null
          endpoint_path_comercial_pedidos?: string | null
          endpoint_path_comercial_pedidos_ch?: string | null
          endpoint_path_comercial_pedidos_total?: string | null
          endpoint_path_comercial_produtos?: string | null
          endpoint_path_comercial_produtos_ch?: string | null
          endpoint_path_comercial_produtos_total?: string | null
          endpoint_path_comercial_totais?: string | null
          endpoint_path_dre?: string | null
          endpoint_path_duplicatas?: string | null
          endpoint_path_estoque_consolidado?: string | null
          endpoint_path_estoque_detalhado?: string | null
          endpoint_path_estoque_giro?: string | null
          endpoint_path_fluxo_caixa?: string | null
          endpoint_path_fluxo_caixa_movimento?: string | null
          endpoint_path_resumo?: string | null
          endpoint_path_variacao?: string | null
          endpoint_url?: string
          id?: string
          json_path_comercial?: string | null
          json_path_comercial_ch?: string | null
          json_path_comercial_devolucoes?: string | null
          json_path_comercial_produtos?: string | null
          json_path_comercial_produtos_ch?: string | null
          json_path_dre?: string | null
          json_path_duplicatas?: string | null
          json_path_estoque_consolidado?: string | null
          json_path_estoque_detalhado?: string | null
          json_path_estoque_giro?: string | null
          json_path_fluxo_caixa?: string | null
          json_path_fluxo_caixa_movimento?: string | null
          json_path_resumo?: string | null
          json_path_variacao?: string | null
          modulo_assistente_ia?: boolean | null
          modulo_comercial?: boolean | null
          modulo_dre?: boolean | null
          modulo_operacional?: boolean | null
          modulo_resumo?: boolean | null
          modulo_variacao?: boolean | null
          modulo_whatsapp?: boolean | null
          nome?: string
          possui_meta_vendedor?: boolean | null
          updated_at?: string | null
          usar_vps_intermediaria?: boolean
          vps_base_url?: string | null
          vps_cliente_identificador?: string | null
        }
        Relationships: []
      }
      estoque_assistant_config: {
        Row: {
          cod_empresa_bi: string
          created_at: string
          custom_prompt: string
          id: string
          updated_at: string
        }
        Insert: {
          cod_empresa_bi: string
          created_at?: string
          custom_prompt?: string
          id?: string
          updated_at?: string
        }
        Update: {
          cod_empresa_bi?: string
          created_at?: string
          custom_prompt?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      estoque_assistant_credits: {
        Row: {
          cod_empresa_bi: string
          created_at: string
          credits_limit: number
          credits_used: number
          id: string
          period_start: string
          updated_at: string
        }
        Insert: {
          cod_empresa_bi: string
          created_at?: string
          credits_limit?: number
          credits_used?: number
          id?: string
          period_start?: string
          updated_at?: string
        }
        Update: {
          cod_empresa_bi?: string
          created_at?: string
          credits_limit?: number
          credits_used?: number
          id?: string
          period_start?: string
          updated_at?: string
        }
        Relationships: []
      }
      metas_vendedores: {
        Row: {
          ano: number
          cod_empresa_bi: string
          cod_vendedor: string
          created_at: string
          criado_por: string | null
          id: string
          mes: number
          meta_valor: number
          nome_vendedor: string | null
          updated_at: string
        }
        Insert: {
          ano: number
          cod_empresa_bi: string
          cod_vendedor: string
          created_at?: string
          criado_por?: string | null
          id?: string
          mes: number
          meta_valor?: number
          nome_vendedor?: string | null
          updated_at?: string
        }
        Update: {
          ano?: number
          cod_empresa_bi?: string
          cod_vendedor?: string
          created_at?: string
          criado_por?: string | null
          id?: string
          mes?: number
          meta_valor?: number
          nome_vendedor?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cod_empresa_bi: string | null
          created_at: string | null
          email: string
          filiais_permitidas: string[] | null
          filial_id: string | null
          id: string
          must_change_password: boolean
          nome: string | null
          phone_e164: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cod_empresa_bi?: string | null
          created_at?: string | null
          email: string
          filiais_permitidas?: string[] | null
          filial_id?: string | null
          id?: string
          must_change_password?: boolean
          nome?: string | null
          phone_e164?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cod_empresa_bi?: string | null
          created_at?: string | null
          email?: string
          filiais_permitidas?: string[] | null
          filial_id?: string | null
          id?: string
          must_change_password?: boolean
          nome?: string | null
          phone_e164?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      seller_whitelist: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string | null
          phone_e164: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          phone_e164: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          phone_e164?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_whitelist_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_permissions: {
        Row: {
          created_at: string
          id: string
          modulo_assistente_ia: boolean
          modulo_comercial: boolean
          modulo_dre: boolean
          modulo_operacional: boolean
          modulo_resumo: boolean
          modulo_variacao: boolean
          modulo_whatsapp: boolean
          permissoes_paginas: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          modulo_assistente_ia?: boolean
          modulo_comercial?: boolean
          modulo_dre?: boolean
          modulo_operacional?: boolean
          modulo_resumo?: boolean
          modulo_variacao?: boolean
          modulo_whatsapp?: boolean
          permissoes_paginas?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          modulo_assistente_ia?: boolean
          modulo_comercial?: boolean
          modulo_dre?: boolean
          modulo_operacional?: boolean
          modulo_resumo?: boolean
          modulo_variacao?: boolean
          modulo_whatsapp?: boolean
          permissoes_paginas?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_agent_broadcasts: {
        Row: {
          agent_id: string
          company_id: string
          content: string | null
          created_at: string
          delivered_to: Json
          group_id: string | null
          id: string
          message_type: string
          related_conversation_id: string | null
          routing_metadata: Json
          source_name: string | null
          source_phone: string | null
          triggered_by: string
        }
        Insert: {
          agent_id: string
          company_id: string
          content?: string | null
          created_at?: string
          delivered_to?: Json
          group_id?: string | null
          id?: string
          message_type?: string
          related_conversation_id?: string | null
          routing_metadata?: Json
          source_name?: string | null
          source_phone?: string | null
          triggered_by?: string
        }
        Update: {
          agent_id?: string
          company_id?: string
          content?: string | null
          created_at?: string
          delivered_to?: Json
          group_id?: string | null
          id?: string
          message_type?: string
          related_conversation_id?: string | null
          routing_metadata?: Json
          source_name?: string | null
          source_phone?: string | null
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_agent_broadcasts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_agent_broadcasts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_agent_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_agent_group_members: {
        Row: {
          company_id: string
          created_at: string
          display_name: string | null
          group_id: string
          id: string
          is_active: boolean
          phone_e164: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          display_name?: string | null
          group_id: string
          id?: string
          is_active?: boolean
          phone_e164: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          display_name?: string | null
          group_id?: string
          id?: string
          is_active?: boolean
          phone_e164?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_agent_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_agent_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_agent_groups: {
        Row: {
          agent_id: string
          company_id: string
          created_at: string
          default_for_topics: string[]
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          company_id: string
          created_at?: string
          default_for_topics?: string[]
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          company_id?: string
          created_at?: string
          default_for_topics?: string[]
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_agent_groups_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_agent_interventions: {
        Row: {
          action_taken: string | null
          agent_id: string
          company_id: string
          conversation_id: string
          created_at: string
          details: Json
          id: string
          resolved_at: string | null
          resolved_by: string | null
          rule_triggered: string
        }
        Insert: {
          action_taken?: string | null
          agent_id: string
          company_id: string
          conversation_id: string
          created_at?: string
          details?: Json
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          rule_triggered: string
        }
        Update: {
          action_taken?: string | null
          agent_id?: string
          company_id?: string
          conversation_id?: string
          created_at?: string
          details?: Json
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          rule_triggered?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_agent_interventions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_agents: {
        Row: {
          avatar_url: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          instance_id: string | null
          is_active: boolean
          name: string
          persona_prompt: string
          phone_e164: string | null
          rules: Json
          supervises_clients: boolean
          tone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          instance_id?: string | null
          is_active?: boolean
          name: string
          persona_prompt?: string
          phone_e164?: string | null
          rules?: Json
          supervises_clients?: boolean
          tone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          instance_id?: string | null
          is_active?: boolean
          name?: string
          persona_prompt?: string
          phone_e164?: string | null
          rules?: Json
          supervises_clients?: boolean
          tone?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_contacts: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          instance_id: string | null
          is_group: boolean | null
          name: string | null
          phone_number: string | null
          profile_picture_url: string | null
          push_name: string | null
          remote_jid: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          instance_id?: string | null
          is_group?: boolean | null
          name?: string | null
          phone_number?: string | null
          profile_picture_url?: string | null
          push_name?: string | null
          remote_jid: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          instance_id?: string | null
          is_group?: boolean | null
          name?: string | null
          phone_number?: string | null
          profile_picture_url?: string | null
          push_name?: string | null
          remote_jid?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_contacts_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversation_notes: {
        Row: {
          company_id: string
          content: string
          conversation_id: string
          created_at: string | null
          created_by: string
          id: string
          is_pinned: boolean | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          content: string
          conversation_id: string
          created_at?: string | null
          created_by: string
          id?: string
          is_pinned?: boolean | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          content?: string
          conversation_id?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_pinned?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversation_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversation_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversation_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          assigned_to: string | null
          company_id: string
          contact_id: string
          created_at: string | null
          id: string
          instance_id: string | null
          is_from_me: boolean | null
          last_message_at: string | null
          last_message_preview: string | null
          sentiment: string | null
          sentiment_score: number | null
          status: string | null
          topics: string[] | null
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          contact_id: string
          created_at?: string | null
          id?: string
          instance_id?: string | null
          is_from_me?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          status?: string | null
          topics?: string[] | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          contact_id?: string
          created_at?: string | null
          id?: string
          instance_id?: string | null
          is_from_me?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          status?: string | null
          topics?: string[] | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instance_secrets: {
        Row: {
          api_key: string
          created_at: string | null
          id: string
          instance_id: string
        }
        Insert: {
          api_key: string
          created_at?: string | null
          id?: string
          instance_id: string
        }
        Update: {
          api_key?: string
          created_at?: string | null
          id?: string
          instance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instance_secrets_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          api_url: string
          company_id: string
          created_at: string | null
          default_seller_id: string | null
          id: string
          instance_name: string
          name: string
          phone_e164: string | null
          phone_number: string | null
          qr_code: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          api_url: string
          company_id: string
          created_at?: string | null
          default_seller_id?: string | null
          id?: string
          instance_name: string
          name: string
          phone_e164?: string | null
          phone_number?: string | null
          qr_code?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          api_url?: string
          company_id?: string
          created_at?: string | null
          default_seller_id?: string | null
          id?: string
          instance_name?: string
          name?: string
          phone_e164?: string | null
          phone_number?: string | null
          qr_code?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instances_default_seller_id_fkey"
            columns: ["default_seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_macros: {
        Row: {
          category: string | null
          company_id: string
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          shortcut: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          category?: string | null
          company_id: string
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          shortcut: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          category?: string | null
          company_id?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          shortcut?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_macros_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_macros_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          company_id: string
          contact_id: string | null
          content: string | null
          conversation_id: string
          created_at: string | null
          edited_at: string | null
          from_me: boolean | null
          id: string
          is_edited: boolean | null
          media_caption: string | null
          media_mimetype: string | null
          media_url: string | null
          message_id: string
          message_type: string | null
          quoted_content: string | null
          quoted_message_id: string | null
          remote_jid: string
          status: string | null
          timestamp: string
          transcription: string | null
        }
        Insert: {
          company_id: string
          contact_id?: string | null
          content?: string | null
          conversation_id: string
          created_at?: string | null
          edited_at?: string | null
          from_me?: boolean | null
          id?: string
          is_edited?: boolean | null
          media_caption?: string | null
          media_mimetype?: string | null
          media_url?: string | null
          message_id: string
          message_type?: string | null
          quoted_content?: string | null
          quoted_message_id?: string | null
          remote_jid: string
          status?: string | null
          timestamp: string
          transcription?: string | null
        }
        Update: {
          company_id?: string
          contact_id?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          edited_at?: string | null
          from_me?: boolean | null
          id?: string
          is_edited?: boolean | null
          media_caption?: string | null
          media_mimetype?: string | null
          media_url?: string | null
          message_id?: string
          message_type?: string | null
          quoted_content?: string | null
          quoted_message_id?: string | null
          remote_jid?: string
          status?: string | null
          timestamp?: string
          transcription?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_sentiment_analysis: {
        Row: {
          agent_tone: string | null
          analyzed_at: string | null
          analyzed_messages_count: number | null
          company_id: string
          complexity: string | null
          confidence_score: number | null
          conversation_flow: string | null
          conversation_id: string
          conversation_type: string | null
          customer_intent: string | null
          empathy_level: string | null
          first_contact_resolution: boolean | null
          id: string
          key_moments: Json | null
          message_clarity: string | null
          recommendations: Json | null
          resolution_status: string | null
          response_time_estimate: string | null
          satisfaction_indicators: Json | null
          satisfaction_level: string | null
          satisfaction_score: number | null
          sentiment: string
          sentiment_evolution: string | null
          service_quality_rating: number | null
          solution_provided: boolean | null
          summary: string | null
          topics: string[] | null
          urgency_level: string | null
        }
        Insert: {
          agent_tone?: string | null
          analyzed_at?: string | null
          analyzed_messages_count?: number | null
          company_id: string
          complexity?: string | null
          confidence_score?: number | null
          conversation_flow?: string | null
          conversation_id: string
          conversation_type?: string | null
          customer_intent?: string | null
          empathy_level?: string | null
          first_contact_resolution?: boolean | null
          id?: string
          key_moments?: Json | null
          message_clarity?: string | null
          recommendations?: Json | null
          resolution_status?: string | null
          response_time_estimate?: string | null
          satisfaction_indicators?: Json | null
          satisfaction_level?: string | null
          satisfaction_score?: number | null
          sentiment: string
          sentiment_evolution?: string | null
          service_quality_rating?: number | null
          solution_provided?: boolean | null
          summary?: string | null
          topics?: string[] | null
          urgency_level?: string | null
        }
        Update: {
          agent_tone?: string | null
          analyzed_at?: string | null
          analyzed_messages_count?: number | null
          company_id?: string
          complexity?: string | null
          confidence_score?: number | null
          conversation_flow?: string | null
          conversation_id?: string
          conversation_type?: string | null
          customer_intent?: string | null
          empathy_level?: string | null
          first_contact_resolution?: boolean | null
          id?: string
          key_moments?: Json | null
          message_clarity?: string | null
          recommendations?: Json | null
          resolution_status?: string | null
          response_time_estimate?: string | null
          satisfaction_indicators?: Json | null
          satisfaction_level?: string | null
          satisfaction_score?: number | null
          sentiment?: string
          sentiment_evolution?: string | null
          service_quality_rating?: number | null
          solution_provided?: boolean | null
          summary?: string | null
          topics?: string[] | null
          urgency_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_sentiment_analysis_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_sentiment_analysis_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_company: { Args: { p_company_id: string }; Returns: boolean }
      can_manage_users_in_company: {
        Args: { target_company_code: string }
        Returns: boolean
      }
      get_user_empresa: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_assistant_credit: {
        Args: { p_cod_empresa_bi: string }
        Returns: Json
      }
      is_gerencial_user: { Args: never; Returns: boolean }
      is_master_user: { Args: never; Returns: boolean }
      is_vendedor_user: { Args: never; Returns: boolean }
      normalize_phone_e164: { Args: { phone: string }; Returns: string }
    }
    Enums: {
      app_role: "master" | "client" | "gerencial" | "vendedor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["master", "client", "gerencial", "vendedor"],
    },
  },
} as const
