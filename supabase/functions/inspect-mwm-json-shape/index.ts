import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const path = url.searchParams.get("path") ?? "1004/comercial_produtos-1778071616784.json";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: signed } = await sb.storage.from("dados-json").createSignedUrl(path, 60);
  const r = await fetch(signed!.signedUrl);
  const txt = await r.text();
  const json = JSON.parse(txt);
  const arr = Array.isArray(json) ? json : (json.produtos || json.Produtos || json.itens || json.Itens || []);
  const sample = arr.slice(0, 2);
  const tipos = new Set<string>(); const dfs = new Set<string>(); const marcas = new Set<string>();
  for (let i=0;i<Math.min(arr.length, 5000);i++){
    const it=arr[i];
    tipos.add(String(it.tipo ?? it.Tipo ?? ""));
    dfs.add(String(it.data_faturamento ?? it.DataFaturamento ?? "").slice(0,7));
    marcas.add(String(it.marca ?? it.Marca ?? ""));
  }
  return new Response(JSON.stringify({
    count: arr.length,
    sampleKeys: sample[0] ? Object.keys(sample[0]) : [],
    sample,
    tipos: [...tipos].slice(0,10),
    dfs: [...dfs].slice(0,20),
    marcasSample: [...marcas].slice(0,30),
  }, null, 2), { headers: { ...corsHeaders, "content-type": "application/json" } });
});
