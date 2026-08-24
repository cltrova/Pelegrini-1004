import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const mes = url.searchParams.get("mes") ?? "2026-05";
  const path = url.searchParams.get("path") ?? "1004/comercial_produtos-1778071616784.json";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: signed } = await sb.storage.from("dados-json").createSignedUrl(path, 60);
  const r = await fetch(signed!.signedUrl);
  const arr = JSON.parse(await r.text());

  const norm = (s: any) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  const abs = (v: any) => Math.abs(Number(v || 0));
  const EQUIPE = ["BRUNO","DANIEL","ERLAN","FABIO","PAULO"];
  const pertence = (v: string) => !!v && !v.includes("CCH") && !v.includes("ESTOQUE") && EQUIPE.some(n => v.includes(n));

  let totMWM = 0, totEATON = 0, totCombo = 0;
  const porVend: Record<string, { mwm: number; eaton: number; total: number }> = {};

  for (const it of arr) {
    const dm = String(it.data_movimento ?? "").slice(0, 7);
    if (dm !== mes) continue;

    const vend = norm(it.vendedor);
    if (!pertence(vend)) continue;

    const vv = abs(it.ValorVenda);
    const vd = abs(it.ValorDescontoItem);
    const valor = vv + vd;

    const marca = norm(it.marca);
    const grupo = norm(it.grupo_produto);
    const produto = norm(it.produto);

    const isMWM = marca === "MWM";
    const isEATON = marca === "EATON" || ((grupo === "DESATIVADO" || grupo === "SUBSTITUIDO") && produto.includes("EATON"));
    if (!isMWM && !isEATON) continue;

    porVend[vend] = porVend[vend] ?? { mwm: 0, eaton: 0, total: 0 };
    if (isMWM) { totMWM += valor; porVend[vend].mwm += valor; }
    if (isEATON) { totEATON += valor; porVend[vend].eaton += valor; }
    totCombo += valor;
    porVend[vend].total += valor;
  }

  return new Response(JSON.stringify({
    mes, totalMWM: totMWM, totalEATON: totEATON, totalCombinado: totCombo,
    esperado: 527908.64, diferenca: totCombo - 527908.64,
    porVendedor: Object.fromEntries(Object.entries(porVend).sort((a,b)=>b[1].total-a[1].total)),
  }, null, 2), { headers: { ...corsHeaders, "content-type": "application/json" } });
});
