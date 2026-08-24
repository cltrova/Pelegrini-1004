import type { Pedido } from '@/types/comercial';

export type AutenticacaoStatus = 'autenticado' | 'divergente' | 'nao_encontrado' | 'extra_sistema';

export interface LinhaPlanilha {
  numero_pedido: string;
  cliente?: string;
  valor?: number;
  data?: string;
  raw?: Record<string, unknown>;
}

export interface ResultadoComparacao {
  numero_pedido: string;
  cliente_planilha?: string;
  cliente_sistema?: string;
  valor_planilha?: number;
  valor_sistema?: number;
  data?: string;
  status: AutenticacaoStatus;
  divergencias: string[];
}

export const TOLERANCIA_VALOR = 0.01;

export function normalizarNumeroPedido(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  if (!s) return '';
  // remove zeros à esquerda, espaços e caracteres não alfanuméricos comuns
  return s.replace(/^0+/, '').replace(/\s+/g, '').toUpperCase();
}

export function normalizarTexto(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseNumero(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const s = String(v).replace(/[^\d,.-]/g, '').trim();
  if (!s) return undefined;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}

export function detectarColunas(linhas: Record<string, unknown>[]): {
  numero?: string;
  cliente?: string;
  valor?: string;
  valor_venda?: string;
  valor_devolucao?: string;
  data?: string;
} {
  if (!linhas.length) return {};
  const keys = Object.keys(linhas[0]);
  const norm = (s: string) => normalizarTexto(s);
  const matchOne = (candidatos: string[]) =>
    keys.find(k => candidatos.some(c => norm(k).includes(c)));
  const matchExact = (candidatos: string[]) =>
    keys.find(k => candidatos.some(c => norm(k) === c));

  const valorLiquido = matchOne([
    'venda descontando devolucao', 'venda liquida', 'venda - devolucao',
  ]) ?? matchOne(['liquido']);
  const valorVenda = matchExact(['venda', 'vendas', 'valor venda', 'valor de venda']);
  const valorDevolucao = matchOne(['devolucao', 'devolucoes']);

  return {
    numero: matchOne([
      'numero do pedido', 'num pedido', 'numero pedido', 'nro pedido', 'nr pedido',
      'pedido', 'nota fiscal', 'num nf', 'documento',
    ]) ?? matchExact(['nf', 'numero']),
    cliente: matchOne(['cliente', 'razao social', 'razao', 'nome do cliente', 'destinatario']),
    valor: valorLiquido ?? matchOne(['valor total', 'total geral', 'valor liquido', 'valor bruto', 'total', 'valor']) ?? valorVenda,
    valor_venda: valorVenda,
    valor_devolucao: valorDevolucao,
    data: matchOne(['data movimento', 'data do pedido', 'data pedido', 'data emissao', 'data emissão', 'emissao', 'data']),
  };
}

interface PedidoAgregado {
  numero: string;
  cliente: string;
  valor_bruto: number;
  valor_liquido: number;
  ocorrencias: number;
}

/**
 * Agrega pedidos do sistema por número (ignorando devoluções),
 * somando valores quando há múltiplas linhas para o mesmo pedido.
 * Também indexa por número da NF como fallback.
 */
function indexarPedidosSistema(pedidosSistema: Pedido[]) {
  const porNumero = new Map<string, PedidoAgregado>();
  const porNF = new Map<string, PedidoAgregado>();

  for (const p of pedidosSistema) {
    if (p.tipo === 'DEVOLUCAO') continue;

    const numero = normalizarNumeroPedido(p.numero ?? p.id);
    const nf = normalizarNumeroPedido(p.num_nf);
    if (!numero && !nf) continue;

    const cliente = String(p.cliente_razao || p.cliente_fantasia || p.cliente_codigo || '').trim();
    const vb = Number(p.valor_bruto ?? 0);
    const vl = Number(p.valor_liquido ?? 0);

    const upsert = (mapa: Map<string, PedidoAgregado>, key: string) => {
      if (!key) return;
      const cur = mapa.get(key);
      if (cur) {
        cur.valor_bruto += vb;
        cur.valor_liquido += vl;
        cur.ocorrencias += 1;
        if (!cur.cliente && cliente) cur.cliente = cliente;
      } else {
        mapa.set(key, { numero: key, cliente, valor_bruto: vb, valor_liquido: vl, ocorrencias: 1 });
      }
    };

    upsert(porNumero, numero);
    upsert(porNF, nf);
  }

  return { porNumero, porNF };
}

export function compararLinhas(
  linhasPlanilha: LinhaPlanilha[],
  pedidosSistema: Pedido[]
): ResultadoComparacao[] {
  const { porNumero, porNF } = indexarPedidosSistema(pedidosSistema);

  const usados = new Set<string>();
  const resultados: ResultadoComparacao[] = [];

  for (const linha of linhasPlanilha) {
    const num = normalizarNumeroPedido(linha.numero_pedido);
    if (!num) continue;

    const sistema = porNumero.get(num) ?? porNF.get(num);
    if (!sistema) {
      resultados.push({
        numero_pedido: linha.numero_pedido,
        cliente_planilha: linha.cliente,
        valor_planilha: linha.valor,
        data: linha.data,
        status: 'nao_encontrado',
        divergencias: ['Pedido não encontrado no sistema'],
      });
      continue;
    }
    usados.add(sistema.numero);

    // Compara valor da planilha contra o "valor total" do sistema.
    // Aceita match com valor_bruto OU valor_liquido (alguns clientes exportam um, outros outro).
    const valorSistemaBruto = sistema.valor_bruto;
    const valorSistemaLiquido = sistema.valor_liquido;
    const valorSistemaPrincipal = valorSistemaBruto || valorSistemaLiquido;

    const divergencias: string[] = [];

    if (linha.valor !== undefined) {
      const diffBruto = Math.abs((linha.valor ?? 0) - valorSistemaBruto);
      const diffLiquido = Math.abs((linha.valor ?? 0) - valorSistemaLiquido);
      if (diffBruto > TOLERANCIA_VALOR && diffLiquido > TOLERANCIA_VALOR) {
        divergencias.push(
          `Valor difere: planilha R$ ${linha.valor.toFixed(2)} × sistema bruto R$ ${valorSistemaBruto.toFixed(2)} / líquido R$ ${valorSistemaLiquido.toFixed(2)}`
        );
      }
    }

    if (linha.cliente && sistema.cliente) {
      const a = normalizarTexto(linha.cliente);
      const b = normalizarTexto(sistema.cliente);
      // considera ok se um contém o outro (razão social vs fantasia)
      if (a && b && !a.includes(b) && !b.includes(a)) {
        divergencias.push(`Cliente difere: "${linha.cliente}" × "${sistema.cliente}"`);
      }
    }

    resultados.push({
      numero_pedido: linha.numero_pedido,
      cliente_planilha: linha.cliente,
      cliente_sistema: sistema.cliente || undefined,
      valor_planilha: linha.valor,
      valor_sistema: valorSistemaPrincipal,
      data: linha.data,
      status: divergencias.length ? 'divergente' : 'autenticado',
      divergencias,
    });
  }

  // Extras: pedidos do sistema que não apareceram na planilha
  for (const [num, p] of porNumero.entries()) {
    if (usados.has(num)) continue;
    resultados.push({
      numero_pedido: num,
      cliente_sistema: p.cliente || undefined,
      valor_sistema: p.valor_bruto || p.valor_liquido,
      status: 'extra_sistema',
      divergencias: ['Pedido existe no sistema mas não está na planilha'],
    });
  }

  return resultados;
}

// ============================================================
// Modo "por cliente" — quando a planilha é um relatório agregado
// (CLIENTE, VENDA, DEVOLUÇÃO, VENDA DESCONTANDO DEVOLUÇÃO, DATA MOVIMENTO)
// e não contém número de pedido. Comparamos totais líquidos por cliente
// (opcionalmente quebrados por data).
// ============================================================

export interface LinhaPlanilhaCliente {
  cliente: string;
  valor_venda?: number;
  valor_devolucao?: number;
  valor_liquido: number;
  data?: string;
  raw?: Record<string, unknown>;
}

/**
 * Extrai um possível código de cliente do início do texto.
 * Casa padrões como "C2116 - NOME", "2116 NOME", "002116-NOME".
 */
export function extrairCodigoCliente(raw: string): string | undefined {
  if (!raw) return undefined;
  const m = raw.trim().match(/^([A-Z]?\s*0*\d{1,10})\b/i);
  if (!m) return undefined;
  const cod = m[1].replace(/[^0-9A-Za-z]/g, '').replace(/^0+/, '').toUpperCase();
  return cod || undefined;
}

function normalizarCodigoCliente(raw: unknown): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  const cod = String(raw).trim().replace(/[^0-9A-Za-z]/g, '').replace(/^0+/, '').toUpperCase();
  return cod || undefined;
}

