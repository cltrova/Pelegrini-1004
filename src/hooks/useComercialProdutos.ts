import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildApiProxyUrl } from '@/utils/apiEndpointResolver';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { filtrarPorFilial, filtrarPorEquipePadrao } from '@/utils/filialFilter';
import { resolveComercialEndpointPath, resolveComercialJsonPath, resolveCodEmpresaBiParam } from '@/utils/filialEndpoint';
import { readJsonOrFallback } from '@/utils/safeJsonResponse';
import {
  calcularValorDevolucaoReceita1004,
  corrigirVendedorAusente1004,
  criarResolvedorVendedoresChevrolet10041,
  EQUIPE_PRINCIPAL_1004_CODES,
  getFiltroVendedoresChevrolet10041,
  getVendedorCasaChevrolet10041FromRecord,
  isServicoForaRelatorioChevrolet10041,
  isContextoChevrolet10041 as isContextoChevrolet10041Util,
  RECEITA_1004_RULE_VERSION,
  vendedorForcaP1004,
  vendedorMatchesFiltro1004,
  vendedorNaoComissionavel1004,
  vendedorPertenceRelatorioChevrolet10041,
} from '@/utils/vendedores1004';
import type { Empresa } from '@/hooks/useEmpresaConfig';
import type {
  ProdutoItem,
  TopProdutoAgg,
  CategoriaAgg,
  ProdutoSemGiro,
  MarcaAgg,
  ResumoVendaLinha,
  ResumoVendedor,
  ClienteGrupoLinha,
} from '@/types/comercialProdutos';
import type { ComercialFilters } from '@/types/comercial';

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function getField<T = any>(item: any, ...keys: string[]): T | undefined {
  for (const k of keys) {
    if (item?.[k] !== undefined && item?.[k] !== null && item?.[k] !== '') {
      return item[k] as T;
    }
  }
  return undefined;
}

function parseNum(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const cleaned = value.replace(/[^\d,.-]/g, '').trim();
  if (!cleaned) return 0;
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function sanitizeJsonText(text: string): string {
  let s = text.replace(/^\uFEFF/, '');
  s = s.replace(/\r\n/g, '').replace(/\r/g, '').replace(/\n/g, '');
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  return s;
}

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (isNaN(d.getTime())) return isoDate;
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function getFiltroVendedoresSemEquipeCt10041(
  vendedores: ComercialFilters['vendedores'] | undefined,
  codEmpresa: unknown,
  filialAtiva?: unknown,
): string[] | undefined {
  const cod = String(codEmpresa ?? '').trim();
  const isContexto10041 = cod === '10041' || (cod === '1004' && String(filialAtiva ?? '').trim() === 'chevrolet');
  const selecionados = (vendedores || []).map((v) => String(v).trim()).filter(Boolean);

  if (!isContexto10041) return selecionados.length > 0 ? selecionados : undefined;

  return getFiltroVendedoresChevrolet10041(selecionados, codEmpresa, filialAtiva);
}

function getFiltroVendedorSemEquipeCt10041(
  vendedor: ComercialFilters['vendedor'] | undefined,
  codEmpresa: unknown,
  filialAtiva?: unknown,
): string | undefined {
  if (vendedor === undefined || vendedor === null || vendedor === '') return undefined;
  const codigo = String(vendedor).trim();
  const cod = String(codEmpresa ?? '').trim();
  const isContexto10041 = cod === '10041' || (cod === '1004' && String(filialAtiva ?? '').trim() === 'chevrolet');
  if (!isContexto10041) return codigo;
  if (EQUIPE_PRINCIPAL_1004_CODES.includes(codigo)) return undefined;
  return codigo;
}

function isEmpresaPelegrini1004Like(codEmpresa: unknown): boolean {
  const cod = String(codEmpresa ?? '').trim();
  return cod === '1004' || cod === '10041';
}

function normalizeDateKey(value: unknown): string {
  if (value == null) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  const isoMatch = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];

  const brMatch = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;

  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return '';
  return parsed.toISOString().split('T')[0];
}

function isDateWithinPeriodo(value: unknown, inicio?: string, fim?: string): boolean {
  const dateKey = normalizeDateKey(value);
  if (!dateKey || !inicio || !fim) return false;
  return dateKey >= inicio && dateKey <= fim;
}

function textMatch(value: unknown, target: unknown): boolean {
  const a = String(value ?? '').trim();
  const b = String(target ?? '').trim();
  if (!a || !b) return false;
  return a === b || a.toUpperCase() === b.toUpperCase();
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function isLinhaResumoTotaisProduto(p: ProdutoItem): boolean {
  const fields = [
    p.cod_pedido,
    p.num_nf,
    p.cod_produto,
    p.descricao,
    p.cliente_razao,
    p.vendedor_nome,
    p.grupo,
    p.marca,
  ];
  return fields.some((field) => {
    const text = normalizeText(field);
    return text === 'TOTAL' || text === 'TOTAIS' || text.startsWith('TOTAIS ');
  });
}

function isCfopExcluidoReceita1004(p: ProdutoItem): boolean {
  const cfop = String((p as any).cfop ?? '').replace(/[^\d]/g, '');
  return cfop === '6933';
}

function isVendaSemPedidoValido1004(p: ProdutoItem): boolean {
  if (p.tipo === 'DEVOLUCAO') return false;
  const codPedido = String(p.cod_pedido ?? '').trim();
  return !codPedido || codPedido === '0';
}

interface ReceitaComissao1004Linha {
  codigo: string;
  nome: string;
  qtdFat: number;
  faturadoAteHoje: number;
  devolucaoVenda: number;
  stVenda: number;
  raw: Record<string, unknown>;
}

type ReceitaOficial1004Linha = {
  codigo: string;
  nome: string;
  receita: number;
  devolucoes: number;
  qtdFat: number;
  raw: Record<string, unknown>;
};

type DetalheReceita1004Linha = {
  codigo?: string;
  nome?: string;
  total: number;
  devolucoes?: number;
  qtdFat?: number;
  corrigido: number;
};

const VENDEDORES_COMPLEMENTARES_COMISSAO_CHEVROLET_10041 = new Set(['59']);

export function resolveComissao1004Path(isContextoChevrolet10041Ativo: boolean): string {
  return isContextoChevrolet10041Ativo ? '/comercial/comissoes_ch' : '/comercial/comissoes';
}

export function calcularReceitaComissaoOficial1004(
  linha: Pick<ReceitaComissao1004Linha, 'faturadoAteHoje' | 'stVenda'>,
  isContextoChevrolet10041Ativo: boolean,
  cfop6933 = 0,
): number {
  if (isContextoChevrolet10041Ativo) return linha.faturadoAteHoje;
  return linha.faturadoAteHoje + linha.stVenda - cfop6933;
}

export function resolverReceitaComissaoOficial1004(params: {
  receitaBase: number;
  detalhe?: { total: number; corrigido: number };
  isContextoChevrolet10041Ativo: boolean;
}): number {
  if (params.isContextoChevrolet10041Ativo) return params.receitaBase;

  const detalhe = params.detalhe;
  const diffDetalhe = detalhe ? detalhe.total - params.receitaBase : 0;
  return detalhe && detalhe.corrigido > 0 && Math.abs(diffDetalhe - detalhe.corrigido) < 0.02
    ? detalhe.total
    : params.receitaBase;
}

export function deveAplicarFiltroOcultosTotalizador1004(
  excluirVendedoresOcultos1004: boolean | undefined,
  isContextoChevrolet10041Ativo: boolean,
): boolean {
  return !!excluirVendedoresOcultos1004 && !isContextoChevrolet10041Ativo;
}

export function completarReceitaOficialChevrolet10041(
  receitaOficial: Map<string, ReceitaOficial1004Linha>,
  detalhePorVendedor: Map<string, DetalheReceita1004Linha>,
  isContextoChevrolet10041Ativo: boolean,
): Map<string, ReceitaOficial1004Linha> {
  if (!isContextoChevrolet10041Ativo) return receitaOficial;

  const resultado = new Map(receitaOficial);
  for (const codigo of VENDEDORES_COMPLEMENTARES_COMISSAO_CHEVROLET_10041) {
    if (resultado.has(codigo)) continue;

    const detalhe = detalhePorVendedor.get(codigo);
    if (!detalhe || Math.abs(detalhe.total) <= 0.009) continue;

    resultado.set(codigo, {
      codigo,
      nome: detalhe.nome || detalhe.codigo || codigo,
      receita: detalhe.total,
      devolucoes: Math.abs(detalhe.devolucoes || 0),
      qtdFat: Number(detalhe.qtdFat || 0),
      raw: { origem: 'produtos_complementar_cch' },
    });
  }

  return resultado;
}

export function normalizarFiltroVendedoresReceitaOficial1004(
  vendedores: Array<string | number> | undefined,
  receitaOficial: Map<string, ReceitaOficial1004Linha>,
  isContextoChevrolet10041Ativo: boolean,
): string[] | undefined {
  const selecionados = (vendedores || []).map((v) => String(v).trim()).filter(Boolean);
  if (selecionados.length === 0) return undefined;
  if (!isContextoChevrolet10041Ativo) return selecionados;

  const codigosReceita = Array.from(receitaOficial.keys());
  if (codigosReceita.length === 0) return selecionados;

  const setSelecionados = new Set(selecionados);
  const faltantes = codigosReceita.filter((codigo) => !setSelecionados.has(codigo));
  const todosSelecionadosSaoDaReceita = selecionados.every((codigo) => receitaOficial.has(codigo));
  const faltamSomenteComplementares = faltantes.length > 0
    && faltantes.every((codigo) => VENDEDORES_COMPLEMENTARES_COMISSAO_CHEVROLET_10041.has(codigo));
  const cobreBaseSemComplementares = selecionados.length >= codigosReceita.length - faltantes.length;

  return todosSelecionadosSaoDaReceita && faltamSomenteComplementares && cobreBaseSemComplementares
    ? undefined
    : selecionados;
}

function pickInsensitive(row: Record<string, unknown>, ...keys: string[]): unknown {
  const normalizeKey = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();

  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
    const normalizedTarget = normalizeKey(key);
    const found = Object.keys(row).find((candidate) =>
      candidate.toLowerCase() === key.toLowerCase() || normalizeKey(candidate) === normalizedTarget
    );
    if (found && row[found] !== undefined && row[found] !== null && row[found] !== '') return row[found];
  }
  return undefined;
}

function looksLikeCodigoVendedor1004(value: unknown): boolean {
  return /^\d+$/.test(String(value ?? '').trim());
}

export function normalizeComissao1004(row: Record<string, unknown>): ReceitaComissao1004Linha {
  const codigoDireto = pickInsensitive(row, 'cod_vendedor', 'CodVendedor', 'COD VENDEDOR', 'codigo', 'CodigoVendedor', 'Codigo Vendedor');
  const vendedorGenerico = pickInsensitive(row, 'Vendedor', 'vendedor', 'VENDEDOR');
  const codigo = codigoDireto ?? (looksLikeCodigoVendedor1004(vendedorGenerico) ? vendedorGenerico : '');
  const nome = pickInsensitive(row, 'NomeVendedor', 'nome_vendedor', 'vendedor_nome', 'VendedorNome', 'nome', 'Vendedor', 'VENDEDOR');

  return {
    codigo: String(codigo ?? '').trim(),
    nome: String(nome ?? '').trim(),
    qtdFat: parseNum(pickInsensitive(row, 'Qtd', 'QTD', 'Quantidade', 'quantidade', 'qtd', 'Qtde', 'QTDE')),
    faturadoAteHoje: parseNum(pickInsensitive(row, 'Acumulada', 'acumulada', 'valor_acumulado', 'ValorAcumulado', 'FaturadoAteHoje', 'faturado_ate_hoje', 'faturado')),
    devolucaoVenda: parseNum(pickInsensitive(row, 'DevolucaoSemST', 'Devolucao Venda', 'DEVOLUCAO VENDA', 'devolucao_venda', 'DevolucaoVenda', 'devolucao', 'Devolucao', 'ValorDevolucao')),
    stVenda: parseNum(pickInsensitive(row, 'STVenda', 'ST VENDA', 'st_venda', 'valor_st_venda')),
    raw: row,
  };
}

