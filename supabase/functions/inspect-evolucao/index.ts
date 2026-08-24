import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.searchParams.get("path") ?? "1004/comercial-1778069178192.json";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: signed } = await sb.storage.from("dados-json").createSignedUrl(path, 60);
  const r = await fetch(signed!.signedUrl);
  const arr = JSON.parse(await r.text());
  const devs: any[] = [];
  const peds: any[] = [];
  let totalDevValorReal = 0, totalDevValorDevolucao = 0;
  const byDay: Record<string, { vR: number; vD: number; n: number }> = {};
  for (const it of arr) {
    const tipo = String(it.tipo ?? it.Tipo ?? "").toUpperCase();
    const dp = (it.data_pedido ?? "").toString().slice(0, 10);
    if (tipo === "DEVOLUCAO") {
      const vR = Math.abs(Number(it.Valor_Real ?? it.valor_real ?? 0));
      const vD = Math.abs(Number(it.Valor_Devolucao ?? it.valor_devolucao ?? 0));
      totalDevValorReal += vR; totalDevValorDevolucao += vD;
      if (dp.startsWith("2026-05") || dp.startsWith("2026-04-3")) {
        byDay[dp] = byDay[dp] ?? { vR: 0, vD: 0, n: 0 };
        byDay[dp].vR += vR; byDay[dp].vD += vD; byDay[dp].n++;
      }
      if (devs.length < 3) devs.push(it);
    } else {
      if (peds.length < 1) peds.push(it);
    }
  }
  return new Response(JSON.stringify({
    totalDevValorReal, totalDevValorDevolucao,
    byDay,
    sampleDev: devs,
    samplePed: peds[0],
  }, null, 2), { headers: { "content-type": "application/json" } });
});
