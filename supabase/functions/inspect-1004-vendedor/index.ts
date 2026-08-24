import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async () => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: signed } = await sb.storage.from("dados-json").createSignedUrl("1004/comercial-1778069178192.json", 60);
  const r = await fetch(signed!.signedUrl);
  const txt = await r.text();
  const arr = JSON.parse(txt);
  const filiais = new Map<string, number>();
  const vendByFilial = new Map<string, Set<string>>();
  for (const it of arr) {
    const f = String(it.Filial ?? "");
    filiais.set(f, (filiais.get(f) ?? 0) + 1);
    const vn = String(it.vendedor ?? "");
    if (!vendByFilial.has(f)) vendByFilial.set(f, new Set());
    vendByFilial.get(f)!.add(`${it.cod_vendedor}|${vn}`);
  }
  const out: any = { totalRegistros: arr.length, filiais: Object.fromEntries(filiais) };
  for (const [f, s] of vendByFilial) out[`vendedores_${f}`] = Array.from(s).sort();
  return new Response(JSON.stringify(out, null, 2), { headers: { "content-type": "application/json" } });
});
