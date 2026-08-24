// Auditoria bruta dos dados da API do ERP - Empresa 1004 (Pelegrini) / Filial CT
// Retorna dump bruto de maio/2026 e junho/2026 sem aplicar regra de campanha
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");

  const VPS_BASE = "http://187.77.203.16";
  const CLIENTE = "pelegrini";
  const PATH = "/comercial/produtos";
  const COD_BI = "1004"; // Casa da Transmissão (CT)

  const meses = [
    { nome: "MAIO_2026", ini: "2026-05-01", fim: "2026-05-31" },
    { nome: "JUNHO_2026", ini: "2026-06-01", fim: "2026-06-30" },
  ];

  const norm = (s: any) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  const num = (v: any) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    if (typeof v !== "string") return 0;
    const s = v.replace(/[^\d,.-]/g, "");
    if (!s) return 0;
    const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
    return Number.isFinite(n) ? n : 0;
  };
  const r2 = (n: number) => Math.round(n * 100) / 100;

  async function baixarMes(ini: string, fim: string) {
    // janelas semanais como o frontend
    const semanas: [string, string][] = [];
    const d = new Date(`${ini}T00:00:00`);
    const end = new Date(`${fim}T00:00:00`);
    while (d.getTime() <= end.getTime()) {
      const di = d.toISOString().split("T")[0];
      const next = new Date(d);
      next.setDate(next.getDate() + 6);
      if (next.getTime() > end.getTime()) next.setTime(end.getTime());
      semanas.push([di, next.toISOString().split("T")[0]]);
      d.setDate(d.getDate() + 7);
    }

    const all: any[] = [];
    for (const [di, df] of semanas) {
      for (let page = 1; page <= 30; page++) {
        const u = `${VPS_BASE}/${CLIENTE}${PATH}?data_ini=${di}&data_fim=${df}&page_size=5000&page=${page}&cod_empresa_bi=${COD_BI}`;
        try {
          const r = await fetch(u);
          if (!r.ok) break;
          const j = await r.json();
          const arr = Array.isArray(j) ? j : (j.produtos || j.Produtos || j.itens || []);
          all.push(...arr);
          if (arr.length < 5000) break;
        } catch { break; }
      }
    }
    return all;
  }

  function auditar(all: any[], mesRef: string) {
    // filtra apenas registros do mês (defensivo)
    const base = all.filter(it => String(it.data_movimento ?? "").slice(0, 7) === mesRef);

    const contagem = (fn: (it: any) => string) => {
      const m: Record<string, number> = {};
      for (const it of base) {
        const k = fn(it) || "(vazio)";
        m[k] = (m[k] ?? 0) + 1;
      }
      return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
    };

    const somaPor = (fn: (it: any) => string, val: (it: any) => number) => {
      const m: Record<string, number> = {};
      for (const it of base) {
        const k = fn(it) || "(vazio)";
        m[k] = (m[k] ?? 0) + val(it);
      }
      return Object.fromEntries(
        Object.entries(m).map(([k, v]) => [k, r2(v)]).sort((a, b) => Math.abs(b[1] as number) - Math.abs(a[1] as number))
      );
    };

    const tipo = (it: any) => norm(it.tipo_movimento ?? it.tipo);
    const marca = (it: any) => norm(it.marca ?? it.Marca ?? it.descricao_marca);
    const grupo = (it: any) => norm(it.grupo ?? it.Grupo ?? it.grupo_produto);
    const produto = (it: any) => norm(it.produto ?? it.Produto ?? it.descricao);
    const vendedor = (it: any) => norm(it.vendedor);
    const filial = (it: any) => String(it.filial ?? it.Filial ?? it.cod_filial ?? "(vazio)");

    // amostra dos primeiros 5 registros com campos pedidos
    const amostra = base.slice(0, 5).map(it => ({
      data_movimento: it.data_movimento,
      tipo_movimento: it.tipo_movimento ?? it.tipo,
      cod_pedido: it.cod_pedido,
      num_nf: it.num_nf ?? it.numero_nf ?? it.NumNF,
      filial: it.filial ?? it.Filial ?? it.cod_filial,
      cod_cliente: it.cod_cliente,
      cliente: it.cliente,
      cod_vendedor: it.cod_vendedor,
      vendedor: it.vendedor,
      cod_marca: it.cod_marca,
      marca: it.marca ?? it.Marca,
      cod_produto: it.cod_produto,
      produto: it.produto ?? it.Produto ?? it.descricao,
      grupo_produto: it.grupo ?? it.Grupo ?? it.grupo_produto,
      num_cfop: it.num_cfop ?? it.cfop,
      quantidade: it.quantidade ?? it.Quantidade,
      valor_custo: it.valor_custo ?? it.ValorCusto,
      ValorVenda: it.ValorVenda ?? it.valor_venda,
      ValorDescontoItem: it.ValorDescontoItem ?? it.valor_desconto_item,
      ValorDevolucao: it.ValorDevolucao ?? it.valor_devolucao,
      valor_total_nf: it.valor_total_nf ?? it.ValorTotalNF,
    }));

    // Fatias por marca alvo
    const isMWM = (it: any) => marca(it) === "MWM";
    const isEATON = (it: any) => marca(it) === "EATON";
    const grupoMWM = (it: any) => grupo(it).includes("MWM");
    const grupoEATON = (it: any) => grupo(it).includes("EATON");
    const produtoMWM = (it: any) => produto(it).includes("MWM");
    const produtoEATON = (it: any) => produto(it).includes("EATON");

    const fatia = (nome: string, filtro: (it: any) => boolean) => {
      const arr = base.filter(filtro);
      return {
        registros: arr.length,
        soma_ValorVenda: r2(arr.reduce((s, it) => s + num(it.ValorVenda ?? it.valor_venda), 0)),
        soma_ValorDescontoItem: r2(arr.reduce((s, it) => s + num(it.ValorDescontoItem ?? it.valor_desconto_item), 0)),
        soma_ValorDevolucao: r2(arr.reduce((s, it) => s + num(it.ValorDevolucao ?? it.valor_devolucao), 0)),
        por_marca: Object.fromEntries(Object.entries(
          arr.reduce((m: Record<string, number>, it) => { m[marca(it)] = (m[marca(it)] ?? 0) + 1; return m; }, {})
        ).sort((a, b) => b[1] - a[1])),
        por_grupo: Object.fromEntries(Object.entries(
          arr.reduce((m: Record<string, number>, it) => { m[grupo(it)] = (m[grupo(it)] ?? 0) + 1; return m; }, {})
        ).sort((a, b) => b[1] - a[1])),
      };
    };

    return {
      total_registros: base.length,
      total_registros_baixados_sem_filtro_data: all.length,
      campos_disponiveis: base[0] ? Object.keys(base[0]).sort() : [],
      contagem_por_tipo_movimento: contagem(tipo),
      contagem_por_marca: contagem(marca),
      contagem_por_vendedor: contagem(vendedor),
      contagem_por_filial: contagem(filial),
      contagem_por_grupo_produto: contagem(grupo),
      soma_ValorVenda_total: r2(base.reduce((s, it) => s + num(it.ValorVenda ?? it.valor_venda), 0)),
      soma_ValorDescontoItem_total: r2(base.reduce((s, it) => s + num(it.ValorDescontoItem ?? it.valor_desconto_item), 0)),
      soma_ValorDevolucao_total: r2(base.reduce((s, it) => s + num(it.ValorDevolucao ?? it.valor_devolucao), 0)),
      soma_ValorVenda_por_marca: somaPor(marca, it => num(it.ValorVenda ?? it.valor_venda)),
      soma_ValorVenda_por_vendedor: somaPor(vendedor, it => num(it.ValorVenda ?? it.valor_venda)),
      soma_ValorVenda_por_tipo: somaPor(tipo, it => num(it.ValorVenda ?? it.valor_venda)),
      soma_ValorDevolucao_por_marca: somaPor(marca, it => num(it.ValorDevolucao ?? it.valor_devolucao)),
      fatias: {
        MARCA_MWM: fatia("MARCA_MWM", isMWM),
        MARCA_EATON: fatia("MARCA_EATON", isEATON),
        GRUPO_MWM: fatia("GRUPO_MWM", grupoMWM),
        GRUPO_EATON: fatia("GRUPO_EATON", grupoEATON),
        PRODUTO_CONTEM_MWM: fatia("PRODUTO_CONTEM_MWM", produtoMWM),
        PRODUTO_CONTEM_EATON: fatia("PRODUTO_CONTEM_EATON", produtoEATON),
      },
      amostra_5_registros: amostra,
    };
  }

  const resultado: Record<string, any> = {};
  for (const m of meses) {
    const all = await baixarMes(m.ini, m.fim);
    resultado[m.nome] = auditar(all, `${m.ini.slice(0, 7)}`);
  }

  // Comparativo
  const cmp = (chave: string) => {
    const mai = resultado.MAIO_2026[chave];
    const jun = resultado.JUNHO_2026[chave];
    if (typeof mai === "number") return { maio: mai, junho: jun, dif: r2(jun - mai) };
    return { maio: mai, junho: jun };
  };

  const marcas = new Set([
    ...Object.keys(resultado.MAIO_2026.soma_ValorVenda_por_marca),
    ...Object.keys(resultado.JUNHO_2026.soma_ValorVenda_por_marca),
  ]);
  const cmpMarca: Record<string, any> = {};
  for (const m of marcas) {
    const a = resultado.MAIO_2026.soma_ValorVenda_por_marca[m] ?? 0;
    const b = resultado.JUNHO_2026.soma_ValorVenda_por_marca[m] ?? 0;
    cmpMarca[m] = { maio: a, junho: b, dif: r2(b - a) };
  }

  const comparativo = {
    total_registros: cmp("total_registros"),
    soma_ValorVenda_total: cmp("soma_ValorVenda_total"),
    soma_ValorDescontoItem_total: cmp("soma_ValorDescontoItem_total"),
    soma_ValorDevolucao_total: cmp("soma_ValorDevolucao_total"),
    por_marca_ValorVenda: Object.fromEntries(
      Object.entries(cmpMarca).sort((a: any, b: any) => Math.abs(b[1].dif) - Math.abs(a[1].dif))
    ),
    fatias_MWM: {
      MARCA: {
        maio: resultado.MAIO_2026.fatias.MARCA_MWM,
        junho: resultado.JUNHO_2026.fatias.MARCA_MWM,
      },
      GRUPO: {
        maio: resultado.MAIO_2026.fatias.GRUPO_MWM,
        junho: resultado.JUNHO_2026.fatias.GRUPO_MWM,
      },
      PRODUTO_CONTEM: {
        maio: resultado.MAIO_2026.fatias.PRODUTO_CONTEM_MWM,
        junho: resultado.JUNHO_2026.fatias.PRODUTO_CONTEM_MWM,
      },
    },
    fatias_EATON: {
      MARCA: {
        maio: resultado.MAIO_2026.fatias.MARCA_EATON,
        junho: resultado.JUNHO_2026.fatias.MARCA_EATON,
      },
      GRUPO: {
        maio: resultado.MAIO_2026.fatias.GRUPO_EATON,
        junho: resultado.JUNHO_2026.fatias.GRUPO_EATON,
      },
      PRODUTO_CONTEM: {
        maio: resultado.MAIO_2026.fatias.PRODUTO_CONTEM_EATON,
        junho: resultado.JUNHO_2026.fatias.PRODUTO_CONTEM_EATON,
      },
    },
  };

  return new Response(
    JSON.stringify({
      config: { empresa: "1004 Pelegrini", filial: "CT (Casa da Transmissao)", endpoint: `${VPS_BASE}/${CLIENTE}${PATH}`, cod_empresa_bi: COD_BI },
      MAIO_2026: resultado.MAIO_2026,
      JUNHO_2026: resultado.JUNHO_2026,
      COMPARATIVO_FINAL: comparativo,
      observacao: "Dump bruto sem aplicar regra de campanha. Use este JSON para conferir contra o Excel.",
    }, null, 2),
    { headers: { "content-type": "application/json" } }
  );
});