function variantesCodigoCliente(raw: unknown): string[] {
  const cod = normalizarCodigoCliente(raw);
  if (!cod) return [];
  const variantes = new Set<string>([cod]);
  const apenasNumeros = cod.replace(/^[A-Z]+/, '').replace(/^0+/, '');
  if (apenasNumeros) variantes.add(apenasNumeros);
  return Array.from(variantes);
}

function chavesCliente(cliente: string, data?: string): { codigo?: string; texto: string; dataKey?: string } {
  const codigo = extrairCodigoCliente(cliente);
  // remove o prefixo de código para casar o nome também
  const semCodigo = cliente.replace(/^[A-Z]?\s*0*\d{1,10}\s*[-–—:]?\s*/i, '');
  const texto = normalizarTexto(semCodigo || cliente);
  return { codigo, texto, dataKey: data };
}

export function compararPorCliente(
  linhasPlanilha: LinhaPlanilhaCliente[],
  pedidosSistema: Pedido[],
  opts: { porData?: boolean } = {}
): ResultadoComparacao[] {
  const porData = !!opts.porData;

  type Agreg = {
    cliente: string;
    codigo?: string;
    data?: string;
    venda: number;
    devolucao: number;
    liquido: number;
  };

  // Indexamos sistema por código E por nome normalizado (com data se aplicável)
  const porCodigo = new Map<string, Agreg>();
  const porNome = new Map<string, Agreg>();

  const keyData = (d?: string) => (porData && d ? `|${d}` : '');

  for (const p of pedidosSistema) {
    const nome = String(p.cliente_razao || p.cliente_fantasia || '').trim();
    const codigoRaw = String(p.cliente_codigo ?? '').trim();
    const codigo = normalizarCodigoCliente(codigoRaw);
    if (!nome && !codigo) continue;

    const data = porData ? (p.data_pedido || p.data_faturamento)?.slice(0, 10) : undefined;
    const vl = Number(p.valor_liquido ?? p.valor_bruto ?? 0);
    const isDev = p.tipo === 'DEVOLUCAO';
    const dv = isDev ? Math.abs(Number(p.valor_devolucao_real ?? vl ?? 0)) : 0;

    const apply = (cur: Agreg) => {
      if (isDev) {
        cur.devolucao += dv;
        cur.liquido -= dv;
      } else {
        cur.venda += vl;
        cur.liquido += vl;
      }
    };

    for (const codigoKey of variantesCodigoCliente(codigoRaw)) {
      const k = `${codigoKey}${keyData(data)}`;
      const cur = porCodigo.get(k) ?? { cliente: nome || codigoKey, codigo: codigoKey, data, venda: 0, devolucao: 0, liquido: 0 };
      if (!cur.cliente && nome) cur.cliente = nome;
      apply(cur);
      porCodigo.set(k, cur);
    }
    if (nome) {
      const k = `${normalizarTexto(nome)}${keyData(data)}`;
      const cur = porNome.get(k) ?? { cliente: nome, codigo, data, venda: 0, devolucao: 0, liquido: 0 };
      apply(cur);
      porNome.set(k, cur);
    }
  }

  const usadosCodigo = new Set<string>();
  const usadosNome = new Set<string>();
  const resultados: ResultadoComparacao[] = [];

  for (const l of linhasPlanilha) {
    if (!l.cliente) continue;
    const { codigo, texto } = chavesCliente(l.cliente);
    const data = porData ? l.data : undefined;

    let s: Agreg | undefined;
    let matchKind: 'codigo' | 'nome' | undefined;
    for (const codigoKey of variantesCodigoCliente(codigo)) {
      const k = `${codigoKey}${keyData(data)}`;
      s = porCodigo.get(k);
      if (s) { usadosCodigo.add(k); matchKind = 'codigo'; break; }
    }
    if (!s && texto) {
      const k = `${texto}${keyData(data)}`;
      s = porNome.get(k);
      if (s) { usadosNome.add(k); matchKind = 'nome'; }
    }

    const rotulo = porData && l.data ? `${l.cliente} · ${l.data}` : l.cliente;

    if (!s) {
      resultados.push({
        numero_pedido: rotulo,
        cliente_planilha: l.cliente,
        valor_planilha: l.valor_liquido,
        data: l.data,
        status: 'nao_encontrado',
        divergencias: [`Cliente não encontrado no sistema${codigo ? ` (código ${codigo})` : ''}`],
      });
      continue;
    }

    // marca uso também no índice paralelo, para evitar duplicar como "extra"
    for (const codigoKey of variantesCodigoCliente(s.codigo)) usadosCodigo.add(`${codigoKey}${keyData(s.data)}`);
    if (s.cliente) usadosNome.add(`${normalizarTexto(s.cliente)}${keyData(s.data)}`);

    const divergencias: string[] = [];
    const tolerancia = Math.max(TOLERANCIA_VALOR, Math.abs(l.valor_liquido) * 0.001);
    const diff = Math.abs(l.valor_liquido - s.liquido);
    if (diff > tolerancia) {
      divergencias.push(
        `Líquido difere em R$ ${diff.toFixed(2)} (planilha R$ ${l.valor_liquido.toFixed(2)} × sistema R$ ${s.liquido.toFixed(2)})`
      );
    }
    if (l.valor_venda !== undefined && Math.abs(l.valor_venda - s.venda) > tolerancia) {
      divergencias.push(`Venda difere: planilha R$ ${l.valor_venda.toFixed(2)} × sistema R$ ${s.venda.toFixed(2)}`);
    }
    if (l.valor_devolucao !== undefined && Math.abs(l.valor_devolucao - s.devolucao) > tolerancia) {
      divergencias.push(`Devolução difere: planilha R$ ${l.valor_devolucao.toFixed(2)} × sistema R$ ${s.devolucao.toFixed(2)}`);
    }
    void matchKind;

    resultados.push({
      numero_pedido: rotulo,
      cliente_planilha: l.cliente,
      cliente_sistema: s.cliente,
      valor_planilha: l.valor_liquido,
      valor_sistema: s.liquido,
      data: l.data ?? s.data,
      status: divergencias.length ? 'divergente' : 'autenticado',
      divergencias,
    });
  }

  // Extras: clientes do sistema não consumidos (usamos o índice por código quando houver)
  const vistos = new Set<string>();
  for (const [k, s] of porCodigo.entries()) {
    if (usadosCodigo.has(k)) continue;
    if (Math.abs(s.liquido) < TOLERANCIA_VALOR) continue;
    const id = (s.codigo ?? '') + '|' + (s.cliente ?? '') + keyData(s.data);
    if (vistos.has(id)) continue;
    vistos.add(id);
    const rotulo = porData && s.data ? `${s.cliente} · ${s.data}` : s.cliente;
    resultados.push({
      numero_pedido: rotulo,
      cliente_sistema: s.cliente,
      valor_sistema: s.liquido,
      status: 'extra_sistema',
      divergencias: ['Cliente movimentou no sistema mas não está na planilha'],
    });
  }
  for (const [k, s] of porNome.entries()) {
    if (usadosNome.has(k)) continue;
    if (s.codigo && usadosCodigo.has(`${s.codigo}${keyData(s.data)}`)) continue;
    if (Math.abs(s.liquido) < TOLERANCIA_VALOR) continue;
    const id = (s.codigo ?? '') + '|' + (s.cliente ?? '') + keyData(s.data);
    if (vistos.has(id)) continue;
    vistos.add(id);
    const rotulo = porData && s.data ? `${s.cliente} · ${s.data}` : s.cliente;
    resultados.push({
      numero_pedido: rotulo,
      cliente_sistema: s.cliente,
      valor_sistema: s.liquido,
      status: 'extra_sistema',
      divergencias: ['Cliente movimentou no sistema mas não está na planilha'],
    });
  }

  return resultados;
}