function getProdutoUniqueKey(p: ProdutoItem): string {
  // Chave técnica oficial do item (Pelegrini 1004/10041):
  //   cod_empresa + cod_documento + num_lancamento
  // O campo num_lancamento é obrigatório para diferenciar lançamentos reais
  // dentro do mesmo pedido/produto. Nunca colapsar linhas por cod_pedido+cod_produto.
  const anyP = p as any;
  const codEmpresa = anyP.cod_empresa_bi ?? anyP.filial_codigo ?? '';
  const codDocumento = anyP.cod_documento ?? anyP.cod_pedido ?? anyP.num_nf ?? '';
  const numLanc = anyP.num_lancamento ?? '';
  if (String(numLanc).trim() !== '') {
    return [codEmpresa, codDocumento, numLanc].map(v => normalizeText(v)).join('|');
  }
  // Fallback (compatibilidade com fontes antigas que não retornam num_lancamento):
  // usar id do item + tipo para não colapsar linhas distintas.
  return [
    codEmpresa,
    codDocumento,
    anyP.id ?? '',
    p.cod_produto,
    p.tipo,
    p.quantidade,
    p.valor_liquido_final_item ?? p.valor_total,
  ].map(value => normalizeText(value)).join('|');
}

function produtoMatchesVendedor1005(p: ProdutoItem, target: unknown): boolean {
  const anyP = p as any;
  return [
    p.vendedor_codigo,
    p.vendedor_nome,
    anyP.cod_vendedor_externo,
    anyP.vendedor_externo,
    anyP.nome_externo,
    anyP.cod_vendedor_interno,
    anyP.vendedor_interno,
    anyP.nome_interno,
    anyP.cod_vendedor_meta,
    anyP.vendedor_meta,
  ].some(value => textMatch(value, target));
}

function produtoMatchesVendedor(p: ProdutoItem, target: unknown): boolean {
  const anyP = p as any;
  return [
    p.vendedor_codigo,
    p.vendedor_nome,
    p.nome_interno,
    p.nome_externo,
    anyP.vendedor_interno,
    anyP.vendedor_externo,
    anyP.cod_vendedor_interno,
    anyP.cod_vendedor_externo,
  ].some(value => textMatch(value, target));
}

function produtoMatchesVendedorEmpresa(p: ProdutoItem, target: unknown, codEmpresaAtiva?: string): boolean {
  const codEmpresa = String(codEmpresaAtiva ?? '').trim();
  if (codEmpresa === '10041') {
    const vendedor = getVendedorProduto10041(p);
    return vendedor.codigo !== 'SEM_VENDEDOR' && vendedorMatchesFiltro1004(vendedor, target);
  }
  if (codEmpresa === '1004' || codEmpresa === '10041') {
    const candidatos = [
      { codigo: (p as any).vendedor_codigo ?? (p as any).cod_vendedor, nome: (p as any).vendedor_nome ?? (p as any).vendedor },
      { codigo: (p as any).cod_vendedor_chevrolet, nome: (p as any).vendedor_chevrolet },
      { codigo: (p as any).cod_vendedor_cch, nome: (p as any).vendedor_cch },
      { codigo: (p as any).cod_vendedor_comissao, nome: (p as any).vendedor_comissao },
      { codigo: (p as any).cod_vendedor_interno, nome: (p as any).nome_interno ?? (p as any).vendedor_interno },
      { codigo: (p as any).cod_vendedor_externo, nome: (p as any).nome_externo ?? (p as any).vendedor_externo },
      { codigo: (p as any).cod_vendedor_meta, nome: (p as any).vendedor_meta },
    ];
    return candidatos.some((vendedor) => vendedorMatchesFiltro1004(vendedor, target));
  }
  return produtoMatchesVendedor(p, target);
}

function getVendedorProduto10041(p: ProdutoItem): { codigo: string; nome: string } {
  return getVendedorCasaChevrolet10041FromRecord(p as unknown as Record<string, unknown>)
    || { codigo: 'SEM_VENDEDOR', nome: 'SEM VENDEDOR' };
}

