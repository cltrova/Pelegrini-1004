import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.searchParams.get("path") ?? "1004/comercial-1778069178192.json";
  const mes = url.searchParams.get("mes") ?? "2026-05";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: signed } = await sb.storage.from("dados-json").createSignedUrl(path, 60);
  const r = await fetch(signed!.signedUrl);
  const arr = JSON.parse(await r.text());

  const norm = (s: any) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  const abs = (v: any) => Math.abs(Number(v || 0));

  let totalMarcaMWM = 0;
  let totalGrupoMWMExtra = 0; // itens sem marca=MWM mas grupo começa MWM
  const porGrupoExtra: Record<string, { valor: number; n: number; marcasItem: Record<string, number> }> = {};
  const porVendedorMarcaMWM: Record<string, number> = {};
  const porVendedorMWMTotal: Record<string, number> = {};

  for (const it of arr) {
    const tipo = String(it.tipo ?? it.Tipo ?? "").toUpperCase();
    if (tipo && tipo !== "PEDIDO") continue;
    const df = String(it.data_faturamento ?? "").slice(0, 7);
    if (df !== mes) continue;
    const valor = abs(it.valor_total ?? it.Valor_Total ?? it.valor_real ?? it.Valor_Real);
    const marca = norm(it.marca ?? it.Marca);
    const grupo = norm(it.grupo ?? it.grupo_produto ?? it.Grupo);
    const vendedor = norm(it.vendedor ?? it.Vendedor ?? it.nome_vendedor);
    const isMarcaMWM = marca === "MWM";
    const isGrupoMWM = grupo.startsWith("MWM");

    if (isMarcaMWM) {
      totalMarcaMWM += valor;
      porVendedorMarcaMWM[vendedor] = (porVendedorMarcaMWM[vendedor] ?? 0) + valor;
    }
    if (isMarcaMWM || isGrupoMWM) {
      porVendedorMWMTotal[vendedor] = (porVendedorMWMTotal[vendedor] ?? 0) + valor;
    }
    if (!isMarcaMWM && isGrupoMWM) {
      totalGrupoMWMExtra += valor;
      const g = grupo;
      porGrupoExtra[g] = porGrupoExtra[g] ?? { valor: 0, n: 0, marcasItem: {} };
      porGrupoExtra[g].valor += valor;
      porGrupoExtra[g].n += 1;
      porGrupoExtra[g].marcasItem[marca] = (porGrupoExtra[g].marcasItem[marca] ?? 0) + valor;
    }
  }

  return new Response(JSON.stringify({
    mes,
    totalMarcaMWM,
    totalGrupoMWMExtra,
    totalCombinado: totalMarcaMWM + totalGrupoMWMExtra,
    porGrupoExtra,
    porVendedorMarcaMWM,
    porVendedorMWMTotal,
  }, null, 2), { headers: { "content-type": "application/json" } });
});
