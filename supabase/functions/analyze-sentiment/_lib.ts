// Pure helper functions extracted from index.ts so they can be unit-tested
// without spinning up Deno.serve / OpenAI / Supabase.

export type SalesStage =
  | "cold_lead"
  | "negotiating"
  | "closed_won"
  | "closed_lost"
  | "abandoned";

export type ResolutionStatus =
  | "resolved"
  | "partially_resolved"
  | "unresolved"
  | "pending";

export interface EnrichedIndicators {
  indicators: string[];
  sales: {
    stage: SalesStage;
    buying_signals: string[];
    objections: string[];
    loss_reason: string | null;
  } | null;
}

const STAGE_TO_RESOLUTION: Record<SalesStage, ResolutionStatus> = {
  closed_won: "resolved",
  closed_lost: "unresolved",
  abandoned: "unresolved",
  negotiating: "pending",
  cold_lead: "pending",
};

const VALID_STAGES = new Set<SalesStage>([
  "cold_lead",
  "negotiating",
  "closed_won",
  "closed_lost",
  "abandoned",
]);

/**
 * Parse the raw OpenAI text response, stripping markdown code fences.
 * Throws if not valid JSON.
 */
export function parseAnalysisResponse(raw: string): any {
  const cleaned = raw
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  return JSON.parse(cleaned);
}

/**
 * Build the enriched satisfaction_indicators jsonb payload.
 * - Always returns { indicators: string[], sales: object | null }
 * - sales is null unless a valid sales_stage is present
 * - Tolerates missing/partial fields from the LLM
 */
export function buildEnrichedIndicators(analysis: any): EnrichedIndicators {
  const ctx = analysis?.conversation_context ?? {};
  const rawIndicators = analysis?.customer_satisfaction?.indicators;
  const indicators = Array.isArray(rawIndicators) ? rawIndicators : [];

  const stage = ctx.sales_stage as SalesStage | null | undefined;
  const hasValidStage = !!stage && VALID_STAGES.has(stage);

  return {
    indicators,
    sales: hasValidStage
      ? {
          stage: stage as SalesStage,
          buying_signals: Array.isArray(ctx.buying_signals)
            ? ctx.buying_signals
            : [],
          objections: Array.isArray(ctx.objections) ? ctx.objections : [],
          loss_reason: ctx.loss_reason ?? null,
        }
      : null,
  };
}

/**
 * Decide the resolution_status to persist.
 * - Sales conversations with a valid sales_stage are mapped deterministically
 *   so KPIs (taxa de resolução) stay consistent.
 * - Everything else falls back to the LLM's own resolution_status.
 */
export function resolveFinalResolutionStatus(
  analysis: any,
): ResolutionStatus | undefined {
  const ctx = analysis?.conversation_context ?? {};
  const stage = ctx.sales_stage as SalesStage | null | undefined;

  if (
    ctx.type === "sales" &&
    stage &&
    VALID_STAGES.has(stage)
  ) {
    return STAGE_TO_RESOLUTION[stage];
  }

  return analysis?.resolution_status;
}

/**
 * OpenAI request defaults — exposed so tests can lock min token budget
 * and ensure the prompt isn't accidentally truncated to old values.
 */
export const OPENAI_REQUEST_DEFAULTS = {
  model: "gpt-4o-mini",
  temperature: 0.2,
  max_tokens: 2000,
} as const;

/**
 * System prompt for analyze-sentiment.
 * Lives here (instead of inline in index.ts) so tests can assert that
 * critical classification rules continue to be present.
 */