function normalizeProduto(raw: any, empresaFromPath?: string): ProdutoItem {
  const vendedorCorrigido1004 = corrigirVendedorAusente1004(raw);
  const rawTipo = getField<string>(raw, 'tipo', 'Tipo', 'TIPO', 'tipo_movimento', 'TipoMovimento');
  const tipo: 'PEDIDO' | 'DEVOLUCAO' = rawTipo
    ? (rawTipo.toString().toUpperCase().startsWith('DEV') ? 'DEVOLUCAO' : 'PEDIDO')
    : 'PEDIDO';

  const qtdRaw = parseNum(getField(raw, 'quantidade', 'Quantidade', 'qtd', 'Qtd', 'qtde', 'Qtde'));
  const qtdDevolvidaRaw = parseNum(getField(raw, 'quantidade_devolvida', 'QuantidadeDevolvida', 'qtd_devolvida', 'QtdDevolvida'));
  const quantidade = tipo === 'DEVOLUCAO'
    ? -Math.abs(qtdDevolvidaRaw || qtdRaw)
    : Math.abs(qtdRaw);

  const valorUnit = parseNum(getField(raw, 'valor_unitario', 'ValorUnitario', 'Valor_Unitario', 'preco_unitario', 'PrecoUnitario'));

  // Campos brutos do ERP. Para a receita da 1004, ValorVenda ja vem liquido dos
  // descontos nos pedidos; devolucoes subtraem somente ValorDevolucao.
  const valorVenda = parseNum(getField(raw, 'ValorVenda', 'valor_venda', 'Valor_Venda', 'Vlr. Venda', 'Vlr Venda', 'VlrVenda'));
  const valorDevolucao = parseNum(getField(raw, 'valor_devolvido', 'ValorDevolvido', 'Valor_Devolvido', 'ValorDevolucao', 'valor_devolucao', 'Valor_Devolucao', 'Vlr. Devolução', 'Vlr Devolucao', 'VlrDevolucao'));
  const valorDescontoItem = parseNum(getField(raw, 'desconto_proporcional', 'DescontoProporcional', 'Desconto_Proporcional', 'ValorDescontoItem', 'valor_desconto_item', 'Valor_Desconto_Item', 'valor_desconto', 'ValorDesconto', 'Valor_Desconto', 'Desc. Item', 'Desc Item', 'DescItem'));
  const valorLiquidoFinalRawValue = getField(raw, 'valor_liquido', 'ValorLiquido', 'Valor_Liquido', 'ValorLiquidoFinal', 'valor_liquido_final', 'Valor_Liquido_Final', 'Vlr. Líq. Final', 'Vlr. Liq. Final', 'Vlr Liq Final', 'VlrLiqFinal', 'Valor Líquido Final', 'Valor Liquido Final');
  const valorLiquidoFinalRaw = parseNum(valorLiquidoFinalRawValue);
  const hasValorLiquidoFinalRaw = valorLiquidoFinalRawValue !== undefined && valorLiquidoFinalRawValue !== null && valorLiquidoFinalRawValue !== '';

  const valorTotalLegado = parseNum(getField(raw, 'valor_total', 'ValorTotal', 'Valor_Total', 'valor_real', 'Valor_Real', 'valor_liquido', 'ValorLiquido'));
  const cfopRaw = getField<string>(raw, 'num_cfop', 'NumCfop', 'num_CFOP', 'cfop', 'CFOP', 'Cfop', 'cod_cfop', 'CodCfop');
  const codEmpresaItem = String(getField(raw, 'CodEmpresa_bi', 'cod_empresa_bi', 'codEmpresaBi') ?? empresaFromPath ?? '').trim();
  const isPelegrini1004Item = codEmpresaItem === '1004' || codEmpresaItem === '10041';

  // Receita 1004: vendas somam ValorVenda; devolucoes subtraem a base liquida
  // validada no relatorio RSYS/FAT. ValorLiquidoFinal fica preservado para auditoria/exportacao.
  let valorLiquidoFinal: number;
  let valorTotalReceita: number;
  if (tipo === 'DEVOLUCAO') {
    const baseDev = hasValorLiquidoFinalRaw && valorLiquidoFinalRaw !== 0
      ? valorLiquidoFinalRaw
      : (valorDevolucao || valorTotalLegado);
    valorLiquidoFinal = -Math.abs(baseDev);
    valorTotalReceita = isPelegrini1004Item
      ? -calcularValorDevolucaoReceita1004({
        valorDevolucao,
        valorDescontoItem,
        valorTotalLegado,
        valorLiquidoFinalRaw,
        cfop: cfopRaw,
      })
      : valorLiquidoFinal;
  } else {
    valorLiquidoFinal = Math.abs(valorLiquidoFinalRaw)
      || Math.max(0, Math.abs(valorVenda) - Math.abs(valorDescontoItem))
      || Math.abs(valorTotalLegado);
    valorTotalReceita = isPelegrini1004Item && Number.isFinite(valorVenda) && valorVenda !== 0
      ? Math.abs(valorVenda)
      : valorLiquidoFinal;
  }

  const valorTotal = valorTotalReceita;
  const valorBrutoItem = tipo === 'DEVOLUCAO'
    ? -(Math.abs(valorVenda) || Math.abs(valorDevolucao) || Math.abs(valorTotalLegado))
    : (Math.abs(valorVenda) || Math.abs(valorTotalLegado));

  const valorTotalRaw = valorTotal;

  const numLancamento = getField(raw, 'num_lancamento', 'NumLancamento', 'Num_Lancamento', 'numero_lancamento', 'NumeroLancamento') as string | number | undefined;
  const codDocumento = getField(raw, 'cod_documento', 'CodDocumento', 'Cod_Documento', 'codigo_documento', 'CodigoDocumento') as string | number | undefined;
  const idRaw = getField(raw, 'id', 'ID', 'cod_item', 'CodItem');
  const idBase = idRaw ?? [
    getField(raw, 'cod_empresa', 'CodEmpresa') ?? '',
    codDocumento ?? getField(raw, 'cod_pedido', 'CodPedido') ?? '',
    numLancamento ?? '',
    getField(raw, 'cod_produto', 'CodProduto') ?? '',
  ].filter(v => v !== '' && v != null).join('-');

  return {
    id: String(idBase || `${Date.now()}-${Math.random()}`),
    cod_produto: (getField(raw, 'cod_produto', 'CodProduto', 'codigo_produto', 'CodigoProduto') ?? '') as string | number,
    descricao: (() => {
      const v = getField(raw,
        'produto', 'Produto',
        'descricao', 'Descricao',
        'desc_produto', 'DescProduto',
        'descricao_produto', 'DescricaoProduto',
        'nome_produto', 'NomeProduto',
        'descricao_item', 'DescricaoItem',
        'desc_item', 'DescItem',
        'produto_descricao', 'ProdutoDescricao',
        'descricao_mercadoria', 'DescricaoMercadoria',
        'nome', 'Nome'
      );
      const s = v == null ? '' : String(v).trim();
      if (s) return s;
      const cod = getField(raw, 'cod_produto', 'CodProduto', 'codigo_produto', 'CodigoProduto');
      return cod ? `Produto #${cod}` : 'Sem descrição';
    })(),
    cod_pedido: getField(raw, 'cod_pedido', 'CodPedido', 'Cód. Pedido', 'Cod. Pedido', 'Cod Pedido', 'CodigoPedido', 'Código Pedido', 'numero_pedido', 'NumPedido') as string | number | undefined,
    num_nf: getField<string>(raw, 'num_nf', 'NumNf', 'numero_nf', 'NumeroNF', 'numero_nota', 'NumeroNota', 'Numero_Nota', 'num_nota', 'NumNota'),
    // Campo bruto oficial do ERP Pelegrini (1004/10041) — usado no totalizador Vendas.
    NumeroNota: getField<string>(raw, 'NumeroNota'),


    // ERP Caspper (cliente 1004) usa data_movimento/data_documento no JSON de itens.
    data_pedido: getField<string>(raw, 'data_pedido', 'DataPedido', 'Data_Pedido', 'data_documento', 'DataDocumento'),
    data_faturamento: getField<string>(raw, 'data_faturamento', 'DataFaturamento', 'Data_Faturamento', 'data_movimento', 'DataMovimento'),

    cod_empresa_bi: codEmpresaItem,
    filial_codigo: getField(raw, 'cod_empresa', 'CodEmpresa', 'filial_codigo', 'CodFilial') as string | number | undefined,
    filial_nome: getField<string>(raw, 'Filial', 'filial', 'empresa', 'Empresa', 'filial_nome', 'NomeFilial'),

    tipo,

    categoria: getField<string>(raw, 'categoria', 'Categoria', 'categoria_produto', 'CategoriaProduto'),
    grupo: getField<string>(raw, 'grupo', 'Grupo', 'grupo_produto', 'GrupoProduto'),
    marca: (() => {
      const v = getField<string>(raw, 'descricao_marca', 'DescricaoMarca', 'desc_marca', 'DescMarca', 'nome_marca', 'NomeMarca', 'marca_descricao', 'MarcaDescricao', 'marca', 'Marca', 'marca_produto', 'MarcaProduto');
      if (v == null) return undefined;
      const s = String(v).trim();
      if (!s) return undefined;
      // Se vier apenas numérico, é o código — descartamos para usar somente descrição
      if (/^\d+$/.test(s)) return undefined;
      return s;
    })(),
    cod_marca: getField(raw, 'cod_marca', 'CodMarca', 'codigo_marca', 'CodigoMarca') as string | number | undefined,
    fabricante: getField<string>(raw, 'fabricante', 'Fabricante'),
    linha: getField<string>(raw, 'linha', 'Linha'),

    cliente_codigo: getField(raw, 'cod_cliente', 'CodCliente') as string | number | undefined,
    cliente_razao: getField<string>(raw, 'cliente', 'Cliente', 'cliente_razao', 'NomeCliente', 'RazaoSocial'),
    cliente_cidade: getField<string>(raw, 'cidade', 'Cidade', 'cliente_cidade'),
    cliente_uf: getField<string>(raw, 'uf', 'UF', 'estado', 'Estado', 'cliente_uf'),
    cod_grupo: getField(raw, 'cod_grupo', 'CodGrupo') as string | number | undefined,
    nome_grupo: getField<string>(raw, 'NomeGrupo', 'nome_grupo', 'grupo', 'Grupo'),

    vendedor_codigo: vendedorCorrigido1004?.codigo ?? getField(raw, 'cod_vendedor', 'CodVendedor') as string | number | undefined,
    vendedor_nome: vendedorCorrigido1004?.nome ?? getField<string>(raw, 'vendedor', 'Vendedor', 'vendedor_nome'),
    vendedor_corrigido_1004: !!vendedorCorrigido1004,
    cod_vendedor_chevrolet: getField(raw, 'cod_vendedor_chevrolet', 'CodVendedorChevrolet', 'cod_vendedor_ch', 'CodVendedorCH', 'cod_vendedor_cch', 'CodVendedorCCH', 'cod_vendedor_comissao', 'CodVendedorComissao') as string | number | undefined,
    vendedor_chevrolet: getField<string>(raw, 'vendedor_chevrolet', 'VendedorChevrolet', 'nome_vendedor_chevrolet', 'NomeVendedorChevrolet', 'vendedor_ch', 'VendedorCH', 'nome_vendedor_ch', 'NomeVendedorCH', 'vendedor_cch', 'VendedorCCH', 'nome_vendedor_cch', 'NomeVendedorCCH', 'vendedor_comissao', 'VendedorComissao', 'nome_vendedor_comissao', 'NomeVendedorComissao'),
    cod_vendedor_cch: getField(raw, 'cod_vendedor_cch', 'CodVendedorCCH', 'cod_vendedor_ch', 'CodVendedorCH') as string | number | undefined,
    vendedor_cch: getField<string>(raw, 'vendedor_cch', 'VendedorCCH', 'nome_vendedor_cch', 'NomeVendedorCCH', 'vendedor_ch', 'VendedorCH', 'nome_vendedor_ch', 'NomeVendedorCH'),
    cod_vendedor_comissao: getField(raw, 'cod_vendedor_comissao', 'CodVendedorComissao') as string | number | undefined,
    vendedor_comissao: getField<string>(raw, 'vendedor_comissao', 'VendedorComissao', 'nome_vendedor_comissao', 'NomeVendedorComissao'),
    cod_vendedor_representante: getField(raw, 'cod_vendedor_representante', 'CodVendedorRepresentante', 'cod_representante', 'CodRepresentante') as string | number | undefined,
    vendedor_representante: getField<string>(raw, 'vendedor_representante', 'VendedorRepresentante', 'nome_representante', 'NomeRepresentante', 'representante', 'Representante'),
    cod_vendedor_filial: getField(raw, 'cod_vendedor_filial', 'CodVendedorFilial') as string | number | undefined,
    vendedor_filial: getField<string>(raw, 'vendedor_filial', 'VendedorFilial', 'nome_vendedor_filial', 'NomeVendedorFilial'),
    cod_vendedor_origem: getField(raw, 'cod_vendedor_origem', 'CodVendedorOrigem') as string | number | undefined,
    vendedor_origem: getField<string>(raw, 'vendedor_origem', 'VendedorOrigem', 'nome_vendedor_origem', 'NomeVendedorOrigem'),
    nome_interno: getField<string>(raw, 'NomeInterno', 'nome_interno', 'VendedorInterno', 'Nome_Interno', 'Vendedor_Interno'),
    nome_externo: getField<string>(raw, 'NomeExterno', 'nome_externo', 'VendedorExterno', 'Nome_Externo', 'Vendedor_Externo'),
    vendedor_interno: getField<string>(raw, 'vendedor_interno', 'VendedorInterno', 'NomeInterno', 'nome_interno', 'Vendedor_Interno', 'Nome_Interno'),
    vendedor_externo: getField<string>(raw, 'vendedor_externo', 'VendedorExterno', 'NomeExterno', 'nome_externo', 'Vendedor_Externo', 'Nome_Externo'),
    cod_vendedor_interno: getField(raw, 'CodVendedorInterno', 'cod_vendedor_interno', 'Cod_Vendedor_Interno', 'CodVendInterno') as string | number | undefined,
    cod_vendedor_externo: getField(raw, 'CodVendedorExterno', 'cod_vendedor_externo', 'Cod_Vendedor_Externo', 'CodVendExterno') as string | number | undefined,
    vendedor_meta: getField<string>(raw, 'vendedor_meta', 'VendedorMeta', 'nome_vendedor_meta', 'NomeVendedorMeta', 'Vendedor_Meta', 'Nome_Vendedor_Meta'),
    cod_vendedor_meta: getField(raw, 'cod_vendedor_meta', 'CodVendedorMeta', 'codigo_vendedor_meta', 'Cod_Vendedor_Meta', 'CodVendMeta') as string | number | undefined,

    cod_meta: getField(raw, 'CodMeta', 'cod_meta') as string | number | undefined,
    valor_meta: parseNum(getField(raw, 'valor_meta', 'ValorMeta', 'Valor_Meta', 'meta_marca', 'MetaMarca', 'Meta_Marca')) || undefined,
    valor_meta_interno: parseNum(getField(raw, 'valor_meta_interno', 'ValorMetaInterno', 'Valor_Meta_Interno', 'meta_vendedor_interno', 'MetaVendedorInterno', 'Meta_Vendedor_Interno')) || undefined,
    valor_meta_externo: parseNum(getField(raw, 'valor_meta_externo', 'ValorMetaExterno', 'Valor_Meta_Externo', 'meta_vendedor_externo', 'MetaVendedorExterno', 'Meta_Vendedor_Externo')) || undefined,
    descricao_meta: getField<string>(raw, 'descricao_meta', 'DescricaoMeta', 'desc_meta', 'DescMeta'),
    cod_marca_meta_inicial: getField(raw, 'cod_marca_meta_inicial', 'CodMarcaMetaInicial', 'CodMarcaInicial') as string | number | undefined,
    cod_marca_meta_final: getField(raw, 'cod_marca_meta_final', 'CodMarcaMetaFinal', 'CodMarcaFinal') as string | number | undefined,

    quantidade,
    valor_unitario: valorUnit || (Math.abs(valorTotalRaw) && Math.abs(qtdRaw) ? Math.abs(valorTotalRaw) / Math.abs(qtdRaw) : 0),
    valor_total: valorTotal,
    valor_bruto_item: valorBrutoItem,
    valor_custo: parseNum(getField(raw, 'valor_custo', 'ValorCusto', 'Valor_Custo', 'custo', 'Custo')),
    valor_desconto: valorDescontoItem,
    valor_devolucao_item: valorDevolucao,
    valor_venda_item: valorVenda,
    valor_liquido_final_item: valorLiquidoFinal,
    valor_total_nf: parseNum(getField(raw, 'valor_total_nf', 'ValorTotalNf', 'Valor_Total_NF', 'ValorTotalNF')),
    valor_impostos: parseNum(getField(raw, 'impostos', 'Impostos', 'valor_impostos', 'ValorImpostos', 'Valor_Impostos')),
    margem: parseNum(getField(raw, 'margem', 'Margem', 'margem_percentual', 'MargemPercentual')),
    quantidade_devolvida: Math.abs(qtdDevolvidaRaw),
    cfop: cfopRaw,
    num_lancamento: numLancamento,
    cod_documento: codDocumento,
    cod_documento_origem: getField(raw, 'cod_documento_origem', 'CodDocumentoOrigem', 'documento_origem', 'DocumentoOrigem', 'num_documento_origem', 'NumDocumentoOrigem') as string | number | undefined,
    num_nf_origem: getField(raw, 'num_nf_origem', 'NumNfOrigem', 'NumNFOrigem', 'nf_origem', 'NfOrigem', 'nota_origem', 'NotaOrigem', 'numero_nf_origem', 'NumeroNFOrigem') as string | number | undefined,
    cod_pedido_origem: getField(raw, 'cod_pedido_origem', 'CodPedidoOrigem', 'pedido_origem', 'PedidoOrigem', 'num_pedido_origem', 'NumPedidoOrigem') as string | number | undefined,



  };
}

