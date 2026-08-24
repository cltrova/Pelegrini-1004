import type { Pedido } from '@/types/comercial';

export type Granularidade = 'semanal' | 'quinzenal' | 'mensal';
export type RiscoNivel = 'critico' | 'alto' | 'medio' | 'estavel' | 'crescimento';

export interface ClienteQueda {
  codigo: string | number;
  razao: string;
  fantasia?: string;
  vendedor_nome?: string;
  faturamentoP1: number;
  faturamentoP2: number;
  variacaoValor: number;
  variacaoPercent: number;
  pedidosP1: number;
  pedidosP2: number;
  ticketMedioP1: number;
  ticketMedioP2: number;
  ultimaCompra?: string;
  diasSemCompra?: number;
  risco: RiscoNivel;
}

export function classificarRisco(faturamentoP1: number, faturamentoP2: number): RiscoNivel {
  if (faturamentoP2 <= 0 && faturamentoP1 <= 0) return 'estavel';
  if (faturamentoP2 > 0 && faturamentoP1 <= 0) return 'critico';
  if (faturamentoP2 <= 0 && faturamentoP1 > 0) return 'crescimento';
  const variacao = (faturamentoP1 - faturamentoP2) / faturamentoP2;
  if (variacao <= -0.7) return 'critico';
  if (variacao <= -0.4) return 'alto';
  if (variacao <= -0.2) return 'medio';
  if (variacao > 0.2) return 'crescimento';
  return 'estavel';
}

export function computarPeriodoAnterior(inicio: Date, fim: Date): { inicio: Date; fim: Date } {
  const diffMs = fim.getTime() - inicio.getTime();
  const dias = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
  const p2Fim = new Date(inicio);
  p2Fim.setDate(p2Fim.getDate() - 1);
  const p2Inicio = new Date(p2Fim);
  p2Inicio.setDate(p2Inicio.getDate() - (dias - 1));
  return { inicio: p2Inicio, fim: p2Fim };
}

export function periodoAtualPorGranularidade(granularidade: Granularidade, hoje: Date = new Date()): { inicio: Date; fim: Date } {
  const fim = new Date(hoje);
  const inicio = new Date(hoje);
  if (granularidade === 'semanal') {
    inicio.setDate(inicio.getDate() - 6);
  } else if (granularidade === 'quinzenal') {
    inicio.setDate(inicio.getDate() - 14);
  } else {
    inicio.setDate(1);
  }
  return { inicio, fim };
}

function getDataRef(p: Pedido): string | undefined {
  const raw = (p.data_pedido || p.data_faturamento) as string | undefined;
  if (!raw) return undefined;
  return String(raw).substring(0, 10);
}

function inRange(dateStr: string, inicio: Date, fim: Date): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  return d >= new Date(inicio.toISOString().substring(0, 10) + 'T00:00:00') &&
         d <= new Date(fim.toISOString().substring(0, 10) + 'T23:59:59');
}

