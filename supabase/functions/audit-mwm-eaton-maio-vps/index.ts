const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const filial = url.searchParams.get("filial") ?? "ct";
  const inicio = url.searchParams.get("inicio") ?? "2026-05-01";
  const fim = url.searchParams.get("fim") ?? "2026-05-31";
  const path = filial === "ch" ? "/comercial/produtos_ch" : "/comercial/produtos";

  // Janelas semanais com data_fim exclusivo (+1 dia, como o hook faz para 1004)
  const semanas: Array<[string,string]> = [];
  const d = new Date(inicio + "T00:00:00");
  const end = new Date(fim + "T00:00:00");
  while (d.getTime() <= end.getTime()) {
    const di = d.toISOString().slice(0,10);
    const next = new Date(d);
    next.setDate(next.getDate()+6);
    if (next.getTime() > end.getTime()) next.setTime(end.getTime());
    const nx = new Date(next); nx.setDate(nx.getDate()+1);
    semanas.push([di, nx.toISOString().slice(0,10)]);
    d.setDate(d.getDate()+7);
  }

  const all: any[] = [];
  const logs: string[] = [];
  for (const [di, df] of semanas) {
    for (let page=1; page<=20; page++) {
      const u = `http://187.77.203.16/pelegrini${path}?cod_empresa_bi=1004&data_ini=${di}&data_fim=${df}&page_size=5000&page=${page}`;
      const r = await fetch(u);
      const j = await r.json();
      const arr = Array.isArray(j) ? j : (j.produtos||j.Produtos||j.itens||j.Itens||[]);
      logs.push(`${di}..${df} p${page}: ${arr.length}`);
      all.push(...arr);
      if (arr.length < 5000) break;
    }
  }

  const norm = (s: any) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  const abs = (v: any) => Math.abs(Number(v || 0));
  const EQUIPE = ["BRUNO","DANIEL","ERLAN","FABIO","PAULO"];
  const pertence = (v: string) => !!v && !v.includes("CCH") && !v.includes("ESTOQUE") && EQUIPE.some(n => v.includes(n));

  let totMWM=0, totEATON=0, totCombo=0;
  const porVend: Record<string,{mwm:number;eaton:number;total:number}> = {};

  for (const it of all) {
    const dm = String(it.data_movimento ?? "").slice(0,7);
    if (dm !== inicio.slice(0,7)) continue;
    const vend = norm(it.vendedor);
    if (!pertence(vend)) continue;

    const vv = abs(it.ValorVenda);
    const vd = abs(it.ValorDescontoItem);
    const valor = vv + vd;

    const marca = norm(it.marca);
    const grupo = norm(it.grupo_produto);
    const produto = norm(it.produto);
    const isMWM = marca === "MWM";
    const isEATON = marca === "EATON" || ((grupo==="DESATIVADO"||grupo==="SUBSTITUIDO") && produto.includes("EATON"));
    if (!isMWM && !isEATON) continue;

    porVend[vend] = porVend[vend] ?? { mwm:0, eaton:0, total:0 };
    if (isMWM) { totMWM+=valor; porVend[vend].mwm+=valor; }
    if (isEATON) { totEATON+=valor; porVend[vend].eaton+=valor; }
    totCombo+=valor; porVend[vend].total+=valor;
  }

  return new Response(JSON.stringify({
    filial, inicio, fim, semanas, logs, count: all.length,
    totalMWM: totMWM, totalEATON: totEATON, totalCombinado: totCombo,
    esperado: 527908.64, diferenca: totCombo - 527908.64,
    porVendedor: Object.fromEntries(Object.entries(porVend).sort((a,b)=>b[1].total-a[1].total)),
  }, null, 2), { headers: { ...corsHeaders, "content-type": "application/json" } });
});