// ----------------------------------------------------------------
// Fetch
// ----------------------------------------------------------------

async function fetchFromStorage(storagePath: string): Promise<ProdutoItem[]> {
  console.log(`[ComercialProdutos] Storage: ${storagePath}`);
  const empresaFromPath = storagePath.split('/')[0];
  const { data, error } = await supabase.storage.from('dados-json').download(storagePath);
  if (error) throw error;
  if (!data) return [];
  const text = await data.text();
  const json = JSON.parse(sanitizeJsonText(text));
  const arr: any[] = Array.isArray(json) ? json : (json.produtos || json.Produtos || json.itens || json.Itens || []);
  return arr.map(r => normalizeProduto(r, empresaFromPath));
}

async function fetchFromEndpoint(empresa: Empresa, periodo?: { inicio: string; fim: string }, filialAtiva?: string | null): Promise<ProdutoItem[]> {
  const basePath = resolveComercialEndpointPath('produtos', empresa, filialAtiva);
  const usaVps = !!empresa.usar_vps_intermediaria;

  const [pathOnly, existingQuery = ''] = basePath.split('?');
  const timeoutMs = usaVps ? 145000 : 30000;

  // Fallback: ÚLTIMO MÊS FECHADO (evita cair em mês corrente vazio na API/VPS)
  const hoje = new Date();
  const _pad = (n: number) => String(n).padStart(2, '0');
  const _toLocal = (d: Date) => `${d.getFullYear()}-${_pad(d.getMonth() + 1)}-${_pad(d.getDate())}`;
  const _primeiroMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const _ultimoDiaMesAnt = new Date(_primeiroMesAtual.getTime() - 24 * 60 * 60 * 1000);
  const _primeiroDiaMesAnt = new Date(_ultimoDiaMesAnt.getFullYear(), _ultimoDiaMesAnt.getMonth(), 1);
  const ini = periodo?.inicio || _toLocal(_primeiroDiaMesAnt);
  const fim = periodo?.fim || _toLocal(_ultimoDiaMesAnt);

  const codBiParam = resolveCodEmpresaBiParam(empresa, filialAtiva);
  const codEmpresaConfig = String(empresa.cod_empresa_bi ?? '').trim();
  const isPelegrini1004Config = codEmpresaConfig === '1004' || codEmpresaConfig === '10041';
  const keyIni = usaVps || codEmpresaConfig === '1003' || isPelegrini1004Config ? 'data_ini' : 'data_inicio';

  // Log da URL upstream final (útil para diagnosticar roteamento VPS/proxy)
  {
    const debugBase = usaVps
      ? `${(empresa.vps_base_url || '').replace(/\/+$/, '')}/${(empresa.vps_cliente_identificador || '').replace(/^\/+|\/+$/g, '')}`
      : (empresa.endpoint_url || '');
    const debugCodBi = codBiParam ? `&cod_empresa_bi=${codBiParam}` : '';
    console.log(`[ComercialProdutos] URL final upstream: ${debugBase}${pathOnly}?${keyIni}=${ini}&data_fim=${fim}&page_size=5000${debugCodBi}`);
  }

  const buildUrl = (di: string, df: string, page: number, pageSize: number) => {
    const params = new URLSearchParams(existingQuery);
    params.set(keyIni, di);
    params.set('data_fim', df);
    params.set('page_size', String(pageSize));
    params.set('page', String(page));
    if (codBiParam) params.set('cod_empresa_bi', codBiParam);
    return buildApiProxyUrl(empresa, `${pathOnly}?${params.toString()}`);
  };

  const extractArray = (json: any): any[] =>
    Array.isArray(json) ? json : (json.produtos || json.Produtos || json.itens || json.Itens || []);

  const rawRowKey = (r: any) => [
    r?.cod_empresa ?? r?.CodEmpresa ?? '',
    r?.num_lancamento ?? r?.NumLancamento ?? '',
    r?.cod_documento ?? r?.CodDocumento ?? '',
    r?.cod_pedido ?? r?.CodPedido ?? '',
    r?.cod_produto ?? r?.CodProduto ?? '',
    r?.quantidade ?? '',
    r?.ValorLiquidoFinal ?? r?.valor_total ?? '',
    r?.tipo_movimento ?? r?.tipo ?? '',
  ].join('|');

  const fetchRange = async (di: string, df: string): Promise<any[]> => {
    const pageSize = 5000;
    const allPages: any[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= 20; page++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(buildUrl(di, df, page, pageSize), {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          signal: controller.signal,
        });
        if (!res.ok) {
          console.warn(`[ComercialProdutos] ${di}..${df} página ${page}: HTTP ${res.status}`);
          throw new Error(`Produtos ${di}..${df} página ${page}: HTTP ${res.status}`);
        }
        const json = await readJsonOrFallback(res, []);
        const arr = extractArray(json);

        // A VPS/ERP ignora o parâmetro `page` em alguns endpoints e devolve
        // sempre o mesmo conjunto. Sem essa proteção o loop repetia 20x o
        // mesmo lote (travando a tela de Campanhas em zero enquanto carregava).
        let novos = 0;
        for (const r of arr) {
          const key = rawRowKey(r);
          if (seen.has(key)) continue;
          seen.add(key);
          allPages.push(r);
          novos++;
        }

        console.log(`[ComercialProdutos] ${di}..${df} página ${page}: ${arr.length} registros (${novos} novos)`);
        if (page === 1 && arr.length > 0) {
          console.log('[ComercialProdutos] Campos da API (amostra):', Object.keys(arr[0]));
          console.log('[ComercialProdutos] Primeiro registro:', arr[0]);
        }
        if (novos === 0) {
          if (page > 1) console.warn(`[ComercialProdutos] ${di}..${df}: paginação não avança (página ${page} repetida) — encerrando.`);
          break;
        }
        if (arr.length < pageSize) break;
      } finally {
        clearTimeout(timer);
      }
    }

    console.log(`[ComercialProdutos] ${di}..${df}: ${allPages.length} registros`);
    return allPages;
  };


  let all: any[] = [];

  if (usaVps && isPelegrini1004Config) {
    // Pelegrini 1004: a Receita do dashboard/modal precisa sair de um único
    // conjunto final. Não usamos janelas semanais (fronteiras se sobrepõem),
    // mas períodos longos (ex.: campanhas de 2+ meses) são fatiados por mês
    // porque o endpoint ignora `page` e trunca o retorno em uma única chamada.
    const dIni = new Date(`${ini}T00:00:00`);
    const dFim = new Date(`${fim}T00:00:00`);
    const spanDias = Math.round((dFim.getTime() - dIni.getTime()) / 86400000);
    if (spanDias > 40) {
      const chunks: Array<[string, string]> = [];
      let cursor = new Date(dIni);
      while (cursor.getTime() <= dFim.getTime()) {
        const fimMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
        const chunkFim = fimMes.getTime() > dFim.getTime() ? new Date(dFim) : fimMes;
        chunks.push([_toLocal(cursor), addDaysIso(_toLocal(chunkFim), 1)]);
        cursor = new Date(chunkFim.getFullYear(), chunkFim.getMonth(), chunkFim.getDate() + 1);
      }
      console.log(`[ComercialProdutos][1004] período longo (${spanDias}d) → ${chunks.length} janelas mensais.`);
      const seenChunks = new Set<string>();
      for (const [di, df] of chunks) {
        try {
          const part = await fetchRange(di, df);
          for (const r of part) {
            const key = rawRowKey(r);
            if (seenChunks.has(key)) continue;
            seenChunks.add(key);
            all.push(r);
          }
        } catch (err) {
          console.warn(`[ComercialProdutos][1004] Falha no chunk ${di}..${df}:`, err);
        }
      }
      console.log(`[ComercialProdutos][1004] TOTAL agregado (mensal): ${all.length} registros`);
    } else {
      const df = addDaysIso(fim, 1);
      console.log('[ComercialProdutos][1004] usando range completo; fatiamento semanal desativado.');
      all = await fetchRange(ini, df);
    }
  } else if (usaVps) {

    // Quebrar em janelas semanais.
    // No ERP do cliente 1004 o data_fim funciona como limite exclusivo: para trazer
    // vendas do dia 29/06, por exemplo, a chamada precisa ir até 30/06.
    const fimApiInclusivo = isPelegrini1004Config
      ? (date: Date) => {
          const d = new Date(date);
          d.setDate(d.getDate() + 1);
          return d.toISOString().split('T')[0];
        }
      : (date: Date) => date.toISOString().split('T')[0];
    const semanas: Array<[string, string]> = [];
    const d = new Date(`${ini}T00:00:00`);
    const end = new Date(`${fim}T00:00:00`);
    while (d.getTime() <= end.getTime()) {
      const di = d.toISOString().split('T')[0];
      const next = new Date(d);
      next.setDate(next.getDate() + 6);
      if (next.getTime() > end.getTime()) next.setTime(end.getTime());
      semanas.push([di, fimApiInclusivo(next)]);
      d.setDate(d.getDate() + 7);
    }
    console.log(`[ComercialProdutos] VPS: ${semanas.length} janelas semanais (concorrência 3)`);

    let i = 0;
    const concurrency = Math.min(3, semanas.length);
    const runners = Array.from({ length: concurrency }, async () => {
      while (i < semanas.length) {
        const idx = i++;
        const [di, df] = semanas[idx];
        try {
          const part = await fetchRange(di, df);
          all.push(...part);
        } catch (err) {
          console.warn(`[ComercialProdutos] Falha no chunk ${di}..${df}:`, err);
        }
      }
    });
    await Promise.all(runners);
    console.log(`[ComercialProdutos] TOTAL agregado: ${all.length} registros`);
  } else {
    all = await fetchRange(ini, fim);
  }


  const empresaFallback = String(codBiParam ?? empresa.cod_empresa_bi ?? '').trim();
  return all.map(r => normalizeProduto(r, empresaFallback));
}


async function fetchProdutos(empresa: Empresa | null | undefined, periodo?: { inicio: string; fim: string }, filialAtiva?: string | null): Promise<ProdutoItem[]> {
  if (!empresa || !empresa.modulo_comercial) return [];
  const jsonPath = resolveComercialJsonPath('produtos', empresa, filialAtiva);
  if (jsonPath?.startsWith('storage:')) {
    try {
      const storageData = await fetchFromStorage(jsonPath.replace('storage:', ''));
      if (storageData.length > 0) return storageData;
      console.warn('[ComercialProdutos] JSON de produtos veio vazio; tentando endpoint configurado.');
    } catch (e) { console.error('[ComercialProdutos]', e); }
  } else if (jsonPath) {
    try {
      const storageData = await fetchFromStorage(jsonPath);
      if (storageData.length > 0) return storageData;
      console.warn('[ComercialProdutos] JSON de produtos veio vazio; tentando endpoint configurado.');
    } catch (e) { console.error('[ComercialProdutos]', e); }
  }
  if ((empresa.endpoint_url || empresa.usar_vps_intermediaria)) {
    try { return await fetchFromEndpoint(empresa, periodo, filialAtiva); } catch (e) { console.error('[ComercialProdutos]', e); }
  }
  return [];
}