export const SYSTEM_PROMPT = `Você é um analista sênior de qualidade de atendimento e funil de vendas via WhatsApp Business.
Analise a conversa fornecida com RIGOR e retorne APENAS um JSON válido com a seguinte estrutura:

{
  "customer_satisfaction": {
    "level": "very_satisfied" | "satisfied" | "neutral" | "dissatisfied" | "very_dissatisfied",
    "score": número de 1 a 10,
    "indicators": ["indicador1", "indicador2"]
  },
  "sentiment": {
    "overall": "positive" | "neutral" | "negative",
    "evolution": "improved" | "stable" | "worsened",
    "confidence": número entre 0.0 e 1.0
  },
  "service_quality": {
    "rating": número de 1 a 10,
    "agent_tone": "professional" | "friendly" | "cold" | "rude",
    "empathy_level": "high" | "medium" | "low",
    "solution_provided": true ou false,
    "first_contact_resolution": true ou false
  },
  "response_metrics": {
    "agent_response_time_estimate": "fast" | "moderate" | "slow",
    "conversation_flow": "smooth" | "interrupted" | "confusing",
    "message_clarity": "clear" | "moderate" | "unclear"
  },
  "conversation_context": {
    "type": "support" | "sales" | "complaint" | "inquiry" | "feedback" | "other",
    "urgency": "high" | "medium" | "low",
    "complexity": "simple" | "moderate" | "complex",
    "sales_stage": "cold_lead" | "negotiating" | "closed_won" | "closed_lost" | "abandoned" | null,
    "buying_signals": ["sinal1", "sinal2"],
    "objections": ["objeção1"],
    "loss_reason": "preço" | "prazo" | "concorrência" | "produto_indisponível" | "sem_resposta" | "outro" | null
  },
  "topics": ["tópico1", "tópico2", "tópico3"],
  "summary": "Resumo executivo da conversa em até 3 frases",
  "recommendations": ["recomendação 1", "recomendação 2"],
  "key_moments": [
    {"type": "positive" | "negative", "description": "descrição breve do momento chave"}
  ],
  "customer_intent": "intenção principal do cliente em uma frase",
  "resolution_status": "resolved" | "partially_resolved" | "unresolved" | "pending"
}

═══════════════════════════════════════════════════
CRITÉRIOS DE CLASSIFICAÇÃO DE TIPO (conversation_context.type)
═══════════════════════════════════════════════════

- "sales": há intenção CLARA de compra do cliente OU oferta ATIVA do vendedor envolvendo produto, preço, condições ou fechamento. Não basta ter preço mencionado — precisa de intenção bilateral.
- "support": cliente pede ajuda com algo JÁ comprado (uso, defeito, dúvida pós-venda, troca, garantia).
- "complaint": cliente reclama de produto, atendimento, cobrança ou prazo.
- "inquiry": pergunta genérica sem intenção clara de compra (ex: "vocês abrem sábado?", "qual o endereço?", "vocês têm tal coisa?" sem follow-up).
- "feedback": retorno espontâneo (elogio ou sugestão) sem demanda comercial.
- "other": não se encaixa nos demais.

REGRA CRÍTICA: NÃO classifique como "sales" só porque alguém perguntou preço. Precisa de evidência de negociação ou demonstração real de interesse de compra.

═══════════════════════════════════════════════════
CRITÉRIOS DE sales_stage (preencher SOMENTE se type = "sales", senão null)
═══════════════════════════════════════════════════

- "cold_lead": cliente perguntou preço/produto e sumiu, sem demonstrar intenção real (1-3 mensagens, depois silêncio).
- "negotiating": conversa ATIVA com discussão de preço, prazo, parcelamento, condições — sem decisão final ainda. Há troca recente nos dois sentidos.
- "closed_won": evidência TEXTUAL de fechamento. Exemplos: "fechado", "pode mandar", "vou pagar", "manda o pix", "confirmado", envio de dados de entrega/pagamento, confirmação de pedido. Não inferir só por sentimento positivo.
- "closed_lost": cliente RECUSOU explicitamente. Exemplos: "não vou levar", "muito caro", "vou em outro lugar", "deixa pra próxima", "não tenho interesse".
- "abandoned": vendedor fez oferta/proposta e cliente NÃO RESPONDEU mais, OU disse "vou pensar"/"depois te respondo" e nunca voltou.

REGRAS CRÍTICAS:
- "Vou pensar" / "depois te respondo" SEM retorno posterior = "abandoned", NUNCA "negotiating".
- Se vendedor fez oferta e cliente sumiu, sales_stage = "abandoned" e loss_reason = "sem_resposta".
- Só marque "closed_won" com EVIDÊNCIA TEXTUAL clara de aceite/fechamento.
- Se a última mensagem do cliente foi há muito tempo relativo ao fluxo da conversa e sem confirmação, prefira "abandoned" a "negotiating".

═══════════════════════════════════════════════════
buying_signals (sinais de interesse de compra detectados)
═══════════════════════════════════════════════════
Exemplos: "perguntou forma de pagamento", "pediu nota fiscal", "perguntou prazo de entrega", "pediu desconto", "confirmou disponibilidade", "enviou endereço". Liste só o que houver evidência. Pode ser array vazio.

═══════════════════════════════════════════════════
objections (objeções levantadas pelo cliente)
═══════════════════════════════════════════════════
Exemplos: "achou caro", "queria parcelar mais vezes", "prazo muito longo", "produto não tem na cor desejada". Pode ser array vazio.

═══════════════════════════════════════════════════
loss_reason (preencher se sales_stage in ["closed_lost", "abandoned"], senão null)
═══════════════════════════════════════════════════
- "preço": cliente achou caro
- "prazo": prazo de entrega/pagamento inadequado
- "concorrência": foi pra outro fornecedor
- "produto_indisponível": item sem estoque ou sem variação desejada
- "sem_resposta": cliente sumiu sem dar motivo
- "outro": qualquer outra razão

═══════════════════════════════════════════════════
MAPEAMENTO sales_stage → resolution_status
═══════════════════════════════════════════════════
- closed_won → "resolved"
- closed_lost → "unresolved"
- abandoned → "unresolved"
- negotiating → "pending"
- cold_lead → "pending"
- (não-sales) → use seu julgamento normal

═══════════════════════════════════════════════════
key_moments — quando type = "sales", priorize:
═══════════════════════════════════════════════════
- Momento de demonstração de interesse forte do cliente
- Momento de fechamento ou recusa
- Momento em que vendedor falhou em responder uma pergunta crítica (negativo)
- Momento em que vendedor superou objeção (positivo)

Retorne SOMENTE o JSON, sem explicações adicionais ou markdown.`;

