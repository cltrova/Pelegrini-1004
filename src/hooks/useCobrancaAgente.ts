import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useToast } from '@/hooks/use-toast';

export interface CobrancaConfig {
  id?: string;
  cod_empresa_bi: string;
  agente_nome: string;
  persona_prompt: string;
  enviar_d3: boolean;
  enviar_d1: boolean;
  enviar_d0: boolean;
  enviar_atrasado: boolean;
  template_d3: string;
  template_d1: string;
  template_d0: string;
  template_atrasado: string;
  rodape: string;
}

const DEFAULTS: Omit<CobrancaConfig, 'cod_empresa_bi'> = {
  agente_nome: 'Agente de Cobrança',
  persona_prompt:
    'Você é um assistente de cobrança cordial, profissional e firme. Sempre trate o cliente pelo nome, seja claro sobre valores e datas, ofereça canais para regularização e mantenha um tom respeitoso.',
  enviar_d3: true,
  enviar_d1: true,
  enviar_d0: true,
  enviar_atrasado: true,
  template_d3:
    'Olá {cliente}, tudo bem? 👋\n\nPassando para lembrar que você tem uma fatura no valor de *{valor}* que vence em *{vencimento}* (em 3 dias).\n\nCaso já tenha efetuado o pagamento, por favor desconsidere esta mensagem.',
  template_d1:
    'Olá {cliente}!\n\nLembrete amigável: sua fatura no valor de *{valor}* vence *amanhã ({vencimento})*.\n\nQualquer dúvida estamos por aqui. 🙌',
  template_d0:
    'Olá {cliente}, bom dia!\n\nLembramos que sua fatura no valor de *{valor}* vence *hoje ({vencimento})*. Para evitar juros e multa, garanta o pagamento ainda hoje. 🙏',
  template_atrasado:
    'Olá {cliente},\n\nIdentificamos que sua fatura no valor de *{valor}*, com vencimento em *{vencimento}*, está em aberto há *{dias_atraso} dia(s)*.\n\nPedimos a gentileza de regularizar o quanto antes. Estamos à disposição.',
  rodape: '',
};

export function useCobrancaConfig() {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const qc = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['cobranca-config', codEmpresaAtiva],
    enabled: !!codEmpresaAtiva,
    queryFn: async (): Promise<CobrancaConfig> => {
      const { data, error } = await supabase
        .from('cobranca_agente_config')
        .select('*')
        .eq('cod_empresa_bi', codEmpresaAtiva!)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as CobrancaConfig;
      return { cod_empresa_bi: codEmpresaAtiva!, ...DEFAULTS };
    },
  });

  const save = useMutation({
    mutationFn: async (cfg: CobrancaConfig) => {
      const { error } = await supabase
        .from('cobranca_agente_config')
        .upsert(cfg, { onConflict: 'cod_empresa_bi' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cobranca-config', codEmpresaAtiva] });
      toast({ title: 'Configuração salva' });
    },
    onError: (e: any) => toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' }),
  });

  return { config: query.data, isLoading: query.isLoading, save };
}

export interface CobrancaTelefone {
  id?: string;
  cod_empresa_bi: string;
  cod_cliente: string;
  cliente_nome?: string | null;
  phone_e164: string;
}

export function useCobrancaTelefones() {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const qc = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['cobranca-telefones', codEmpresaAtiva],
    enabled: !!codEmpresaAtiva,
    queryFn: async (): Promise<Record<string, CobrancaTelefone>> => {
      const { data, error } = await supabase
        .from('cobranca_clientes_telefones')
        .select('*')
        .eq('cod_empresa_bi', codEmpresaAtiva!);
      if (error) throw error;
      const map: Record<string, CobrancaTelefone> = {};
      (data || []).forEach((t: any) => { map[t.cod_cliente] = t; });
      return map;
    },
  });

  const upsert = useMutation({
    mutationFn: async (t: CobrancaTelefone) => {
      const { error } = await supabase
        .from('cobranca_clientes_telefones')
        .upsert(t, { onConflict: 'cod_empresa_bi,cod_cliente' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cobranca-telefones', codEmpresaAtiva] });
      toast({ title: 'Telefone salvo' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  return { telefones: query.data ?? {}, isLoading: query.isLoading, upsert };
}

export function useEnviarCobranca() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { codEmpresaAtiva } = useEmpresaAtiva();
  return useMutation({
    mutationFn: async (payload: {
      phone_e164: string;
      content: string;
      duplicata_id?: string;
      cod_cliente?: string;
      cliente_nome?: string;
      gatilho: 'd3' | 'd1' | 'd0' | 'atrasado';
      valor?: number;
      data_vencimento?: string;
      dias_atraso?: number;
    }) => {
      if (!codEmpresaAtiva) throw new Error('Empresa não selecionada');
      const { data, error } = await supabase.functions.invoke('cobranca-send', {
        body: { ...payload, cod_empresa_bi: codEmpresaAtiva },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cobranca-envios'] });
      toast({ title: 'Cobrança enviada com sucesso' });
    },
    onError: (e: any) => toast({ title: 'Erro ao enviar', description: e.message, variant: 'destructive' }),
  });
}
