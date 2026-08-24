// Reconciliação Comercial 1004 — Junho/2026
// Aplica grupo "Somente comissionáveis" (exclui Terceiro, Elisabete, Dayvid, Nata, Thiago Tomas e nulos)

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
};

const VPS = "http://187.77.203.16/pelegrini";
const DATA_INI = "2026-06-01";
const DATA_FIM = "2026-07-01"; // exclusivo

function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function get<T = unknown>(o: any, ...keys: string[]): T | undefined {
  for (const k of keys) if (o?.[k] !== undefined && o?.[k] !== null && o?.[k] !== "") return o[k];
  return undefined;
}

function norm(s: unknown): string {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

// Grupo "Somente comissionáveis": excluir estes nomes/códigos e vendedores nulos
const EXCLUIR_NOMES = ["TERCEIRO", "ELISABETE", "DAYVID", "NATA", "THIAGO TOMAS", "THIAGO"];

function isComissionavel(it: any): boolean {
  const nome = norm(get(it, "vendedor", "vendedor_nome", "Vendedor", "nome_interno", "nome_externo"));
  const cod = String(get(it, "cod_vendedor", "CodVendedor") ?? "").trim();
  if (!nome && !cod) return false; // exclui nulos
  if (!nome) return false;
  for (const ex of EXCLUIR_NOMES) if (nome.includes(ex)) return false;
  return true;
}

async function fetchAll(codBi: string): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= 20; page++) {
    const url = `${VPS}/comercial/produtos?data_ini=${DATA_INI}&data_fim=${DATA_FIM}&page=${page}&page_size=5000&cod_empresa_bi=${codBi}`;
    const r = await fetch(url);
    if (!r.ok) break;
    const j = await r.json();
    const arr = Array.isArray(j) ? j : (j.produtos || j.Produtos || j.itens || []);
    all.push(...arr);
    if (arr.length < 5000) break;
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const ct = await fetchAll("1004");

    // Filtros: apenas CT (não CHEVROLET), apenas comissionáveis
    const base = ct.filter((it) => {
      const filial = norm(get(it, "filial", "Filial", "filial_nome"));
      if (filial.includes("CHEVROLET")) return false;
      if (!isComissionavel(it)) return false;
      return true;
    });

    let somaVenda = 0, somaDevol = 0, somaLF = 0;
    let linhasPedido = 0, linhasDevol = 0;
    const pedidosDistintos = new Set<string>();
    const pedidosZero: any[] = [];
    const dupKey = new Map<string, number>();
    const porVendedor = new Map<string, { receita: number; venda: number; devol: number; pedidos: Set<string>; linhas: number }>();
    const porPedido = new Map<string, { receita: number; venda: number; devol: number; linhas: number; vendedor: string; nf: string }>();

    for (const it of base) {
      const tipo = norm(get(it, "tipo", "Tipo"));
      const isDev = tipo.startsWith("DEV");
      const codPed = String(get(it, "cod_pedido", "CodPedido") ?? "").trim();
      const codDoc = String(get(it, "cod_documento", "CodDocumento") ?? "").trim();
      const numLanc = String(get(it, "num_lancamento", "NumLancamento") ?? "").trim();
      const nf = String(get(it, "num_nf", "NumNF", "numero_nf") ?? "").trim();
      const vend = norm(get(it, "vendedor", "vendedor_nome")) || `#${get(it, "cod_vendedor") ?? "?"}`;

      const vV = num(get(it, "ValorVenda", "valor_venda"));
      const vD = Math.abs(num(get(it, "ValorDevolucao", "valor_devolucao")));
      const vLF = num(get(it, "ValorLiquidoFinal", "valor_liquido_final"));

      somaVenda += vV;
      somaDevol += vD;
      somaLF += vLF;

      if (isDev) linhasDevol++; else linhasPedido++;

      const isPedValido = !isDev && codPed && codPed !== "0";
      if (isPedValido) pedidosDistintos.add(codPed);

      if (!isDev && (!codPed || codPed === "0")) {
        pedidosZero.push({ cod_pedido: codPed, vendedor: vend, ValorVenda: vV, num_nf: nf });
      }

      const dk = `${codDoc}|${numLanc}`;
      if (codDoc || numLanc) dupKey.set(dk, (dupKey.get(dk) ?? 0) + 1);

      const pv = porVendedor.get(vend) ?? { receita: 0, venda: 0, devol: 0, pedidos: new Set<string>(), linhas: 0 };
      pv.venda += vV; pv.devol += isDev ? vD : 0; pv.receita = pv.venda - pv.devol; pv.linhas++;
      if (isPedValido) pv.pedidos.add(codPed);
      porVendedor.set(vend, pv);

      if (codPed) {
        const pp = porPedido.get(codPed) ?? { receita: 0, venda: 0, devol: 0, linhas: 0, vendedor: vend, nf };
        pp.venda += vV; pp.devol += isDev ? vD : 0; pp.receita = pp.venda - pp.devol; pp.linhas++;
        porPedido.set(codPed, pp);
      }
    }

    const receita = somaVenda - somaDevol;
    const ticket = pedidosDistintos.size > 0 ? receita / pedidosDistintos.size : 0;

    const duplicados = [...dupKey.entries()].filter(([, n]) => n > 1).map(([k, n]) => ({ chave: k, ocorrencias: n }));

    const vendedores = [...porVendedor.entries()].map(([nome, v]) => ({
      vendedor: nome,
      receita: +v.receita.toFixed(2),
      venda: +v.venda.toFixed(2),
      devolucao: +v.devol.toFixed(2),
      pedidos_distintos: v.pedidos.size,
      linhas: v.linhas,
    })).sort((a, b) => b.receita - a.receita);

    return new Response(JSON.stringify({
      periodo: `${DATA_INI} .. ${DATA_FIM} (exclusivo)`,
      grupo: "Somente comissionáveis",
      referencia_relatorio: { receita: 1578896.65, vendas: 925, ticket_medio: 1706.91 },
      totais_sistema: {
        soma_ValorVenda: +somaVenda.toFixed(2),
        soma_ValorDevolucao: +somaDevol.toFixed(2),
        soma_ValorLiquidoFinal: +somaLF.toFixed(2),
        receita_calculada: +receita.toFixed(2),
        linhas_total: base.length,
        linhas_PEDIDO: linhasPedido,
        linhas_DEVOLUCAO: linhasDevol,
        pedidos_distintos: pedidosDistintos.size,
        ticket_medio: +ticket.toFixed(2),
      },
      diferenca: {
        receita: +(receita - 1578896.65).toFixed(2),
        vendas: pedidosDistintos.size - 925,
        ticket_medio: +(ticket - 1706.91).toFixed(2),
      },
      pedidos_zero_ou_nulos: {
        quantidade: pedidosZero.length,
        soma_ValorVenda: +pedidosZero.reduce((s, x) => s + x.ValorVenda, 0).toFixed(2),
        amostra: pedidosZero.slice(0, 20),
      },
      duplicados_cod_documento_num_lancamento: duplicados.slice(0, 30),
      por_vendedor: vendedores,
      top_pedidos_por_receita: [...porPedido.entries()]
        .sort((a, b) => b[1].receita - a[1].receita)
        .slice(0, 15)
        .map(([cp, v]) => ({ cod_pedido: cp, ...v, receita: +v.receita.toFixed(2), venda: +v.venda.toFixed(2), devol: +v.devol.toFixed(2) })),
    }, null, 2), { headers: { ...corsHeaders, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
});
