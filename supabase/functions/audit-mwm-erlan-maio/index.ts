// Auditoria detalhada MWM MAIO/2026 empresa 1004 — foco ERLAN e gap total
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const inicio = "2026-05-01";
  const fim = "2026-05-31";
  const path = "/comercial/produtos";

  // Baixa em janelas semanais (mesma estrutura do frontend 1004)
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
      const u = `http://187.77.203.16/pelegrini${path}?cod_empresa_bi=1004&data_ini=${di}&data_fim=${df}&page_size=5000&page=${page}`;
      try {
        const r = await fetch(u);
        const j = await r.json();
        const arr = Array.isArray(j) ? j : (j.produtos || j.Produtos || j.itens || j.Itens || []);
        all.push(...arr);
        if (arr.length < 5000) break;
      } catch {
        break;
      }
    }
  }

  const norm = (s: any) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  const abs = (v: any) => Math.abs(Number(v || 0));
  const EQUIPE = ["BRUNO", "DANIEL", "ERLAN", "FABIO", "PAULO"];
  const pertence = (v: string) => !!v && !v.includes("CCH") && !v.includes("ESTOQUE") && EQUIPE.some(n => v.includes(n));
  const noMes = (it: any) => String(it.data_movimento ?? "").slice(0, 7) === "2026-05";

  // === BLOCO 1: ERLAN — todos os registros da regra atual ===
  const erlanStrict: any[] = [];
  for (const it of all) {
    if (!noMes(it)) continue;
    const vend = norm(it.vendedor);
    if (!vend.includes("ERLAN") || vend.includes("CCH") || vend.includes("ESTOQUE")) continue;
    const marca = norm(it.marca);
    if (marca !== "MWM") continue;
    const vv = abs(it.ValorVenda);
    const vd = abs(it.ValorDescontoItem);
    erlanStrict.push({
      num_nf: it.num_nf,
      cod_pedido: it.cod_pedido,
      data_movimento: it.data_movimento,
      produto: it.produto,
      grupo_produto: it.grupo_produto,
      marca: it.marca,
      tipo_movimento: it.tipo_movimento,
      ValorVenda: it.ValorVenda,
      ValorDescontoItem: it.ValorDescontoItem,
      ValorDevolucao: it.ValorDevolucao,
      impacto: vv + vd,
    });
  }
  const totalErlanStrict = erlanStrict.reduce((a, r) => a + r.impacto, 0);

  // === Candidatos para explicar gap do ERLAN (R$ 20.289,59) ===
  // Todos os registros do ERLAN que NÃO entram na regra atual
  const erlanFora: any[] = [];
  for (const it of all) {
    if (!noMes(it)) continue;
    const vend = norm(it.vendedor);
    if (!vend.includes("ERLAN")) continue;
    const marca = norm(it.marca);
    const grupo = norm(it.grupo_produto);
    const produto = norm(it.produto);
    const isMWMStrict = marca === "MWM";
    const equipeOk = !vend.includes("CCH") && !vend.includes("ESTOQUE");
    if (isMWMStrict && equipeOk) continue; // já contado
    const vv = abs(it.ValorVenda);
    const vd = abs(it.ValorDescontoItem);
    const impacto = vv + vd;
    if (impacto === 0) continue;
    // marcar razão de exclusão
    const razoes: string[] = [];
    if (!equipeOk) razoes.push("vendedor_CCH_ou_ESTOQUE");
    if (!isMWMStrict) razoes.push(`marca_${marca || "(vazio)"}`);
    if (grupo.includes("MWM")) razoes.push("grupo_contem_MWM");
    if (produto.includes("MWM")) razoes.push("produto_contem_MWM");
    erlanFora.push({
      razoes,
      vendedor: it.vendedor,
      num_nf: it.num_nf,
      cod_pedido: it.cod_pedido,
      data_movimento: it.data_movimento,
      produto: it.produto,
      grupo_produto: it.grupo_produto,
      marca: it.marca,
      tipo_movimento: it.tipo_movimento,
      ValorVenda: it.ValorVenda,
      ValorDescontoItem: it.ValorDescontoItem,
      ValorDevolucao: it.ValorDevolucao,
      impacto,
    });
  }
  // Ordenar por impacto desc e ranking de grupos/marcas
  erlanFora.sort((a, b) => b.impacto - a.impacto);
  const erlanForaPorMarca: Record<string, number> = {};
  const erlanForaPorGrupo: Record<string, number> = {};
  for (const r of erlanFora) {
    const m = String(r.marca || "(vazio)");
    const g = String(r.grupo_produto || "(vazio)");
    erlanForaPorMarca[m] = (erlanForaPorMarca[m] ?? 0) + r.impacto;
    erlanForaPorGrupo[g] = (erlanForaPorGrupo[g] ?? 0) + r.impacto;
  }

  // Combinações que se aproximam de 20.289,59
  const ALVO_ERLAN = 20289.59;
  const combosProximos: any[] = [];
  // 1) agrupar erlanFora por marca e somar
  for (const [m, v] of Object.entries(erlanForaPorMarca)) {
    combosProximos.push({ tipo: "marca_erlan_fora", chave: m, valor: v, diff: v - ALVO_ERLAN });
  }
  for (const [g, v] of Object.entries(erlanForaPorGrupo)) {
    combosProximos.push({ tipo: "grupo_erlan_fora", chave: g, valor: v, diff: v - ALVO_ERLAN });
  }
  combosProximos.sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff));

  // === BLOCO 2: gap do total (R$ 26.619,56) ===
  // Todos os registros MWM strict em 05/2026, agrupados por vendedor (inclusive fora da equipe)
  const porVendedorTodos: Record<string, number> = {};
  for (const it of all) {
    if (!noMes(it)) continue;
    const marca = norm(it.marca);
    if (marca !== "MWM") continue;
    const vv = abs(it.ValorVenda);
    const vd = abs(it.ValorDescontoItem);
    const vend = String(it.vendedor ?? "(sem vendedor)");
    porVendedorTodos[vend] = (porVendedorTodos[vend] ?? 0) + vv + vd;
  }
  const ordenado = Object.entries(porVendedorTodos).sort((a, b) => b[1] - a[1]);

  // Soma da equipe atual (5)
  const somaEquipe = ordenado
    .filter(([v]) => pertence(norm(v)))
    .reduce((a, [, val]) => a + val, 0);
  // Fora da equipe
  const foraEquipe = ordenado.filter(([v]) => !pertence(norm(v)));
  const totalForaEquipe = foraEquipe.reduce((a, [, val]) => a + val, 0);

  return new Response(JSON.stringify({
    parametros: {
      mes: "2026-05", empresa: 1004, regra: "marca === 'MWM' + equipe {BRUNO,DANIEL,ERLAN,FABIO,PAULO} sem CCH/ESTOQUE, |ValorVenda|+|ValorDescontoItem|",
      registrosBaixados: all.length, semanas,
    },

    bloco1_ERLAN: {
      totalSistema: Math.round(totalErlanStrict * 100) / 100,
      esperadoPrint: 108443.29,
      diferenca: Math.round((108443.29 - totalErlanStrict) * 100) / 100,
      qtdRegistrosStrict: erlanStrict.length,
      registrosStrict: erlanStrict,
      candidatosGap: {
        totalForaRegra: Math.round(erlanFora.reduce((a, r) => a + r.impacto, 0) * 100) / 100,
        porMarca: erlanForaPorMarca,
        porGrupo: erlanForaPorGrupo,
        combosMaisProximosDe_20289_59: combosProximos.slice(0, 15),
        top30registrosForaRegra: erlanFora.slice(0, 30),
      },
    },

    bloco2_TOTAL_PRINT: {
      totalPrint: 527908.64,
      somaVendedoresPrint: 501289.08,
      diferencaSemDono: 26619.56,
      somaEquipeSistema_MWMstrict: Math.round(somaEquipe * 100) / 100,
      vendedoresMWM_foraEquipe: foraEquipe.map(([v, val]) => ({ vendedor: v, valor: Math.round(val * 100) / 100 })),
      totalForaEquipe: Math.round(totalForaEquipe * 100) / 100,
      todosVendedoresMWM: ordenado.map(([v, val]) => ({ vendedor: v, valor: Math.round(val * 100) / 100 })),
    },
  }, null, 2), { headers: { ...corsHeaders, "content-type": "application/json" } });
});
