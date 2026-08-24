// Diagnóstico Receita 1004 — Junho/2026
// Compara relatório CT (R$ 1.578.896,65 / 925 vendas) x BI (R$ 1.608.599,65 / 1.021 vendas)

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
};

const VPS = "http://187.77.203.16/pelegrini";
const DATA_INI = "2026-06-01";
const DATA_FIM = "2026-07-01"; // exclusivo no ERP

function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function get<T = unknown>(o: any, ...keys: string[]): T | undefined {
  for (const k of keys) if (o?.[k] !== undefined && o?.[k] !== null && o?.[k] !== "") return o[k];
  return undefined;
}

async function fetchAll(codBi: string): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= 20; page++) {
    const url = `${VPS}/comercial/produtos?data_ini=${DATA_INI}&data_fim=${DATA_FIM}&page=${page}&page_size=5000&cod_empresa_bi=${codBi}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`page ${page}: HTTP ${res.status}`);
    const json = await res.json();
    const arr = Array.isArray(json) ? json : (json.produtos || json.Produtos || json.itens || json.Itens || []);
    all.push(...arr);
    if (arr.length < 5000) break;
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const [ct, ch] = await Promise.all([fetchAll("1004"), fetchAll("10041")]);

    type Agg = {
      vendas: number; devolucoes: number;
      valorVendaPed: number; valorDevolucaoDev: number;
      valorLiqFinalPed: number; valorLiqFinalDev: number;
      valorDescontoPed: number;
      pedidos: Set<string>; vendasDist: Set<string>;
    };
    const empty = (): Agg => ({
      vendas: 0, devolucoes: 0,
      valorVendaPed: 0, valorDevolucaoDev: 0,
      valorLiqFinalPed: 0, valorLiqFinalDev: 0,
      valorDescontoPed: 0,
      pedidos: new Set(), vendasDist: new Set(),
    });

    const byVendedor = new Map<string, Agg>();
    const byFilial = new Map<string, Agg>();
    const total = empty();

    const processar = (arr: any[], origem: "CT" | "CH") => {
      for (const it of arr) {
        const tipo = String(get<string>(it, "tipo", "Tipo") ?? "").toUpperCase().startsWith("DEV") ? "DEV" : "PED";
        const filialRaw = String(get(it, "Filial", "filial", "empresa", "Empresa") ?? "").toUpperCase().trim();
        const filialKey = `${origem}|${filialRaw || "(vazio)"}`;
        const vend = String(get(it, "cod_vendedor", "CodVendedor") ?? "??") + " " + String(get(it, "vendedor", "vendedor_nome", "Vendedor", "nome_interno") ?? "");
        const codDoc = String(get(it, "cod_documento", "CodDocumento", "cod_pedido", "CodPedido") ?? "");
        const numLanc = String(get(it, "num_lancamento", "NumLancamento") ?? "");
        const chave = `${codDoc}|${numLanc}`;

        const vV = num(get(it, "ValorVenda", "valor_venda", "Valor_Venda"));
        const vD = num(get(it, "ValorDevolucao", "valor_devolucao", "Valor_Devolucao"));
        const vDesc = num(get(it, "ValorDescontoItem", "valor_desconto_item"));
        const vLF = num(get(it, "ValorLiquidoFinal", "valor_liquido_final", "Valor_Liquido_Final"));

        for (const bucket of [total, byVendedor.get(vend) ?? (() => { const b = empty(); byVendedor.set(vend, b); return b; })(),
          byFilial.get(filialKey) ?? (() => { const b = empty(); byFilial.set(filialKey, b); return b; })()]) {
          if (tipo === "PED") {
            bucket.vendas += 1;
            bucket.valorVendaPed += vV;
            bucket.valorLiqFinalPed += Math.abs(vLF);
            bucket.valorDescontoPed += vDesc;
          } else {
            bucket.devolucoes += 1;
            bucket.valorDevolucaoDev += Math.abs(vD);
            bucket.valorLiqFinalDev += Math.abs(vLF);
          }
          if (codDoc) bucket.pedidos.add(codDoc);
          bucket.vendasDist.add(chave);
        }
      }
    };

    processar(ct, "CT");
    processar(ch, "CH");

    const fmt = (a: Agg) => ({
      linhas_pedido: a.vendas,
      linhas_devolucao: a.devolucoes,
      soma_ValorVenda_PED: +a.valorVendaPed.toFixed(2),
      soma_ValorDevolucao_DEV: +a.valorDevolucaoDev.toFixed(2),
      soma_ValorLiqFinal_PED: +a.valorLiqFinalPed.toFixed(2),
      soma_ValorLiqFinal_DEV: +a.valorLiqFinalDev.toFixed(2),
      soma_Desconto_PED: +a.valorDescontoPed.toFixed(2),
      receita_ValorVenda_menos_ValorDevolucao: +(a.valorVendaPed - a.valorDevolucaoDev).toFixed(2),
      receita_ValorLiqFinal_liquida: +(a.valorLiqFinalPed - a.valorLiqFinalDev).toFixed(2),
      pedidos_distintos: a.pedidos.size,
      lancamentos_distintos: a.vendasDist.size,
    });

    const vendedores: Record<string, ReturnType<typeof fmt>> = {};
    for (const [k, v] of [...byVendedor.entries()].sort((a, b) => b[1].valorVendaPed - a[1].valorVendaPed)) {
      vendedores[k] = fmt(v);
    }
    const filiais: Record<string, ReturnType<typeof fmt>> = {};
    for (const [k, v] of byFilial) filiais[k] = fmt(v);

    return new Response(JSON.stringify({
      periodo: `${DATA_INI} .. ${DATA_FIM} (exclusivo)`,
      relatorio_referencia: { receita: 1578896.65, vendas: 925, venda_direta: 1632116.61, devolucao: 53219.96 },
      total_geral: fmt(total),
      por_filial: filiais,
      por_vendedor: vendedores,
    }, null, 2), { headers: { ...corsHeaders, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
});
