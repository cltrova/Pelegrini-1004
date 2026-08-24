// Auditoria fina NF-a-NF EATON JUNHO/2026 empresa 1004
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // duas metades do mês
  const semanas: Array<[string, string]> = [
    ["2026-06-01", "2026-06-15"],
    ["2026-06-16", "2026-06-30"],
  ];

  const all: any[] = [];
  for (const [di, df] of semanas) {
    for (let page = 1; page <= 30; page++) {
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
  const round = (n: number) => Math.round(n * 100) / 100;
  const EQUIPE = ["BRUNO", "DANIEL", "ERLAN", "FABIO", "PAULO"];
  const identificaVend = (v: string) => {
    if (!v || v.includes("CCH") || v.includes("ESTOQUE")) return null;
    return EQUIPE.find(n => v.includes(n)) || null;
  };
  const noMes = (it: any) => String(it.data_movimento ?? "").slice(0, 7) === "2026-06";
  const isEATON = (marca: string, grupo: string, produto: string) =>
    marca === "EATON" || ((grupo === "DESATIVADO" || grupo === "SUBSTITUIDO") && produto.includes("EATON"));

  // Excel de referência (do print junho)
  const excel: Record<string, number> = {
    BRUNO: 154470.61,
    DANIEL: 219115.62,
    ERLAN: 89368.40,
    FABIO: 86192.53,
    PAULO: 30806.43,
  };
  const totalCardExcel = 582223.44;

  // Agregar por vendedor (equipe) e capturar detalhes
  const detalhesPorVend: Record<string, any[]> = { BRUNO: [], DANIEL: [], ERLAN: [], FABIO: [], PAULO: [] };
  const totaisPorVend: Record<string, number> = { BRUNO: 0, DANIEL: 0, ERLAN: 0, FABIO: 0, PAULO: 0 };
  // agrupamento por NF
  const nfsPorVend: Record<string, Record<string, { num_nf: any; data_movimento: any; cliente: any; qtd_itens: number; impacto: number; produtos: string[] }>> = {
    BRUNO: {}, DANIEL: {}, ERLAN: {}, FABIO: {}, PAULO: {},
  };

  // EATON fora da equipe
  const foraEquipe: any[] = [];
  const foraEquipePorVend: Record<string, { total: number; qtd: number }> = {};

  for (const it of all) {
    if (!noMes(it)) continue;
    const marca = norm(it.marca);
    const grupo = norm(it.grupo_produto);
    const produto = norm(it.produto);
    if (!isEATON(marca, grupo, produto)) continue;

    const impacto = abs(it.ValorVenda) + abs(it.ValorDescontoItem);
    if (impacto === 0) continue;

    const vendNorm = norm(it.vendedor);
    const key = identificaVend(vendNorm);

    if (!key) {
      // EATON fora da equipe
      foraEquipe.push({
        vendedor: it.vendedor, num_nf: it.num_nf, cod_pedido: it.cod_pedido,
        data_movimento: it.data_movimento, cliente: it.cliente ?? it.nome_cliente,
        marca: it.marca, grupo_produto: it.grupo_produto, produto: it.produto,
        ValorVenda: num(it.ValorVenda), ValorDescontoItem: num(it.ValorDescontoItem),
        ValorDevolucao: num(it.ValorDevolucao), impacto,
      });
      const bucket = it.vendedor ?? "(sem vendedor)";
      foraEquipePorVend[bucket] = foraEquipePorVend[bucket] ?? { total: 0, qtd: 0 };
      foraEquipePorVend[bucket].total += impacto;
      foraEquipePorVend[bucket].qtd += 1;
      continue;
    }

    totaisPorVend[key] += impacto;
    const nf = String(it.num_nf ?? it.cod_pedido ?? "?");
    const agg = nfsPorVend[key][nf] ?? { num_nf: it.num_nf, data_movimento: it.data_movimento, cliente: it.cliente ?? it.nome_cliente, qtd_itens: 0, impacto: 0, produtos: [] };
    agg.qtd_itens += 1;
    agg.impacto += impacto;
    if (agg.produtos.length < 5) agg.produtos.push(String(it.produto ?? "").slice(0, 40));
    nfsPorVend[key][nf] = agg;

    detalhesPorVend[key].push({
      num_nf: it.num_nf, cod_pedido: it.cod_pedido, data_movimento: it.data_movimento,
      cliente: it.cliente ?? it.nome_cliente, produto: it.produto, grupo_produto: it.grupo_produto,
      marca: it.marca, ValorVenda: num(it.ValorVenda), ValorDescontoItem: num(it.ValorDescontoItem),
      ValorDevolucao: num(it.ValorDevolucao), impacto,
    });
  }

  // Montar blocos por vendedor
  const bloco = (v: string) => {
    const nfsMap = nfsPorVend[v];
    const nfsArr = Object.values(nfsMap).sort((a, b) => b.impacto - a.impacto)
      .map(x => ({ ...x, impacto: round(x.impacto) }));
    const totalSis = round(totaisPorVend[v]);
    const totalXls = excel[v];
    const gap = round(totalXls - totalSis);
    // Candidatas: NFs cujo impacto se aproxima do |gap|
    const candidatasProximas = nfsArr
      .filter(n => Math.abs(n.impacto - Math.abs(gap)) < 200 || n.impacto < Math.abs(gap) + 100)
      .sort((a, b) => Math.abs(a.impacto - Math.abs(gap)) - Math.abs(b.impacto - Math.abs(gap)))
      .slice(0, 10);
    // Combinacoes de 1-2 NFs que somem |gap|
    const combos: any[] = [];
    const small = nfsArr.filter(n => n.impacto <= Math.abs(gap) + 500).slice(0, 40);
    for (let i = 0; i < small.length; i++) {
      if (Math.abs(small[i].impacto - Math.abs(gap)) < 1) combos.push({ soma: small[i].impacto, nfs: [small[i]] });
      for (let j = i + 1; j < small.length; j++) {
        const s = small[i].impacto + small[j].impacto;
        if (Math.abs(s - Math.abs(gap)) < 1) combos.push({ soma: round(s), nfs: [small[i], small[j]] });
      }
    }
    // detalhe: itens com devolucao
    const comDevolucao = detalhesPorVend[v].filter(d => Math.abs(d.ValorDevolucao) > 0);
    return {
      vendedor: v,
      qtd_nfs: nfsArr.length,
      qtd_itens: detalhesPorVend[v].length,
      total_sistema: totalSis,
      total_excel: totalXls,
      gap,
      direcao_gap: gap > 0 ? "Excel > Sistema (falta capturar)" : gap < 0 ? "Sistema > Excel (excesso no sistema)" : "sem gap",
      nfs_top: nfsArr.slice(0, 20),
      candidatas_proximas_ao_gap: candidatasProximas,
      combinacoes_1_2_nfs_batendo_gap: combos.slice(0, 5),
      itens_com_devolucao: comDevolucao.slice(0, 10),
      total_devolucao: round(comDevolucao.reduce((s, d) => s + Math.abs(d.ValorDevolucao), 0)),
    };
  };

  const somaSistema = round(Object.values(totaisPorVend).reduce((a, b) => a + b, 0));
  const somaExcel = round(Object.values(excel).reduce((a, b) => a + b, 0));
  const totalForaEquipe = round(foraEquipe.reduce((s, x) => s + x.impacto, 0));

  return new Response(JSON.stringify({
    parametros: { mes: "2026-06", empresa: 1004, registrosBaixados: all.length, regraEATON: "marca===EATON OR (grupo IN (DESATIVADO,SUBSTITUIDO) AND produto contém EATON)", formula: "|ValorVenda|+|ValorDescontoItem|" },

    BLOCO1_BRUNO: bloco("BRUNO"),
    BLOCO2_DANIEL: bloco("DANIEL"),
    BLOCO3_ERLAN: bloco("ERLAN"),
    BLOCO4_FABIO: bloco("FABIO"),
    BLOCO5_PAULO: bloco("PAULO"),

    BLOCO6_ORIGEM_2269: {
      total_card_excel: totalCardExcel,
      soma_5_vendedores_excel: somaExcel,
      diferenca_dentro_do_excel: round(totalCardExcel - somaExcel),
      eaton_fora_equipe_no_sistema: {
        total: totalForaEquipe,
        qtd_registros: foraEquipe.length,
        por_vendedor: Object.fromEntries(
          Object.entries(foraEquipePorVend).sort((a, b) => b[1].total - a[1].total)
            .map(([k, v]) => [k, { total: round(v.total), qtd: v.qtd }])
        ),
        top_nfs: foraEquipe.sort((a, b) => b.impacto - a.impacto).slice(0, 20),
      },
      hipoteses: [
        totalForaEquipe >= 2000 && totalForaEquipe <= 2600
          ? `EATON fora da equipe (R$ ${totalForaEquipe}) é compatível com o gap de R$ 2.269,61 do card`
          : `EATON fora da equipe (R$ ${totalForaEquipe}) NÃO explica sozinho os R$ 2.269,61`,
        "Se não for fora da equipe, provavelmente é linha manual/ajuste no Excel (não rastreável no JSON)",
      ],
    },

    BLOCO7_CONCLUSAO: {
      soma_sistema_5vend: somaSistema,
      soma_excel_5vend: somaExcel,
      gap_total_5vend: round(somaExcel - somaSistema),
      total_card_excel: totalCardExcel,
      gap_card_vs_soma_excel: round(totalCardExcel - somaExcel),
      total_eaton_fora_equipe: totalForaEquipe,
      observacao: "Gaps por vendedor bidirecionais (ERLAN excedente, demais deficitários) — não há filtro único capaz de fechar tudo. Ver blocos 1-5 para NFs candidatas específicas.",
    },
  }, null, 2), { headers: { ...corsHeaders, "content-type": "application/json" } });
});