export function agregarQuedaClientes(
  pedidos: Pedido[],
  p1: { inicio: Date; fim: Date },
  p2: { inicio: Date; fim: Date },
): ClienteQueda[] {
  const map = new Map<string, {
    razao: string; fantasia?: string; vendedor?: string;
    p1: number; p2: number; qp1: number; qp2: number; ultima?: string;
  }>();

  for (const ped of pedidos) {
    const d = getDataRef(ped);
    if (!d) continue;
    const key = String(ped.cliente_codigo ?? ped.cliente_razao ?? 'N/A');
    if (!map.has(key)) {
      map.set(key, {
        razao: ped.cliente_razao || ped.cliente_fantasia || String(ped.cliente_codigo),
        fantasia: ped.cliente_fantasia,
        vendedor: ped.vendedor_nome,
        p1: 0, p2: 0, qp1: 0, qp2: 0,
      });
    }
    const rec = map.get(key)!;
    const valor = Number(ped.valor_liquido ?? ped.valor_real ?? 0) || 0;
    if (inRange(d, p1.inicio, p1.fim)) {
      rec.p1 += valor;
      rec.qp1 += 1;
      if (!rec.ultima || d > rec.ultima) rec.ultima = d;
    } else if (inRange(d, p2.inicio, p2.fim)) {
      rec.p2 += valor;
      rec.qp2 += 1;
    } else {
      if (!rec.ultima || d > rec.ultima) rec.ultima = d;
    }
  }

  const hoje = new Date();
  const out: ClienteQueda[] = [];
  for (const [codigo, r] of map.entries()) {
    if (r.p1 <= 0 && r.p2 <= 0) continue;
    const variacaoValor = r.p1 - r.p2;
    const variacaoPercent = r.p2 > 0 ? (variacaoValor / r.p2) * 100 : (r.p1 > 0 ? 100 : -100);
    const diasSemCompra = r.ultima
      ? Math.floor((hoje.getTime() - new Date(r.ultima + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
      : undefined;
    out.push({
      codigo,
      razao: r.razao,
      fantasia: r.fantasia,
      vendedor_nome: r.vendedor,
      faturamentoP1: r.p1,
      faturamentoP2: r.p2,
      variacaoValor,
      variacaoPercent,
      pedidosP1: r.qp1,
      pedidosP2: r.qp2,
      ticketMedioP1: r.qp1 > 0 ? r.p1 / r.qp1 : 0,
      ticketMedioP2: r.qp2 > 0 ? r.p2 / r.qp2 : 0,
      ultimaCompra: r.ultima,
      diasSemCompra,
      risco: classificarRisco(r.p1, r.p2),
    });
  }
  return out.sort((a, b) => a.variacaoValor - b.variacaoValor);
}

export const RISCO_LABEL: Record<RiscoNivel, string> = {
  critico: 'Crítico',
  alto: 'Alto',
  medio: 'Médio',
  estavel: 'Estável',
  crescimento: 'Crescimento',
};

export const RISCO_COLOR: Record<RiscoNivel, string> = {
  critico: 'hsl(0, 72%, 51%)',
  alto: 'hsl(24, 90%, 55%)',
  medio: 'hsl(38, 92%, 50%)',
  estavel: 'hsl(217, 91%, 60%)',
  crescimento: 'hsl(142, 71%, 45%)',
};

// ---------------------------------------------------------------------------
// Adapter: mapeia resposta de /comercial/clientes/analise para ClienteQueda[]
// ---------------------------------------------------------------------------
export function mapAnaliseToQueda(items: any[]): ClienteQueda[] {
  if (!Array.isArray(items)) return [];
  const num = (v: any) => (v == null ? 0 : Number(v) || 0);
  const out: ClienteQueda[] = items.map((it) => {
    const p1 = num(it.faturamento_p1 ?? it.total_liquido_p1);
    const p2 = num(it.faturamento_p2 ?? it.total_liquido_p2);
    const variacaoValor = num(it.variacao_valor ?? (p1 - p2));
    const variacaoPercent = num(it.variacao_percent ?? (p2 > 0 ? ((p1 - p2) / p2) * 100 : (p1 > 0 ? 100 : -100)));
    const qp1 = num(it.pedidos_p1 ?? it.quantidade_pedidos_p1);
    const qp2 = num(it.pedidos_p2 ?? it.quantidade_pedidos_p2);
    const riscoServer = String(it.risco || '').toLowerCase() as RiscoNivel;
    const risco: RiscoNivel = (['critico', 'alto', 'medio', 'estavel', 'crescimento'] as RiscoNivel[])
      .includes(riscoServer) ? riscoServer : classificarRisco(p1, p2);
    return {
      codigo: it.cod_cliente ?? it.codigo ?? 'N/A',
      razao: it.cliente || it.razao || String(it.cod_cliente ?? ''),
      fantasia: it.nome_fantasia || it.fantasia,
      vendedor_nome: it.vendedor || it.vendedor_nome,
      faturamentoP1: p1,
      faturamentoP2: p2,
      variacaoValor,
      variacaoPercent,
      pedidosP1: qp1,
      pedidosP2: qp2,
      ticketMedioP1: num(it.ticket_medio_p1 ?? (qp1 > 0 ? p1 / qp1 : 0)),
      ticketMedioP2: num(it.ticket_medio_p2 ?? (qp2 > 0 ? p2 / qp2 : 0)),
      ultimaCompra: it.ultima_compra,
      diasSemCompra: it.dias_sem_compra != null ? num(it.dias_sem_compra) : undefined,
      risco,
    };
  });
  return out.sort((a, b) => a.variacaoValor - b.variacaoValor);
}


// ---------------------------------------------------------------------------
// Adapter: monta ClienteQueda[] a partir dos totalizadores /comercial/agrupado
// (grupo=CLIENTE) de dois períodos — P1 (atual) e P2 (anterior).
// ---------------------------------------------------------------------------
export function mapAgrupadoClientesToQueda(rowsP1: any[], rowsP2: any[]): ClienteQueda[] {
  const num = (v: any) => (v == null ? 0 : Number(v) || 0);
  const valor = (r: any) => num(r.total_liquido ?? r.total_pedidos ?? r.total_bruto);
  const key = (r: any) => String(r.cod_cliente ?? r.cliente ?? 'N/A');

  const map = new Map<string, {
    razao: string; fantasia?: string; vendedor?: string;
    p1: number; p2: number; qp1: number; qp2: number; ultima?: string;
  }>();

  const ensure = (r: any) => {
    const k = key(r);
    if (!map.has(k)) {
      map.set(k, {
        razao: r.cliente || r.nome_fantasia || k,
        fantasia: r.nome_fantasia || undefined,
        vendedor: r.vendedor || undefined,
        p1: 0, p2: 0, qp1: 0, qp2: 0,
      });
    }
    return map.get(k)!;
  };

  for (const r of Array.isArray(rowsP2) ? rowsP2 : []) {
    const rec = ensure(r);
    rec.p2 += valor(r);
    rec.qp2 += num(r.quantidade_pedidos);
    const u = r.ultima_compra_periodo ? String(r.ultima_compra_periodo).substring(0, 10) : undefined;
    if (u && (!rec.ultima || u > rec.ultima)) rec.ultima = u;
  }
  for (const r of Array.isArray(rowsP1) ? rowsP1 : []) {
    const rec = ensure(r);
    rec.p1 += valor(r);
    rec.qp1 += num(r.quantidade_pedidos);
    const u = r.ultima_compra_periodo ? String(r.ultima_compra_periodo).substring(0, 10) : undefined;
    if (u && (!rec.ultima || u > rec.ultima)) rec.ultima = u;
  }

  const hoje = new Date();
  const out: ClienteQueda[] = [];
  for (const [codigo, r] of map.entries()) {
    if (r.p1 <= 0 && r.p2 <= 0) continue;
    const variacaoValor = r.p1 - r.p2;
    const variacaoPercent = r.p2 > 0 ? (variacaoValor / r.p2) * 100 : (r.p1 > 0 ? 100 : -100);
    const diasSemCompra = r.ultima
      ? Math.max(0, Math.floor((hoje.getTime() - new Date(r.ultima + 'T00:00:00').getTime()) / 86400000))
      : undefined;
    out.push({
      codigo,
      razao: r.razao,
      fantasia: r.fantasia,
      vendedor_nome: r.vendedor,
      faturamentoP1: r.p1,
      faturamentoP2: r.p2,
      variacaoValor,
      variacaoPercent,
      pedidosP1: r.qp1,
      pedidosP2: r.qp2,
      ticketMedioP1: r.qp1 > 0 ? r.p1 / r.qp1 : 0,
      ticketMedioP2: r.qp2 > 0 ? r.p2 / r.qp2 : 0,
      ultimaCompra: r.ultima,
      diasSemCompra,
      risco: classificarRisco(r.p1, r.p2),
    });
  }
  return out.sort((a, b) => a.variacaoValor - b.variacaoValor);
}

// ---------------------------------------------------------------------------
// Situação do cliente — linguagem simples (substitui "risco P1 x P2")
// ---------------------------------------------------------------------------
export type SituacaoCliente = 'parou' | 'caiu_forte' | 'caiu_leve' | 'ok';

export function classificarSituacao(c: ClienteQueda): SituacaoCliente {
  if (c.faturamentoP2 > 0 && c.faturamentoP1 <= 0) return 'parou';
  if (c.faturamentoP2 <= 0) return 'ok';
  const varPct = ((c.faturamentoP1 - c.faturamentoP2) / c.faturamentoP2) * 100;
  if (varPct <= -40) return 'caiu_forte';
  if (varPct <= -10) return 'caiu_leve';
  return 'ok';
}

export const SITUACAO_LABEL: Record<SituacaoCliente, string> = {
  parou: 'Parou de comprar',
  caiu_forte: 'Caiu forte',
  caiu_leve: 'Caiu pouco',
  ok: 'Estável ou cresceu',
};

export const SITUACAO_COLOR: Record<SituacaoCliente, string> = {
  parou: 'hsl(0, 72%, 51%)',
  caiu_forte: 'hsl(24, 90%, 55%)',
  caiu_leve: 'hsl(38, 92%, 50%)',
  ok: 'hsl(142, 71%, 45%)',
};

export function formatarDataBR(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.substring(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function rotuloPeriodo(inicio: string, fim: string): string {
  return `${formatarDataBR(inicio)} a ${formatarDataBR(fim)}`;
}
