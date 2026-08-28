export const EQUIPE_PRINCIPAL_1004_CODES = ['78', '98', '59', '63', '71'];
export const VENDEDORES_EXTRAS_CAMPANHA_1004 = [
  { codigo: '99', nome: 'ELIANE' },
  { codigo: '11', nome: 'MARCIO CCH' },
  { codigo: '34', nome: 'FERNANDO CCH' },
  { codigo: '47', nome: 'RAFAEL CCH' },
];
export const RECEITA_1004_RULE_VERSION = 'receita-1004-comissoes-oficial-v9';

export function normalizarCfop1004(cfop: unknown): string {
  return String(cfop ?? '').replace(/[^\d]/g, '').trim();
}

export function calcularValorDevolucaoReceita1004(params: {
  valorDevolucao?: number;
  valorDescontoItem?: number;
  valorTotalLegado?: number;
  valorLiquidoFinalRaw?: number;
  cfop?: unknown;
}): number {
  const valorDevolucao = Number(params.valorDevolucao ?? 0);
  const valorTotalLegado = Number(params.valorTotalLegado ?? 0);
  const valorLiquidoFinalRaw = Number(params.valorLiquidoFinalRaw ?? 0);
  const base = Math.abs(valorDevolucao || valorTotalLegado || valorLiquidoFinalRaw);

  // No relatorio RSYS/FAT da Casa da Transmissao, devolucoes CFOP 1.411
  // entram pelo ValorLiquidoFinal. CFOP 2.202 entra liquida do desconto do item.
  const cfop = normalizarCfop1004(params.cfop);
  if (cfop === '1411' && valorLiquidoFinalRaw !== 0) {
    return Math.max(0, Math.abs(valorLiquidoFinalRaw));
  }

  const desconto = cfop === '2202'
    ? Math.max(0, Number(params.valorDescontoItem ?? 0))
    : 0;

  return Math.max(0, base - desconto);
}

export function calcularReceitaLinha1004(params: {
  tipo?: unknown;
  valorVenda?: number;
  valorLiquidoFinal?: number;
  valorDevolucao?: number;
  valorDescontoItem?: number;
  valorTotalLegado?: number;
  cfop?: unknown;
}): number {
  const tipo = String(params.tipo ?? 'PEDIDO').toUpperCase();
  if (tipo.startsWith('DEV')) {
    return -calcularValorDevolucaoReceita1004({
      valorDevolucao: params.valorDevolucao,
      valorDescontoItem: params.valorDescontoItem,
      valorTotalLegado: params.valorTotalLegado,
      valorLiquidoFinalRaw: params.valorLiquidoFinal,
      cfop: params.cfop,
    });
  }

  const valorVenda = Math.abs(Number(params.valorVenda ?? 0));
  const valorLiquidoFinal = Math.abs(Number(params.valorLiquidoFinal ?? 0));
  const valorTotalLegado = Math.abs(Number(params.valorTotalLegado ?? 0));
  return valorVenda || valorLiquidoFinal || valorTotalLegado;
}

export function corrigirVendedorAusente1004(raw: {
  CodEmpresa_bi?: unknown;
  cod_empresa_bi?: unknown;
  cod_pedido?: unknown;
  num_lancamento?: unknown;
  cod_documento?: unknown;
  num_nf?: unknown;
  cod_vendedor?: unknown;
  vendedor?: unknown;
}): { codigo: string; nome: string } | null {
  const codEmpresa = String(raw.CodEmpresa_bi ?? raw.cod_empresa_bi ?? '').trim();
  const codVendedor = String(raw.cod_vendedor ?? '').trim();
  const nomeVendedor = String(raw.vendedor ?? '').trim();
  if (codEmpresa !== '1004' || (codVendedor && codVendedor !== '0') || nomeVendedor) return null;

  // Anomalia validada no relatorio RSYS/FAT de junho/2026:
  // o endpoint detalhado retorna este lancamento sem vendedor, mas o BI oficial
  // totaliza a venda no vendedor 063 - FABIO R. Corrigimos apenas o vinculo.
  const chave = [
    raw.cod_pedido,
    raw.num_lancamento,
    raw.cod_documento,
    raw.num_nf,
  ].map((value) => String(value ?? '').trim()).join('|');

  if (chave === '529460|2176384|246509|177852') {
    return { codigo: '63', nome: 'FABIO R' };
  }

  return null;
}

export const VENDEDORES_CHEVROLET_1004 = [
  { codigo: '999', nome: 'BRUNO B' },
  { codigo: '8', nome: 'DARI' },
  { codigo: '250', nome: 'DAYVID' },
  { codigo: '512', nome: 'EDER' },
  { codigo: '99', nome: 'ELIANE' },
  { codigo: '20', nome: 'ELIELTON' },
  { codigo: '87', nome: 'EVALDO' },
  { codigo: '34', nome: 'FERNANDO M' },
  { codigo: '14', nome: 'MAGALHÃES' },
  { codigo: '11', nome: 'MARCIO' },
  { codigo: '47', nome: 'RAFAEL' },
  { codigo: '10', nome: 'XEXEU' },
];

