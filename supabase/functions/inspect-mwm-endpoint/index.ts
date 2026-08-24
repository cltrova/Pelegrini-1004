Deno.serve(async () => {
  const parseNum = (v: any) => typeof v === "number" ? v : Number(String(v ?? "").replace(",", ".")) || 0;
  const norm = (s: any) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  const arr = await (await fetch("http://187.77.203.16/pelegrini/comercial/produtos?data_ini=2026-05-01&data_fim=2026-05-31&page_size=5000&page=1&cod_empresa_bi=1004")).json();

  const alvo = ["DANIEL"];
  const devsFull: any[] = [];
  for (const it of arr) {
    const dt = String(it.data_movimento ?? "").slice(0, 7);
    if (dt !== "2026-05") continue;
    const vend = String(it.NomeExterno ?? it.nome_externo ?? it.vendedor ?? "").trim().toUpperCase();
    if (!alvo.includes(vend)) continue;
    if (it.tipo_movimento !== "Devolução") continue;
    devsFull.push({ vend, ...it });
  }

  const cands: Record<string, any> = {};
  const detalhe: Record<string, any[]> = {};
  for (const v of alvo) {
    const rows = devsFull.filter(r => r.vend === v);
    const sum = (fn: (r: any) => number) => Math.round(rows.reduce((a, r) => a + fn(r), 0) * 100) / 100;
    cands[v] = {
      qtd_linhas: rows.length,
      ValorDevolucao: sum(r => parseNum(r.ValorDevolucao)),
      valor_total_nf: sum(r => parseNum(r.valor_total_nf)),
      valor_custo_x_qtd: sum(r => parseNum(r.valor_custo) * parseNum(r.quantidade)),
      quantidade: sum(r => parseNum(r.quantidade)),
    };
    detalhe[v] = rows.map(r => ({
      nf: r.num_nf, produto: r.produto, marca: r.marca, grupo: r.grupo_produto, qtd: r.quantidade,
      ValorDevolucao: r.ValorDevolucao, valor_total_nf: r.valor_total_nf,
    }));
  }

  // Dump completo de todas as chaves e valores de cada linha de devolução do DANIEL
  const dumpCompleto = devsFull.map(r => {
    const obj: any = {};
    for (const k of Object.keys(r)) obj[k] = r[k];
    return obj;
  });

  return new Response(
    JSON.stringify({
      candidatos_por_vendedor: cands,
      detalhe,
      dump_completo_daniel: dumpCompleto,
      totais_esperados_excel: {
        DANIEL_precisa_subtrair: 3680.25,
        ERLAN_precisa_subtrair: 1368.98,
      },
    }, null, 2),
    { headers: { "content-type": "application/json" } }
  );
});
