// Investigação de regressão de campanha MWM/EATON — empresa 1004.
// Baixa itens via VPS pelo mesmo caminho do frontend e testa várias regras
// de agregação, mostrando qual reproduz os alvos validados:
//   maio/2026 MWM  = R$ 527.908,64
//   junho/2026 EATON = R$ 582.223,44
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  const url = new URL(req.url);
  const mes = url.searchParams.get("mes") ?? "2026-06"; // 2026-05 ou 2026-06
  const marcaAlvo = (url.searchParams.get("marca") ?? "EATON").toUpperCase();

  // Config 1004 (VPS Pelegrini)
  const VPS_BASE = "http://187.77.203.16";
  const CLIENTE = "pelegrini";
  const PATH = "/comercial/produtos";
  const COD_BI = "1004";

  const [yy, mm] = mes.split("-").map(Number);
  const ini = `${yy}-${String(mm).padStart(2, "0")}-01`;
  const lastDay = new Date(yy, mm, 0).getDate();
  const fim = `${yy}-${String(mm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  // Janelas semanais como o frontend faz
  const semanas: [string, string][] = [];
  const d = new Date(`${ini}T00:00:00`);
  const end = new Date(`${fim}T00:00:00`);
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
    for (let page = 1; page <= 20; page++) {
      const u = `${VPS_BASE}/${CLIENTE}${PATH}?data_ini=${di}&data_fim=${df}&page_size=5000&page=${page}&cod_empresa_bi=${COD_BI}`;
      try {
        const r = await fetch(u);
        if (!r.ok) break;
        const j = await r.json();
        const arr = Array.isArray(j) ? j : (j.produtos || j.Produtos || j.itens || []);
        all.push(...arr);
        if (arr.length < 5000) break;
      } catch (e) {
        console.error("chunk fail", di, df, page, e);
        break;
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

  // Amostra de campos
  const sampleKeys = all[0] ? Object.keys(all[0]) : [];

  // Classificador de marca (mesma lógica do CampanhasTab)
  const pertenceMarca = (it: any, marca: string) => {
    const marcaC = norm(marca);
    const marcaItem = norm(it.marca ?? it.Marca ?? it.descricao_marca);
    const produto = norm(it.produto ?? it.Produto ?? it.descricao ?? it.Descricao);
    const grupo = norm(it.grupo ?? it.Grupo ?? it.grupo_produto ?? it.GrupoProduto);
    if (marcaItem === marcaC) {
      if (marcaC === "EATON" && grupo === "VW") return false;
      return true;
    }
    if (marcaC === "EATON" && marcaItem === "DESATIVADO/SUBSTITUIDO" && produto.includes("EATON")) return true;
    if (marcaC === "MWM" && grupo.startsWith("MWM")) return true;
    return false;
  };

  // Diferentes fórmulas candidatas
  const formulas: Record<string, (it: any) => number> = {
    // A) valor_bruto_item = ValorVenda + ValorDescontoItem  |  DEV = -|ValorDevolucao|
    A_bruto_venda_desc: (it) => {
      const tipo = norm(it.tipo);
      if (tipo.startsWith("DEV")) return -Math.abs(num(it.ValorDevolucao ?? it.valor_devolucao));
      return Math.abs(num(it.ValorVenda ?? it.valor_venda)) + Math.abs(num(it.ValorDescontoItem ?? it.valor_desconto_item));
    },
    // B) receita = ValorVenda - ValorDevolucao (fórmula BI)
    B_receita_bi: (it) => num(it.ValorVenda ?? it.valor_venda) - num(it.ValorDevolucao ?? it.valor_devolucao),
    // C) só ValorVenda (ignora devolução completamente)
    C_so_venda: (it) => Math.abs(num(it.ValorVenda ?? it.valor_venda)),
    // D) valor_total assinado no JSON
    D_valor_total: (it) => {
      const tipo = norm(it.tipo);
      const v = Math.abs(num(it.valor_total ?? it.ValorTotal ?? it.valor_real));
      return tipo.startsWith("DEV") ? -v : v;
    },
    // E) ValorVenda para PEDIDO, -|ValorDevolucao| para DEV (sem desconto)
    E_venda_menos_devitem: (it) => {
      const tipo = norm(it.tipo);
      if (tipo.startsWith("DEV")) return -Math.abs(num(it.ValorDevolucao ?? it.valor_devolucao));
      return Math.abs(num(it.ValorVenda ?? it.valor_venda));
    },
  };

  const filtroData = (it: any) => {
    const df = String(it.data_movimento ?? it.data_documento ?? "").slice(0, 7);
    return df === mes;
  };
  const filtroTipo = (it: any) => {
    const t = norm(it.tipo_movimento ?? it.tipo);
    return t === "PEDIDO" || t.startsWith("DEV");
  };
  const filtroVendedor = (it: any) => {
    const v = norm(it.vendedor);
    return !!v && !v.includes("ESTOQUE");
  };

  // Normalizar tipo pra ficar em `it.tipo` para as fórmulas
  for (const it of all) {
    if (!it.tipo) it.tipo = it.tipo_movimento;
  }

  const base = all.filter(it => filtroData(it) && filtroTipo(it) && filtroVendedor(it) && pertenceMarca(it, marcaAlvo));

  const resultados: Record<string, { total: number; diff: number; porVendedor: Record<string, number> }> = {};
  const alvo = marcaAlvo === "MWM" && mes === "2026-05" ? 527908.64
            : marcaAlvo === "EATON" && mes === "2026-06" ? 582223.44 : 0;

  for (const [nome, fn] of Object.entries(formulas)) {
    let total = 0;
    const porV: Record<string, number> = {};
    for (const it of base) {
      const v = fn(it);
      total += v;
      const vend = norm(it.vendedor);
      porV[vend] = (porV[vend] ?? 0) + v;
    }
    resultados[nome] = {
      total: Math.round(total * 100) / 100,
      diff: Math.round((total - alvo) * 100) / 100,
      porVendedor: Object.fromEntries(Object.entries(porV).sort((a,b)=>b[1]-a[1])),
    };
  }

  // Ranking de grupos e marcas dos itens elegíveis (para inspecionar classificação)
  const porMarcaItem: Record<string, number> = {};
  const porGrupoItem: Record<string, number> = {};
  for (const it of base) {
    const m = norm(it.marca ?? it.Marca ?? it.descricao_marca) || "(sem marca)";
    const g = norm(it.grupo ?? it.Grupo ?? it.grupo_produto) || "(sem grupo)";
    const v = formulas.A_bruto_venda_desc(it);
    porMarcaItem[m] = (porMarcaItem[m] ?? 0) + v;
    porGrupoItem[g] = (porGrupoItem[g] ?? 0) + v;
  }

  return new Response(JSON.stringify({
    mes, marcaAlvo, alvo,
    totalRegistrosBaixados: all.length,
    registrosElegiveis: base.length,
    sampleKeys,
    formulas: Object.fromEntries(Object.entries(resultados).map(([k,v]) => [k, { total: v.total, diff: v.diff }])),
    detalhePorVendedor_A: resultados.A_bruto_venda_desc?.porVendedor,
    detalhePorVendedor_E: resultados.E_venda_menos_devitem?.porVendedor,
    porMarcaItem, porGrupoItem,
  }, null, 2), { headers: { "content-type": "application/json" } });
});
