
CREATE TABLE public.cobranca_agente_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_empresa_bi text NOT NULL UNIQUE,
  agente_nome text NOT NULL DEFAULT 'Agente de Cobrança',
  persona_prompt text NOT NULL DEFAULT 'Você é um assistente de cobrança cordial, profissional e firme. Sempre trate o cliente pelo nome, seja claro sobre valores e datas, ofereça canais para regularização e mantenha um tom respeitoso.',
  enviar_d3 boolean NOT NULL DEFAULT true,
  enviar_d1 boolean NOT NULL DEFAULT true,
  enviar_d0 boolean NOT NULL DEFAULT true,
  enviar_atrasado boolean NOT NULL DEFAULT true,
  template_d3 text NOT NULL DEFAULT 'Olá {cliente}, tudo bem? 👋

Passando para lembrar que você tem uma fatura no valor de *{valor}* que vence em *{vencimento}* (em 3 dias).

Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem. Qualquer dúvida estamos à disposição!',
  template_d1 text NOT NULL DEFAULT 'Olá {cliente}! 

Lembrete amigável: sua fatura no valor de *{valor}* vence *amanhã ({vencimento})*.

Se precisar da segunda via ou tiver qualquer dúvida, é só responder esta mensagem. Obrigado! 🙌',
  template_d0 text NOT NULL DEFAULT 'Olá {cliente}, bom dia!

Lembramos que sua fatura no valor de *{valor}* vence *hoje ({vencimento})*.

Para evitar juros e multa, garanta o pagamento ainda hoje. Qualquer dúvida estamos por aqui. 🙏',
  template_atrasado text NOT NULL DEFAULT 'Olá {cliente},

Identificamos que sua fatura no valor de *{valor}*, com vencimento em *{vencimento}*, está em aberto há *{dias_atraso} dia(s)*.

Pedimos a gentileza de regularizar o quanto antes. Caso já tenha pago, por favor nos envie o comprovante. Estamos à disposição para negociar.',
  rodape text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cobranca_agente_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read cobranca_agente_config by company"
ON public.cobranca_agente_config FOR SELECT
USING (is_master_user() OR cod_empresa_bi = get_user_empresa());

CREATE POLICY "Manage cobranca_agente_config by company"
ON public.cobranca_agente_config FOR ALL
USING (is_master_user() OR (is_gerencial_user() AND cod_empresa_bi = get_user_empresa()))
WITH CHECK (is_master_user() OR (is_gerencial_user() AND cod_empresa_bi = get_user_empresa()));

CREATE TRIGGER trg_cobranca_agente_config_updated
BEFORE UPDATE ON public.cobranca_agente_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.cobranca_clientes_telefones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_empresa_bi text NOT NULL,
  cod_cliente text NOT NULL,
  cliente_nome text,
  phone_e164 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cod_empresa_bi, cod_cliente)
);

ALTER TABLE public.cobranca_clientes_telefones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read cobranca_telefones by company"
ON public.cobranca_clientes_telefones FOR SELECT
USING (is_master_user() OR cod_empresa_bi = get_user_empresa());

CREATE POLICY "Manage cobranca_telefones by company"
ON public.cobranca_clientes_telefones FOR ALL
USING (is_master_user() OR (is_gerencial_user() AND cod_empresa_bi = get_user_empresa()))
WITH CHECK (is_master_user() OR (is_gerencial_user() AND cod_empresa_bi = get_user_empresa()));

CREATE TRIGGER trg_cobranca_telefones_updated
BEFORE UPDATE ON public.cobranca_clientes_telefones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.cobranca_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_empresa_bi text NOT NULL,
  duplicata_id text,
  cod_cliente text,
  cliente_nome text,
  phone_e164 text NOT NULL,
  gatilho text NOT NULL,
  valor numeric,
  data_vencimento date,
  dias_atraso integer,
  conteudo text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  erro text,
  enviado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cobranca_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read cobranca_envios by company"
ON public.cobranca_envios FOR SELECT
USING (is_master_user() OR cod_empresa_bi = get_user_empresa());

CREATE POLICY "Insert cobranca_envios by company"
ON public.cobranca_envios FOR INSERT
WITH CHECK (is_master_user() OR cod_empresa_bi = get_user_empresa());

CREATE INDEX idx_cobranca_envios_empresa ON public.cobranca_envios (cod_empresa_bi, created_at DESC);
