// Agent Router — roteamento híbrido (menção @ + LLM) para distribuir mensagens
// recebidas pelo número de um agente para os destinos apropriados.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Threshold mínimo de confiança da IA para aceitar o roteamento
const LLM_CONFIDENCE_THRESHOLD = 0.7;
// Modelo de classificação (rápido e barato) — OpenAI direto
const ROUTING_MODEL = 'gpt-4o-mini';

interface RouteRequest {
  agent_id: string;
  source_phone_e164?: string;
  source_name?: string;
  content: string;
  message_type?: 'text';
  triggered_by?: 'internal_chat' | 'client_supervision';
  related_conversation_id?: string | null;
  // Quando chamado pela rota de supervisão ou pela UI de teste, força o destino:
  target_group_id?: string;
  // Para testes: incluir o próprio remetente nos destinatários
  include_sender?: boolean;
  // Permite desativar o classificador LLM (debug / teste)
  disable_llm?: boolean;
}

type RoutingMethod = 'mention' | 'llm' | 'broadcast' | 'fallback' | 'forced';

function normalize(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

function normalizeName(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Extrai todas as menções @xxx do texto (suporta acentos)
function extractMentions(text: string): string[] {
  const matches = text.match(/@([\p{L}\d_]+)/giu) || [];
  return matches.map((m) => normalizeName(m.replace(/^@/, '')));
}

// Chama o provedor de IA configurado com tool calling para decidir o destino.
async function classifyRouting(params: {
  message: string;
  members: Array<{ id: string; display_name: string | null; group_id: string; phone_e164: string }>;
  groups: Array<{ id: string; name: string }>;
  senderName?: string;
}): Promise<{
  intencao:
    | 'pergunta_sobre_pessoa'
    | 'pergunta_sobre_grupo'
    | 'encaminhar_para_pessoa'
    | 'encaminhar_para_grupo'
    | 'broadcast'
    | 'incerto';
  destino_tipo: 'pessoa' | 'grupo' | 'broadcast' | 'incerto';
  destino_id?: string;
  confianca: number;
  raciocinio?: string;
} | null> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    console.warn('[agent-router] OPENAI_API_KEY ausente, pulando LLM');
    return null;
  }

  const memberList = params.members
    .map((m) => `- id="${m.id}" nome="${m.display_name || '(sem nome)'}" grupo_id="${m.group_id}"`)
    .join('\n');
  const groupList = params.groups
    .map((g) => `- id="${g.id}" nome="${g.name}"`)
    .join('\n');

  const systemPrompt = `Você é um roteador de mensagens em um sistema de WhatsApp corporativo.
Sua tarefa é decidir a INTENÇÃO de uma mensagem e o destino correspondente.

Diferencie cuidadosamente PERGUNTA SOBRE alguém vs ENCAMINHAR PARA alguém:
- "Como está o desempenho do João?" → intencao=pergunta_sobre_pessoa, destino_tipo=pessoa, destino_id=<id do João>
  (o remetente quer SABER algo sobre o João — devemos RESPONDER ao remetente, não falar com o João)
- "Me dá um resumo do time de vendas" → intencao=pergunta_sobre_grupo, destino_tipo=grupo, destino_id=<id do grupo>
- "@João tudo bem?" ou "Avisa o João que cheguei" → intencao=encaminhar_para_pessoa, destino_tipo=pessoa, destino_id=<id do João>
  (o remetente quer FALAR COM o João — devemos encaminhar a mensagem)
- "Pessoal do time, reunião 14h" → intencao=encaminhar_para_grupo, destino_tipo=grupo, destino_id=<id do grupo>
- "Bom dia time!" → intencao=broadcast, destino_tipo=broadcast
- Não conseguiu decidir → intencao=incerto, destino_tipo=incerto

Regra de ouro: se a mensagem é uma PERGUNTA, DÚVIDA ou PEDIDO DE INFORMAÇÃO sobre uma pessoa/equipe,
use pergunta_sobre_*. Se é uma mensagem para ser ENTREGUE àquela pessoa/equipe, use encaminhar_para_*.

A confiança deve refletir honestamente quão certo você está (0.0 a 1.0).
SEMPRE chame a tool route_message com o resultado.`;

  const userPrompt = `Remetente: ${params.senderName || 'desconhecido'}
Mensagem: "${params.message}"

PESSOAS disponíveis:
${memberList || '(nenhuma)'}

GRUPOS disponíveis:
${groupList || '(nenhum)'}`;

  const body = {
    model: ROUTING_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'route_message',
          description: 'Decide o destino da mensagem',
          parameters: {
            type: 'object',
            properties: {
              intencao: {
                type: 'string',
                enum: [
                  'pergunta_sobre_pessoa',
                  'pergunta_sobre_grupo',
                  'encaminhar_para_pessoa',
                  'encaminhar_para_grupo',
                  'broadcast',
                  'incerto',
                ],
                description: 'A intenção da mensagem (pergunta SOBRE alguém, vs encaminhar PARA alguém)',
              },
              destino_tipo: { type: 'string', enum: ['pessoa', 'grupo', 'broadcast', 'incerto'] },
              destino_id: { type: 'string', description: 'id da pessoa ou grupo alvo (omitir se broadcast/incerto)' },
              confianca: { type: 'number', description: '0.0 a 1.0' },
              raciocinio: { type: 'string', description: 'breve explicação' },
            },
            required: ['intencao', 'destino_tipo', 'confianca'],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: 'function', function: { name: 'route_message' } },
  };

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      const txt = await res.text();
      console.error('[agent-router] LLM error', res.status, txt.slice(0, 300));
      return null;
    }
    const data = await res.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) return null;
    const parsed = JSON.parse(call.function.arguments);
    return {
      intencao: parsed.intencao || (parsed.destino_tipo === 'pessoa' ? 'encaminhar_para_pessoa'
        : parsed.destino_tipo === 'grupo' ? 'encaminhar_para_grupo'
        : parsed.destino_tipo === 'broadcast' ? 'broadcast' : 'incerto'),
      destino_tipo: parsed.destino_tipo,
      destino_id: parsed.destino_id,
      confianca: typeof parsed.confianca === 'number' ? parsed.confianca : 0,
      raciocinio: parsed.raciocinio,
    };
  } catch (e) {
    console.error('[agent-router] LLM exception', e);
    return null;
  }
}

