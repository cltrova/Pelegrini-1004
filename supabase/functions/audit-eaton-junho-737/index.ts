// Auditoria fina EATON JUNHO/2026 empresa 1004 — rastrear gap de R$ 737,76
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const inicio = "2026-06-01";
  const fim = "2026-06-30";

  const semanas: Array<[string, string]> = [];
  const d = new Date(inicio + "T00:00:00");
  const end = new Date(fim + "T00:00:00");
  while (d.getTime() <= end.getTime()) {
    const di = d.toISOString().slice(0, 10);
    const next = new Date(d);
    next.setDate(next.getDate() + 6);
    if (next.getTime() > end.getTime()) next.setTime(end.getTime());
    const nx = new Date(next);
    nx.setDate(nx.getDate() + 1);
    semanas.push([di, nx.toISOString().slice(0, 10)]);
    d.setDate(d.getDate() + 7);
  }

  const all: any[] = [];
  for (const [di, df] of semanas) {
    for (let page = 1; page <= 20; page++) {
      const u = `http://187.77.203.16/pelegrini/comercial/produtos?cod_empresa_bi=1004&data_ini=${di}&data_fim=${df}&page_size=5000&page=${page}`;
      try {
        const r = await fetch(u);
        const j = await r.json();
        const arr = Array.isArray(j) ? j : (j.produtos || j.Produtos || j.itens || j.Itens || []);
        all.push(...arr);
        if (arr.length < 5000) break;
      } catch { break; }
    }
  }

  const norm = (s: any) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  const abs = (v: any) => Math.abs(Number(v || 0));
  const num = (v: any) => Number(v || 0);
  const EQUIPE = ["BRUNO", "DANIEL", "ERLAN", "FABIO", "PAULO"];
  const pertenceEquipe = (v: string) => !!v && !v.includes("CCH") && !v.includes("ESTOQUE") && EQUIPE.some(n => v.includes(n));
  const noMes = (it: any) => String(it.data_movimento ?? "").slice(0, 7) === "2026-06";

  // Regra atual EATON (validada em junho)
  const isEATON_atual = (marca: string, grupo: string, produto: string) =>
    marca === "EATON" || ((grupo === "DESATIVADO" || grupo === "SUBSTITUIDO") && produto.includes("EATON"));

  // Candidatos ampliados
  const isEATON_ampliado = (marca: string, grupo: string, produto: string) =>
    marca === "EATON" ||
    grupo.startsWith("EATON") ||
    grupo.includes("EATON") ||
    produto.includes("EATON");

  let totalEatonAtual = 0;
  let totalEatonAmpliado = 0;
  let totalEatonForaEquipe = 0;   // itens EATON regra atual mas vendedor fora equipe
  let totalEatonForaMes = 0;      // itens EATON marca === EATON mas fora do mes
  const porVendAtual: Record<string, number> = {};
  const composicaoDetalhada: any[] = []; // todos os EATON regra atual
  const candidatosGap: any[] = [];       // ampliado - atual (com equipe)
  const eatonForaEquipeDetalhe: any[] = [];
  const eatonDevolucaoDetalhe: any[] = [];
  let totalDevolucaoEATON = 0;
  let totalDescontoEATON = 0;

  for (const it of all) {
    const marca = norm(it.marca);
    const grupo = norm(it.grupo_produto);
    const produto = norm(it.produto);
    const vend = norm(it.vendedor);
    const impacto = abs(it.ValorVenda) + abs(it.ValorDescontoItem);
    if (impacto === 0) continue;

    const eatonAtual = isEATON_atual(marca, grupo, produto);
    const eatonAmpl = isEATON_ampliado(marca, grupo, produto);

    if (marca === "EATON" && !noMes(it)) {
      totalEatonForaMes += impacto;
      continue;
    }
    if (!noMes(it)) continue;

    if (eatonAtual && !pertenceEquipe(vend)) {
      totalEatonForaEquipe += impacto;
      eatonForaEquipeDetalhe.push({
        vendedor: it.vendedor, num_nf: it.num_nf, data_movimento: it.data_movimento,
        marca: it.marca, grupo_produto: it.grupo_produto, produto: it.produto,
        ValorVenda: it.ValorVenda, ValorDescontoItem: it.ValorDescontoItem, impacto,
      });
      continue;
    }

    if (!pertenceEquipe(vend)) continue;

    if (eatonAtual) {
      totalEatonAtual += impacto;
      porVendAtual[vend] = (porVendAtual[vend] ?? 0) + impacto;
      totalDescontoEATON += abs(it.ValorDescontoItem);
      const dev = abs(it.ValorDevolucao);
      if (dev > 0) {
        totalDevolucaoEATON += dev;
        eatonDevolucaoDetalhe.push({
          vendedor: it.vendedor, num_nf: it.num_nf, data_movimento: it.data_movimento,
          marca: it.marca, grupo_produto: it.grupo_produto, produto: it.produto,
          ValorVenda: it.ValorVenda, ValorDescontoItem: it.ValorDescontoItem,
          ValorDevolucao: it.ValorDevolucao, impacto,
        });
      }
      composicaoDetalhada.push({
        vendedor: it.vendedor, num_nf: it.num_nf, cod_pedido: it.cod_pedido,
        data_movimento: it.data_movimento, marca: it.marca, grupo_produto: it.grupo_produto,
        produto: it.produto, tipo_movimento: it.tipo_movimento,
        ValorVenda: num(it.ValorVenda), ValorDescontoItem: num(it.ValorDescontoItem),
        ValorDevolucao: num(it.ValorDevolucao), impacto,
      });
    }

    if (eatonAmpl) totalEatonAmpliado += impacto;

    if (eatonAmpl && !eatonAtual) {
      candidatosGap.push({
        vendedor: it.vendedor, num_nf: it.num_nf, cod_pedido: it.cod_pedido,
        data_movimento: it.data_movimento, marca: it.marca, grupo_produto: it.grupo_produto,
        produto: it.produto, tipo_movimento: it.tipo_movimento,
        ValorVenda: num(it.ValorVenda), ValorDescontoItem: num(it.ValorDescontoItem),
        ValorDevolucao: num(it.ValorDevolucao), impacto,
      });
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  const validadoEATON = 579953.59;
  const atual = round(totalEatonAtual);
  const gapReal = round(validadoEATON - atual);

  // Buscar candidatos exatos ~ R$ 737,76 (tolerância)
  const candidatosProximos = candidatosGap
    .filter(c => Math.abs(c.impacto - gapReal) < 50 || c.impacto < 1500)
    .sort((a,b)=>Math.abs(a.impacto - gapReal) - Math.abs(b.impacto - gapReal))
    .slice(0, 30);

  // Combinar 1 a 3 itens que somem ~gap
  const combinacoes: any[] = [];
  const smalls = candidatosGap.filter(c => c.impacto < gapReal + 500).slice(0, 50);
  for (let i = 0; i < smalls.length; i++) {
    if (Math.abs(smalls[i].impacto - gapReal) < 1) combinacoes.push({ soma: smalls[i].impacto, itens: [smalls[i]] });
    for (let j = i+1; j < smalls.length; j++) {
      const s2 = smalls[i].impacto + smalls[j].impacto;
      if (Math.abs(s2 - gapReal) < 1) combinacoes.push({ soma: s2, itens: [smalls[i], smalls[j]] });
    }
  }

  return new Response(JSON.stringify({
    parametros: {
      mes: "2026-06", empresa: 1004, registrosBaixados: all.length,
      regraAtual: "marca === 'EATON' OR ((grupo IN (DESATIVADO,SUBSTITUIDO)) AND produto contém 'EATON')",
      formula: "|ValorVenda| + |ValorDescontoItem|",
      equipe: EQUIPE,
    },

    BLOCO1_EATON_ATUAL: {
      totalEATON: atual,
      totalEATON_validado: validadoEATON,
      diferencaReal: gapReal,
      qtdRegistros: composicaoDetalhada.length,
      totalDescontoIncluso: round(totalDescontoEATON),
      totalDevolucaoEATON: round(totalDevolucaoEATON),
      qtdRegistrosComDevolucao: eatonDevolucaoDetalhe.length,
      porVendedor: Object.fromEntries(
        Object.entries(porVendAtual).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k, round(v)])
      ),
    },

    BLOCO2_CANDIDATOS_GAP: {
      totalEATON_ampliado: round(totalEatonAmpliado),
      diferencaAmpliadoVsAtual: round(totalEatonAmpliado - atual),
      qtdCandidatos: candidatosGap.length,
      totalEatonForaEquipe: round(totalEatonForaEquipe),
      qtdEatonForaEquipe: eatonForaEquipeDetalhe.length,
      totalEatonForaMes: round(totalEatonForaMes),
      candidatosProximosDoGap: candidatosProximos,
      combinacoesQueBatemGap: combinacoes.slice(0, 10),
      eatonForaEquipe_top: eatonForaEquipeDetalhe.sort((a,b)=>b.impacto-a.impacto).slice(0,15),
    },

    BLOCO3_DEVOLUCAO_EATON: {
      totalDevolucao: round(totalDevolucaoEATON),
      qtd: eatonDevolucaoDetalhe.length,
      registros: eatonDevolucaoDetalhe.sort((a,b)=>b.impacto-a.impacto).slice(0,15),
    },

    BLOCO4_CONCLUSAO: {
      gap: gapReal,
      hipoteses: [
        gapReal > 0 && candidatosProximos.length > 0
          ? `Existem ${candidatosProximos.length} candidatos ampliados próximos ao gap`
          : null,
        gapReal > 0 && totalEatonForaEquipe > 0
          ? `Há R$ ${round(totalEatonForaEquipe)} de EATON fora da equipe`
          : null,
        combinacoes.length > 0
          ? `${combinacoes.length} combinação(ões) de 1-2 itens que batem exato o gap`
          : "Nenhuma combinação simples bate exato o gap",
      ].filter(Boolean),
    },
  }, null, 2), { headers: { ...corsHeaders, "content-type": "application/json" } });
});