function vendedorValidoTotalizador1004(item: any): boolean {
  const codigo = String(getField(item, 'vendedor_codigo', 'cod_vendedor', 'CodVendedor', 'cod_vendedor_interno') ?? '').trim();
  const nome = String(getField(item, 'vendedor_nome', 'vendedor', 'Vendedor', 'nome_interno', 'nome_externo') ?? '').trim();
  if ((!codigo || codigo === '0') && !nome) return false;
  if (codigo === '0') return false;
  return !vendedorNaoComissionavel1004({ codigo, nome });
}

function produtoPertenceForcaP1004(item: any): boolean {
  const candidatos = [
    { codigo: getField(item, 'vendedor_codigo', 'cod_vendedor', 'CodVendedor', 'VendedorCodigo'), nome: getField(item, 'vendedor_nome', 'vendedor', 'Vendedor', 'VendedorNome') },
    { codigo: getField(item, 'cod_vendedor_interno', 'CodVendedorInterno'), nome: getField(item, 'nome_interno', 'vendedor_interno', 'VendedorInterno', 'NomeInterno') },
    { codigo: getField(item, 'cod_vendedor_externo', 'CodVendedorExterno'), nome: getField(item, 'nome_externo', 'vendedor_externo', 'VendedorExterno', 'NomeExterno') },
    { codigo: getField(item, 'cod_vendedor_chevrolet', 'CodVendedorChevrolet'), nome: getField(item, 'vendedor_chevrolet', 'VendedorChevrolet') },
    { codigo: getField(item, 'cod_vendedor_cch', 'CodVendedorCCH'), nome: getField(item, 'vendedor_cch', 'VendedorCCH') },
    { codigo: getField(item, 'cod_vendedor_comissao', 'CodVendedorComissao'), nome: getField(item, 'vendedor_comissao', 'VendedorComissao') },
    { codigo: getField(item, 'cod_vendedor_representante', 'CodVendedorRepresentante', 'cod_representante', 'CodRepresentante'), nome: getField(item, 'vendedor_representante', 'VendedorRepresentante', 'representante', 'Representante') },
    { codigo: getField(item, 'cod_vendedor_meta', 'CodVendedorMeta'), nome: getField(item, 'vendedor_meta', 'VendedorMeta') },
  ];

  return candidatos.some((vendedor) => vendedorForcaP1004(vendedor));
}

export function produtoPertenceEscopoPelegrini1004(
  item: Record<string, unknown>,
  params: {
    codEmpresa: unknown;
    isContextoChevrolet10041Ativo: boolean;
    usarTodasFiliais1004?: boolean;
  },
): boolean {
  const codEmpresaNorm = String(params.codEmpresa ?? '').trim();
  const isEmpresa1004 = codEmpresaNorm === '1004';
  const isEmpresa10041 = codEmpresaNorm === '10041' || params.isContextoChevrolet10041Ativo;
  if (!isEmpresa1004 && !isEmpresa10041) return true;

  const codBi = String(item.cod_empresa_bi ?? item.CodEmpresa_bi ?? '').trim();
  const filialNomeNorm = normalizeText(item.filial_nome ?? item.Filial ?? item.filial ?? item.NomeFilial ?? item.empresa ?? item.Empresa);

  if (isEmpresa10041) {
    if (codBi && codBi !== '10041') return false;
    if (!codBi && filialNomeNorm && !filialNomeNorm.includes('CHEVROLET') && filialNomeNorm !== 'CH' && filialNomeNorm !== 'CCH') return false;
    if (produtoPertenceForcaP1004(item)) return false;
    return true;
  }

  if (!params.usarTodasFiliais1004) {
    if (codBi && codBi !== '1004') return false;
    if (filialNomeNorm.includes('CHEVROLET') || filialNomeNorm === 'CH' || filialNomeNorm === 'CCH') return false;
  }

  if (produtoPertenceForcaP1004(item)) return false;
  return true;
}

async function fetchProdutosTodasFiliais1004(
  empresa: Empresa | null | undefined,
  periodo?: { inicio: string; fim: string },
): Promise<ProdutoItem[]> {
  if (!empresa || String(empresa.cod_empresa_bi ?? '').trim() !== '1004') {
    return fetchProdutos(empresa, periodo, undefined);
  }

  const temEndpoint = !!(empresa.endpoint_url || empresa.usar_vps_intermediaria);
  const fetchFilial = async (filial: 'transmissao' | 'chevrolet') => {
    if (temEndpoint) {
      try {
        return await fetchFromEndpoint(empresa, periodo, filial);
      } catch (error) {
        console.warn(`[ComercialProdutos][1004] Falha no endpoint ${filial}; tentando fallback configurado.`, error);
      }
    }
    return fetchProdutos(empresa, periodo, filial);
  };

  const [transmissao, chevrolet] = await Promise.all([
    fetchFilial('transmissao'),
    fetchFilial('chevrolet'),
  ]);

  return [...transmissao, ...chevrolet];
}

async function fetchReceitaComissao1004(
  empresa: Empresa | null | undefined,
  periodo?: { inicio: string; fim: string },
  filialAtiva?: string | null,
  isContextoChevrolet10041Ativo = false,
): Promise<ReceitaComissao1004Linha[]> {
  if (!empresa) return [];
  const codEmpresaNorm = String(empresa.cod_empresa_bi ?? '').trim();
  const isPelegrini = codEmpresaNorm === '1004' || codEmpresaNorm === '10041' || isContextoChevrolet10041Ativo;
  if (!isPelegrini) return [];

  const hoje = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const toLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const primeiroMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const ultimoDiaMesAnt = new Date(primeiroMesAtual.getTime() - 24 * 60 * 60 * 1000);
  const primeiroDiaMesAnt = new Date(ultimoDiaMesAnt.getFullYear(), ultimoDiaMesAnt.getMonth(), 1);

  const params = new URLSearchParams();
  params.set('data_ini', periodo?.inicio || toLocal(primeiroDiaMesAnt));
  params.set('data_fim', periodo?.fim || toLocal(ultimoDiaMesAnt));
  params.set('page_size', '5000');
  params.set('page', '1');
  const codBiParam = resolveCodEmpresaBiParam(empresa, filialAtiva) || (isContextoChevrolet10041Ativo ? '10041' : '1004');
  params.set('cod_empresa_bi', codBiParam);

  const path = resolveComissao1004Path(isContextoChevrolet10041Ativo);
  const url = buildApiProxyUrl(empresa, `${path}?${params.toString()}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Comissoes 1004: HTTP ${res.status}`);
    const json = await readJsonOrFallback(res, []);
    const arr: Record<string, unknown>[] = Array.isArray(json)
      ? json
      : json?.dados || json?.data || json?.comissoes || json?.registros || [];
    return arr.map(normalizeComissao1004);
  } finally {
    clearTimeout(timer);
  }
}

// ----------------------------------------------------------------
// Hook
// ----------------------------------------------------------------

