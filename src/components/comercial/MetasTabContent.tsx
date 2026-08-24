import { useMemo } from 'react';
import { PremiumMetasView } from './PremiumMetasView';
import { getDiasUteisNoMes, getDiasUteisDecorridos, type ComercialFilters as ComercialFiltersType } from '@/types/comercial';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useMetasVendedores } from '@/hooks/useMetasVendedores';
import { getFeriadosComerciaisMeta } from '@/utils/feriadosComerciais';

const METAS_VENDEDORES: Record<string | number, number> = {
  5: 300000, 6: 290000, 7: 280000, 8: 220000,
  9: 200000, 10: 230000, 11: 220000, 12: 200000,
};
const META_PADRAO = 0;

function getReceita1004(p: any): number {
  if (p.tipo === 'DEVOLUCAO') return -Math.abs(Number(p.valor_devolucao_real || p.valor_real || p.valor_liquido || 0));
  const liquidoFinal = Math.abs(Number(p.valor_liquido_final ?? Math.max(0, Math.abs(p.valor_bruto || 0) - Math.abs(p.valor_desconto || 0))));
  return liquidoFinal - Math.abs(Number(p.valor_devolucao_real || 0));
}

interface Override1003 {
  agrVendedor: any[];
  agrPeriodoDiario: any[];
  totIdealPedidos: any | null;
  totIdealDevolucoes: any | null;
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vendedoresPerformance: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pedidos: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  devolucoes: any[];
  appliedFilters?: ComercialFiltersType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  periodoDisponivel?: any;
  override1003?: Override1003;
}