// Detecta período mencionado na pergunta (hoje/ontem/semana/mês). Default: 30 dias.
// Usa fuso America/Sao_Paulo para "hoje" e "ontem".
type PeriodLabel = 'hoje' | 'ontem' | 'semana' | 'mes';
interface DetectedPeriod {
  label: PeriodLabel;
  description: string; // ex: "HOJE (29/04/2026 00:00 → agora)"
  since: string; // ISO
  until: string; // ISO
}

function detectPeriod(question: string): DetectedPeriod {
  const q = (question || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const now = new Date();

  // Calcula início do dia "local" no fuso de São Paulo (UTC-3, sem horário de verão atualmente)
  // Pega data atual em SP e gera ISO 00:00 SP convertido para UTC.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const todaySp = fmt.format(now); // YYYY-MM-DD em SP
  // SP = UTC-3 → 00:00 SP = 03:00 UTC do mesmo dia
  const startOfTodayUtc = new Date(`${todaySp}T03:00:00.000Z`);
  const startOfYesterdayUtc = new Date(startOfTodayUtc.getTime() - 24 * 60 * 60 * 1000);
  const endOfYesterdayUtc = new Date(startOfTodayUtc.getTime() - 1);

  const dataBr = todaySp.split('-').reverse().join('/'); // DD/MM/YYYY

  if (/\b(hoje|agora|no dia de hoje|nesse dia|neste dia)\b/.test(q)) {
    return {
      label: 'hoje',
      description: `HOJE (${dataBr}, 00:00 SP até agora)`,
      since: startOfTodayUtc.toISOString(),
      until: now.toISOString(),
    };
  }
  if (/\b(ontem)\b/.test(q)) {
    const ontemSp = new Date(startOfYesterdayUtc.getTime());
    const dataOntem = fmt.format(ontemSp).split('-').reverse().join('/');
    return {
      label: 'ontem',
      description: `ONTEM (${dataOntem})`,
      since: startOfYesterdayUtc.toISOString(),
      until: endOfYesterdayUtc.toISOString(),
    };
  }
  if (/\b(essa semana|nesta semana|na semana|ultimos 7 dias|ultima semana|semana)\b/.test(q)) {
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      label: 'semana',
      description: `ÚLTIMOS 7 DIAS`,
      since: since.toISOString(),
      until: now.toISOString(),
    };
  }
  if (/\b(esse mes|neste mes|no mes|ultimos 30 dias|ultimo mes|mes)\b/.test(q)) {
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
      label: 'mes',
      description: `ÚLTIMOS 30 DIAS`,
      since: since.toISOString(),
      until: now.toISOString(),
    };
  }
  // Default: últimos 30 dias
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    label: 'mes',
    description: `ÚLTIMOS 30 DIAS (período padrão)`,
    since: since.toISOString(),
    until: now.toISOString(),
  };
}

// ============================================================
// AGREGAÇÃO DE INSIGHTS DE VENDA (a partir das análises de sentimento)
// ============================================================
interface SalesAggregate {
  totalAnalyses: number;
  stages: Record<string, number>;          // closed_won / closed_lost / abandoned / negotiating / cold_lead
  conversionRate: number;                  // closed_won / (closed_won + closed_lost + abandoned)
  topLossReasons: Array<{ reason: string; count: number }>;
  topObjections: Array<{ objection: string; count: number }>;
  topBuyingSignals: Array<{ signal: string; count: number }>;
  fcrRate: number;                         // first_contact_resolution / total
  solutionRate: number;                    // solution_provided / total
  avgCsat: number | null;                  // 0-10
  csatCount: number;
  toneDistribution: Record<string, number>;
  empathyDistribution: Record<string, number>;
  avgServiceQuality: number | null;
  topRecommendations: Array<{ rec: string; count: number }>;
  recentSummaries: string[];               // até 3
}