export const VENDEDORES_CHEVROLET_1004_CODES = VENDEDORES_CHEVROLET_1004.map((v) => v.codigo);

export const NAO_COMISSIONAVEIS_1004_CODES = ['155', '33', '1082', '929', '1032', '250', '10'];

export const FORCA_P_1004_CODES = [
  '999',
  '250',
  '1032',
  '155',
  '33',
  '1082',
  '1083',
  '929',
  '940',
  '588',
  '54',
] as const;

const FORCA_P_1004_SET = new Set<string>(FORCA_P_1004_CODES);
const FORCA_P_1004_NOMES = [
  'BRUNO B',
  'DAYVID',
  'DAVID',
  'SERVICO DE TERCEIRO',
  'SERVICOS DE TERCEIRO',
  'SERVICO TERCEIRO',
  'SERVICOS TERCEIRO',
  'NATA',
  'THIAGO THOMAS',
  'THIAGO TOMAS',
  'THIAGO TOMAZ',
  'WANDERSON VIANA',
];

export function vendedorForcaP1004(vendedor: { codigo?: unknown; nome?: unknown } | null | undefined): boolean {
  if (!vendedor) return false;

  const codigo = String(vendedor.codigo ?? '').trim();
  if (codigo && FORCA_P_1004_SET.has(codigo)) return true;

  const nome = normalizeVendedor1004(vendedor.nome);
  if (!nome) return false;

  return FORCA_P_1004_NOMES.some((blocked) => nome.includes(blocked));
}

export const VENDEDORES_RELATORIO_CHEVROLET_10041_CODES = [
  '8',
  '10',
  '11',
  '14',
  '20',
  '34',
  '47',
  '51',
  '59',
  '99',
  '512',
] as const;

const VENDEDORES_RELATORIO_CHEVROLET_10041_SET = new Set<string>(
  VENDEDORES_RELATORIO_CHEVROLET_10041_CODES,
);

export const VENDEDORES_PADRAO_CHEVROLET_10041 = VENDEDORES_CHEVROLET_1004.filter(
  (vendedor) => !NAO_COMISSIONAVEIS_1004_CODES.includes(String(vendedor.codigo))
    && String(vendedor.codigo) !== '14',
);

export const VENDEDORES_PADRAO_CHEVROLET_10041_CODES = VENDEDORES_PADRAO_CHEVROLET_10041.map(
  (vendedor) => vendedor.codigo,
);

const SELECAO_ANTIGA_TODOS_CHEVROLET_10041_CODES = ['8', '512', '99', '20', '34', '14', '11', '47', '10'];
const COMPLEMENTARES_SELECAO_ANTIGA_CHEVROLET_10041_CODES = ['59'];

export function getIdsVendedoresChevrolet10041(
  vendedoresSelecionados?: Array<string | number>,
): string[] {
  return Array.from(new Set(
    (vendedoresSelecionados ?? [])
      .map((codigo) => String(codigo).trim())
      .filter((codigo) => /^\d+$/.test(codigo) && !EQUIPE_PRINCIPAL_1004_CODES.includes(codigo)),
  ));
}

export function getFiltroVendedoresChevrolet10041(
  vendedoresSelecionados: Array<string | number> | undefined,
  codEmpresa: unknown,
  filialAtiva?: unknown,
): string[] | undefined {
  if (!isContextoChevrolet10041(codEmpresa, filialAtiva)) {
    const selecionados = (vendedoresSelecionados ?? []).map((codigo) => String(codigo).trim()).filter(Boolean);
    return selecionados.length > 0 ? selecionados : undefined;
  }

  const selecionados = getIdsVendedoresChevrolet10041(vendedoresSelecionados);
  const selecionadosSet = new Set(selecionados);
  const isSelecaoAntigaTodos = SELECAO_ANTIGA_TODOS_CHEVROLET_10041_CODES.every((codigo) => selecionadosSet.has(codigo))
    && selecionados.every((codigo) => SELECAO_ANTIGA_TODOS_CHEVROLET_10041_CODES.includes(codigo));
  if (isSelecaoAntigaTodos) {
    return [...selecionados, ...COMPLEMENTARES_SELECAO_ANTIGA_CHEVROLET_10041_CODES];
  }
  return selecionados.length > 0 ? selecionados : undefined;
}

export type EquipePadraoFiltro1004 = 'transmissao' | 'chevrolet';

export function getEquipePadraoFiltro1004(
  equipe: EquipePadraoFiltro1004 = 'transmissao',
): { codes: string[]; label: string; vendedores: Array<{ codigo: string; nome: string }> } {
  if (equipe === 'chevrolet') {
    return {
      codes: [],
      label: 'Vendedores da fonte',
      vendedores: [],
    };
  }

  return {
    codes: [...EQUIPE_PRINCIPAL_1004_CODES],
    label: `Equipe principal (${EQUIPE_PRINCIPAL_1004_CODES.length})`,
    vendedores: EQUIPE_PRINCIPAL_1004_CODES.map((codigo) => ({ codigo, nome: codigo })),
  };
}

