// Simulação regra ampliada MWM em JUNHO/2026 empresa 1004 — sem alterar produção
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const inicio = "2026-06-01";
  const fim = "2026-06-30";

  const semanas: Array<[string, string]> = [];
  const d = new Date(inicio + "T00:00:00");
  const end = new Date(fim + "T00:00:00");
  while (d.getTime() <= end.getTime()) {
    const di = d.toISOString().slice(0, 10);
    const next = new Date(d);
    next.setDate(next.getDate() + 6);
    if (next.getTime() > end.getTime()) next.setTime(end.getTime());
    const nx = new Date(next);
    nx.setDate(nx.getDate() + 1);
    semanas.push([di, nx.toISOString().slice(0, 10)]);
    d.setDate(d.getDate() + 7);
  }

  const all: any[] = [];
  for (const [di, df] of semanas) {
    for (let page = 1; page <= 20; page++) {
      const u = `http://187.77.203.16/pelegrini/comercial/produtos?cod_empresa_bi=1004&data_ini=${di}&data_fim=${df}&page_size=5000&page=${page}`;
      try {
        const r = await fetch(u);
        const j = await r.json();
        const arr = Array.isArray(j) ? j : (j.produtos || j.Produtos || j.itens || j.Itens || []);
        all.push(...arr);
        if (arr.length < 5000) break;
      } catch { break; }
    }
  }

  const norm = (s: any) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  const abs = (v: any) => Math.abs(Number(v || 0));
  const EQUIPE = ["BRUNO", "DANIEL", "ERLAN", "FABIO", "PAULO"];
  const pertenceEquipe = (v: string) => !!v && !v.includes("CCH") && !v.includes("ESTOQUE") && EQUIPE.some(n => v.includes(n));
  const noMes = (it: any) => String(it.data_movimento ?? "").slice(0, 7) === "2026-06";

  const isEATON = (marca: string, grupo: string, produto: string) =>
    marca === "EATON" || ((grupo === "DESATIVADO" || grupo === "SUBSTITUIDO") && produto.includes("EATON"));

  const isMWM_strict = (marca: string) => marca === "MWM";
  const isMWM_ampla = (marca: string, grupo: string) => marca === "MWM" || grupo.startsWith("MWM");

  const acc = () => ({ mwm: 0, eaton: 0, total: 0 });
  const strict = { total: acc(), porVend: {} as Record<string, ReturnType<typeof acc>> };
  const ampla  = { total: acc(), porVend: {} as Record<string, ReturnType<typeof acc>> };

  const diffRegistros: any[] = []; // itens que entram só com regra ampliada
  const gruposMWMdetectados: Record<string, number> = {};
  const marcasDosDiff: Record<string, number> = {};

  for (const it of all) {
    if (!noMes(it)) continue;
    const vend = norm(it.vendedor);
    if (!pertenceEquipe(vend)) continue;
    const marca = norm(it.marca);
    const grupo = norm(it.grupo_produto);
    const produto = norm(it.produto);
    const impacto = abs(it.ValorVenda) + abs(it.ValorDescontoItem);
    if (impacto === 0) continue;

    const eaton = isEATON(marca, grupo, produto);
    const mwmS = isMWM_strict(marca);
    const mwmA = isMWM_ampla(marca, grupo);

    // strict
    strict.porVend[vend] = strict.porVend[vend] ?? acc();
    if (mwmS) { strict.total.mwm += impacto; strict.porVend[vend].mwm += impacto; }
    if (eaton) { strict.total.eaton += impacto; strict.porVend[vend].eaton += impacto; }
    if (mwmS || eaton) { strict.total.total += impacto; strict.porVend[vend].total += impacto; }

    // ampla
    ampla.porVend[vend] = ampla.porVend[vend] ?? acc();
    if (mwmA) { ampla.total.mwm += impacto; ampla.porVend[vend].mwm += impacto; }
    if (eaton) { ampla.total.eaton += impacto; ampla.porVend[vend].eaton += impacto; }
    if (mwmA || eaton) { ampla.total.total += impacto; ampla.porVend[vend].total += impacto; }

    // diff: entra em ampla mas não em strict (só MWM, EATON não muda)
    if (mwmA && !mwmS) {
      diffRegistros.push({
        vendedor: it.vendedor, num_nf: it.num_nf, data_movimento: it.data_movimento,
        marca: it.marca, grupo_produto: it.grupo_produto, produto: it.produto,
        ValorVenda: it.ValorVenda, ValorDescontoItem: it.ValorDescontoItem, impacto,
      });
      gruposMWMdetectados[grupo] = (gruposMWMdetectados[grupo] ?? 0) + impacto;
      marcasDosDiff[marca || "(vazio)"] = (marcasDosDiff[marca || "(vazio)"] ?? 0) + impacto;
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  const fmtVend = (o: Record<string, ReturnType<typeof acc>>) =>
    Object.fromEntries(Object.entries(o).sort((a,b)=>b[1].total-a[1].total).map(([k,v]) => [k, {
      mwm: round(v.mwm), eaton: round(v.eaton), total: round(v.total),
    }]));

  const diffTotal = round(ampla.total.mwm - strict.total.mwm);
  const junhoValidadoMWM = 579953.59;
  const junhoValidadoEATON = 582223.44;

  return new Response(JSON.stringify({
    parametros: {
      mes: "2026-06", empresa: 1004, registrosBaixados: all.length,
      regraStrict: "marca === 'MWM'",
      regraAmpla: "marca === 'MWM' OR grupo.startsWith('MWM')",
      equipe: EQUIPE,
      formula: "|ValorVenda| + |ValorDescontoItem|",
    },

    BLOCO1_JUNHO_REGRA_ATUAL: {
      totalMWM: round(strict.total.mwm),
      totalEATON: round(strict.total.eaton),
      totalGeral: round(strict.total.total),
      validadoMWM: junhoValidadoMWM,
      difVsValidadoMWM: round(strict.total.mwm - junhoValidadoMWM),
      ranking: fmtVend(strict.porVend),
    },

    BLOCO2_JUNHO_REGRA_AMPLIADA: {
      totalMWM: round(ampla.total.mwm),
      totalEATON: round(ampla.total.eaton),
      totalGeral: round(ampla.total.total),
      difVsValidadoMWM: round(ampla.total.mwm - junhoValidadoMWM),
      ranking: fmtVend(ampla.porVend),
    },

    BLOCO3_IMPACTO: {
      diferencaMWM_absoluta: diffTotal,
      diferencaEATON: round(ampla.total.eaton - strict.total.eaton),
      qtdRegistrosNovos: diffRegistros.length,
      gruposMWMdetectados_valores: Object.fromEntries(
        Object.entries(gruposMWMdetectados).sort((a,b)=>b[1]-a[1]).map(([k,v]) => [k, round(v)])
      ),
      marcasDosRegistrosNovos: Object.fromEntries(
        Object.entries(marcasDosDiff).sort((a,b)=>b[1]-a[1]).map(([k,v]) => [k, round(v)])
      ),
      vendedoresImpactados: Object.fromEntries(
        Object.entries(ampla.porVend)
          .map(([v, a]) => [v, round(a.mwm - (strict.porVend[v]?.mwm ?? 0))])
          .filter(([, d]) => (d as number) !== 0)
      ),
      contaminaEATON: round(ampla.total.eaton - strict.total.eaton) !== 0,
      topRegistrosNovos: diffRegistros.sort((a,b)=>b.impacto-a.impacto).slice(0, 30),
    },

    BLOCO4_CONCLUSAO: {
      seguro: diffTotal === 0
        ? "SIM — regra ampliada não altera junho, seguro aplicar"
        : Math.abs(diffTotal) < 1000
          ? `PARCIAL — altera junho em R$ ${diffTotal}, revisar tolerância`
          : `NÃO — altera junho em R$ ${diffTotal}, quebra valor validado (${junhoValidadoMWM})`,
      resolveMaio: "Confirmar após: se maio+ampla ≈ 527.908,64, resolve",
    },
  }, null, 2), { headers: { ...corsHeaders, "content-type": "application/json" } });
});
