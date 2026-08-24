import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const systemPrompt = `Você é um assistente financeiro especializado em análise de DRE (Demonstrativo de Resultado do Exercício) e DFC/Variação (Demonstrativo de Fluxo de Caixa).

SUAS CAPACIDADES:
1. Analisar dados financeiros detalhadamente
2. Identificar tendências, anomalias e padrões
3. Fazer cálculos com os valores fornecidos
4. Explicar conceitos financeiros de forma clara
5. Comparar períodos e identificar variações significativas

REGRAS DE RESPOSTA:
1. SEMPRE analise os dados fornecidos no contexto - nunca invente números
2. Cite números específicos, códigos de conta e períodos
3. Faça cálculos reais com os valores (variação %, participação, etc.)
4. Explique seu raciocínio passo a passo
5. Use formatação monetária brasileira (R$ X.XXX,XX)
6. Identifique as maiores variações e explique possíveis causas
7. Seja conciso mas completo nas análises

ESTRUTURA DA DRE:
- Receitas (grupos iniciando com código 1.x)
- Custos (grupos iniciando com código 2.x)  
- Despesas Operacionais (grupos iniciando com código 3.x)
- Resultado Operacional
- Resultado Líquido

ESTRUTURA DA VARIAÇÃO/DFC:
- Atividades Operacionais
- Atividades de Investimento
- Atividades de Financiamento
- Variação Líquida de Caixa

REGRAS PARA GRÁFICOS:
- SOMENTE liste dados para gráfico se o usuário PEDIR EXPLICITAMENTE um gráfico
- Quando listar dados para gráfico, use EXATAMENTE os nomes das categorias que existem nos dados
- Formate cada item assim: "Nome Exato da Categoria: R$ valor"
- NÃO invente nomes de categorias - use apenas os que existem nos dados fornecidos

Quando receber dados, analise-os cuidadosamente antes de responder.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, dreData, variacaoData } = await req.json();
    
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY não está configurada");
    }

    // Preparar contexto com dados financeiros
    // IMPORTANTE: Os dados já vêm filtrados pelo frontend (ano mais recente)
    let dataContext = "";
    
    if (dreData && dreData.length > 0) {
      // Identificar períodos disponíveis nos dados recebidos
      const periodosSet = new Set<string>();
      dreData.forEach((item: any) => periodosSet.add(String(item.ano_mes)));
      const periodos = Array.from(periodosSet).sort();
      
      const anosSet = new Set<string>();
      periodos.forEach((p) => anosSet.add(p.split('-')[0]));
      const anosDisponiveis = Array.from(anosSet).sort();
      const anoDosDados = anosDisponiveis[anosDisponiveis.length - 1] || "N/A";
      
      // IMPORTANTE: Usar apenas o nível mais detalhado para cálculos (evitar dupla contagem)
      // Esta é a MESMA lógica usada em calculateIndicators do useDreData.ts
      const niveisSet = new Set<number>();
      dreData.forEach((r: any) => niveisSet.add(Number(r.nivel)));
      const niveis = Array.from(niveisSet).sort((a, b) => b - a);
      const nivelMaisDetalhado = niveis[0] || 0;
      const recordsDetalhados = dreData.filter((r: any) => r.nivel === nivelMaisDetalhado);
      
      // Calcular totais por grupo usando apenas registros detalhados
      const totaisPorGrupo: Record<string, number> = {};
      const detalhesPorGrupo: Record<string, Array<{codigo: string; descricao: string; valor: number}>> = {};
      
      recordsDetalhados.forEach((item: any) => {
        const grupo = item.grupo || "Sem Grupo";
        totaisPorGrupo[grupo] = (totaisPorGrupo[grupo] || 0) + (item.valor || 0);
        
        if (!detalhesPorGrupo[grupo]) detalhesPorGrupo[grupo] = [];
        detalhesPorGrupo[grupo].push({
          codigo: item.codigo,
          descricao: item.descricao,
          valor: item.valor || 0
        });
      });
      
      // Ordenar itens por valor absoluto para identificar maiores
      Object.keys(detalhesPorGrupo).forEach(grupo => {
        detalhesPorGrupo[grupo].sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
      });
      
      // Calcular resultado líquido (soma de todos os valores do nível detalhado)
      // MESMA lógica de calculateIndicators
      const resultadoLiquido = recordsDetalhados.reduce((sum: number, r: any) => sum + (r.valor || 0), 0);
      
      // Separar por categoria para exibição (MESMA lógica de calculateIndicators)
      let totalReceitas = 0;
      let totalCustos = 0;
      let totalDespesas = 0;
      
      recordsDetalhados.forEach((item: any) => {
        const grupoLower = (item.grupo || "").toLowerCase();
        if (grupoLower.includes('receita') && !grupoLower.includes('financeiro')) {
          totalReceitas += item.valor || 0;
        } else if (grupoLower.includes('custo')) {
          totalCustos += item.valor || 0;
        } else if (grupoLower.includes('despesa') && !grupoLower.includes('financeiro')) {
          totalDespesas += item.valor || 0;
        }
      });
      
      dataContext += `\n\n=== DADOS DRE FILTRADOS - ANO ${anoDosDados} ===`;
      dataContext += `\n(Estes são os mesmos dados exibidos no dashboard da DRE)`;
      dataContext += `\nTotal de registros detalhados: ${recordsDetalhados.length}`;
      dataContext += `\nPeríodos incluídos: ${periodos.join(', ')}`;
      dataContext += `\n\n📊 RESULTADO CALCULADO DO EXERCÍCIO ${anoDosDados}:`;
      dataContext += `\n  Receitas Totais: R$ ${totalReceitas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
      dataContext += `\n  Custos Totais: R$ ${totalCustos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
      dataContext += `\n  Despesas Totais: R$ ${totalDespesas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
      dataContext += `\n  RESULTADO LÍQUIDO: R$ ${resultadoLiquido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
      
      dataContext += `\n\n📋 TOTAIS POR GRUPO (${anoDosDados}):`;
      Object.entries(totaisPorGrupo)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .forEach(([grupo, total]) => {
          dataContext += `\n  ${grupo}: R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
          // Top 3 itens do grupo
          const topItens = detalhesPorGrupo[grupo]?.slice(0, 3) || [];
          topItens.forEach(item => {
            dataContext += `\n    - ${item.descricao}: R$ ${item.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
          });
        });
    }
    
    if (variacaoData && variacaoData.length > 0) {
      const variacaoDetalhado = variacaoData.slice(0, 50).map((item: any) => ({
        empresa: item.empresa,
        periodo: item.ano_mes,
        grupo: item.grupo,
        codigo: item.codigo,
        descricao: item.descricao,
        valor: item.valor
      }));
      dataContext += `\n\n--- DADOS VARIAÇÃO/DFC (${variacaoData.length} registros, mostrando primeiros 50) ---\n${JSON.stringify(variacaoDetalhado, null, 2)}`;
    }

    const fullSystemPrompt = systemPrompt + dataContext;

    // Chamar OpenAI API diretamente com fetch para streaming
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 2000,
        messages: [
          { role: "system", content: fullSystemPrompt },
          ...messages.map((m: any) => ({ role: m.role, content: m.content }))
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Aguarde um momento." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    // Retornar stream diretamente
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Assistente error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    
    // Handle rate limits
    if (errorMessage.includes("429") || errorMessage.includes("rate")) {
      return new Response(
        JSON.stringify({ error: "Limite de requisições excedido. Aguarde um momento." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