export function MetasTabContent({ vendedoresPerformance, pedidos, devolucoes, appliedFilters, periodoDisponivel, override1003 }: Props) {
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const is1005 = String(codEmpresaAtiva || '') === '1005';
  const is1004 = String(codEmpresaAtiva || '') === '1004';
  const is1003 = String(codEmpresaAtiva || '') === '1003';
  const hoje = new Date();
  const diaAtual = hoje.getDate();

  const periodoFiltros = useMemo(() => {
    if (appliedFilters?.anos?.length && appliedFilters?.meses?.length) {
      return { ano: parseInt(appliedFilters.anos[0]), mes: parseInt(appliedFilters.meses[0]) };
    }
    if (periodoDisponivel) {
      return { ano: parseInt(periodoDisponivel.ultimoAno), mes: parseInt(periodoDisponivel.ultimoMes) };
    }
    return { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  }, [appliedFilters, periodoDisponivel]);

  const feriadosMeta = useMemo(
    () => getFeriadosComerciaisMeta(codEmpresaAtiva, periodoFiltros.ano, periodoFiltros.mes - 1),
    [codEmpresaAtiva, periodoFiltros.ano, periodoFiltros.mes]
  );

  const diasUteisNoMes = getDiasUteisNoMes(periodoFiltros.ano, periodoFiltros.mes - 1, feriadosMeta);
  const anoMesAtual = hoje.getFullYear() * 100 + (hoje.getMonth() + 1);
  const anoMesFiltro = periodoFiltros.ano * 100 + periodoFiltros.mes;
  // Para o mês corrente, usar a última data efetivamente faturada no JSON em vez
  // de hoje.getDate(): assim, os dias úteis decorridos só avançam quando o dado real
  // também avança, evitando queda artificial do % de atingimento.
  let diaRef = diaAtual;
  if (anoMesFiltro === anoMesAtual && periodoDisponivel?.fim) {
    const fim = periodoDisponivel.fim as string;
    const fimAno = parseInt(fim.substring(0, 4), 10);
    const fimMes = parseInt(fim.substring(5, 7), 10);
    if (fimAno === periodoFiltros.ano && fimMes === periodoFiltros.mes) {
      diaRef = parseInt(fim.substring(8, 10), 10) || diaAtual;
    }
  }
  const diasUteisDecorridos = anoMesFiltro < anoMesAtual
    ? diasUteisNoMes
    : anoMesFiltro === anoMesAtual
      ? getDiasUteisDecorridos(periodoFiltros.ano, periodoFiltros.mes - 1, diaRef, feriadosMeta)
      : 0;

  const mesesSelecionadosSet = useMemo(() => {
    const anos = appliedFilters?.anos ?? [];
    const meses = appliedFilters?.meses ?? [];
    if (!anos.length || !meses.length) return null;
    const set = new Set<string>();
    for (const a of anos) for (const m of meses) {
      set.add(`${a}-${String(parseInt(m)).padStart(2, '0')}`);
    }
    return set;
  }, [appliedFilters?.anos, appliedFilters?.meses]);

  const vendedoresComMeta = useMemo(() => {
    // Empresa 1005: meta é por CARTEIRA EXTERNA (cod_vendedor_externo + meta_vendedor_externo).
    // O ERP repete a meta da carteira em todas as linhas dos vendedores internos,
    // por isso somar por vendedor original inflaciona. Reagrupamos por carteira.
    if (is1005) {
      type Acc = {
        codigo: string;
        nome: string;
        metasPorMes: Map<string, number>;
        faturamento: number;
        pendente: number;
        clientes: Set<string>;
        pedidosIds: Set<string>;
      };
      const map = new Map<string, Acc>();
      for (const p of pedidos as any[]) {
        const cod = String(p.cod_vendedor_externo ?? '').trim();
        const nome = String(p.vendedor_externo ?? '').trim();
        if (!cod && !nome) continue;
        const key = cod || nome.toUpperCase();
        let acc = map.get(key);
        if (!acc) {
          acc = { codigo: key, nome: (nome || key).toUpperCase(), metasPorMes: new Map(), faturamento: 0, pendente: 0, clientes: new Set(), pedidosIds: new Set() };
          map.set(key, acc);
        }
        const dataRef = (p.data_faturamento || p.data_pedido || '').toString();
        const mesKey = dataRef.substring(0, 7);
        if (mesesSelecionadosSet && mesKey && !mesesSelecionadosSet.has(mesKey)) continue;

        // Meta: MAX(meta_vendedor_externo) por mês — fallback para MetaVendedor.
        const metaLinha = Number(p.meta_vendedor_externo ?? p.meta_vendedor ?? 0) || 0;
        if (mesKey && metaLinha > 0 && p.tipo !== 'DEVOLUCAO') {
          const cur = acc.metasPorMes.get(mesKey) ?? 0;
          if (metaLinha > cur) acc.metasPorMes.set(mesKey, metaLinha);
        }

        // Faturamento: valor_liquido já vem assinado (faturado positivo, devolução negativo).
        acc.faturamento += Number(p.valor_liquido || 0);
        const temData = !!(p.data_faturamento && String(p.data_faturamento).trim() !== '' && p.data_faturamento !== 'null');
        if (!temData && p.tipo !== 'DEVOLUCAO') {
          acc.pendente += Math.abs(Number(p.valor_bruto || 0));
        }
        if (p.cliente_codigo) acc.clientes.add(String(p.cliente_codigo));
        if (p.id != null) acc.pedidosIds.add(String(p.id));
      }

      const arr = Array.from(map.values()).map(acc => {
        const metaMensal = Array.from(acc.metasPorMes.values()).reduce((a, b) => a + b, 0);
        const faturamentoMesAtual = acc.faturamento;
        const valorPendente = acc.pendente;
        const valorTotalPedidos = faturamentoMesAtual + valorPendente;
        const metaDiaria = metaMensal > 0 ? metaMensal / diasUteisNoMes : 0;
        const metaEsperada = metaDiaria * diasUteisDecorridos;
        const percentualMetaFaturado = metaMensal > 0 ? (faturamentoMesAtual / metaMensal) * 100 : 0;
        const percentualMetaTotal = metaMensal > 0 ? (valorTotalPedidos / metaMensal) * 100 : 0;
        const diferenca = faturamentoMesAtual - metaEsperada;
        const status = percentualMetaFaturado >= 100 ? 'acima' : percentualMetaFaturado >= 90 ? 'proximo' : 'abaixo';
        return {
          codigo: acc.codigo,
          nome: acc.nome,
          metaMensal,
          faturamentoMesAtual,
          valorPendente,
          valorTotal: valorTotalPedidos,
          percentualMetaFaturado,
          percentualMetaTotal,
          diferenca,
          status,
          metaDiaria,
          metaEsperada,
          totalVendas: faturamentoMesAtual,
          totalDevolucoes: 0,
          pedidosFaturados: acc.pedidosIds.size,
          pedidosPendentes: 0,
          ticketMedio: acc.pedidosIds.size > 0 ? faturamentoMesAtual / acc.pedidosIds.size : 0,
          participacao: 0,
          faturamentoLiquido: faturamentoMesAtual,
          valorFaturado: faturamentoMesAtual,
          margem: 0,
          comissao: 0,
        };
      }).sort((a, b) => b.percentualMetaFaturado - a.percentualMetaFaturado);

      return arr;
    }

    return vendedoresPerformance.map(v => {
      const pedidosVendedor = pedidos.filter(p => String(p.vendedor_codigo) === String(v.codigo));
      const metasPorMes = new Map<string, number>();
      for (const p of pedidosVendedor) {
        if (p.tipo === 'DEVOLUCAO') continue;
        const meta = p.meta_vendedor;
        if (meta == null || !(meta > 0)) continue;
        const dataRef = (p.data_faturamento || p.data_pedido || '').toString();
        const mesKey = dataRef.substring(0, 7);
        if (!mesKey) continue;
        if (mesesSelecionadosSet && !mesesSelecionadosSet.has(mesKey)) continue;
        const atual = metasPorMes.get(mesKey) ?? 0;
        if (meta > atual) metasPorMes.set(mesKey, meta);
      }
      const metaDoJson = Array.from(metasPorMes.values()).reduce((a, b) => a + b, 0);
      const metaMensal = metaDoJson > 0 ? metaDoJson : (METAS_VENDEDORES[v.codigo] ?? META_PADRAO);

      const faturamentoMesAtual = pedidosVendedor.reduce((acc, p) => acc + (is1004 ? getReceita1004(p) : (p.valor_liquido || 0)), 0);
      const valorPendente = pedidosVendedor.reduce((acc, p) => {
        if (p.tipo === 'DEVOLUCAO') return acc;
        const temData = !!(p.data_faturamento && String(p.data_faturamento).trim() !== '' && p.data_faturamento !== 'null');
        return temData ? acc : acc + Math.abs(p.valor_bruto || 0);
      }, 0);
      const valorTotalPedidos = faturamentoMesAtual + valorPendente;
      const metaDiaria = metaMensal / diasUteisNoMes;
      const metaEsperada = metaDiaria * diasUteisDecorridos;
      const percentualMetaFaturado = metaMensal > 0 ? (faturamentoMesAtual / metaMensal) * 100 : 0;
      const percentualMetaTotal = metaMensal > 0 ? (valorTotalPedidos / metaMensal) * 100 : 0;
      const diferenca = faturamentoMesAtual - metaEsperada;
      const status = percentualMetaFaturado >= 100 ? 'acima' : percentualMetaFaturado >= 90 ? 'proximo' : 'abaixo';

      return {
        ...v, metaMensal, faturamentoMesAtual, valorPendente,
        valorTotal: valorTotalPedidos, percentualMetaFaturado, percentualMetaTotal,
        diferenca, status, metaDiaria, metaEsperada,
      };
    }).sort((a, b) => b.percentualMetaFaturado - a.percentualMetaFaturado);
  }, [is1005, is1004, vendedoresPerformance, pedidos, diasUteisNoMes, diasUteisDecorridos, mesesSelecionadosSet]);

  const kpisGerais = useMemo(() => {
    const comMeta = vendedoresComMeta.filter(v => v.metaMensal > 0);
    const totalMeta = comMeta.reduce((a, v) => a + v.metaMensal, 0);
    const totalMetaEsperada = comMeta.reduce((a, v) => a + v.metaEsperada, 0);
    const totalFaturado = vendedoresComMeta.reduce((a, v) => a + v.faturamentoMesAtual, 0);
    const totalPedidos = vendedoresComMeta.reduce((a, v) => a + v.valorTotal, 0);
    const totalPendente = vendedoresComMeta.reduce((a, v) => a + v.valorPendente, 0);
    // Faturamento restrito aos vendedores que possuem meta (para % coerente)
    const faturadoDeComMeta = comMeta.reduce((a, v) => a + v.faturamentoMesAtual, 0);
    const pedidosDeComMeta = comMeta.reduce((a, v) => a + v.valorTotal, 0);
    const totalDevolucoesUnif = pedidos.filter(p => p.tipo === 'DEVOLUCAO')
      .reduce((a, p) => a + Math.abs(p.valor_devolucao_real ?? p.valor_real ?? p.valor_liquido ?? 0), 0);
    const totalDevolucoesLeg = devolucoes.reduce((a, d) => a + Math.abs(d.valor_liquido || 0), 0);
    const totalDevolucoes = totalDevolucoesUnif || totalDevolucoesLeg;
    const percentualFaturado = totalMeta > 0 ? (faturadoDeComMeta / totalMeta) * 100 : 0;
    const percentualTotal = totalMeta > 0 ? (pedidosDeComMeta / totalMeta) * 100 : 0;
    const faltaFaturado = totalMeta - faturadoDeComMeta;
    const faltaTotal = totalMeta - pedidosDeComMeta;
    const acimaMeta = comMeta.filter(v => v.percentualMetaFaturado >= 100).length;
    const proximoMeta = comMeta.filter(v => v.percentualMetaFaturado >= 90 && v.percentualMetaFaturado < 100).length;
    const abaixoMeta = comMeta.filter(v => v.percentualMetaFaturado < 90).length;
    const clientesAtendidos = new Set(pedidos.map(p => p.cliente_codigo)).size;
    const ticketMedio = pedidos.length > 0 ? totalFaturado / pedidos.length : 0;
    const mediaMetaVendedores = comMeta.length > 0
      ? comMeta.reduce((a, v) => a + v.percentualMetaFaturado, 0) / comMeta.length : 0;
    const totalGeral = totalFaturado || 1;
    const participacoes = vendedoresComMeta.map(v => ({ ...v, participacao: (v.faturamentoMesAtual / totalGeral) * 100 }));

    return {
      totalMeta, totalMetaEsperada, totalFaturado, totalPendente, totalPedidos,
      totalDevolucoes, percentualFaturado, percentualTotal, faltaFaturado, faltaTotal,
      acimaMeta, proximoMeta, abaixoMeta, totalVendedores: vendedoresComMeta.length,
      clientesAtendidos, ticketMedio, mediaMetaVendedores, participacoes,
      fatVsPed: totalPedidos > 0 ? (totalFaturado / totalPedidos) * 100 : 0,
    };
  }, [vendedoresComMeta, devolucoes, pedidos]);

  // ============================================================
  // BRANCH EMPRESA 1003 (Ideal) — usa endpoints agrupados / totalizadores
  // Não depende dos arrays legados `pedidos`/`vendedoresPerformance`.
  // ============================================================
  const { metas: metasCadastradas } = useMetasVendedores({
    codEmpresaBi: is1003 ? String(codEmpresaAtiva ?? '') : undefined,
    ano: is1003 ? periodoFiltros.ano : undefined,
    meses: is1003 ? [periodoFiltros.mes] : undefined,
    enabled: is1003,
  });

  const ideal1003 = useMemo(() => {
    if (!is1003 || !override1003) return null;
    const { agrVendedor, agrPeriodoDiario, totIdealPedidos, totIdealDevolucoes } = override1003;

    // ---- Mapa de metas por cod_vendedor ----
    const metaByCod = new Map<string, { valor: number; nome?: string }>();
    for (const m of metasCadastradas || []) {
      const key = String(m.cod_vendedor).trim();
      if (!key) continue;
      const cur = metaByCod.get(key)?.valor ?? 0;
      metaByCod.set(key, { valor: cur + Number(m.meta_valor || 0), nome: m.nome_vendedor || undefined });
    }

    // ---- Vendedores com meta a partir do agrupado ----
    const rowsV = Array.isArray(agrVendedor) ? agrVendedor : [];
    const vendedoresBase = rowsV.map((r: any) => {
      const cod = String(r.cod_vendedor ?? '').trim();
      const nome = String(r.vendedor ?? r.nome ?? cod).trim();
      const realizado = Number(r.total_liquido) || 0;
      const faturado = Number(r.total_faturado) || 0;
      const pedidosQ = Number(r.quantidade_pedidos) || 0;
      const clientesQ = Number(r.quantidade_clientes) || 0;
      const ticket = Number(r.ticket_medio) || (pedidosQ > 0 ? realizado / pedidosQ : 0);
      const margem = Number(r.margem_percentual) || 0;
      const metaMensal = metaByCod.get(cod)?.valor ?? 0;
      const metaDiaria = metaMensal > 0 ? metaMensal / diasUteisNoMes : 0;
      const metaEsperada = metaDiaria * diasUteisDecorridos;
      const percentualMetaFaturado = metaMensal > 0 ? (realizado / metaMensal) * 100 : 0;
      const percentualMetaTotal = percentualMetaFaturado;
      const diferenca = realizado - metaEsperada;
      const status = percentualMetaFaturado >= 100 ? 'acima' : percentualMetaFaturado >= 90 ? 'proximo' : 'abaixo';
      return {
        codigo: cod,
        nome,
        metaMensal,
        faturamentoMesAtual: realizado,
        valorPendente: 0,
        valorTotal: realizado,
        percentualMetaFaturado,
        percentualMetaTotal,
        diferenca,
        status,
        metaDiaria,
        metaEsperada,
        totalVendas: realizado,
        totalDevolucoes: 0,
        pedidosFaturados: pedidosQ,
        pedidosPendentes: 0,
        ticketMedio: ticket,
        participacao: 0,
        faturamentoLiquido: realizado,
        valorFaturado: faturado,
        margem,
        comissao: 0,
      };
    }).sort((a: any, b: any) => b.percentualMetaFaturado - a.percentualMetaFaturado);

    // Inclui vendedores cadastrados na meta mas ausentes do agrupado
    const seen = new Set(vendedoresBase.map(v => String(v.codigo)));
    for (const [cod, info] of metaByCod.entries()) {
      if (seen.has(cod)) continue;
      const metaMensal = info.valor;
      const metaDiaria = metaMensal > 0 ? metaMensal / diasUteisNoMes : 0;
      vendedoresBase.push({
        codigo: cod, nome: info.nome || cod, metaMensal,
        faturamentoMesAtual: 0, valorPendente: 0, valorTotal: 0,
        percentualMetaFaturado: 0, percentualMetaTotal: 0, diferenca: -metaDiaria * diasUteisDecorridos,
        status: 'abaixo', metaDiaria, metaEsperada: metaDiaria * diasUteisDecorridos,
        totalVendas: 0, totalDevolucoes: 0, pedidosFaturados: 0, pedidosPendentes: 0,
        ticketMedio: 0, participacao: 0, faturamentoLiquido: 0, valorFaturado: 0,
        margem: 0, comissao: 0,
      });
    }

    // ---- KPIs gerais (a partir dos totalizadores /total) ----
    const tot = totIdealPedidos || {};
    const dev = totIdealDevolucoes || {};
    const totalFaturado = Number(tot.total_liquido) || vendedoresBase.reduce((s, v) => s + v.faturamentoMesAtual, 0);
    const qtdPedidos = Number(tot.quantidade_pedidos) || 0;
    const clientesAtendidos = Number(tot.quantidade_clientes) || 0;
    const ticketMedio = Number(tot.ticket_medio) || (qtdPedidos > 0 ? totalFaturado / qtdPedidos : 0);
    const totalDevolucoes = Number(dev.valor_total_devolvido) || 0;
    const totalVendedores = Number(tot.quantidade_vendedores) || vendedoresBase.length;

    const comMeta = vendedoresBase.filter(v => v.metaMensal > 0);
    const totalMeta = comMeta.reduce((a, v) => a + v.metaMensal, 0);
    const totalMetaEsperada = comMeta.reduce((a, v) => a + v.metaEsperada, 0);
    const faturadoDeComMeta = comMeta.reduce((a, v) => a + v.faturamentoMesAtual, 0);
    const percentualFaturado = totalMeta > 0 ? (faturadoDeComMeta / totalMeta) * 100 : 0;
    const percentualTotal = percentualFaturado;
    const faltaFaturado = totalMeta - faturadoDeComMeta;
    const faltaTotal = faltaFaturado;
    const acimaMeta = comMeta.filter(v => v.percentualMetaFaturado >= 100).length;
    const proximoMeta = comMeta.filter(v => v.percentualMetaFaturado >= 90 && v.percentualMetaFaturado < 100).length;
    const abaixoMeta = comMeta.filter(v => v.percentualMetaFaturado < 90).length;
    const mediaMetaVendedores = comMeta.length > 0
      ? comMeta.reduce((a, v) => a + v.percentualMetaFaturado, 0) / comMeta.length : 0;
    const totalGeral = totalFaturado || 1;
    const participacoes = vendedoresBase.map(v => ({ ...v, participacao: (v.faturamentoMesAtual / totalGeral) * 100 }));

    const kpisGerais1003: any = {
      totalMeta, totalMetaEsperada, totalFaturado,
      totalPendente: 0, totalPedidos: totalFaturado,
      totalDevolucoes, percentualFaturado, percentualTotal,
      faltaFaturado, faltaTotal,
      acimaMeta, proximoMeta, abaixoMeta,
      totalVendedores,
      clientesAtendidos, ticketMedio, mediaMetaVendedores, participacoes,
      qtdPedidos,
      fatVsPed: 100,
    };

    // ---- Pedidos sintéticos para alimentar o gráfico Realizado x Meta ----
    const anoStr = String(periodoFiltros.ano);
    const mesStr = String(periodoFiltros.mes).padStart(2, '0');
    const pedidosSinteticos: any[] = [];
    for (const row of (agrPeriodoDiario || [])) {
      const periodoStr = String(row.periodo || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(periodoStr)) continue;
      pedidosSinteticos.push({
        vendedor_codigo: '',
        data_faturamento: periodoStr,
        data_pedido: periodoStr,
        valor_liquido: Number(row.total_liquido) || 0,
        meta_vendedor: totalMeta,
        tipo: 'FATURADO',
      });
    }
    // Garante ao menos um ponto no mês atual para o gráfico não ficar vazio
    if (pedidosSinteticos.length === 0 && totalFaturado > 0) {
      pedidosSinteticos.push({
        vendedor_codigo: '',
        data_faturamento: `${anoStr}-${mesStr}-01`,
        data_pedido: `${anoStr}-${mesStr}-01`,
        valor_liquido: totalFaturado,
        meta_vendedor: totalMeta,
        tipo: 'FATURADO',
      });
    }

    return { vendedoresComMeta: vendedoresBase, kpisGerais: kpisGerais1003, pedidos: pedidosSinteticos };
  }, [is1003, override1003, metasCadastradas, diasUteisNoMes, diasUteisDecorridos, periodoFiltros]);

  if (is1003 && ideal1003) {
    return (
      <PremiumMetasView
        vendedoresComMeta={ideal1003.vendedoresComMeta as any}
        pedidos={ideal1003.pedidos as any}
        kpisGerais={ideal1003.kpisGerais}
        periodoFiltros={periodoFiltros}
        diasUteisNoMes={diasUteisNoMes}
        diasUteisDecorridos={diasUteisDecorridos}
      />
    );
  }

  return (
    <PremiumMetasView
      vendedoresComMeta={vendedoresComMeta}
      pedidos={pedidos}
      kpisGerais={kpisGerais}
      periodoFiltros={periodoFiltros}
      diasUteisNoMes={diasUteisNoMes}
      diasUteisDecorridos={diasUteisDecorridos}
    />
  );
}
