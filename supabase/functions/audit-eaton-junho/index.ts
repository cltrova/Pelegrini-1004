// Auditoria complementar EATON / Junho 2026 - versão 2 (CT + CH)
Deno.serve(async () => {
  const VPS_BASE = "http://187.77.203.16";
  const CLIENTE = "pelegrini";
  const PATH = "/comercial/produtos";
  const COD_BIS = ["1004", "10041"];
  const ALVO = 582223.44;
  const MES = "2026-06";

  const semanas: [string, string][] = [];
  const d = new Date("2026-06-01T00:00:00");
  const end = new Date("2026-06-30T00:00:00");
  while (d.getTime() <= end.getTime()) {
    const di = d.toISOString().split("T")[0];
    const next = new Date(d);
    next.setDate(next.getDate() + 6);
    if (next.getTime() > end.getTime()) next.setTime(end.getTime());
    semanas.push([di, next.toISOString().split("T")[0]]);
    d.setDate(d.getDate() + 7);
  }

  const all: any[] = [];
  for (const [di, df] of semanas) {
    for (const COD_BI of COD_BIS) {
      for (let page = 1; page <= 20; page++) {
        const u = `${VPS_BASE}/${CLIENTE}${PATH}?data_ini=${di}&data_fim=${df}&page_size=5000&page=${page}&cod_empresa_bi=${COD_BI}`;
        try {
          const r = await fetch(u);
          if (!r.ok) break;
          const j = await r.json();
          const arr = Array.isArray(j) ? j : (j.produtos || j.Produtos || j.itens || []);
          arr.forEach((x: any) => x.__filial = COD_BI === "10041" ? "CH" : "CT");
          all.push(...arr);
          if (arr.length < 5000) break;
        } catch { break; }
      }
    }
  }

  const norm = (s: any) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  const num = (v: any) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    if (typeof v !== "string") return 0;
    const s = v.replace(/[^\d,.-]/g, "");
    if (!s) return 0;
    const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
    return Number.isFinite(n) ? n : 0;
  };
  const r2 = (n: number) => Math.round(n * 100) / 100;

  for (const it of all) if (!it.tipo) it.tipo = it.tipo_movimento;

  const isDev = (it: any) => norm(it.tipo).startsWith("DEV");
  const valorPadrao = (it: any) => {
    if (isDev(it)) return -Math.abs(num(it.ValorDevolucao ?? it.valor_devolucao));
    return Math.abs(num(it.ValorVenda ?? it.valor_venda)) + Math.abs(num(it.ValorDescontoItem ?? it.valor_desconto_item));
  };
  const isEaton = (it: any) => {
    const m = norm(it.marca ?? it.Marca ?? it.descricao_marca);
    const g = norm(it.grupo ?? it.Grupo ?? it.grupo_produto);
    const p = norm(it.produto ?? it.Produto ?? it.descricao ?? it.Descricao);
    if (m === "EATON" && g !== "VW") return true;
    if (m === "DESATIVADO/SUBSTITUIDO" && p.includes("EATON")) return true;
    return false;
  };
  const isEatonAmpl = (it: any) => {
    if (isEaton(it)) return true;
    const m = norm(it.marca ?? it.Marca);
    const g = norm(it.grupo ?? it.Grupo ?? it.grupo_produto);
    const p = norm(it.produto ?? it.Produto ?? it.descricao);
    return m.includes("EATON") || g.startsWith("EATON") || p.includes("EATON");
  };
  const dataOk = (it: any) => String(it.data_movimento ?? "").slice(0, 7) === MES;
  const tipoOk = (it: any) => {
    const t = norm(it.tipo);
    return t === "PEDIDO" || t === "VENDA" || t.startsWith("DEV");
  };
  const vendedorOk = (it: any) => {
    const v = norm(it.vendedor);
    return !!v && !v.includes("ESTOQUE");
  };

  const base = all.filter(dataOk).filter(tipoOk);

  const cenarios: Record<string, { qtd: number; total: number; diff: number }> = {};
  const push = (nome: string, filter: (it: any) => boolean) => {
    const arr = base.filter(filter);
    const total = arr.reduce((s, it) => s + valorPadrao(it), 0);
    cenarios[nome] = { qtd: arr.length, total: r2(total), diff: r2(ALVO - total) };
  };

  push("01_CT_regra_atual", it => it.__filial === "CT" && vendedorOk(it) && isEaton(it));
  push("02_CH_regra_atual", it => it.__filial === "CH" && vendedorOk(it) && isEaton(it));
  push("03_CT+CH_regra_atual", it => vendedorOk(it) && isEaton(it));
  push("04_CT_com_ESTOQUE", it => it.__filial === "CT" && isEaton(it));
  push("05_CT+CH_com_ESTOQUE", it => isEaton(it));
  push("06_CT_ampliado", it => it.__filial === "CT" && vendedorOk(it) && isEatonAmpl(it));
  push("07_CT+CH_ampliado", it => vendedorOk(it) && isEatonAmpl(it));
  push("08_CT+CH_ampliado_com_ESTOQUE", it => isEatonAmpl(it));

  // Detalhe filial
  const porFilial = {
    CT: all.filter(it => it.__filial === "CT").length,
    CH: all.filter(it => it.__filial === "CH").length,
  };

  // Vendedores excluídos por ESTOQUE que tocaram EATON
  const excluidosEstoque: Record<string, number> = {};
  for (const it of base.filter(it => isEaton(it) && !vendedorOk(it))) {
    const v = norm(it.vendedor) || "(vazio)";
    excluidosEstoque[v] = (excluidosEstoque[v] ?? 0) + valorPadrao(it);
  }
  for (const k of Object.keys(excluidosEstoque)) excluidosEstoque[k] = r2(excluidosEstoque[k]);

  // Ranking vendedores CT+CH regra atual
  const vend: Record<string, { valor: number; filial: string }> = {};
  for (const it of base.filter(it => vendedorOk(it) && isEaton(it))) {
    const key = `${norm(it.vendedor)} [${it.__filial}]`;
    vend[key] = vend[key] ?? { valor: 0, filial: it.__filial };
    vend[key].valor += valorPadrao(it);
  }
  const rankVend = Object.entries(vend)
    .map(([k, v]) => ({ vendedor: k, valor: r2(v.valor) }))
    .sort((a, b) => b.valor - a.valor);

  return new Response(JSON.stringify({
    alvo: ALVO,
    total_registros: all.length,
    por_filial: porFilial,
    cenarios,
    vendedores_ESTOQUE_com_EATON: excluidosEstoque,
    ranking_vendedores_regra_atual_CT_CH: rankVend,
    conclusao: (() => {
      const best = Object.entries(cenarios).sort((a, b) => Math.abs(a[1].diff) - Math.abs(b[1].diff))[0];
      return {
        cenario_mais_proximo: best[0],
        total: best[1].total,
        diff: best[1].diff,
        bate_alvo: Math.abs(best[1].diff) < 1,
      };
    })(),
  }, null, 2), { headers: { "content-type": "application/json" } });
});
