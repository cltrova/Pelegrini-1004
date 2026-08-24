import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useAuth } from '@/contexts/AuthContext';
import { normalizePhoneE164 } from '@/utils/phoneUtils';
import { toast } from 'sonner';

export interface Vendedor {
  id: string;
  user_id: string;
  nome: string | null;
  email: string;
  phone_e164: string | null;
  cod_empresa_bi: string | null;
  status: string | null;
  created_at: string | null;
}

export interface WhitelistEntry {
  id: string;
  company_id: string;
  phone_e164: string;
  name: string | null;
  is_active: boolean;
  created_at: string | null;
}

export interface CreateVendedorData {
  nome?: string;
  phone: string;
  cod_empresa_bi: string;
  company_id: string;
}

/**
 * Hook para buscar vendedores da empresa atual
 */
export function useVendedores() {
  const { empresa } = useEmpresaAtiva();
  const { isMaster } = useAuth();
  
  return useQuery({
    queryKey: ['vendedores', empresa?.id, empresa?.cod_empresa_bi],
    queryFn: async () => {
      if (!empresa?.id) return [];
      
      // 1. Buscar da whitelist primeiro (fonte principal)
      const { data: whitelist, error: whitelistError } = await supabase
        .from('seller_whitelist')
        .select('*')
        .eq('company_id', empresa.id)
        .order('created_at', { ascending: false });
      
      if (whitelistError) {
        console.error('Erro ao buscar whitelist:', whitelistError);
        throw whitelistError;
      }
      
      // 2. Buscar profiles com role vendedor da empresa
      let profilesQuery = supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          nome,
          email,
          phone_e164,
          cod_empresa_bi,
          status,
          created_at
        `)
        .eq('cod_empresa_bi', empresa.cod_empresa_bi)
        .order('nome', { ascending: true });
      
      const { data: profiles, error: profilesError } = await profilesQuery;
      
      if (profilesError) {
        console.error('Erro ao buscar profiles:', profilesError);
        throw profilesError;
      }
      
      // 3. Buscar roles para filtrar apenas vendedores
      const userIds = profiles?.map(p => p.user_id) || [];
      let vendedorUserIds = new Set<string>();
      
      if (userIds.length > 0) {
        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds)
          .eq('role', 'vendedor');
        
        if (rolesError) {
          console.error('Erro ao buscar roles:', rolesError);
          throw rolesError;
        }
        
        vendedorUserIds = new Set(roles?.map(r => r.user_id) || []);
      }
      
      // 4. Criar mapa de profiles por telefone
      const profilesByPhone = new Map<string, typeof profiles[0]>();
      profiles?.forEach(p => {
        if (p.phone_e164 && vendedorUserIds.has(p.user_id)) {
          profilesByPhone.set(p.phone_e164, p);
        }
      });
      
      // 5. Combinar whitelist com profiles
      const vendedores: Vendedor[] = [];
      const processedPhones = new Set<string>();
      
      // Primeiro, adicionar da whitelist
      whitelist?.forEach(entry => {
        const profile = profilesByPhone.get(entry.phone_e164);
        processedPhones.add(entry.phone_e164);
        
        vendedores.push({
          id: profile?.id || entry.id,
          user_id: profile?.user_id || entry.id,
          nome: entry.name || profile?.nome || null,
          email: profile?.email || `${entry.phone_e164}@pending.local`,
          phone_e164: entry.phone_e164,
          cod_empresa_bi: empresa.cod_empresa_bi,
          status: entry.is_active ? (profile?.status || 'pending_login') : 'inactive',
          created_at: profile?.created_at || entry.created_at,
        });
      });
      
      // Depois, adicionar profiles vendedores que não estão na whitelist
      profiles?.forEach(p => {
        if (vendedorUserIds.has(p.user_id) && p.phone_e164 && !processedPhones.has(p.phone_e164)) {
          vendedores.push(p as Vendedor);
        }
      });
      
      // Ordenar por nome
      vendedores.sort((a, b) => {
        const nameA = a.nome || a.email || '';
        const nameB = b.nome || b.email || '';
        return nameA.localeCompare(nameB);
      });
      
      return vendedores;
    },
    enabled: !!empresa?.id,
  });
}

/**
 * Hook para buscar whitelist de vendedores
 */
export function useSellerWhitelist() {
  const { empresa } = useEmpresaAtiva();
  
  return useQuery({
    queryKey: ['seller-whitelist', empresa?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seller_whitelist')
        .select('*')
        .eq('company_id', empresa?.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as WhitelistEntry[];
    },
    enabled: !!empresa?.id,
  });
}

/**
 * Hook para criar/cadastrar um novo vendedor
 */
export function useCreateVendedor() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ nome, phone, cod_empresa_bi, company_id }: CreateVendedorData) => {
      const phone_e164 = normalizePhoneE164(phone);
      
      if (!phone_e164) {
        throw new Error('Telefone inválido');
      }
      
      // 1. Inserir/atualizar na whitelist
      const { error: whitelistError } = await supabase
        .from('seller_whitelist')
        .upsert({
          company_id,
          phone_e164,
          name: nome || null,
          is_active: true,
          created_by: user?.id,
        }, {
          onConflict: 'company_id,phone_e164',
        });
      
      if (whitelistError) {
        console.error('Erro ao inserir na whitelist:', whitelistError);
        throw whitelistError;
      }
      
      // 2. Verificar se já existe profile com esse telefone
      const { data: existingProfile, error: searchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone_e164', phone_e164)
        .maybeSingle();
      
      if (searchError) {
        console.error('Erro ao buscar profile existente:', searchError);
        throw searchError;
      }
      
      let profileUserId: string;
      
      if (existingProfile) {
        // Atualizar profile existente
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            cod_empresa_bi,
            nome: nome || existingProfile.nome,
          })
          .eq('id', existingProfile.id);
        
        if (updateError) {
          console.error('Erro ao atualizar profile:', updateError);
          throw updateError;
        }
        
        profileUserId = existingProfile.user_id;
      } else {
        // Criar novo profile (pré-cadastro)
        const newUserId = crypto.randomUUID();
        const placeholderEmail = `pending_${phone_e164.replace(/\+/g, '')}@placeholder.local`;
        
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: newUserId,
            email: placeholderEmail,
            nome: nome || null,
            phone_e164,
            cod_empresa_bi,
            status: 'pending_login',
          });
        
        if (insertError) {
          console.error('Erro ao criar profile:', insertError);
          throw insertError;
        }
        
        profileUserId = newUserId;
      }
      
      // 3. Garantir role vendedor
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: profileUserId,
          role: 'vendedor',
        }, {
          onConflict: 'user_id,role',
          ignoreDuplicates: true,
        });
      
      if (roleError) {
        console.error('Erro ao atribuir role:', roleError);
        throw roleError;
      }
      
      return { success: true, phone_e164, user_id: profileUserId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedores'] });
      queryClient.invalidateQueries({ queryKey: ['seller-whitelist'] });
      toast.success('Vendedor cadastrado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao criar vendedor:', error);
      toast.error('Erro ao cadastrar vendedor. Tente novamente.');
    },
  });
}

/**
 * Hook para remover vendedor da whitelist
 */
export function useRemoveVendedor() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ whitelistId, profileId }: { whitelistId?: string; profileId?: string }) => {
      // Desativar na whitelist
      if (whitelistId) {
        const { error } = await supabase
          .from('seller_whitelist')
          .update({ is_active: false })
          .eq('id', whitelistId);
        
        if (error) throw error;
      }
      
      // Opcional: atualizar status do profile
      if (profileId) {
        await supabase
          .from('profiles')
          .update({ status: 'inactive' })
          .eq('id', profileId);
      }
      
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedores'] });
      queryClient.invalidateQueries({ queryKey: ['seller-whitelist'] });
      toast.success('Vendedor removido com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao remover vendedor:', error);
      toast.error('Erro ao remover vendedor.');
    },
  });
}

/**
 * Hook para reativar vendedor
 */
export function useReactivateVendedor() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ whitelistId, profileId }: { whitelistId?: string; profileId?: string }) => {
      if (whitelistId) {
        const { error } = await supabase
          .from('seller_whitelist')
          .update({ is_active: true })
          .eq('id', whitelistId);
        
        if (error) throw error;
      }
      
      if (profileId) {
        await supabase
          .from('profiles')
          .update({ status: 'pending_login' })
          .eq('id', profileId);
      }
      
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedores'] });
      queryClient.invalidateQueries({ queryKey: ['seller-whitelist'] });
      toast.success('Vendedor reativado!');
    },
  });
}
