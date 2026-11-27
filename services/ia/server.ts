import { pathToFileURL } from 'node:url';
import { handleAiRequest as compose } from '../../supabase/functions/ai-compose/index.ts';
import { handleAiRequest as dre } from '../../supabase/functions/assistente-dre/index.ts';
import { handleAiRequest as estoque } from '../../supabase/functions/assistente-estoque/index.ts';
import { handleAiRequest as estoqueBrain } from '../../supabase/functions/assistente-estoque-brain/index.ts';
import { handleAiRequest as estoqueInsights } from '../../supabase/functions/assistente-estoque-insights/index.ts';
import { handleAiRequest as financeiro } from '../../supabase/functions/assistente-financeiro/index.ts';
import { handleAiRequest as variacao } from '../../supabase/functions/assistente-variacao/index.ts';
import { handleAiRequest as campanhasInsights } from '../../supabase/functions/campanhas-insights/index.ts';
import { handleAiRequest as categoriasInsights } from '../../supabase/functions/categorias-insights/index.ts';
import { handleAiRequest as cobranca } from '../../supabase/functions/cobranca-simulate/index.ts';
import { handleAiRequest as comercialChat } from '../../supabase/functions/comercial-ai-chat/index.ts';
import { handleAiRequest as comercialFeed } from '../../supabase/functions/comercial-ai-feed/index.ts';
import { handleAiRequest as marcasInsights } from '../../supabase/functions/marcas-insights/index.ts';
import { handleAiRequest as metasInsights } from '../../supabase/functions/metas-insights/index.ts';
import { handleAiRequest as produtosInsights } from '../../supabase/functions/produtos-insights/index.ts';
import { handleAiRequest as transcribe } from '../../supabase/functions/transcribe-audio/index.ts';
import { handleSmartReplyRequest } from '../../supabase/functions/_shared/smart-replies.ts';
import { createAiServer } from './http.ts';
import type { AiHandlers } from './http.ts';
import { createDailyCommercialInsights, readGeneratedInsights } from './daily-commercial-insights.ts';
import { loadCommercialAnalysisInput } from './daily-commercial-source.ts';

const handlers = {
  'ai-compose': compose,
  'assistente-dre': dre,
  'assistente-estoque': estoque,
  'assistente-estoque-brain': estoqueBrain,
  'assistente-estoque-insights': estoqueInsights,
  'assistente-financeiro': financeiro,
  'assistente-variacao': variacao,
  'campanhas-insights': campanhasInsights,
  'categorias-insights': categoriasInsights,
  'cobranca-simulate': cobranca,
  'comercial-ai-chat': comercialChat,
  'comercial-ai-feed': comercialFeed,
  'marcas-insights': marcasInsights,
  'produtos-insights': produtosInsights,
  'smart-replies': handleSmartReplyRequest,
  'transcribe-audio': transcribe,
} satisfies AiHandlers;

export function createPelegriniAiServer() {
  const dataDir = process.env.PELEGRINI_INSIGHTS_DIR?.trim();
  const dailyInsights = dataDir && createDailyCommercialInsights({
    dataDir,
    async generate(branch, periodo) {
      if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('Chave de IA indisponível');
      const input = await loadCommercialAnalysisInput(branch, periodo, process.env);
      if (input.vendedores.length === 0) return [];
      const request = new Request('http://localhost/api/ia/metas-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(90_000),
      });
      return readGeneratedInsights(await metasInsights(request));
    },
  });
  const server = createAiServer({ handlers, readDailyInsights: dailyInsights ? dailyInsights.read : undefined });
  if (dailyInsights) server.once('listening', () => server.once('close', dailyInsights.start()));
  return server;
}

function listen(): void {
  const host = process.env.PELEGRINI_AI_HOST?.trim() || '127.0.0.1';
  const configuredPort = process.env.PELEGRINI_AI_PORT?.trim() || '4319';
  const port = Number(configuredPort);
  if (!/^\d{1,5}$/.test(configuredPort) || port > 65_535) {
    console.error('PELEGRINI_AI_PORT inválida.');
    process.exitCode = 1;
    return;
  }

  const server = createPelegriniAiServer();
  server.once('error', () => {
    console.error('Não foi possível iniciar o serviço de IA.');
    process.exitCode = 1;
  });
  server.listen({ host, port });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) listen();