const VENDEDORES_CHEVROLET_1004_API_ALIASES: Record<string, string[]> = {
  // O filtro mostra os codigos do relatorio RSYS, mas /comercial/produtos
  // retorna alguns vendedores CCH com outro cod_vendedor.
  '250': ['1032', 'DAYVID'],
  '34': ['45', 'FERNANDO M', 'FERNANDO M CCH'],
  '47': ['85', 'RAFAEL', 'RAFAEL CCH'],
  '10': ['XEXEU', 'XEXEU CCH'],
  '8': ['DARI'],
};

const VENDEDORES_CHEVROLET_1004_CANONICAL_BY_API_CODE: Record<string, string> = {
  '1032': '250',
  '45': '34',
  '85': '47',
};

export const EQUIPE_PRINCIPAL_1004_NOMES = [
  'BRUNO',
  'DANIEL',
  'ERLAN',
  'FABIO R',
  'FABIO',
  'PAULO HENRIQUE',
];

const VENDEDORES_OCULTOS_FILTRO_1004 = [
  'ELISABETE',
  'ELIZABETH',
  'TERCEIROS',
  'TERCEIRO',
  'BRENO ESTOQUE',
  'BRENNO ESTOQUE',
  'THIAGO THOMAS',
  'THIAGO TOMAS',
  'THIAGO TOMAZ',
  'DAVID',
  'DAYVID',
  'XEXEU',
];