export function useComercialProdutos(filters?: ComercialFilters, options?: { enabled?: boolean; keepPreviousData?: boolean }) {
  const { empresa, codEmpresaAtiva, isLoading: loadingEmpresa } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();
  const codEmpresaAtivaNorm = String(codEmpresaAtiva ?? '').trim();
  const isContextoChevrolet10041Ativo = isContextoChevrolet10041Util(codEmpresaAtiva, filialAtiva, empresa);
  const codEmpresaParaFiltro10041 = isContextoChevrolet10041Ativo ? '10041' : codEmpresaAtivaNorm;
  const isPelegriniComercial = codEmpresaAtivaNorm === '1004' || codEmpresaAtivaNorm === '10041' || isContextoChevrolet10041Ativo;
  const usarTodasFiliais1004 = !isContextoChevrolet10041Ativo && codEmpresaAtivaNorm === '1004' && !!filters?.incluirTodasFiliais1004;
  const enabledFlag = options?.enabled !== false;

  const hasJson = !!resolveComercialJsonPath('produtos', empresa, filialAtiva);
  const hasEndpoint = !!(empresa?.endpoint_url || empresa?.usar_vps_intermediaria);
  const hasSource = hasJson || hasEndpoint;

  const query = useQuery({
    queryKey: [
      'comercial-produtos',
      codEmpresaAtiva,
      filialAtiva,
      empresa?.json_path_comercial_produtos,
      empresa?.json_path_comercial_produtos_ch,
      empresa?.endpoint_url,
      empresa?.endpoint_path_comercial_produtos,
      empresa?.endpoint_path_comercial_produtos_ch,
      'endpoint-date-range-v2',
      filters?.periodo?.inicio,
      filters?.periodo?.fim,
      filters?.ignorarEquipePadrao ? 'campanhas-venda-bruta-v4' : 'padrao',
      isContextoChevrolet10041Ativo ? 'chevrolet-10041' : 'contexto-normal',
      resolveComissao1004Path(isContextoChevrolet10041Ativo),
      usarTodasFiliais1004 ? 'todas-filiais-1004-endpoint-v2' : 'filial-ativa',
      filters?.excluirVendedoresOcultos1004 ? 'sem-ocultos-1004-v1' : 'com-ocultos',
      isPelegriniComercial ? RECEITA_1004_RULE_VERSION : 'receita-padrao',
    ],
    queryFn: async () => {
      if (usarTodasFiliais1004) {
        return fetchProdutosTodasFiliais1004(empresa, filters?.periodo);
      }
      return fetchProdutos(empresa, filters?.periodo, filialAtiva);
    },
    enabled: !loadingEmpresa && hasSource && enabledFlag,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
    placeholderData: options?.keepPreviousData === false ? undefined : keepPreviousData,
  });

  const all = useMemo(
    () => isContextoChevrolet10041Ativo
      ? filtrarPorFilial((query.data || []) as any[], '10041', 'chevrolet') as ProdutoItem[]
      : usarTodasFiliais1004
      ? ((query.data || []) as ProdutoItem[])
      : filtrarPorFilial((query.data || []) as any[], codEmpresaAtiva, filialAtiva) as ProdutoItem[],
    [query.data, codEmpresaAtiva, filialAtiva, usarTodasFiliais1004, isContextoChevrolet10041Ativo],
  );

  const allEscopoPelegrini = useMemo(() => {
    if (!isPelegriniComercial) return all;
    return all.filter((p) => produtoPertenceEscopoPelegrini1004(p as unknown as Record<string, unknown>, {
      codEmpresa: codEmpresaParaFiltro10041,
      isContextoChevrolet10041Ativo,
      usarTodasFiliais1004,
    }));
  }, [all, isPelegriniComercial, codEmpresaParaFiltro10041, isContextoChevrolet10041Ativo, usarTodasFiliais1004]);

  const comissao1004Query = useQuery({
    queryKey: [
      'comercial-receita-comissao-1004',
      codEmpresaAtiva,
      empresa?.endpoint_url,
      empresa?.usar_vps_intermediaria,
      filialAtiva,
      isContextoChevrolet10041Ativo ? 'chevrolet-10041' : 'transmissao-1004',
      resolveComissao1004Path(isContextoChevrolet10041Ativo),
      filters?.periodo?.inicio,
      filters?.periodo?.fim,
      RECEITA_1004_RULE_VERSION,
    ],
    queryFn: () => fetchReceitaComissao1004(empresa, filters?.periodo, filialAtiva, isContextoChevrolet10041Ativo),
    enabled: !loadingEmpresa && isPelegriniComercial && hasEndpoint && enabledFlag,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
    placeholderData: options?.keepPreviousData === false ? undefined : keepPreviousData,
  });

  const produtosFiltrados = useMemo(() => {
    if (!allEscopoPelegrini.length) return allEscopoPelegrini;
    const isEmpresa1004 = codEmpresaParaFiltro10041 === '1004';
    const isEmpresa10041 = codEmpresaParaFiltro10041 === '10041';
    const isContextoChevrolet10041 = isContextoChevrolet10041Ativo;
    // Aplica equipe padrão da filial quando nenhum vendedor explícito foi escolhido.
    // Campanhas precisam considerar todos os vendedores do JSON, incluindo os fora da equipe padrão.
    const vendedorFiltro = getFiltroVendedorSemEquipeCt10041(filters?.vendedor, codEmpresaParaFiltro10041, filialAtiva);
    const vendedoresFiltro = getFiltroVendedoresSemEquipeCt10041(filters?.vendedores, codEmpresaParaFiltro10041, filialAtiva);
    const hasFiltroVendedor = !!vendedorFiltro || !!(vendedoresFiltro && vendedoresFiltro.length > 0);
    const baseComEquipeObrigatoria = allEscopoPelegrini;
    const baseEquipe = isContextoChevrolet10041 || filters?.ignorarEquipePadrao || hasFiltroVendedor
      ? baseComEquipeObrigatoria
      : (filtrarPorEquipePadrao(allEscopoPelegrini as any[], codEmpresaAtiva, filialAtiva) as ProdutoItem[]);
    const baseSemForcaP = baseEquipe;
    if (!filters) return baseSemForcaP;
    const filtrados = baseSemForcaP.filter(p => {
      if (isEmpresa1004 || isEmpresa10041) {
        const codBi = String(p.cod_empresa_bi ?? '').trim();
        const filialNomeNorm = normalizeText(p.filial_nome);
        if (isContextoChevrolet10041 && codBi && codBi !== '10041') return false;
        if (isContextoChevrolet10041 && !codBi && filialNomeNorm && !filialNomeNorm.includes('CHEVROLET')) return false;
        if (!usarTodasFiliais1004 && !isContextoChevrolet10041 && codBi && codBi !== '1004') return false;
        if (!usarTodasFiliais1004 && !isContextoChevrolet10041 && filialNomeNorm.includes('CHEVROLET')) return false;
        if (deveAplicarFiltroOcultosTotalizador1004(filters?.excluirVendedoresOcultos1004, isContextoChevrolet10041) && !vendedorValidoTotalizador1004(p)) return false;
        if (isLinhaResumoTotaisProduto(p)) return false;
        if (!Number.isFinite(Number((p as any).valor_liquido_final_item ?? p.valor_total ?? 0))) return false;
        if (isVendaSemPedidoValido1004(p)) return false;
      }
      if (filters.periodo) {
        // 1003 (Ideal): usar data de MOVIMENTO como padrão (data_pedido),
        // com data_faturamento apenas como fallback. Demais empresas mantêm
        // faturamento primeiro.
        const is1003 = String(codEmpresaAtiva ?? '') === '1003';
        const dataRef = is1003
          ? (p.data_pedido || p.data_faturamento)
          : (p.data_faturamento || p.data_pedido);
        // Itens sem data NÃO entram no período filtrado (evita inflar totais).
        if (!dataRef) return false;
        if (!isDateWithinPeriodo(dataRef, filters.periodo.inicio, filters.periodo.fim)) return false;
      }
      if (vendedorFiltro) {
        const codUpper = String(codEmpresaAtiva ?? '').toUpperCase();
        if (codEmpresaAtiva === '1005' || codUpper === 'MASTER') {
          if (!produtoMatchesVendedor1005(p, vendedorFiltro)) return false;
        } else if (!produtoMatchesVendedorEmpresa(p, vendedorFiltro, codEmpresaParaFiltro10041)) return false;
      }
      if (vendedoresFiltro && vendedoresFiltro.length > 0) {
        const codUpper = String(codEmpresaAtiva ?? '').toUpperCase();
        const matches = vendedoresFiltro.some(vendedor => (
          codEmpresaAtiva === '1005' || codUpper === 'MASTER'
            ? produtoMatchesVendedor1005(p, vendedor)
            : produtoMatchesVendedorEmpresa(p, vendedor, codEmpresaParaFiltro10041)
        ));
        if (!matches) return false;
      }
      // Filtros específicos do sistema 1005
      const f: any = filters;
      if (f.vendedor_externo) {
        const cod = String((p as any).cod_vendedor_externo ?? '').trim();
        const nome = ((p as any).vendedor_externo || (p as any).nome_externo || '').toString().trim();
        const alvo = String(f.vendedor_externo).trim();
        if (cod !== alvo && nome !== alvo && nome.toUpperCase() !== alvo.toUpperCase()) return false;
      }
      if (f.vendedor_interno) {
        const cod = String((p as any).cod_vendedor_interno ?? '').trim();
        const nome = ((p as any).vendedor_interno || (p as any).nome_interno || '').toString().trim();
        const alvo = String(f.vendedor_interno).trim();
        if (cod !== alvo && nome !== alvo && nome.toUpperCase() !== alvo.toUpperCase()) return false;
      }
      if (f.vendedor_meta && !produtoMatchesVendedor1005(p, f.vendedor_meta)) return false;
      if (filters.cliente && p.cliente_codigo !== filters.cliente) return false;
      if (filters.tipo && filters.tipo !== 'todos' && p.tipo !== filters.tipo) return false;
      return true;
    });

    if (!isEmpresa1004 && !isEmpresa10041) return filtrados;

    const seen = new Set<string>();
    return filtrados.filter((p) => {
      const key = getProdutoUniqueKey(p);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allEscopoPelegrini, filters, codEmpresaAtiva, codEmpresaAtivaNorm, codEmpresaParaFiltro10041, filialAtiva, usarTodasFiliais1004, isContextoChevrolet10041Ativo]);

  const topProdutos = useMemo((): TopProdutoAgg[] => {
    const map = new Map<string, TopProdutoAgg>();
    for (const it of produtosFiltrados) {
      const key = String(it.cod_produto);
      const ex = map.get(key) || {
        cod_produto: it.cod_produto,
        descricao: it.descricao,
        categoria: it.categoria,
        grupo: it.grupo,
        marca: it.marca,
        quantidade: 0,
        faturamento: 0,
        pedidos: 0,
        participacao: 0,
      };
      ex.quantidade += it.quantidade;
      ex.faturamento += it.valor_total;
      ex.pedidos += 1;
      map.set(key, ex);
    }
    const arr = Array.from(map.values()).sort((a, b) => b.faturamento - a.faturamento);
    const total = arr.reduce((acc, p) => acc + Math.max(0, p.faturamento), 0);
    arr.forEach(p => { p.participacao = total > 0 ? (p.faturamento / total) * 100 : 0; });
    return arr;
  }, [produtosFiltrados]);

  const porCategoria = useMemo((): CategoriaAgg[] => {
    const map = new Map<string, CategoriaAgg & { _set: Set<string> }>();
    for (const it of produtosFiltrados) {
      const key = it.categoria || it.grupo || it.marca || 'Sem categoria';
      const ex = map.get(key) || { chave: key, faturamento: 0, quantidade: 0, produtos: 0, participacao: 0, _set: new Set<string>() };
      ex.faturamento += it.valor_total;
      ex.quantidade += it.quantidade;
      ex._set.add(String(it.cod_produto));
      map.set(key, ex);
    }
    const arr = Array.from(map.values()).map(({ _set, ...rest }) => ({ ...rest, produtos: _set.size }));
    arr.sort((a, b) => b.faturamento - a.faturamento);
    const total = arr.reduce((acc, c) => acc + Math.max(0, c.faturamento), 0);
    arr.forEach(c => { c.participacao = total > 0 ? (c.faturamento / total) * 100 : 0; });
    return arr;
  }, [produtosFiltrados]);

  const produtosSemGiro = useMemo((): ProdutoSemGiro[] => {
    // Catálogo: todos os produtos do JSON (independente do filtro de período)
    // Sem giro = não vendeu dentro do período aplicado.
    const vendidosNoPeriodo = new Set(produtosFiltrados.filter(p => p.tipo === 'PEDIDO').map(p => String(p.cod_produto)));
    const catalogo = new Map<string, ProdutoSemGiro & { ultimaVendaTs: string }>();
    for (const it of allEscopoPelegrini) {
      const key = String(it.cod_produto);
      if (vendidosNoPeriodo.has(key)) continue;
      const is1003SG = String(codEmpresaAtiva ?? '') === '1003';
      const dt = (is1003SG ? (it.data_pedido || it.data_faturamento) : (it.data_faturamento || it.data_pedido)) || '';
      const ex = catalogo.get(key);
      if (!ex || dt > ex.ultimaVendaTs) {
        catalogo.set(key, {
          cod_produto: it.cod_produto,
          descricao: it.descricao,
          categoria: it.categoria,
          marca: it.marca,
          ultimaVenda: dt || undefined,
          ultimaVendaTs: dt,
        });
      }
    }
    const hoje = new Date();
    return Array.from(catalogo.values()).map(({ ultimaVendaTs, ...rest }) => {
      let dias: number | undefined;
      if (rest.ultimaVenda) {
        const d = new Date(rest.ultimaVenda);
        if (!isNaN(d.getTime())) dias = Math.floor((hoje.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      }
      return { ...rest, diasSemVenda: dias };
    }).sort((a, b) => (b.diasSemVenda ?? 9999) - (a.diasSemVenda ?? 9999));
  }, [allEscopoPelegrini, produtosFiltrados]);

  // -------------------- NOVAS AGREGAÇÕES --------------------

  // Receita por Marca (gráfico do Power BI)
  const porMarca = useMemo((): MarcaAgg[] => {
    const map = new Map<string, MarcaAgg & { _set: Set<string> }>();
    for (const it of produtosFiltrados) {
      const key = (it.marca || 'SEM MARCA').toString().trim().toUpperCase();
      const ex = map.get(key) || {
        marca: key,
        faturamento: 0,
        custo: 0,
        lucro: 0,
        margem: 0,
        quantidade: 0,
        produtos: 0,
        participacao: 0,
        _set: new Set<string>(),
      };
      ex.faturamento += it.valor_total;
      ex.custo += it.valor_custo || 0;
      ex.quantidade += it.quantidade;
      ex._set.add(String(it.cod_produto));
      map.set(key, ex);
    }
    const arr = Array.from(map.values()).map(({ _set, ...rest }) => {
      const lucro = rest.faturamento - rest.custo;
      return {
        ...rest,
        produtos: _set.size,
        lucro,
        margem: rest.faturamento > 0 ? (lucro / rest.faturamento) * 100 : 0,
      };
    });
    arr.sort((a, b) => b.faturamento - a.faturamento);
    const total = arr.reduce((acc, m) => acc + Math.max(0, m.faturamento), 0);
    arr.forEach(m => { m.participacao = total > 0 ? (m.faturamento / total) * 100 : 0; });
    return arr;
  }, [produtosFiltrados]);

  // Resumo de Vendas linha-a-linha (Data, NF, Produto, Marca, Cliente, Receita, Custo, Lucro, %, Interno, Externo)
  const resumoVendas = useMemo((): ResumoVendaLinha[] => {
    return produtosFiltrados.map(it => {
      const receita = it.valor_total;
      const custo = (it.valor_custo || 0) * (it.tipo === 'DEVOLUCAO' ? -1 : 1);
      const lucro = receita - custo;
      return {
        data: (String(codEmpresaAtiva ?? '') === '1003' ? (it.data_pedido || it.data_faturamento) : (it.data_faturamento || it.data_pedido)) || '',
        num_nf: it.num_nf,
        cod_produto: it.cod_produto,
        descricao: it.descricao,
        marca: it.marca,
        cliente_codigo: it.cliente_codigo,
        cliente_razao: it.cliente_razao,
        cliente_cidade: it.cliente_cidade,
        receita,
        custo,
        lucro,
        margem: receita !== 0 ? (lucro / Math.abs(receita)) * 100 : 0,
        nome_interno: it.nome_interno,
        nome_externo: it.nome_externo,
        tipo: it.tipo,
      };
    }).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }, [produtosFiltrados]);

  // Helper para agregar vendedores por nome (Interno OU Externo)
  function agruparVendedores(getName: (it: ProdutoItem) => string | undefined): ResumoVendedor[] {
    const map = new Map<string, ResumoVendedor & { _pedidos: Set<string> }>();
    for (const it of produtosFiltrados) {
      const nome = (getName(it) || '').toString().trim();
      if (!nome) continue;
      const ex = map.get(nome) || {
        nome,
        vendas: 0,
        receita: 0,
        custo: 0,
        lucro: 0,
        margem: 0,
        ticket_medio: 0,
        _pedidos: new Set<string>(),
      };
      ex.receita += it.valor_total;
      ex.custo += (it.valor_custo || 0) * (it.tipo === 'DEVOLUCAO' ? -1 : 1);
      if (it.cod_pedido) ex._pedidos.add(String(it.cod_pedido));
      map.set(nome, ex);
    }
    const arr = Array.from(map.values()).map(({ _pedidos, ...rest }) => {
      const vendas = _pedidos.size || 0;
      const lucro = rest.receita - rest.custo;
      return {
        ...rest,
        vendas,
        lucro,
        margem: rest.receita > 0 ? (lucro / rest.receita) * 100 : 0,
        ticket_medio: vendas > 0 ? rest.receita / vendas : 0,
      };
    });
    return arr.sort((a, b) => b.receita - a.receita);
  }

  const vendedoresInternos = useMemo(
    () => agruparVendedores(it => it.nome_interno || it.vendedor_nome),
    [produtosFiltrados]
  );
  const vendedoresExternos = useMemo(
    () => agruparVendedores(it => it.nome_externo),
    [produtosFiltrados]
  );

  // Clientes x Grupo (tabela "CLIENTES POR GRUPO" do Power BI)
  const clientesPorGrupo = useMemo((): ClienteGrupoLinha[] => {
    const map = new Map<string, ClienteGrupoLinha & { _pedidos: Set<string> }>();
    for (const it of produtosFiltrados) {
      const grupo = (it.nome_grupo || 'SEM GRUPO').trim();
      const cliente = String(it.cliente_codigo || it.cliente_razao || '');
      if (!cliente) continue;
      const key = `${cliente}::${grupo}`;
      const ex = map.get(key) || {
        cliente_codigo: it.cliente_codigo || '',
        cliente_razao: it.cliente_razao || '',
        cidade: it.cliente_cidade,
        cod_grupo: it.cod_grupo,
        nome_grupo: grupo,
        vendas: 0,
        receita: 0,
        custo: 0,
        lucro: 0,
        margem: 0,
        _pedidos: new Set<string>(),
      };
      ex.receita += it.valor_total;
      ex.custo += (it.valor_custo || 0) * (it.tipo === 'DEVOLUCAO' ? -1 : 1);
      if (it.cod_pedido) ex._pedidos.add(String(it.cod_pedido));
      map.set(key, ex);
    }
    return Array.from(map.values()).map(({ _pedidos, ...rest }) => {
      const lucro = rest.receita - rest.custo;
      return {
        ...rest,
        vendas: _pedidos.size,
        lucro,
        margem: rest.receita > 0 ? (lucro / rest.receita) * 100 : 0,
      };
    }).sort((a, b) => b.receita - a.receita);
  }, [produtosFiltrados]);

  // Meta consolidada: SOMA do MAX(ValorMeta) por vendedor (não duplica por pedido)
  const metaConsolidada = useMemo(() => {
    const maxPorVendedor = new Map<string, number>();
    for (const it of produtosFiltrados) {
      if (!it.valor_meta) continue;
      const key = String(it.cod_vendedor_interno || it.nome_interno || it.vendedor_nome || '');
      if (!key) continue;
      const cur = maxPorVendedor.get(key) || 0;
      if (it.valor_meta > cur) maxPorVendedor.set(key, it.valor_meta);
    }
    let total = 0;
    maxPorVendedor.forEach(v => { total += v; });
    return { total, porVendedor: Object.fromEntries(maxPorVendedor) };
  }, [produtosFiltrados]);

  // Base de receita 1004 — usa TODOS os registros retornados pela API (sem dedupe,
  // sem filtro de vendedor/cliente/tipo, sem exclusão de cod_pedido=0). Aplica
  // apenas empresa (CT vs Chevrolet), período e remoção de linhas de resumo.
  const baseReceita1004 = useMemo(() => {
    const codEmpresaNorm = codEmpresaParaFiltro10041;
    const isEmpresa1004 = codEmpresaNorm === '1004';
    const isEmpresa10041 = codEmpresaNorm === '10041';
    if (!isEmpresa1004 && !isEmpresa10041) return [] as ProdutoItem[];
    const isContextoChevrolet10041 = isContextoChevrolet10041Ativo;
    return (allEscopoPelegrini as ProdutoItem[]).filter((p) => {
      const codBi = String((p as any).cod_empresa_bi ?? '').trim();
      const filialNomeNorm = normalizeText((p as any).filial_nome);
      if (isContextoChevrolet10041 && codBi && codBi !== '10041') return false;
      if (isContextoChevrolet10041 && !codBi && filialNomeNorm && !filialNomeNorm.includes('CHEVROLET')) return false;
      if (!usarTodasFiliais1004 && !isContextoChevrolet10041 && codBi && codBi !== '1004') return false;
      if (!usarTodasFiliais1004 && !isContextoChevrolet10041 && filialNomeNorm.includes('CHEVROLET')) return false;
      if (deveAplicarFiltroOcultosTotalizador1004(filters?.excluirVendedoresOcultos1004, isContextoChevrolet10041) && !vendedorValidoTotalizador1004(p)) return false;
      if (isContextoChevrolet10041 && isServicoForaRelatorioChevrolet10041(p as unknown as Record<string, unknown>)) return false;
      if (isContextoChevrolet10041 && !vendedorPertenceRelatorioChevrolet10041(getVendedorProduto10041(p))) return false;
      if (isLinhaResumoTotaisProduto(p)) return false;
      if (isCfopExcluidoReceita1004(p)) return false;
      if (isVendaSemPedidoValido1004(p)) return false;
      if (filters?.periodo) {
        const dataRef = p.data_faturamento || p.data_pedido;
        if (!dataRef) return false;
        if (!isDateWithinPeriodo(dataRef, filters.periodo.inicio, filters.periodo.fim)) return false;
      }
      return true;
    });
  }, [allEscopoPelegrini, filters, codEmpresaParaFiltro10041, isContextoChevrolet10041Ativo, usarTodasFiliais1004]);

  const cfop6933PorVendedor1004 = useMemo(() => {
    const mapa = new Map<string, number>();
    if (String(codEmpresaAtiva ?? '').trim() !== '1004') return mapa;

    for (const p of allEscopoPelegrini as ProdutoItem[]) {
      if (filters?.periodo) {
        const dataRef = p.data_faturamento || p.data_pedido;
        if (!dataRef) continue;
        if (!isDateWithinPeriodo(dataRef, filters.periodo.inicio, filters.periodo.fim)) continue;
      }
      if (p.tipo === 'DEVOLUCAO') continue;
      if (!isCfopExcluidoReceita1004(p)) continue;

      const codigo = String((p as any).vendedor_codigo ?? (p as any).cod_vendedor ?? '').trim();
      if (!codigo) continue;
      const valor = Math.abs(Number((p as any).valor_venda_item ?? p.valor_total ?? 0));
      mapa.set(codigo, (mapa.get(codigo) || 0) + valor);
    }

    return mapa;
  }, [allEscopoPelegrini, filters?.periodo, codEmpresaAtiva]);

  const receitaOficial1004 = useMemo(() => {
    const linhas = comissao1004Query.data || [];
    if (!isEmpresaPelegrini1004Like(codEmpresaAtiva) || linhas.length === 0) return null;

    const detalhePorVendedor = new Map<string, DetalheReceita1004Linha>();
    for (const p of baseReceita1004) {
      const codigo = String((p as any).vendedor_codigo ?? '').trim();
      if (!codigo) continue;
      const atual = detalhePorVendedor.get(codigo) || {
        codigo,
        nome: String((p as any).vendedor_nome ?? codigo).trim(),
        total: 0,
        devolucoes: 0,
        qtdFat: 0,
        corrigido: 0,
      };
      const valor = Number(p.valor_total ?? 0);
      atual.total += valor;
      atual.devolucoes = (atual.devolucoes || 0) + Math.abs(Number((p as any).valor_devolucao_item ?? 0));
      atual.qtdFat = (atual.qtdFat || 0) + Number((p as any).quantidade || 0);
      if ((p as any).vendedor_corrigido_1004) atual.corrigido += valor;
      detalhePorVendedor.set(codigo, atual);
    }

    const mapa = new Map<string, ReceitaOficial1004Linha>();

    for (const linha of linhas) {
      if (!linha.codigo) continue;
      if (deveAplicarFiltroOcultosTotalizador1004(filters?.excluirVendedoresOcultos1004, isContextoChevrolet10041Ativo) && vendedorNaoComissionavel1004({ codigo: linha.codigo, nome: linha.nome })) {
        continue;
      }
      const receitaBase = calcularReceitaComissaoOficial1004(
        linha,
        isContextoChevrolet10041Ativo,
        cfop6933PorVendedor1004.get(linha.codigo) || 0,
      );
      const receita = resolverReceitaComissaoOficial1004({
        receitaBase,
        detalhe: detalhePorVendedor.get(linha.codigo),
        isContextoChevrolet10041Ativo,
      });
      mapa.set(linha.codigo, {
        codigo: linha.codigo,
        nome: linha.nome || linha.codigo,
        receita,
        devolucoes: Math.abs(linha.devolucaoVenda || 0),
        qtdFat: Number(linha.qtdFat || 0),
        raw: linha.raw,
      });
    }

    return completarReceitaOficialChevrolet10041(
      mapa,
      detalhePorVendedor,
      isContextoChevrolet10041Ativo,
    );
  }, [comissao1004Query.data, cfop6933PorVendedor1004, baseReceita1004, filters?.excluirVendedoresOcultos1004, codEmpresaAtiva, isContextoChevrolet10041Ativo]);

  const podeUsarReceitaOficial1004 = useMemo(() => {
    const codEmpresaNorm = String(codEmpresaParaFiltro10041 ?? codEmpresaAtiva ?? '').trim();
    if (!isEmpresaPelegrini1004Like(codEmpresaNorm)) return false;
    if (!receitaOficial1004 || receitaOficial1004.size === 0) return false;
    if (filters?.cliente) return false;
    if (filters?.tipo && filters.tipo !== 'todos') return false;
    return true;
  }, [codEmpresaAtiva, codEmpresaParaFiltro10041, receitaOficial1004, filters?.cliente, filters?.tipo]);

  const filtrarReceitaOficial1004 = (linha: { codigo: string; nome: string }) => {
    if (filters?.vendedor && !vendedorMatchesFiltro1004(linha, filters.vendedor)) return false;
    const vendedoresNormalizados = normalizarFiltroVendedoresReceitaOficial1004(
      filters?.vendedores,
      receitaOficial1004,
      isContextoChevrolet10041Ativo,
    );
    if (vendedoresNormalizados && vendedoresNormalizados.length > 0) {
      if (!vendedoresNormalizados.some((v) => vendedorMatchesFiltro1004(linha, v))) return false;
    }
    return true;
  };

  // Receita Totalizada — regra oficial Pelegrini 1004:
  //   PEDIDO = +ValorVenda; DEVOLUCAO = -ValorDevolucao; CFOP 6.933 fora da base.
  const receitaTotalizada = useMemo(() => {
    const isEmpresa1004 = isEmpresaPelegrini1004Like(codEmpresaParaFiltro10041);

    if (isEmpresa1004 && podeUsarReceitaOficial1004 && receitaOficial1004) {
      const receitaBI = Array.from(receitaOficial1004.values())
        .filter(filtrarReceitaOficial1004)
        .reduce((acc, linha) => acc + linha.receita, 0);

      console.info('[Comercial][1004][Auditoria Receita]', {
        regra: isContextoChevrolet10041Ativo
          ? 'Receita oficial CCH = /comissoes_ch.Acumulada'
          : 'Receita oficial CT = /comissoes.FaturadoAteHoje + STVenda - vendas CFOP 6.933',
        fonte: `${resolveComissao1004Path(isContextoChevrolet10041Ativo).replace(/^\//, '')} + filtro vendedores`,
        vendedores: receitaOficial1004.size,
        receita_final_card: Math.round(receitaBI * 100) / 100,
      });

      return receitaBI;
    }

    // 1004: aplica apenas vendedor/cliente sobre a base oficial ja filtrada.
    let pool: ProdutoItem[];
    if (isEmpresa1004) {
      const vendedorFiltro = getFiltroVendedorSemEquipeCt10041(filters?.vendedor, codEmpresaParaFiltro10041, filialAtiva);
      const vendedoresFiltro = getFiltroVendedoresSemEquipeCt10041(filters?.vendedores, codEmpresaParaFiltro10041, filialAtiva);
      pool = baseReceita1004.filter((p) => {
        if (vendedorFiltro && !produtoMatchesVendedorEmpresa(p, vendedorFiltro, codEmpresaParaFiltro10041)) return false;
        if (vendedoresFiltro && vendedoresFiltro.length > 0) {
          const matches = vendedoresFiltro.some((v) => produtoMatchesVendedorEmpresa(p, v, codEmpresaParaFiltro10041));
          if (!matches) return false;
        }
        if (filters?.cliente && p.cliente_codigo !== filters.cliente) return false;
        return true;
      });
    } else {
      pool = produtosFiltrados;
    }

    let somaReceita = 0;
    let somaVenda = 0;
    let somaDevolucao = 0;
    let somaLiqFinal = 0;

    for (const it of pool) {
      const venda = Number((it as any).valor_venda_item ?? 0);
      const devol = Math.abs(Number((it as any).valor_devolucao_item ?? 0));
      const vLF = Number((it as any).valor_liquido_final_item ?? 0);
      somaReceita += Number(it.valor_total ?? 0);
      somaLiqFinal += vLF;
      somaVenda += Number.isFinite(venda) ? venda : 0;
      somaDevolucao += devol;
    }

    const receitaBI = somaReceita;

    if (isEmpresa1004) {
      console.info('[Comercial][1004][Auditoria Receita]', {
        regra: 'Receita = PEDIDO ValorVenda - DEVOLUCAO ValorDevolucao; exclui CFOP 6.933',
        fonte: 'baseReceita1004 + filtro vendedores/cliente',
        linhas: pool.length,
        soma_receita_normalizada: Math.round(somaReceita * 100) / 100,
        soma_valor_venda: Math.round(somaVenda * 100) / 100,
        soma_valor_devolucao: Math.round(somaDevolucao * 100) / 100,
        soma_vlr_liq_final_auditoria: Math.round(somaLiqFinal * 100) / 100,
        receita_final_card: Math.round(receitaBI * 100) / 100,
        totalizadores_todas_filiais_1004: usarTodasFiliais1004,
        exclui_vendedores_ocultos_1004: !!filters?.excluirVendedoresOcultos1004,
      });
    }

    return receitaBI;
  }, [produtosFiltrados, baseReceita1004, filters, codEmpresaAtiva, codEmpresaParaFiltro10041, filialAtiva, usarTodasFiliais1004, podeUsarReceitaOficial1004, receitaOficial1004, isContextoChevrolet10041Ativo]);

  // Receita por vendedor 1004 — FONTE ÚNICA.
  // Usa exatamente a mesma base e a mesma fórmula do card "Receita"
  // (PEDIDO ValorVenda - DEVOLUCAO ValorDevolucao sobre baseReceita1004), apenas
  // quebrada por vendedor. Garante que Σ vendedores === card Receita.
  const receitaPorVendedor1004 = useMemo(() => {
    const isEmpresa1004 = isEmpresaPelegrini1004Like(codEmpresaParaFiltro10041);
    const mapa = new Map<string, {
      codigo: string;
      nome: string;
      receita: number;
      devolucoes: number;
      qtdFat?: number;
      pedidos: Set<string>;
      clientes: Set<string>;
    }>();
    if (!isEmpresa1004) return mapa;

    const vendedorFiltro = getFiltroVendedorSemEquipeCt10041(filters?.vendedor, codEmpresaParaFiltro10041, filialAtiva);
    const vendedoresFiltro = getFiltroVendedoresSemEquipeCt10041(filters?.vendedores, codEmpresaParaFiltro10041, filialAtiva);
    const pool = baseReceita1004.filter((p) => {
      if (vendedorFiltro && !produtoMatchesVendedorEmpresa(p, vendedorFiltro, codEmpresaParaFiltro10041)) return false;
      if (vendedoresFiltro && vendedoresFiltro.length > 0) {
        if (!vendedoresFiltro.some((v) => produtoMatchesVendedorEmpresa(p, v, codEmpresaParaFiltro10041))) return false;
      }
      if (filters?.cliente && p.cliente_codigo !== filters.cliente) return false;
      return true;
    });

    if (podeUsarReceitaOficial1004 && receitaOficial1004) {
      const resolverVendedorChevrolet10041 = isContextoChevrolet10041Ativo
        ? criarResolvedorVendedoresChevrolet10041(pool as unknown as Array<Record<string, unknown>>)
        : null;

      for (const linha of Array.from(receitaOficial1004.values()).filter(filtrarReceitaOficial1004)) {
        mapa.set(linha.codigo, {
          codigo: linha.codigo,
          nome: linha.nome,
          receita: linha.receita,
          devolucoes: linha.devolucoes,
          qtdFat: linha.qtdFat,
          pedidos: new Set<string>(),
          clientes: new Set<string>(),
        });
      }

      for (const it of pool) {
        const vendedor = resolverVendedorChevrolet10041
          ? (resolverVendedorChevrolet10041(it as unknown as Record<string, unknown>) || getVendedorProduto10041(it))
          : {
            codigo: String((it as any).vendedor_codigo ?? '').trim(),
            nome: String((it as any).vendedor_nome ?? (it as any).vendedor_codigo ?? '').trim(),
          };
        const codigo = String(vendedor?.codigo ?? '').trim();
        const atual = mapa.get(codigo);
        if (!atual) continue;
        if (!isContextoChevrolet10041Ativo) {
          atual.devolucoes += Math.abs(Number((it as any).valor_devolucao_item ?? 0));
        }
        const codPedido = String(it.cod_pedido ?? '').trim();
        if (codPedido && codPedido !== '0' && it.tipo !== 'DEVOLUCAO') atual.pedidos.add(codPedido);
        const cli = String(it.cliente_codigo ?? '').trim();
        if (cli) atual.clientes.add(cli);
      }

      return mapa;
    }

    const resolverVendedorChevrolet10041 = isContextoChevrolet10041Ativo
      ? criarResolvedorVendedoresChevrolet10041(pool as unknown as Array<Record<string, unknown>>)
      : null;

    for (const it of pool) {
      const vendedor = resolverVendedorChevrolet10041
        ? (resolverVendedorChevrolet10041(it as unknown as Record<string, unknown>) || getVendedorProduto10041(it))
        : {
          codigo: String(
            (it as any).vendedor_codigo ?? it.vendedor_nome ?? (it as any).nome_interno ?? (it as any).nome_externo ?? '',
          ).trim() || 'SEM_VENDEDOR',
          nome: String(
            it.vendedor_nome ?? (it as any).nome_interno ?? (it as any).nome_externo ?? 'SEM VENDEDOR',
          ).trim() || 'SEM VENDEDOR',
        };
      const codigo = vendedor.codigo;
      const nome = vendedor.nome;
      const atual = mapa.get(codigo) || {
        codigo,
        nome,
        receita: 0,
        devolucoes: 0,
        qtdFat: 0,
        pedidos: new Set<string>(),
        clientes: new Set<string>(),
      };
      const devol = Math.abs(Number((it as any).valor_devolucao_item ?? 0));
      atual.receita += Number(it.valor_total ?? 0);
      atual.devolucoes += devol;
      const codPedido = String(it.cod_pedido ?? '').trim();
      if (codPedido && codPedido !== '0' && it.tipo !== 'DEVOLUCAO') atual.pedidos.add(codPedido);
      const cli = String(it.cliente_codigo ?? '').trim();
      if (cli) atual.clientes.add(cli);
      mapa.set(codigo, atual);
    }

    const somaVendedores = Array.from(mapa.values()).reduce((acc, v) => acc + v.receita, 0);
    console.info('[1004][Receita unificada]', {
      total_card_receita: Math.round(receitaTotalizada * 100) / 100,
      soma_por_vendedor: Math.round(somaVendedores * 100) / 100,
      diferenca: Math.round((somaVendedores - receitaTotalizada) * 100) / 100,
      vendedores: mapa.size,
      regra: 'PEDIDO ValorVenda - DEVOLUCAO ValorDevolucao; exclui CFOP 6.933 por vendedor',
    });

    return mapa;
  }, [baseReceita1004, filters, codEmpresaAtiva, filialAtiva, receitaTotalizada, podeUsarReceitaOficial1004, receitaOficial1004, isContextoChevrolet10041Ativo, codEmpresaParaFiltro10041]);


  const pedidosDistintosTotalizados = useMemo(() => {
    const pedidos = new Set<string>();
    for (const it of produtosFiltrados) {
      if (it.tipo === 'DEVOLUCAO') continue;
      const codPed = String(it.cod_pedido ?? '').trim();
      if (codPed && codPed !== '0') pedidos.add(codPed);
    }
    return pedidos.size;
  }, [produtosFiltrados]);

  return {
    produtos: produtosFiltrados,
    topProdutos,
    porCategoria,
    porMarca,
    produtosSemGiro,
    resumoVendas,
    vendedoresInternos,
    vendedoresExternos,
    clientesPorGrupo,
    metaConsolidada,
    receitaTotalizada,
    receitaPorVendedor1004,

    pedidosDistintosTotalizados,
    hasSource,
    isLoading: query.isLoading || (isPelegriniComercial && hasEndpoint && comissao1004Query.isLoading),
    isFetching: query.isFetching || (isPelegriniComercial && hasEndpoint && comissao1004Query.isFetching),
    error: query.error || comissao1004Query.error,
  };
}