function topN<T extends string>(items: T[], n: number): Array<{ key: T; count: number }> {
  const map = new Map<T, number>();
  for (const it of items) {
    if (!it) continue;
    const k = String(it).trim().toLowerCase() as T;
    if (!k) continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

// ============================================================
// SUBINTENT — qual o foco da pergunta do gestor?
// ============================================================
type Subintent = 'tempo_resposta' | 'vendas' | 'csat' | 'volume' | 'geral';

function detectSubintent(question: string): Subintent {
  const q = (question || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // tempo de resposta: "tempo de resposta", "demora", "responde rapido", "tempo medio resposta", "sla"
  if (/\b(tempo (de |medio de )?resposta|demora|demorando|sla|responde (rapido|lento|demora)|tempo (medio|de) (de )?retorno|tempo (de |para )?atendimento)\b/.test(q)) {
    return 'tempo_resposta';
  }
  // vendas / conversao
  if (/\b(venda|vendeu|converteu|conversao|fechou|fechamento|perdeu|perdas|lost|won|negocio|negociacao)\b/.test(q)) {
    return 'vendas';
  }
  // csat / satisfacao / qualidade
  if (/\b(csat|satisfacao|satisfacoes|nps|qualidade|nota|avaliacao|empatia|tom|reclamac)\b/.test(q)) {
    return 'csat';
  }
  // volume / quantas
  if (/\b(quantas?|quantos?|volume|total de (conversa|mensagem|atendiment)|movimento|atend(imento|eu))\b/.test(q)) {
    return 'volume';
  }
  return 'geral';
}

// ============================================================
// CÁLCULO DE TEMPO DE RESPOSTA
// ============================================================
interface ResponseTimeStats {
  pairs: number;                    // total de pares cliente→agente analisados
  conversationsCovered: number;     // quantas conversas distintas tinham ao menos 1 par
  firstResponseMedianSec: number | null;   // mediana do tempo da PRIMEIRA resposta da conversa
  firstResponseAvgSec: number | null;
  followupMedianSec: number | null;        // mediana das demais respostas
  slowConversations: number;        // conversas com pelo menos 1 resposta > 30 min
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  return sorted[base];
}

function formatDuration(sec: number | null): string {
  if (sec === null || !isFinite(sec) || sec < 0) return 'sem dado';
  if (sec < 60) return `${Math.round(sec)} s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m < 60) return s > 0 ? `${m} min ${s} s` : `${m} min`;
  const h = Math.floor(m / 60);
  const mr = m % 60;
  return mr > 0 ? `${h} h ${mr} min` : `${h} h`;
}

/**
 * Pega mensagens em ordem cronológica por conversa e mede tempo entre
 * mensagem do cliente (from_me=false) e PRÓXIMA mensagem do agente (from_me=true).
 * Considera apenas pares dentro de 24h (acima disso é "abandono", não resposta).
 */
function computeResponseTimes(messagesByConv: Map<string, Array<{ ts: number; from_me: boolean }>>): ResponseTimeStats {
  const firstResponses: number[] = [];
  const followupResponses: number[] = [];
  let totalPairs = 0;
  let convsCovered = 0;
  let slowConvs = 0;
  const MAX_GAP_SEC = 24 * 60 * 60; // 24h
  const SLOW_THRESHOLD_SEC = 30 * 60; // 30min

  for (const msgs of messagesByConv.values()) {
    if (msgs.length < 2) continue;
    msgs.sort((a, b) => a.ts - b.ts);
    let convPairs = 0;
    let convHasSlow = false;
    let isFirstResponseOfConv = true;
    for (let i = 0; i < msgs.length - 1; i++) {
      const cur = msgs[i];
      const nxt = msgs[i + 1];
      // Cliente fala (from_me=false), depois agente responde (from_me=true) → mede o gap
      if (!cur.from_me && nxt.from_me) {
        const gap = (nxt.ts - cur.ts) / 1000;
        if (gap >= 0 && gap <= MAX_GAP_SEC) {
          if (isFirstResponseOfConv) {
            firstResponses.push(gap);
            isFirstResponseOfConv = false;
          } else {
            followupResponses.push(gap);
          }
          if (gap > SLOW_THRESHOLD_SEC) convHasSlow = true;
          convPairs++;
          totalPairs++;
        }
      }
    }
    if (convPairs > 0) convsCovered++;
    if (convHasSlow) slowConvs++;
  }

  const sortedFirst = [...firstResponses].sort((a, b) => a - b);
  const sortedFollow = [...followupResponses].sort((a, b) => a - b);
  const avg = (arr: number[]) => arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : null;

  return {
    pairs: totalPairs,
    conversationsCovered: convsCovered,
    firstResponseMedianSec: sortedFirst.length ? quantile(sortedFirst, 0.5) : null,
    firstResponseAvgSec: avg(firstResponses),
    followupMedianSec: sortedFollow.length ? quantile(sortedFollow, 0.5) : null,
    slowConversations: slowConvs,
  };
}

function formatResponseTimesForPrompt(rt: ResponseTimeStats): string {
  if (rt.pairs === 0) return '';
  const lines: string[] = ['', '=== TEMPO DE RESPOSTA ==='];
  lines.push(`- Pares cliente→agente analisados: ${rt.pairs} em ${rt.conversationsCovered} conversa(s)`);
  if (rt.firstResponseMedianSec !== null) {
    lines.push(`- Primeira resposta (mediana): ${formatDuration(rt.firstResponseMedianSec)}${rt.firstResponseAvgSec !== null ? ` (média ${formatDuration(rt.firstResponseAvgSec)})` : ''}`);
  }
  if (rt.followupMedianSec !== null) {
    lines.push(`- Respostas seguintes na mesma conversa (mediana): ${formatDuration(rt.followupMedianSec)}`);
  }
  if (rt.slowConversations > 0) {
    lines.push(`- Conversas com alguma resposta > 30 min: ${rt.slowConversations}`);
  }
  return lines.join('\n');
}

function aggregateSalesInsights(analyses: any[]): SalesAggregate {
  const sales = analyses
    .map((a) => a?.satisfaction_indicators?.sales)
    .filter((s) => s && typeof s === 'object');

  const stagesArr = sales.map((s: any) => s.stage).filter(Boolean) as string[];
  const stages: Record<string, number> = {};
  for (const st of stagesArr) stages[st] = (stages[st] || 0) + 1;

  const won = stages['closed_won'] || 0;
  const lost = stages['closed_lost'] || 0;
  const abandoned = stages['abandoned'] || 0;
  const decided = won + lost + abandoned;
  const conversionRate = decided > 0 ? won / decided : 0;

  const lossReasons = topN(
    sales.filter((s: any) => s.stage === 'closed_lost' || s.stage === 'abandoned')
         .map((s: any) => s.loss_reason).filter(Boolean),
    3,
  );
  const objections = topN(sales.flatMap((s: any) => s.objections || []), 3);
  const buyingSignals = topN(sales.flatMap((s: any) => s.buying_signals || []), 3);

  const fcrTotal = analyses.filter((a) => typeof a.first_contact_resolution === 'boolean').length;
  const fcrTrue = analyses.filter((a) => a.first_contact_resolution === true).length;
  const solTotal = analyses.filter((a) => typeof a.solution_provided === 'boolean').length;
  const solTrue = analyses.filter((a) => a.solution_provided === true).length;

  const csats = analyses.map((a) => a.satisfaction_score).filter((n) => typeof n === 'number');
  const avgCsat = csats.length ? csats.reduce((s, n) => s + n, 0) / csats.length : null;

  const sqs = analyses.map((a) => a.service_quality_rating).filter((n) => typeof n === 'number');
  const avgServiceQuality = sqs.length ? sqs.reduce((s, n) => s + n, 0) / sqs.length : null;

  const tones = analyses.map((a) => a.agent_tone).filter(Boolean);
  const toneDist: Record<string, number> = {};
  for (const t of tones) toneDist[t] = (toneDist[t] || 0) + 1;

  const empathy = analyses.map((a) => a.empathy_level).filter(Boolean);
  const empDist: Record<string, number> = {};
  for (const e of empathy) empDist[e] = (empDist[e] || 0) + 1;

  // Recommendations: jsonb pode ser array de strings ou de objetos { text/recommendation }
  const recs: string[] = [];
  for (const a of analyses) {
    const r = a.recommendations;
    if (!r) continue;
    if (Array.isArray(r)) {
      for (const item of r) {
        if (typeof item === 'string') recs.push(item);
        else if (item && typeof item === 'object') {
          recs.push(item.text || item.recommendation || item.action || JSON.stringify(item).slice(0, 80));
        }
      }
    }
  }
  const topRecs = topN(recs, 3);

  const summaries = analyses
    .map((a) => a.summary)
    .filter((s) => typeof s === 'string' && s.trim().length > 0)
    .slice(0, 3);

  return {
    totalAnalyses: analyses.length,
    stages,
    conversionRate,
    topLossReasons: lossReasons.map(({ key, count }) => ({ reason: key, count })),
    topObjections: objections.map(({ key, count }) => ({ objection: key, count })),
    topBuyingSignals: buyingSignals.map(({ key, count }) => ({ signal: key, count })),
    fcrRate: fcrTotal > 0 ? fcrTrue / fcrTotal : 0,
    solutionRate: solTotal > 0 ? solTrue / solTotal : 0,
    avgCsat,
    csatCount: csats.length,
    toneDistribution: toneDist,
    empathyDistribution: empDist,
    avgServiceQuality,
    topRecommendations: topRecs.map(({ key, count }) => ({ rec: key, count })),
    recentSummaries: summaries,
  };
}

function formatAggregateForPrompt(agg: SalesAggregate): string {
  const lines: string[] = [];
  lines.push(`- Análises de sentimento no período: ${agg.totalAnalyses}`);

  if (Object.keys(agg.stages).length > 0) {
    const order = ['closed_won', 'negotiating', 'closed_lost', 'abandoned', 'cold_lead'];
    const labels: Record<string, string> = {
      closed_won: 'fechadas',
      closed_lost: 'perdidas',
      abandoned: 'abandonadas',
      negotiating: 'em negociação',
      cold_lead: 'lead frio',
    };
    const parts = order
      .filter((k) => agg.stages[k])
      .map((k) => `${agg.stages[k]} ${labels[k]}`);
    lines.push(`- Vendas por estágio: ${parts.join(', ')}`);
    if ((agg.stages['closed_won'] || 0) + (agg.stages['closed_lost'] || 0) + (agg.stages['abandoned'] || 0) > 0) {
      lines.push(`- Taxa de conversão (won / decididas): ${(agg.conversionRate * 100).toFixed(0)}%`);
    }
  }

  if (agg.topLossReasons.length > 0) {
    lines.push(`- Principais motivos de perda: ${agg.topLossReasons.map((r) => `"${r.reason}" (${r.count}x)`).join(', ')}`);
  }
  if (agg.topObjections.length > 0) {
    lines.push(`- Objeções recorrentes: ${agg.topObjections.map((o) => `"${o.objection}" (${o.count}x)`).join(', ')}`);
  }
  if (agg.topBuyingSignals.length > 0) {
    lines.push(`- Sinais de compra detectados: ${agg.topBuyingSignals.map((s) => `"${s.signal}" (${s.count}x)`).join(', ')}`);
  }

  if (agg.csatCount > 0 && agg.avgCsat !== null) {
    lines.push(`- CSAT médio: ${agg.avgCsat.toFixed(1)}/10 (${agg.csatCount} análises)`);
  }
  if (agg.avgServiceQuality !== null) {
    lines.push(`- Qualidade média do atendimento: ${agg.avgServiceQuality.toFixed(1)}/10`);
  }
  if (agg.fcrRate > 0) {
    lines.push(`- Taxa de resolução no primeiro contato (FCR): ${(agg.fcrRate * 100).toFixed(0)}%`);
  }
  if (agg.solutionRate > 0) {
    lines.push(`- Taxa de solução entregue: ${(agg.solutionRate * 100).toFixed(0)}%`);
  }

  const topTone = Object.entries(agg.toneDistribution).sort((a, b) => b[1] - a[1])[0];
  if (topTone) lines.push(`- Tom predominante do colaborador: ${topTone[0]} (${topTone[1]}x)`);
  const topEmp = Object.entries(agg.empathyDistribution).sort((a, b) => b[1] - a[1])[0];
  if (topEmp) lines.push(`- Nível de empatia predominante: ${topEmp[0]} (${topEmp[1]}x)`);

  if (agg.topRecommendations.length > 0) {
    lines.push(`- Recomendações já geradas pelas análises individuais:`);
    for (const r of agg.topRecommendations) lines.push(`    • ${r.rec} (${r.count}x)`);
  }
  if (agg.recentSummaries.length > 0) {
    lines.push(`- Resumos de conversas recentes:`);
    agg.recentSummaries.forEach((s, i) => lines.push(`    ${i + 1}. ${s}`));
  }
  return lines.join('\n');
}

function classifyPerformance(agg: SalesAggregate): 'bem' | 'regular' | 'atencao' | 'indefinido' {
  if (agg.totalAnalyses < 3 && agg.csatCount === 0) return 'indefinido';
  const csat = agg.avgCsat ?? 0;
  const conv = agg.conversionRate;
  const decided = (agg.stages['closed_won'] || 0) + (agg.stages['closed_lost'] || 0) + (agg.stages['abandoned'] || 0);
  if (csat >= 7 && (decided === 0 || conv >= 0.5)) return 'bem';
  if (csat >= 5) return 'regular';
  if (csat > 0 || decided > 0) return 'atencao';
  return 'indefinido';
}

// Gera uma RESPOSTA em texto sobre uma pessoa/grupo, usando dados disponíveis
// (conversas recentes, sentimento). Retorna o texto pronto para enviar ao remetente.
async function answerAboutTarget(params: {
  supabase: any;
  question: string;
  senderName?: string;
  agentPersona: string;
  agentTone: string;
  companyId: string;
  target: { kind: 'pessoa' | 'grupo'; name: string; phones: string[] };
}): Promise<{ text: string | null; period: DetectedPeriod; hadData: boolean }> {
  const period = detectPeriod(params.question);
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return { text: null, period, hadData: false };

  let contextoConversas = '';
  let contextoSentimento = '';
  let contextoMensagens = '';
  let hadData = false;
  let lastActivityOutsidePeriod: string | null = null;

  try {
    if (params.target.phones.length > 0) {
      // 1) Busca perfis (user_ids) ligados aos telefones do alvo
      const { data: profiles } = await params.supabase
        .from('profiles')
        .select('user_id, nome, phone_e164')
        .in('phone_e164', params.target.phones);
      const userIds = (profiles || []).map((p: any) => p.user_id).filter(Boolean);

      // 2) Busca instâncias de WhatsApp ligadas ao(s) telefone(s) do alvo
      const { data: instances } = await params.supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('company_id', params.companyId)
        .in('phone_e164', params.target.phones);
      const instanceIds = (instances || []).map((i: any) => i.id);

      // 3) Conversas DENTRO do período pedido
      let convs: any[] = [];
      if (userIds.length > 0 || instanceIds.length > 0) {
        const filters: string[] = [];
        if (userIds.length > 0) filters.push(`assigned_to.in.(${userIds.join(',')})`);
        if (instanceIds.length > 0) filters.push(`instance_id.in.(${instanceIds.join(',')})`);

        const { data: convData } = await params.supabase
          .from('whatsapp_conversations')
          .select('id, last_message_at, sentiment, status')
          .eq('company_id', params.companyId)
          .or(filters.join(','))
          .gte('last_message_at', period.since)
          .lte('last_message_at', period.until)
          .order('last_message_at', { ascending: false })
          .limit(50);
        convs = convData || [];

        // Se não houver dados no período, tenta achar a última atividade fora do período (informativo)
        if (convs.length === 0) {
          const { data: lastConv } = await params.supabase
            .from('whatsapp_conversations')
            .select('last_message_at')
            .eq('company_id', params.companyId)
            .or(filters.join(','))
            .order('last_message_at', { ascending: false })
            .limit(1);
          if (lastConv && lastConv[0]?.last_message_at) {
            lastActivityOutsidePeriod = lastConv[0].last_message_at;
          }
        }
      }

      if (convs.length > 0) {
        hadData = true;
        const total = convs.length;
        const ativas = convs.filter((c: any) => c.status === 'active').length;
        const resolvidas = convs.filter((c: any) => c.status === 'resolved' || c.status === 'closed').length;
        const sentiments = convs.filter((c: any) => c.sentiment).map((c: any) => c.sentiment);
        const positivos = sentiments.filter((s: string) => s === 'positive').length;
        const negativos = sentiments.filter((s: string) => s === 'negative').length;
        const neutros = sentiments.filter((s: string) => s === 'neutral').length;
        const ultimaMsg = convs[0]?.last_message_at;

        contextoConversas = `\n- Conversas com atividade no período: ${total} (${ativas} ativas, ${resolvidas} resolvidas)\n- Última atividade no período: ${ultimaMsg || 'sem registro'}`;
        if (sentiments.length > 0) {
          contextoSentimento = `\n- Sentimento das conversas: ${positivos} positivas, ${neutros} neutras, ${negativos} negativas`;
        }

        const convIds = convs.slice(0, 30).map((c: any) => c.id);

        // 4) Mensagens trocadas no período (volume de trabalho)
        const { count: enviadasCount } = await params.supabase
          .from('whatsapp_messages')
          .select('id', { count: 'exact', head: true })
          .in('conversation_id', convIds)
          .eq('from_me', true)
          .gte('timestamp', period.since)
          .lte('timestamp', period.until);
        const { count: recebidasCount } = await params.supabase
          .from('whatsapp_messages')
          .select('id', { count: 'exact', head: true })
          .in('conversation_id', convIds)
          .eq('from_me', false)
          .gte('timestamp', period.since)
          .lte('timestamp', period.until);
        const totalMsgs = (enviadasCount || 0) + (recebidasCount || 0);
        if (totalMsgs > 0) {
          contextoMensagens = `\n- Mensagens trocadas no período: ${totalMsgs} (${enviadasCount || 0} enviadas pelo colaborador, ${recebidasCount || 0} recebidas)`;
        }

        // 4.1) Tempo de resposta — busca timestamps das mensagens (limitado para perf)
        if (totalMsgs > 0 && totalMsgs < 5000) {
          const { data: msgRows } = await params.supabase
            .from('whatsapp_messages')
            .select('conversation_id, timestamp, from_me')
            .in('conversation_id', convIds)
            .gte('timestamp', period.since)
            .lte('timestamp', period.until)
            .order('timestamp', { ascending: true })
            .limit(3000);
          if (msgRows && msgRows.length > 0) {
            const byConv = new Map<string, Array<{ ts: number; from_me: boolean }>>();
            for (const m of msgRows) {
              const arr = byConv.get(m.conversation_id) || [];
              arr.push({ ts: new Date(m.timestamp).getTime(), from_me: !!m.from_me });
              byConv.set(m.conversation_id, arr);
            }
            const rt = computeResponseTimes(byConv);
            (params as any)._responseTimes = rt;
            const block = formatResponseTimesForPrompt(rt);
            if (block) contextoMensagens += block;
          }
        }

        // 5) Análises de sentimento DENTRO do período (TODOS os campos úteis)
        const { data: analyses } = await params.supabase
          .from('whatsapp_sentiment_analysis')
          .select('satisfaction_score, summary, satisfaction_indicators, first_contact_resolution, solution_provided, agent_tone, empathy_level, message_clarity, service_quality_rating, recommendations')
          .eq('company_id', params.companyId)
          .in('conversation_id', convIds)
          .gte('analyzed_at', period.since)
          .lte('analyzed_at', period.until)
          .order('analyzed_at', { ascending: false })
          .limit(50);

        // Anexa agregação ao contextoSentimento
        if (analyses && analyses.length > 0) {
          (params as any)._aggregate = aggregateSalesInsights(analyses);
          contextoSentimento += `\n\n=== INSIGHTS AGREGADOS DAS ANÁLISES ===\n${formatAggregateForPrompt((params as any)._aggregate)}`;
        }
      }
    }
  } catch (e) {
    console.warn('[agent-router] erro ao montar contexto', e);
  }

  // CASO ESPECIAL: sem dados no período → resposta direta, sem chamar LLM
  if (!hadData) {
    const fallbackInfo = lastActivityOutsidePeriod
      ? ` A última atividade registrada foi em ${new Date(lastActivityOutsidePeriod).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`
      : ' Não há registro de atividade dele no sistema.';
    const text = `📊 Sobre *${params.target.name}* — período: ${period.description}\n\nNão há atividade registrada nesse período.${fallbackInfo}`;
    return { text, period, hadData: false };
  }

  const persona = params.agentPersona?.trim()
    || `Você é um assistente analítico corporativo, tom ${params.agentTone || 'neutro'}.`;

  const aggregate: SalesAggregate | undefined = (params as any)._aggregate;
  const performance = aggregate ? classifyPerformance(aggregate) : 'indefinido';
  const enoughData = !!aggregate && aggregate.totalAnalyses >= 5;

  const toneGuide =
    performance === 'bem'
      ? 'O colaborador está com BOM desempenho. Reforce o que está funcionando e ofereça 1 oportunidade sutil de evolução.'
      : performance === 'regular'
      ? 'O colaborador está REGULAR. Equilibre elogios e melhorias.'
      : performance === 'atencao'
      ? 'O colaborador PRECISA DE ATENÇÃO. Comece SEMPRE pelo que ele está acertando antes de apontar problemas. Tom de coach, NUNCA punitivo.'
      : 'Dados ainda inconclusivos para diagnóstico aprofundado.';

  // Detecta o foco da pergunta para adaptar a resposta
  const subintent: Subintent = detectSubintent(params.question);
  const rt: ResponseTimeStats | undefined = (params as any)._responseTimes;

  // Quando o gestor pede DESEMPENHO/VENDAS de uma pessoa e há dados suficientes,
  // entregamos uma resposta no formato COACH. Caso contrário, modo factual.
  // EXCEÇÃO: se a pergunta é específica (tempo_resposta, volume, csat puro), respondemos focado.
  const isSpecificMetric = subintent === 'tempo_resposta' || subintent === 'volume';
  const isPerformanceQuestion = params.target.kind === 'pessoa' && enoughData && !isSpecificMetric;

  // Subintent guides — instruções extras conforme o foco da pergunta
  const subintentGuide = (() => {
    switch (subintent) {
      case 'tempo_resposta':
        return rt && rt.pairs > 0
          ? `FOCO DA PERGUNTA: TEMPO DE RESPOSTA. Responda OBJETIVAMENTE com os números de tempo de resposta. Use o formato:\n\n⏱ *${params.target.name}* — ${period.description}\n• Primeira resposta (mediana): X\n• Respostas seguintes (mediana): Y\n• Conversas com resposta > 30 min: Z\n[1 linha de leitura: rápido / dentro do esperado / lento]\n\nNÃO traga vendas, CSAT ou outros KPIs a menos que o gestor pergunte. Máximo 6 linhas.`
          : `FOCO DA PERGUNTA: TEMPO DE RESPOSTA. Os dados de tempo NÃO estão disponíveis no período (sem pares cliente→agente suficientes). Diga isso claramente em 2 linhas e sugira ampliar o período.`;
      case 'volume':
        return `FOCO DA PERGUNTA: VOLUME. Responda apenas com contagens (conversas, mensagens enviadas, mensagens recebidas). NÃO traga CSAT, vendas ou tempo. Máximo 5 linhas.`;
      case 'csat':
        return `FOCO DA PERGUNTA: SATISFAÇÃO/QUALIDADE. Foque em CSAT, qualidade, tom, empatia e FCR. Use os indicadores das análises. Máximo 8 linhas.`;
      case 'vendas':
        return `FOCO DA PERGUNTA: VENDAS. Foque em estágios de funil, taxa de conversão, motivos de perda e objeções. Máximo 10 linhas.`;
      default:
        return '';
    }
  })();

  const systemPrompt = isPerformanceQuestion
    ? `${persona}

Você é um COACH DE VENDAS respondendo via WhatsApp ao gestor "${params.senderName || 'usuário'}" sobre o colaborador "${params.target.name}".

PERÍODO ANALISADO: ${period.description}
DIAGNÓSTICO PRELIMINAR: ${performance.toUpperCase()}
DIRETRIZ DE TOM: ${toneGuide}
${subintentGuide ? `\n${subintentGuide}\n` : ''}
ESTRUTURE A RESPOSTA EXATAMENTE ASSIM (use *negrito* do WhatsApp e os emojis dos exemplos):

📊 *${params.target.name}* — ${period.description}
[1 linha de resumo executivo, baseado em números reais]

✅ *Funcionando:*
• [ponto forte 1 ancorado em dado real]
• [ponto forte 2 ancorado em dado real]

⚠️ *Onde está perdendo:*
• [problema concreto com exemplo, ex: "3 vendas perdidas por preço sem contraproposta"]
• [problema 2, se houver]

🎯 *Sugestões para o gestor:*
1. [ação concreta e específica]
2. [ação concreta]
${performance !== 'bem' ? '3. [ação concreta]' : ''}

REGRAS OBRIGATÓRIAS:
- USE APENAS os dados fornecidos abaixo. NÃO invente números, clientes ou eventos.
- Se um campo não existe nos dados, NÃO mencione (ex: se não há objeções listadas, não invente).
- Se a pergunta pediu uma métrica que NÃO está nos dados, diga "esse dado não está disponível".
- Cada bullet deve referenciar um dado real (número, %, contagem, motivo de perda, objeção).
- Máximo 14 linhas no total. Linguagem de WhatsApp: curto e direto, sem parágrafos longos.
- Mencione o período na primeira linha (ex: "essa semana", "hoje", "nos últimos 30 dias").`
    : `${persona}

Você está respondendo via WhatsApp a uma pergunta do gestor "${params.senderName || 'usuário'}" SOBRE ${params.target.kind === 'pessoa' ? 'o colaborador' : 'a equipe'} "${params.target.name}".

PERÍODO ANALISADO: ${period.description}
${aggregate && !enoughData ? `\nATENÇÃO: poucos dados (${aggregate.totalAnalyses} análise(s)). Mencione isso e evite generalizar.` : ''}
${subintentGuide ? `\n${subintentGuide}\n` : ''}
Regras OBRIGATÓRIAS:
- Responda APENAS com base nos dados do período acima.
- Responda DIRETAMENTE à pergunta feita; NÃO traga métricas que não foram pedidas.
- Mencione explicitamente o período na resposta (ex: "hoje", "nos últimos 7 dias").
- Se a pergunta pedir um dado que NÃO está nos dados, diga claramente "esse dado não está disponível no período".
- NÃO invente números nem use dados fora do período.
- Seja direto, factual e conciso.`;

  const dataBlock = `Dados disponíveis sobre ${params.target.name} no período (${period.description}):${contextoConversas}${contextoMensagens}${contextoSentimento}`;

  const userPrompt = `Pergunta do gestor: "${params.question}"\n\n${dataBlock}`;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      console.error('[agent-router] answer LLM error', res.status, (await res.text()).slice(0, 300));
      return { text: null, period, hadData };
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || null;
    return { text, period, hadData };
  } catch (e) {
    console.error('[agent-router] answer exception', e);
    return { text: null, period, hadData };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body: RouteRequest = await req.json();
    if (!body.agent_id || (!body.source_phone_e164 && !body.target_group_id) || !body.content) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios ausentes' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Carrega agente
    const { data: agent, error: agentErr } = await supabase
      .from('whatsapp_agents')
      .select('*')
      .eq('id', body.agent_id)
      .single();

    if (agentErr || !agent || !agent.is_active) {
      return new Response(JSON.stringify({ error: 'Agente inativo ou não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Carrega instância e API key cedo (usados em todos os caminhos)
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('id', agent.instance_id)
      .single();
    if (!instance) {
      return new Response(JSON.stringify({ error: 'Instância do agente não configurada' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: secret } = await supabase
      .from('whatsapp_instance_secrets')
      .select('api_key')
      .eq('instance_id', instance.id)
      .single();
    if (!secret) {
      return new Response(JSON.stringify({ error: 'API key da instância não configurada' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const apiUrl = (instance.api_url as string).replace(/\/$/, '');
    const apiKey = secret.api_key;
    const instanceName = instance.instance_name;

    const sourceNorm = normalize(body.source_phone_e164 || '');

    // Helper: envia para uma lista de números via Evolution API
    const sendToPhones = async (phones: string[], text: string) => {
      const sendResults = await Promise.allSettled(
        phones.map(async (phone) => {
          const number = normalize(phone);
          const res = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: apiKey },
            body: JSON.stringify({ number, text }),
          });
          return { phone, ok: res.ok, status: res.status };
        }),
      );
      return sendResults.map((s, idx) =>
        s.status === 'fulfilled' ? s.value : { phone: phones[idx], ok: false, error: String(s.reason) },
      );
    };

    const prefix = body.source_name
      ? `*[${body.source_name}]*\n`
      : (body.source_phone_e164 ? `*[${body.source_phone_e164}]*\n` : '');
    const fullText = `${prefix}${body.content}`;

    // Helper: registra broadcast
    const logBroadcast = async (params: {
      group_id: string | null;
      delivered: any[];
      method: RoutingMethod;
      meta?: Record<string, any>;
    }) => {
      await supabase.from('whatsapp_agent_broadcasts').insert({
        agent_id: agent.id,
        group_id: params.group_id,
        company_id: agent.company_id,
        source_phone: body.source_phone_e164 || null,
        source_name: body.source_name || null,
        content: body.content,
        message_type: body.message_type || 'text',
        delivered_to: params.delivered,
        triggered_by: body.triggered_by || 'internal_chat',
        related_conversation_id: body.related_conversation_id || null,
        routing_metadata: { method: params.method, ...(params.meta || {}) },
      });
    };

    // ============================================================
    // CAMINHO 1: target_group_id explícito (UI de teste / supervisão)
    // ============================================================
    if (body.target_group_id) {
      const { data: targets } = await supabase
        .from('whatsapp_agent_group_members')
        .select('id, phone_e164, display_name')
        .eq('group_id', body.target_group_id)
        .eq('is_active', true);

      const activeTargets = targets || [];
      const withoutSender = activeTargets.filter(
        (m: any) => !sourceNorm || normalize(m.phone_e164) !== sourceNorm,
      );
      const recipients = body.include_sender || withoutSender.length === 0 ? activeTargets : withoutSender;
      const delivered = await sendToPhones(recipients.map((r: any) => r.phone_e164), fullText);
      await logBroadcast({ group_id: body.target_group_id, delivered, method: 'forced' });
      return new Response(JSON.stringify({
        success: true,
        routing: { method: 'forced' },
        results: [{ group_id: body.target_group_id, delivered }],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============================================================
    // CAMINHO 2: roteamento dinâmico baseado no remetente
    // ============================================================

    // Carrega TODOS os grupos e membros do agente
    const { data: agentGroups } = await supabase
      .from('whatsapp_agent_groups')
      .select('id, name')
      .eq('agent_id', agent.id)
      .eq('is_active', true);
    const groupIds = (agentGroups || []).map((g: any) => g.id);
    if (groupIds.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'agent_has_no_groups' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: allMembers } = await supabase
      .from('whatsapp_agent_group_members')
      .select('id, group_id, phone_e164, display_name')
      .in('group_id', groupIds)
      .eq('is_active', true);
    const members = allMembers || [];

    // Confirma que o remetente pertence a algum grupo do agente
    const senderInGroups = members.filter((m: any) => normalize(m.phone_e164) === sourceNorm);
    if (senderInGroups.length === 0) {
      console.log('[agent-router] Remetente não pertence a nenhum grupo deste agente');
      return new Response(JSON.stringify({ skipped: true, reason: 'sender_not_in_any_group' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const senderGroupIds = senderInGroups.map((m: any) => m.group_id);

    // ===== Etapa A: parser de menções =====
    const mentions = extractMentions(body.content);
    if (mentions.length > 0) {
      // Tenta achar uma pessoa pelo display_name normalizado
      const personMatch = members.find((m: any) =>
        m.display_name && mentions.some((mn) => normalizeName(m.display_name).includes(mn) || mn.includes(normalizeName(m.display_name))),
      );
      if (personMatch) {
        const delivered = await sendToPhones([personMatch.phone_e164], fullText);
        await logBroadcast({
          group_id: personMatch.group_id, delivered, method: 'mention',
          meta: { mention_type: 'person', target_name: personMatch.display_name, mentions },
        });
        return new Response(JSON.stringify({
          success: true, routing: { method: 'mention', target: personMatch.display_name },
          results: [{ group_id: personMatch.group_id, delivered }],
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // Tenta achar um grupo pelo nome normalizado
      const groupMatch = (agentGroups || []).find((g: any) =>
        mentions.some((mn) => normalizeName(g.name).includes(mn) || mn.includes(normalizeName(g.name))),
      );
      if (groupMatch) {
        const targets = members.filter((m: any) => m.group_id === groupMatch.id);
        const recipients = targets.filter((m: any) => normalize(m.phone_e164) !== sourceNorm);
        const finalRecipients = recipients.length > 0 ? recipients : targets;
        const delivered = await sendToPhones(finalRecipients.map((r: any) => r.phone_e164), fullText);
        await logBroadcast({
          group_id: groupMatch.id, delivered, method: 'mention',
          meta: { mention_type: 'group', target_name: groupMatch.name, mentions },
        });
        return new Response(JSON.stringify({
          success: true, routing: { method: 'mention', target: groupMatch.name },
          results: [{ group_id: groupMatch.id, delivered }],
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // Menção não encontrada → fallback amigável só pro remetente
      const fbText = `🤖 Não encontrei *@${mentions[0]}* na sua lista de contatos do agente. Tente usar o nome exato de uma pessoa ou grupo.`;
      const delivered = await sendToPhones([body.source_phone_e164!], fbText);
      await logBroadcast({
        group_id: senderGroupIds[0], delivered, method: 'fallback',
        meta: { reason: 'mention_not_found', mentions },
      });
      return new Response(JSON.stringify({
        success: true, routing: { method: 'fallback', reason: 'mention_not_found' },
        results: [{ group_id: senderGroupIds[0], delivered }],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== Etapa B: classificador LLM (se habilitado) =====
    let llmDecision: Awaited<ReturnType<typeof classifyRouting>> = null;
    if (!body.disable_llm) {
      llmDecision = await classifyRouting({
        message: body.content,
        members: members.map((m: any) => ({
          id: m.id, display_name: m.display_name, group_id: m.group_id, phone_e164: m.phone_e164,
        })),
        groups: agentGroups || [],
        senderName: body.source_name,
      });
    }

    if (llmDecision && llmDecision.confianca >= LLM_CONFIDENCE_THRESHOLD) {
      // ===== PERGUNTA SOBRE alguém → responder ao remetente =====
      if (
        (llmDecision.intencao === 'pergunta_sobre_pessoa' ||
          llmDecision.intencao === 'pergunta_sobre_grupo') &&
        llmDecision.destino_id
      ) {
        const isPessoa = llmDecision.intencao === 'pergunta_sobre_pessoa';
        let targetName = '';
        let targetPhones: string[] = [];

        if (isPessoa) {
          const target = members.find((m: any) => m.id === llmDecision!.destino_id);
          if (target) {
            targetName = target.display_name || 'colaborador';
            targetPhones = [target.phone_e164];
          }
        } else {
          const targetGroup = (agentGroups || []).find((g: any) => g.id === llmDecision!.destino_id);
          if (targetGroup) {
            targetName = targetGroup.name;
            targetPhones = members
              .filter((m: any) => m.group_id === targetGroup.id)
              .map((m: any) => m.phone_e164);
          }
        }

        if (targetName) {
          const answerResult = await answerAboutTarget({
            supabase,
            question: body.content,
            senderName: body.source_name,
            agentPersona: agent.persona_prompt || '',
            agentTone: agent.tone || 'neutro',
            companyId: agent.company_id,
            target: { kind: isPessoa ? 'pessoa' : 'grupo', name: targetName, phones: targetPhones },
          });

          const replyText = answerResult.text
            || `🤖 Não consegui consultar os dados de *${targetName}* agora. Tente novamente em instantes.`;

          // Envia APENAS para o remetente, SEM prefixo de remetente
          const delivered = await sendToPhones([body.source_phone_e164!], replyText);
          await logBroadcast({
            group_id: senderGroupIds[0],
            delivered,
            method: 'fallback',
            meta: {
              answer_mode: true,
              intencao: llmDecision.intencao,
              target_name: targetName,
              had_data: answerResult.hadData,
              period: { label: answerResult.period.label, description: answerResult.period.description },
              confidence: llmDecision.confianca,
              reasoning: llmDecision.raciocinio,
            },
          });
          return new Response(JSON.stringify({
            success: true,
            routing: { method: 'answer', target: targetName, confidence: llmDecision.confianca, period: answerResult.period.label },
            results: [{ group_id: senderGroupIds[0], delivered }],
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Pessoa específica (encaminhar)
      if (llmDecision.destino_tipo === 'pessoa' && llmDecision.destino_id) {
        const target = members.find((m: any) => m.id === llmDecision!.destino_id);
        if (target) {
          const delivered = await sendToPhones([target.phone_e164], fullText);
          await logBroadcast({
            group_id: target.group_id, delivered, method: 'llm',
            meta: {
              destino_tipo: 'pessoa', target_name: target.display_name,
              confidence: llmDecision.confianca, reasoning: llmDecision.raciocinio,
            },
          });
          return new Response(JSON.stringify({
            success: true,
            routing: { method: 'llm', target: target.display_name, confidence: llmDecision.confianca },
            results: [{ group_id: target.group_id, delivered }],
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
      // Grupo específico
      if (llmDecision.destino_tipo === 'grupo' && llmDecision.destino_id) {
        const targetGroup = (agentGroups || []).find((g: any) => g.id === llmDecision!.destino_id);
        if (targetGroup) {
          const targets = members.filter((m: any) => m.group_id === targetGroup.id);
          const recipients = targets.filter((m: any) => normalize(m.phone_e164) !== sourceNorm);
          const finalRecipients = recipients.length > 0 ? recipients : targets;
          const delivered = await sendToPhones(finalRecipients.map((r: any) => r.phone_e164), fullText);
          await logBroadcast({
            group_id: targetGroup.id, delivered, method: 'llm',
            meta: {
              destino_tipo: 'grupo', target_name: targetGroup.name,
              confidence: llmDecision.confianca, reasoning: llmDecision.raciocinio,
            },
          });
          return new Response(JSON.stringify({
            success: true,
            routing: { method: 'llm', target: targetGroup.name, confidence: llmDecision.confianca },
            results: [{ group_id: targetGroup.id, delivered }],
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
      // Broadcast → cai no caminho C
    }

    // ===== Etapa C: broadcast tradicional nos grupos do remetente =====
    // (fallback quando LLM falhou, deu incerto, ou retornou broadcast)
    const broadcastIsLowConfidence =
      llmDecision !== null &&
      (llmDecision.destino_tipo === 'incerto' || llmDecision.confianca < LLM_CONFIDENCE_THRESHOLD);

    if (broadcastIsLowConfidence) {
      // Avisa só o remetente que a IA não entendeu
      const fbText = '🤖 Não consegui identificar com certeza para quem encaminhar sua mensagem. Use *@nome* (de uma pessoa ou grupo) para direcionar.';
      const delivered = await sendToPhones([body.source_phone_e164!], fbText);
      await logBroadcast({
        group_id: senderGroupIds[0], delivered, method: 'fallback',
        meta: {
          reason: 'low_confidence',
          confidence: llmDecision?.confianca,
          reasoning: llmDecision?.raciocinio,
        },
      });
      return new Response(JSON.stringify({
        success: true,
        routing: { method: 'fallback', reason: 'low_confidence', confidence: llmDecision?.confianca },
        results: [{ group_id: senderGroupIds[0], delivered }],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Broadcast nos grupos do remetente (comportamento legado)
    const results: any[] = [];
    for (const gid of senderGroupIds) {
      const targets = members.filter((m: any) => m.group_id === gid);
      const withoutSender = targets.filter((m: any) => normalize(m.phone_e164) !== sourceNorm);
      const recipients = body.include_sender || withoutSender.length === 0 ? targets : withoutSender;
      const delivered = await sendToPhones(recipients.map((r: any) => r.phone_e164), fullText);
      await logBroadcast({
        group_id: gid, delivered, method: 'broadcast',
        meta: llmDecision ? { confidence: llmDecision.confianca, reasoning: llmDecision.raciocinio } : {},
      });
      results.push({ group_id: gid, delivered });
    }

    return new Response(JSON.stringify({
      success: true,
      routing: { method: 'broadcast', confidence: llmDecision?.confianca },
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[agent-router] error', e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