export function normalizeVendedor1004(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

export function isContextoChevrolet10041(
  codEmpresa: unknown,
  filialAtiva?: unknown,
  empresa?: { cod_empresa_bi?: unknown; codigo?: unknown; id?: unknown; nome?: unknown; nome_fantasia?: unknown; razao_social?: unknown } | null,
): boolean {
  const codigos = [
    codEmpresa,
    empresa?.cod_empresa_bi,
    empresa?.codigo,
    empresa?.id,
  ].map((value) => String(value ?? '').trim());
  const filial = normalizeVendedor1004(filialAtiva);
  const nomeEmpresa = normalizeVendedor1004(
    empresa?.nome ?? empresa?.nome_fantasia ?? empresa?.razao_social ?? '',
  );

  const filialChevrolet = filial === 'CHEVROLET'
    || filial === 'CCH'
    || filial === 'CH'
    || filial === '10041'
    || filial.includes('CHEVROLET');

  return codigos.includes('10041')
    || (codigos.includes('1004') && filialChevrolet)
    || (codigos.includes('1004') && nomeEmpresa.includes('CHEVROLET'));
}

export function vendedorOcultoFiltro1004(nome: unknown): boolean {
  const normalized = normalizeVendedor1004(nome);
  const isEstoque = normalized.includes('ESTOQUE');
  const isBrenoEstoque = isEstoque && (normalized.includes('BRENO') || normalized.includes('BRENNO'));
  return isBrenoEstoque || VENDEDORES_OCULTOS_FILTRO_1004.some((blocked) => normalized.includes(blocked));
}

export function vendedorOcultoFiltroContextual1004(nome: unknown, isContextoChevrolet10041Ativo = false): boolean {
  if (isContextoChevrolet10041Ativo) return false;
  return vendedorOcultoFiltro1004(nome);
}

export function montarVendedoresFiltroReceita1004(
  receitaPorVendedor: Map<string, { codigo?: unknown; nome?: unknown; receita?: unknown }> | undefined | null,
): Array<{ codigo: string; nome: string }> {
  const map = new Map<string, { codigo: string; nome: string }>();
  for (const vendedor of Array.from(receitaPorVendedor?.values?.() || [])) {
    const codigo = String(vendedor.codigo ?? '').trim();
    const nome = String(vendedor.nome ?? codigo).trim();
    const receita = Number(vendedor.receita ?? 0);
    if (!codigo || !nome || Math.abs(receita) <= 0.009) continue;
    if (!map.has(codigo)) map.set(codigo, { codigo, nome });
  }
  return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function getValorVendaFiltroChevrolet10041(record: Record<string, unknown>): number {
  const candidates = [
    record.valor_total,
    record.ValorVenda,
    record.valor_venda,
    record.valor_venda_item,
    record.valor_liquido_final_item,
    record.ValorLiquidoFinal,
    record.valor_liquido,
    record.Valor_Real,
  ];

  for (const value of candidates) {
    const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(n) && Math.abs(n) > 0.009) return n;
  }
  return 0;
}

export function montarVendedoresFiltroVendasChevrolet10041(
  movimentos: Array<Record<string, unknown>> | undefined | null,
): Array<{ codigo: string; nome: string }> {
  const map = new Map<string, { codigo: string; nome: string }>();

  for (const movimento of movimentos ?? []) {
    const tipo = normalizeVendedor1004(movimento.tipo ?? movimento.Tipo ?? 'PEDIDO');
    if (tipo.startsWith('DEV')) continue;

    const codPedido = String(movimento.cod_pedido ?? movimento.CodPedido ?? movimento.Pedido ?? '').trim();
    if (!codPedido || codPedido === '0') continue;

    const codBi = String(movimento.cod_empresa_bi ?? movimento.CodEmpresa_bi ?? '').trim();
    const filialNome = normalizeVendedor1004(movimento.filial_nome ?? movimento.Filial ?? movimento.filial);
    if (codBi && codBi !== '10041') continue;
    if (!codBi && filialNome && !filialNome.includes('CHEVROLET') && filialNome !== 'CH' && filialNome !== 'CCH') continue;

    if (getValorVendaFiltroChevrolet10041(movimento) <= 0.009) continue;

    const vendedor = getVendedorCasaChevrolet10041FromRecord(movimento);
    const codigo = String(vendedor?.codigo ?? '').trim();
    const nome = String(vendedor?.nome ?? codigo).trim();
    if (!codigo || !nome || codigo === 'SEM_VENDEDOR') continue;
    if (!map.has(codigo)) map.set(codigo, { codigo, nome });
  }

  return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function unirVendedoresFiltro1004(
  ...listas: Array<Array<{ codigo?: unknown; nome?: unknown }> | undefined | null>
): Array<{ codigo: string; nome: string }> {
  const map = new Map<string, { codigo: string; nome: string }>();

  for (const lista of listas) {
    for (const vendedor of lista ?? []) {
      const codigo = String(vendedor.codigo ?? '').trim();
      const nome = String(vendedor.nome ?? codigo).trim();
      if (!codigo || !nome) continue;
      const atual = map.get(codigo);
      const nomeAtualEhCodigo = atual && normalizeVendedor1004(atual.nome) === normalizeVendedor1004(atual.codigo);
      if (!atual || nomeAtualEhCodigo) map.set(codigo, { codigo, nome });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function somarDevolucoesReceitaVendedores1004(
  vendedores: Array<{ totalDevolucoes?: unknown; devolucoes?: unknown }> | undefined | null,
): number {
  return (vendedores ?? []).reduce((acc, vendedor) => {
    const valor = Number(vendedor.totalDevolucoes ?? vendedor.devolucoes ?? 0);
    return acc + Math.abs(Number.isFinite(valor) ? valor : 0);
  }, 0);
}

export function vendedorPodeAparecerNoComercial1004<T extends { nome?: unknown }>(vendedor: T): boolean {
  return !vendedorOcultoFiltro1004(vendedor.nome);
}

export function vendedorEquipePrincipal1004(vendedor: { codigo?: unknown; nome?: unknown }): boolean {
  const codigo = String(vendedor.codigo ?? '').trim();
  if (EQUIPE_PRINCIPAL_1004_CODES.includes(codigo)) return true;

  const normalized = normalizeVendedor1004(vendedor.nome);
  return EQUIPE_PRINCIPAL_1004_NOMES.some((nome) => normalized.includes(nome));
}

export function aplicarEquipePrincipal1004AoFiltro<T>(
  filters: T | undefined,
): T | undefined {
  if (!filters) return filters;
  const f = filters as {
    vendedores?: Array<string | number>;
    vendedor?: string | number;
  };
  const vendedoresAtuais = (f.vendedores || []).map(String);
  const vendedorUnico = f.vendedor != null ? [String(f.vendedor)] : [];
  const vendedoresSelecionados = Array.from(new Set([...vendedoresAtuais, ...vendedorUnico]));
  const vendedores = vendedoresSelecionados.length > 0
    ? vendedoresSelecionados
    : EQUIPE_PRINCIPAL_1004_CODES;

  return {
    ...(filters as Record<string, unknown>),
    vendedores,
    vendedor: undefined,
    // A tela 1004 representa a Casa da Transmissao. Vendedores da Chevrolet
    // podem aparecer quando vendem para a CT, mas a base de receita nao deve
    // trocar para cod_empresa_bi=10041, pois isso soma vendas da Chevrolet.
    incluirTodasFiliais1004: false,
  } as unknown as T;
}

export function aplicarEquipeChevrolet10041AoFiltro<T>(
  filters: T | undefined,
): T | undefined {
  if (!filters) return filters;

  const filtro = filters as {
    vendedores?: Array<string | number>;
    vendedor?: string | number;
  };
  const vendedoresSelecionados = [
    ...(filtro.vendedores ?? []),
    ...(filtro.vendedor != null ? [filtro.vendedor] : []),
  ];

  return {
    ...(filters as Record<string, unknown>),
    vendedores: getFiltroVendedoresChevrolet10041(vendedoresSelecionados, '10041'),
    vendedor: undefined,
    incluirTodasFiliais1004: false,
  } as unknown as T;
}

export function aplicarEquipeContextualPelegrini1004AoFiltro<T>(
  filters: T | undefined,
  codEmpresa: unknown,
  filialAtiva?: unknown,
  empresa?: { cod_empresa_bi?: unknown; codigo?: unknown; id?: unknown; nome?: unknown; nome_fantasia?: unknown; razao_social?: unknown } | null,
): T | undefined {
  const cod = String(codEmpresa ?? '').trim();
  if (isContextoChevrolet10041(codEmpresa, filialAtiva, empresa)) {
    return aplicarEquipeChevrolet10041AoFiltro(filters);
  }
  if (cod === '1004') return aplicarEquipePrincipal1004AoFiltro(filters);
  return filters;
}

export function relacionarMovimentosVendedoresChevrolet10041<T extends { codigo: string | number; nome?: unknown }>(
  movimentos: T[],
  vendedoresSelecionados?: Array<string | number>,
): Array<{ codigo: string; nome: string; movimento: T | undefined }> {
  const idsSelecionados = new Set(getIdsVendedoresChevrolet10041(vendedoresSelecionados));

  return movimentos
    .map((movimento) => {
      const codigo = String(movimento.codigo ?? '').trim();
      const nome = String(movimento.nome ?? codigo).trim();
      return { codigo, nome, movimento };
    })
    .filter(({ codigo }) => codigo && (idsSelecionados.size === 0 || idsSelecionados.has(codigo)));
}

export function montarVendedoresVisualizacaoChevrolet10041<T extends { codigo: string | number; nome?: unknown }>(
  movimentos: T[],
  vendedoresSelecionados: Array<string | number> | undefined,
  criarSemMovimento: (vendedor: { codigo: string; nome: string }) => T,
): T[] {
  return relacionarMovimentosVendedoresChevrolet10041(
    movimentos,
    vendedoresSelecionados,
  ).map(({ codigo, nome, movimento }) => (
    movimento
      ? { ...movimento, codigo, nome }
      : criarSemMovimento({ codigo, nome })
  ));
}

export function criarFiltroTotalizadores1004<T>(
  filters: T | undefined,
): (T & {
  ignorarEquipePadrao: true;
  excluirVendedoresOcultos1004: true;
}) | undefined {
  if (!filters) return undefined;
  return {
    ...(filters as Record<string, unknown>),
    ignorarEquipePadrao: true,
    excluirVendedoresOcultos1004: true,
    incluirTodasFiliais1004: false,
  } as unknown as T & { ignorarEquipePadrao: true; excluirVendedoresOcultos1004: true };
}

export function vendedorNaoComissionavel1004(vendedor: { codigo?: unknown; nome?: unknown }): boolean {
  const codigo = String(vendedor.codigo ?? '').trim();
  if (NAO_COMISSIONAVEIS_1004_CODES.includes(codigo)) return true;
  return vendedorOcultoFiltro1004(vendedor.nome);
}

export function vendedorPertenceRelatorioChevrolet10041(vendedor: { codigo?: unknown; nome?: unknown } | null | undefined): boolean {
  if (!vendedor) return false;

  const canonico = canonizarVendedorChevrolet1004(vendedor) || {
    codigo: String(vendedor.codigo ?? '').trim(),
    nome: String(vendedor.nome ?? '').trim(),
  };
  const codigo = String(canonico.codigo ?? '').trim();
  const nome = normalizeVendedor1004(canonico.nome);

  if (VENDEDORES_RELATORIO_CHEVROLET_10041_SET.has(codigo)) return true;

  if (nome.includes('ERLAN') && nome.includes('C.CH')) return true;
  if (nome.includes('WANDERSON') && (codigo === '51' || nome.includes('LIGEI'))) return true;

  return false;
}

export function isServicoForaRelatorioChevrolet10041(record: Record<string, unknown>): boolean {
  const cfop = normalizarCfop1004(
    record.cfop ?? record.CFOP ?? record.num_cfop ?? record.NumCfop ?? record.cod_cfop ?? record.CodCfop,
  );
  if (cfop === '5933' || cfop === '6933') return true;

  const descricao = normalizeVendedor1004(
    record.descricao ?? record.Descricao ?? record.produto ?? record.Produto ?? record.descricao_produto ?? record.DescricaoProduto,
  );
  return descricao === 'SERVICO' || descricao === 'SERVICOS';
}

export function vendedorMatchesFiltro1004(
  vendedor: { codigo?: unknown; nome?: unknown },
  filtro: unknown,
): boolean {
  const codigo = String(vendedor.codigo ?? '').trim();
  const nome = normalizeVendedor1004(vendedor.nome);
  const target = String(filtro ?? '').trim();
  const targetNorm = normalizeVendedor1004(target);

  if (target === '999' && nome === 'BRUNO B') return true;

  const aliases = VENDEDORES_CHEVROLET_1004_API_ALIASES[target] || [];
  if (aliases.length > 0) {
    return aliases.some((alias) => {
      const aliasRaw = String(alias).trim();
      const aliasNorm = normalizeVendedor1004(aliasRaw);
      return codigo === aliasRaw || nome === aliasNorm || nome.includes(aliasNorm);
    });
  }

  if (codigo && codigo === target) return true;
  return !!targetNorm && (nome === targetNorm || nome.includes(targetNorm));
}

export function canonizarVendedorChevrolet1004(
  vendedor: { codigo?: unknown; nome?: unknown },
): { codigo: string; nome: string } | null {
  if (normalizeVendedor1004(vendedor.nome) === 'BRUNO B') {
    return { codigo: '999', nome: 'BRUNO B' };
  }

  for (const vendedorChevrolet of VENDEDORES_CHEVROLET_1004) {
    if (vendedorMatchesFiltro1004(vendedor, vendedorChevrolet.codigo)) {
      return vendedorChevrolet;
    }
  }
  return null;
}

export function getVendedorChevrolet1004FromRecord(
  record: Record<string, unknown>,
): { codigo: string; nome: string } | null {
  const candidatos = [
    { codigo: record.cod_vendedor_chevrolet ?? record.CodVendedorChevrolet ?? record.cod_vendedor_ch ?? record.CodVendedorCH, nome: record.vendedor_chevrolet ?? record.VendedorChevrolet ?? record.nome_vendedor_chevrolet ?? record.NomeVendedorChevrolet ?? record.vendedor_ch ?? record.VendedorCH ?? record.nome_vendedor_ch ?? record.NomeVendedorCH },
    { codigo: record.cod_vendedor_cch ?? record.CodVendedorCCH, nome: record.vendedor_cch ?? record.VendedorCCH ?? record.nome_vendedor_cch ?? record.NomeVendedorCCH },
    { codigo: record.cod_vendedor_comissao ?? record.CodVendedorComissao, nome: record.vendedor_comissao ?? record.VendedorComissao ?? record.nome_vendedor_comissao ?? record.NomeVendedorComissao },
    { codigo: record.cod_vendedor_representante ?? record.CodVendedorRepresentante ?? record.cod_representante ?? record.CodRepresentante, nome: record.vendedor_representante ?? record.VendedorRepresentante ?? record.nome_representante ?? record.NomeRepresentante ?? record.representante ?? record.Representante },
    { codigo: record.cod_vendedor_filial ?? record.CodVendedorFilial, nome: record.vendedor_filial ?? record.VendedorFilial ?? record.nome_vendedor_filial ?? record.NomeVendedorFilial },
    { codigo: record.cod_vendedor_origem ?? record.CodVendedorOrigem, nome: record.vendedor_origem ?? record.VendedorOrigem ?? record.nome_vendedor_origem ?? record.NomeVendedorOrigem },
    { codigo: record.cod_vendedor_externo ?? record.CodVendedorExterno, nome: record.vendedor_externo ?? record.VendedorExterno ?? record.nome_externo ?? record.NomeExterno },
    { codigo: record.cod_vendedor_interno ?? record.CodVendedorInterno, nome: record.vendedor_interno ?? record.VendedorInterno ?? record.nome_interno ?? record.NomeInterno },
    { codigo: record.cod_vendedor_meta ?? record.CodVendedorMeta, nome: record.vendedor_meta ?? record.VendedorMeta ?? record.nome_vendedor_meta ?? record.NomeVendedorMeta },
    { codigo: record.vendedor_codigo ?? record.cod_vendedor ?? record.CodVendedor ?? record.VendedorCodigo, nome: record.vendedor_nome ?? record.vendedor ?? record.Vendedor ?? record.VendedorNome ?? record.NomeVendedor },
  ];

  for (const candidato of candidatos) {
    const vendedor = canonizarVendedorChevrolet1004(candidato);
    if (vendedor) return vendedor;
  }

  return null;
}

function getVendedorPrincipalFromRecord(
  record: Record<string, unknown>,
): { codigo: string; nome: string } | null {
  const candidatos = [
    { codigo: record.vendedor_codigo ?? record.cod_vendedor ?? record.CodVendedor ?? record.VendedorCodigo, nome: record.vendedor_nome ?? record.vendedor ?? record.Vendedor ?? record.VendedorNome ?? record.NomeVendedor },
    { codigo: record.cod_vendedor_externo ?? record.CodVendedorExterno, nome: record.vendedor_externo ?? record.VendedorExterno ?? record.nome_externo ?? record.NomeExterno },
    { codigo: record.cod_vendedor_interno ?? record.CodVendedorInterno, nome: record.vendedor_interno ?? record.VendedorInterno ?? record.nome_interno ?? record.NomeInterno },
    { codigo: record.cod_vendedor_meta ?? record.CodVendedorMeta, nome: record.vendedor_meta ?? record.VendedorMeta ?? record.nome_vendedor_meta ?? record.NomeVendedorMeta },
    { codigo: record.cod_vendedor_comissao ?? record.CodVendedorComissao, nome: record.vendedor_comissao ?? record.VendedorComissao ?? record.nome_vendedor_comissao ?? record.NomeVendedorComissao },
    { codigo: record.cod_vendedor_representante ?? record.CodVendedorRepresentante ?? record.cod_representante ?? record.CodRepresentante, nome: record.vendedor_representante ?? record.VendedorRepresentante ?? record.nome_representante ?? record.NomeRepresentante ?? record.representante ?? record.Representante },
  ];

  for (const candidato of candidatos) {
    const codigo = String(candidato.codigo ?? '').trim();
    const nome = String(candidato.nome ?? '').trim();
    const codigoValido = codigo && codigo !== '0';
    const nomeValido = nome && normalizeVendedor1004(nome) !== '0';
    if (!codigoValido && !nomeValido) continue;
    return {
      codigo: codigoValido ? codigo : nome,
      nome: nomeValido ? nome : `Vendedor ${codigo}`,
    };
  }

  return null;
}

export function getVendedorCasaChevrolet10041FromRecord(
  record: Record<string, unknown>,
): { codigo: string; nome: string } | null {
  const codBi = String(record.cod_empresa_bi ?? record.CodEmpresa_bi ?? '').trim();
  const filialNome = normalizeVendedor1004(record.filial_nome ?? record.Filial ?? record.filial);
  if (codBi && codBi !== '10041') return null;
  if (!codBi && filialNome && !filialNome.includes('CHEVROLET')) return null;

  const vendedorExplicito = getVendedorChevrolet1004FromRecord(record);
  if (vendedorExplicito) return vendedorExplicito;

  const vendedorPrincipal = getVendedorPrincipalFromRecord(record);
  if (vendedorPrincipal) return vendedorPrincipal;

  return null;
}

function getChavesDocumentoVendedor10041(record: Record<string, unknown>): string[] {
  const chaves: string[] = [];
  const add = (prefix: string, value: unknown) => {
    const raw = String(value ?? '').trim();
    if (!raw || raw === '0') return;
    chaves.push(`${prefix}:${normalizeVendedor1004(raw)}`);
  };

  add('DOC', record.cod_documento ?? record.CodDocumento ?? record.cod_pedido ?? record.CodPedido);
  add('NF', record.num_nf ?? record.NumNf ?? record.NumNF ?? record.numero_nf ?? record.NumeroNF);
  add('PED', record.cod_pedido ?? record.CodPedido);
  add('DOC', record.cod_documento_origem ?? record.CodDocumentoOrigem ?? record.documento_origem ?? record.DocumentoOrigem ?? record.num_documento_origem ?? record.NumDocumentoOrigem);
  add('NF', record.num_nf_origem ?? record.NumNfOrigem ?? record.NumNFOrigem ?? record.nf_origem ?? record.NfOrigem ?? record.nota_origem ?? record.NotaOrigem ?? record.numero_nf_origem ?? record.NumeroNFOrigem);
  add('PED', record.cod_pedido_origem ?? record.CodPedidoOrigem ?? record.pedido_origem ?? record.PedidoOrigem ?? record.num_pedido_origem ?? record.NumPedidoOrigem);

  return Array.from(new Set(chaves));
}

function getChavesClienteVendedor10041(record: Record<string, unknown>): string[] {
  const chaves: string[] = [];
  const add = (value: unknown) => {
    const raw = String(value ?? '').trim();
    if (!raw || raw === '0') return;
    chaves.push(`CLI:${normalizeVendedor1004(raw)}`);
  };

  add(record.cliente_codigo ?? record.cod_cliente ?? record.CodCliente ?? record.codigo_cliente ?? record.CodigoCliente);
  add(record.cliente_razao ?? record.cliente ?? record.Cliente ?? record.nome_cliente ?? record.NomeCliente ?? record.razao_social ?? record.RazaoSocial);

  return Array.from(new Set(chaves));
}

function parseValorVendedor10041(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value ?? '').replace(/[^\d,.-]/g, '').trim();
  if (!text) return 0;
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isDevolucaoVendedor10041(record: Record<string, unknown>): boolean {
  const tipo = normalizeVendedor1004(record.tipo ?? record.Tipo ?? record.tipo_movimento ?? record.TipoMovimento);
  return tipo.startsWith('DEV');
}

function getValorItemVendedor10041(record: Record<string, unknown>): number {
  const valorDevolucao = parseValorVendedor10041(
    record.valor_devolucao_item ?? record.ValorDevolucao ?? record.valor_devolucao ?? record.Valor_Devolucao,
  );
  const valorVenda = parseValorVendedor10041(
    record.valor_venda_item ?? record.ValorVenda ?? record.valor_venda ?? record.Valor_Venda,
  );
  const valorTotal = parseValorVendedor10041(record.valor_total ?? record.ValorTotal ?? record.ValorLiquidoFinal);
  return Math.abs(valorDevolucao || valorVenda || valorTotal);
}

function getChavesClienteProdutoValorVendedor10041(record: Record<string, unknown>): string[] {
  const valor = getValorItemVendedor10041(record);
  if (!valor) return [];

  const produto = normalizeVendedor1004(
    record.descricao ?? record.produto ?? record.Produto ?? record.descricao_produto ?? record.DescricaoProduto,
  );
  if (!produto) return [];

  const valorKey = Math.round(valor * 100);
  return getChavesClienteVendedor10041(record).map((clienteKey) => `${clienteKey}|PROD:${produto}|VAL:${valorKey}`);
}

function sameVendedor10041(a: { codigo: string; nome: string }, b: { codigo: string; nome: string }): boolean {
  return String(a.codigo) === String(b.codigo)
    || normalizeVendedor1004(a.nome) === normalizeVendedor1004(b.nome);
}

export function criarResolvedorVendedoresChevrolet10041<T extends Record<string, unknown>>(
  records: T[],
): (record: T) => { codigo: string; nome: string } | null {
  const vendedorPorChave = new Map<string, { codigo: string; nome: string } | null>();
  const vendedorPorCliente = new Map<string, { codigo: string; nome: string } | null>();
  const vendedorPorClienteProdutoValor = new Map<string, { codigo: string; nome: string } | null>();

  for (const record of records) {
    const vendedor = getVendedorCasaChevrolet10041FromRecord(record);
    if (!vendedor) continue;

    for (const chave of getChavesDocumentoVendedor10041(record)) {
      const atual = vendedorPorChave.get(chave);
      if (atual === undefined) {
        vendedorPorChave.set(chave, vendedor);
      } else if (atual && !sameVendedor10041(atual, vendedor)) {
        vendedorPorChave.set(chave, null);
      }
    }

    for (const chave of getChavesClienteVendedor10041(record)) {
      const atual = vendedorPorCliente.get(chave);
      if (atual === undefined) {
        vendedorPorCliente.set(chave, vendedor);
      } else if (atual && !sameVendedor10041(atual, vendedor)) {
        vendedorPorCliente.set(chave, null);
      }
    }

    if (!isDevolucaoVendedor10041(record)) {
      for (const chave of getChavesClienteProdutoValorVendedor10041(record)) {
        const atual = vendedorPorClienteProdutoValor.get(chave);
        if (atual === undefined) {
          vendedorPorClienteProdutoValor.set(chave, vendedor);
        } else if (atual && !sameVendedor10041(atual, vendedor)) {
          vendedorPorClienteProdutoValor.set(chave, null);
        }
      }
    }
  }

  return (record: T) => {
    const vendedorDireto = getVendedorCasaChevrolet10041FromRecord(record);

    const vendedorPorOrigem = () => {
      for (const chave of getChavesDocumentoVendedor10041(record)) {
        const vendedor = vendedorPorChave.get(chave);
        if (vendedor) return vendedor;
      }

      for (const chave of getChavesClienteVendedor10041(record)) {
        const vendedor = vendedorPorCliente.get(chave);
        if (vendedor) return vendedor;
      }

      for (const chave of getChavesClienteProdutoValorVendedor10041(record)) {
        const vendedor = vendedorPorClienteProdutoValor.get(chave);
        if (vendedor) return vendedor;
      }

      return null;
    };

    if (isDevolucaoVendedor10041(record)) {
      const vendedorOrigem = vendedorPorOrigem();
      if (vendedorOrigem) return vendedorOrigem;
    }

    if (vendedorDireto) return vendedorDireto;

    const vendedorOrigem = vendedorPorOrigem();
    if (vendedorOrigem) return vendedorOrigem;

    return null;
  };
}

export function montarVendedoresElegiveisFiltro1004<T extends { codigo?: unknown; nome?: unknown }>(
  vendedores: T[],
): Array<{ codigo: string; nome: string }> {
  const map = new Map<string, { codigo: string; nome: string }>();

  for (const vendedor of vendedores) {
    if (!vendedorPodeAparecerNoComercial1004(vendedor)) continue;

    const codigoApi = String(vendedor.codigo ?? '').trim();
    const nome = String(vendedor.nome ?? '').trim();
    if (!codigoApi || !nome) continue;

    const codigo = VENDEDORES_CHEVROLET_1004_CANONICAL_BY_API_CODE[codigoApi] ?? codigoApi;
    const vendedorDaEquipeTransmissao = EQUIPE_PRINCIPAL_1004_CODES.includes(codigo);
    const vendedorChevroletComVendaTransmissao = VENDEDORES_CHEVROLET_1004_CODES.includes(codigo);
    if (!vendedorDaEquipeTransmissao && !vendedorChevroletComVendaTransmissao) continue;

    if (!map.has(codigo)) map.set(codigo, { codigo, nome });
  }

  return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
