import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { 
  Pedido, 
  Devolucao, 
  VendedorPerformance, 
  ClientePerformance,
  EvolucaoDiaria,
  EvolucaoMensal,
  ComercialKPIs,
  ComercialFilters,
  InsightData
} from '@/types/comercial';
import { mockPedidos, mockDevolucoes } from '@/data/comercialMock';
import { useAuth } from '@/contexts/AuthContext';
import { buildApiProxyUrl } from '@/utils/apiEndpointResolver';
import { useEmpresaSelecionada } from '@/contexts/EmpresaSelecionadaContext';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { filtrarPorFilial, filtrarPorEquipePadrao } from '@/utils/filialFilter';
import { empresaPossuiFiliais } from '@/config/filiaisEmpresa';
import { resolveComercialEndpointPath, resolveComercialJsonPath, resolveCodEmpresaBiParam } from '@/utils/filialEndpoint';
import { supabase } from '@/integrations/supabase/client';
import type { Empresa } from '@/hooks/useEmpresaConfig';
import {
  resolverQuantidadeVendasPelegrini,
} from '@/utils/comercialKpiFallback';
import {
  calcularReceitaLinha1004,
  calcularValorDevolucaoReceita1004,
  EQUIPE_PRINCIPAL_1004_CODES,
  EQUIPE_PRINCIPAL_1004_NOMES,
  getFiltroVendedoresChevrolet10041,
  getVendedorCasaChevrolet10041FromRecord,
  isServicoForaRelatorioChevrolet10041,
  isContextoChevrolet10041 as isContextoChevrolet10041Util,
  normalizeVendedor1004,
  RECEITA_1004_RULE_VERSION,
  vendedorForcaP1004,
  vendedorPertenceRelatorioChevrolet10041,
  vendedorMatchesFiltro1004,
} from '@/utils/vendedores1004';

// ============================================================
// Normalização de campos para diferentes formatos de JSON
// ============================================================

function getFieldValue<T>(item: any, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null) {
      return item[key] as T;
    }
  }
  return undefined;
}

function parseComercialNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const cleaned = value.replace(/[^\d,.-]/g, '').trim();
  if (!cleaned) return 0;
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isEmpresa1004Code(codEmpresa: unknown): boolean {
  const cod = String(codEmpresa ?? '').trim();
  return cod === '1004' || cod === '10041';
}

function getPedidoNumero(p: Pick<Pedido, 'numero' | 'id'>): string {
  return String((p as any).numero ?? (p as any).id ?? '').trim();
}

function toDateKey(value: unknown): string {
  return String(value ?? '').trim().substring(0, 10);
}

const CLIENTE_PRIMEIRA_COMPRA_ALIASES = [
  'primeira_compra',
  'PrimeiraCompra',
  'primeiraCompra',
  'data_primeira_compra',
  'DataPrimeiraCompra',
  'Data_Primeira_Compra',
  'dt_primeira_compra',
  'DtPrimeiraCompra',
  'primeira_compra_cliente',
  'PrimeiraCompraCliente',
  'data_primeira_compra_cliente',
  'DataPrimeiraCompraCliente',
];

const CLIENTE_CADASTRO_ALIASES = [
  'data_cadastro_cliente',
  'DataCadastroCliente',
  'Data_Cadastro_Cliente',
  'dt_cadastro_cliente',
  'dtCadastroCliente',
  'data_cadastro',
  'DataCadastro',
  'Data_Cadastro',
  'dt_cadastro',
  'DtCadastro',
  'cadastro_cliente',
  'CadastroCliente',
];

function getDataPrimeiraCompraOuCadastroCliente(item: any): string {
  return toDateKey(
    getFieldValue(item, ...CLIENTE_PRIMEIRA_COMPRA_ALIASES) ??
    getFieldValue(item, ...CLIENTE_CADASTRO_ALIASES),
  );
}

function isDateKeyInRange(value: unknown, inicio?: string, fim?: string): boolean {
  const data = toDateKey(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const ini = toDateKey(inicio);
  const end = toDateKey(fim);
  if (ini && data < ini) return false;
  if (end && data > end) return false;
  return true;
}

export function calcularPrimeirasComprasPorCliente(
  pedidos: Pedido[],
  options?: { periodoInicio?: string },
): Map<string, string> {
  const primeirasCompras = new Map<string, string>();
  const periodoInicio = toDateKey(options?.periodoInicio);
  const temPeriodoInicio = /^\d{4}-\d{2}-\d{2}$/.test(periodoInicio);
  const baseTemHistoricoAntesDoPeriodo = temPeriodoInicio
    ? pedidos.some((p) => {
      if (p.tipo === 'DEVOLUCAO') return false;
      const dataPedido = toDateKey(p.data_pedido || p.data_faturamento);
      return /^\d{4}-\d{2}-\d{2}$/.test(dataPedido) && dataPedido < periodoInicio;
    })
    : true;

  pedidos.forEach((p) => {
    if (p.tipo === 'DEVOLUCAO') return;
    const cliente = String(p.cliente_codigo ?? '').trim();
    if (!cliente) return;
    const dataCadastro = getDataPrimeiraCompraOuCadastroCliente(p);
    const temCadastro = /^\d{4}-\d{2}-\d{2}$/.test(dataCadastro);
    if (!temCadastro && !baseTemHistoricoAntesDoPeriodo) return;
    const data = temCadastro ? dataCadastro : toDateKey(p.data_pedido || p.data_faturamento);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return;
    const atual = primeirasCompras.get(cliente);
    if (!atual || data < atual) primeirasCompras.set(cliente, data);
  });

  return primeirasCompras;
}

function getVendedorNomeNormalizado(p: Pick<Pedido, 'vendedor_nome' | 'vendedor_codigo'>): string {
  return String(p.vendedor_nome ?? p.vendedor_codigo ?? '').trim().toUpperCase();
}

function isFiltroEquipeCt10041(value: unknown): boolean {
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  if (EQUIPE_PRINCIPAL_1004_CODES.map(String).includes(raw)) return true;

  const normalized = normalizeVendedor1004(raw);
  return EQUIPE_PRINCIPAL_1004_NOMES.some((nome) => normalized.includes(normalizeVendedor1004(nome)));
}

function getFiltroVendedoresSemEquipeCt10041(
  vendedores: ComercialFilters['vendedores'] | undefined,
  codEmpresa: unknown,
  filialAtiva?: unknown,
): string[] | undefined {
  const isContexto10041 = isContextoChevrolet10041Util(codEmpresa, filialAtiva);
  if (!isContexto10041) {
    if (!vendedores || vendedores.length === 0) return undefined;
    return vendedores.map((v) => String(v).trim()).filter(Boolean);
  }

  return getFiltroVendedoresChevrolet10041(vendedores, codEmpresa, filialAtiva);
}

function getFiltroVendedorSemEquipeCt10041(
  vendedor: ComercialFilters['vendedor'] | undefined,
  codEmpresa: unknown,
  filialAtiva?: unknown,
): string | undefined {
  if (vendedor === undefined || vendedor === null || vendedor === '') return undefined;
  const codigo = String(vendedor).trim();
  const isContexto10041 = isContextoChevrolet10041Util(codEmpresa, filialAtiva);
  if (!isContexto10041) return codigo;
  if (isFiltroEquipeCt10041(codigo)) return undefined;
  return codigo;
}

function getValorLiquidoFinal1004(p: Pedido): number {
  const explicit = (p as any).valor_liquido_final;
  if (explicit !== undefined && explicit !== null && Number.isFinite(Number(explicit))) {
    return Math.abs(Number(explicit));
  }

  const bruto = Math.abs(Number(p.valor_bruto || 0));
  const desconto = Math.abs(Number(p.valor_desconto || 0));
  return Math.max(0, bruto - desconto);
}

function getValorDevolucao1004(p: Pedido): number {
  return calcularValorDevolucaoReceita1004({
    valorDevolucao: Number((p as any).valor_devolucao_real || 0),
    valorDescontoItem: Number((p as any).valor_desconto || 0),
    valorTotalLegado: Number((p as any).valor_real || p.valor_liquido || 0),
    valorLiquidoFinalRaw: Number((p as any).valor_liquido_coluna || 0),
    cfop: (p as any).cfop ?? (p as any).num_cfop,
  });
}

function getReceitaLiquida1004(p: Pedido): number {
  return calcularReceitaLinha1004({
    tipo: p.tipo,
    valorVenda: Number(p.valor_bruto || 0),
    valorLiquidoFinal: Number((p as any).valor_liquido_final || p.valor_liquido || 0),
    valorDevolucao: Number((p as any).valor_devolucao_real || 0),
    valorDescontoItem: Number((p as any).valor_desconto || 0),
    valorTotalLegado: Number((p as any).valor_real || p.valor_liquido || 0),
    cfop: (p as any).cfop ?? (p as any).num_cfop,
  });
}

function isCasaChevrolet(p: Pick<Pedido, 'filial_nome'>): boolean {
  return String(p.filial_nome ?? '').toUpperCase().includes('CHEVROLET');
}

function hasValorFinanceiroValido(p: Pedido): boolean {
  const bruto = Math.abs(p.valor_bruto || 0);
  const liq = Math.abs(p.valor_liquido || 0);
  const real = Math.abs((p as any).valor_real || 0);
  const dev = Math.abs((p as any).valor_devolucao_real || 0);
  return bruto > 0 || liq > 0 || real > 0 || dev > 0;
}

function isPedidoVendaValido1004(p: Pedido): boolean {
  if ((p.tipo || 'PEDIDO') !== 'PEDIDO') return false;
  const codPed = getPedidoNumero(p);
  if (!codPed || codPed === '0') return false;
  if (!getVendedorNomeNormalizado(p)) return false;
  if (isCasaChevrolet(p)) return false;
  return hasValorFinanceiroValido(p);
}

export function pedidoPertenceForcaP1004(p: Partial<Pedido | Devolucao> | Record<string, unknown>): boolean {
  const anyP = p as Record<string, unknown>;
  const candidatos = [
    { codigo: anyP.vendedor_codigo ?? anyP.cod_vendedor ?? anyP.CodVendedor ?? anyP.VendedorCodigo, nome: anyP.vendedor_nome ?? anyP.vendedor ?? anyP.Vendedor ?? anyP.VendedorNome },
    { codigo: anyP.cod_vendedor_chevrolet ?? anyP.CodVendedorChevrolet, nome: anyP.vendedor_chevrolet ?? anyP.VendedorChevrolet ?? anyP.nome_vendedor_chevrolet ?? anyP.NomeVendedorChevrolet },
    { codigo: anyP.cod_vendedor_cch ?? anyP.CodVendedorCCH, nome: anyP.vendedor_cch ?? anyP.VendedorCCH ?? anyP.nome_vendedor_cch ?? anyP.NomeVendedorCCH },
    { codigo: anyP.cod_vendedor_comissao ?? anyP.CodVendedorComissao, nome: anyP.vendedor_comissao ?? anyP.VendedorComissao ?? anyP.nome_vendedor_comissao ?? anyP.NomeVendedorComissao },
    { codigo: anyP.cod_vendedor_externo ?? anyP.CodVendedorExterno, nome: anyP.vendedor_externo ?? anyP.VendedorExterno ?? anyP.nome_externo ?? anyP.NomeExterno },
    { codigo: anyP.cod_vendedor_interno ?? anyP.CodVendedorInterno, nome: anyP.vendedor_interno ?? anyP.VendedorInterno ?? anyP.nome_interno ?? anyP.NomeInterno },
    { codigo: anyP.cod_vendedor_meta ?? anyP.CodVendedorMeta, nome: anyP.vendedor_meta ?? anyP.VendedorMeta ?? anyP.NomeVendedorMeta },
    { codigo: anyP.cod_vendedor_representante ?? anyP.CodVendedorRepresentante ?? anyP.cod_representante ?? anyP.CodRepresentante, nome: anyP.vendedor_representante ?? anyP.VendedorRepresentante ?? anyP.representante ?? anyP.Representante },
  ];

  return candidatos.some((vendedor) => vendedorForcaP1004(vendedor));
}

export function filtrarEscopoPelegriniComercial1004<T extends Record<string, unknown>>(
  registros: T[],
  options: { codEmpresa?: unknown; isChevrolet10041Ativa?: boolean },
): T[] {
  const codEmpresa = String(options.codEmpresa ?? '').trim();
  const isPelegrini = codEmpresa === '1004' || codEmpresa === '10041' || options.isChevrolet10041Ativa === true;
  if (!isPelegrini) return registros;
  const isChevrolet10041 = codEmpresa === '10041' || options.isChevrolet10041Ativa === true;
  return registros.filter((registro) => {
    if (pedidoPertenceForcaP1004(registro)) return false;
    if (!isChevrolet10041) return true;
    if (isServicoForaRelatorioChevrolet10041(registro)) return false;
    return vendedorPertenceRelatorioChevrolet10041(getVendedorCasaChevrolet10041FromRecord(registro));
  });
}

function isDevolucaoValida1004(p: Pedido): boolean {
  if (p.tipo !== 'DEVOLUCAO') return false;
  // Na Pelegrini/CT as devoluções vêm do endpoint de pedidos com cod_pedido=0.
  // Elas são documentos fiscais válidos e precisam entrar para bater o BI/PDF.
  if (!getVendedorNomeNormalizado(p)) return false;
  if (isCasaChevrolet(p)) return false;
  return Math.abs((p as any).valor_devolucao_real || p.valor_real || p.valor_liquido || 0) > 0;
}

function getPedidoKey1004(p: Pedido): string {
  const numero = getPedidoNumero(p);
  if (numero && numero !== '0') return `P:${numero}`;
  const nf = String((p as any).num_nf ?? '').trim();
  if (nf && nf !== '0') return `NF:${nf}`;
  const id = String((p as any).id ?? '').trim();
  return id ? `ID:${id}` : '';
}

function normalizePedido(item: any): Pedido {
  const codEmpresaItem = String(getFieldValue<string | number>(item, 'CodEmpresa_bi', 'cod_empresa_bi', 'codEmpresaBi') ?? '').trim();
  // Normalizar status: converter "Pendente"/"Faturado" para lowercase
  const rawStatus = getFieldValue<string>(item, 'status_pedido', 'status', 'Status', 'Situacao', 'situacao') || 'pendente';
  const normalizedStatus = rawStatus.toLowerCase();

  // Tipo da transação (vindo do banco): PEDIDO ou DEVOLUCAO
  // Aceita também o campo legado "tipo_movimento" usado pelos JSONs de devolução do ERP Caspper
  const rawTipo = getFieldValue<string>(item, 'tipo', 'Tipo', 'TIPO', 'tipo_movimento', 'TipoMovimento', 'Tipo_Movimento');
  const tipoNormalized = rawTipo
    ? (rawTipo.toString().toUpperCase().startsWith('DEV') ? 'DEVOLUCAO' : 'PEDIDO')
    : 'PEDIDO';

  // Valor base do pedido.
  // Pelegrini 1004: `ValorVenda` é a base bruta; receita usa `ValorLiquidoFinal` abaixo.
  const valorTotalPedido = isEmpresa1004Code(codEmpresaItem)
    ? parseComercialNumber(getFieldValue(item, 'ValorVenda', 'valor_venda', 'valor_bruto', 'ValorBruto', 'Valor_Bruto', 'VlrBruto', 'vlrBruto', 'total_bruto', 'valor_total_pedido'))
    : parseComercialNumber(getFieldValue(item, 'valor_total_pedido', 'valor_bruto', 'ValorBruto', 'Valor_Bruto', 'VlrBruto', 'vlrBruto', 'total_bruto'));
  
  // Data de faturamento (para determinar se é faturado)
  const dataFaturamento = getFieldValue<string>(item, 'data_faturamento', 'DataFaturamento', 'Data_Faturamento', 'DtFaturamento');
  
  // Valores brutos vindos do endpoint para totalizadores do painel
  const valorLiquidoColuna = parseComercialNumber(getFieldValue(item, 'valor_liquido', 'ValorLiquido', 'Valor_Liquido', 'VlrLiquido'));
  const valorCustoColuna = parseComercialNumber(getFieldValue(item, 'valor_custo', 'ValorCusto', 'Valor_Custo', 'VlrCusto', 'custo', 'TotalCusto', 'total_custo'));
  const valorDescontoColuna = parseComercialNumber(getFieldValue(item, 'valor_desconto', 'ValorDesconto', 'Valor_Desconto', 'VlrDesconto', 'desconto', 'ValorDescontoItem', 'valor_desconto_item'));

  // Valor_Real: valor faturado da linha (positivo no JSON, sempre).
  // Empresa 1005: ERP não fornece Valor_Real; o valor faturado real está em
  // `valor_total_nf` (= `valor_liquido`). `valor_total_pedido` é o BRUTO do
  // pedido e não deve ser usado como faturado.
  const valorRealRaw = getFieldValue(item, 'Valor_Real', 'valor_real', 'ValorReal', 'VALOR_REAL');
  let valorRealAbs: number;
  if (valorRealRaw !== undefined && valorRealRaw !== null) {
    valorRealAbs = Math.abs(parseComercialNumber(valorRealRaw));
  } else if (codEmpresaItem === '1005') {
    const valorNf = parseComercialNumber(getFieldValue(item, 'valor_total_nf', 'ValorTotalNF', 'valor_nf'));
    valorRealAbs = Math.abs(valorNf || valorLiquidoColuna || 0);
  } else {
    valorRealAbs = Math.abs(valorLiquidoColuna || valorTotalPedido);
  }

  // Valor_Devolucao: valor da devolução da linha (positivo no JSON). Só relevante quando tipo = DEVOLUCAO.
  // Alguns JSONs 1005 não trazem Valor_Devolucao separado; nesses casos a devolução vem em Valor_Real / NF / líquido.
  const valorDevolucaoRaw = getFieldValue(item, 'valor_devolvido', 'ValorDevolvido', 'Valor_Devolvido', 'Valor_Devolucao', 'valor_devolucao', 'ValorDevolucao', 'VALOR_DEVOLUCAO');
  const valorDevolucaoExplicito = valorDevolucaoRaw !== undefined && valorDevolucaoRaw !== null
    ? Math.abs(parseComercialNumber(valorDevolucaoRaw))
    : 0;
  const valorDevolucaoAbs = tipoNormalized === 'DEVOLUCAO'
    ? (valorDevolucaoExplicito || valorRealAbs || Math.abs(valorLiquidoColuna) || Math.abs(valorTotalPedido))
    : valorDevolucaoExplicito;

  // Faturado por linha (assinado para SUM direto):
  //   PEDIDO faturado (com data_faturamento)  -> +Valor_Real
  //   PEDIDO em aberto (sem data_faturamento) -> 0  (não conta como faturado)
  //   DEVOLUCAO                                -> -Valor_Devolucao
  const temDataFaturamento = !!(dataFaturamento && dataFaturamento.trim() !== '' && dataFaturamento !== 'null');
  const valorFaturadoLinha = tipoNormalized === 'DEVOLUCAO'
    ? -valorDevolucaoAbs
    : (temDataFaturamento ? valorRealAbs : 0);

  // valor_real exposto assinado para manter SUM direto consistente.
  // Na 1005, pedido em aberto não pode entrar como faturado; por isso usamos
  // o valor faturado por linha (0 sem data_faturamento) também em rankings/gráficos.
  const valorReal = codEmpresaItem === '1005'
    ? valorFaturadoLinha
    : (tipoNormalized === 'DEVOLUCAO' ? -valorDevolucaoAbs : valorRealAbs);

  // tipo_vendedor bruto (usado apenas na empresa 1001 para replicar filtro do BI: aceitar 0 ou 1)
  const tipoVendedorRaw = getFieldValue<string | number>(
    item,
    'tipo_vendedor', 'TipoVendedor', 'tipoVendedor', 'tipo_vend', 'TipoVend', 'Tipo_Vendedor',
  );
  const tipoVendedor = tipoVendedorRaw === undefined || tipoVendedorRaw === null || tipoVendedorRaw === ''
    ? undefined
    : Number(tipoVendedorRaw);

  return {
    tipo_vendedor: Number.isFinite(tipoVendedor as number) ? (tipoVendedor as number) : undefined,
    // Identificação do pedido
    id: getFieldValue<string | number>(item, 'cod_pedido', 'id', 'ID', 'Id', 'codigo', 'Codigo') || Math.random().toString(),
    numero: String(getFieldValue<string | number>(item, 'cod_pedido', 'numero', 'Numero', 'NumPedido', 'num_pedido') || ''),
    data_pedido: getFieldValue<string>(item, 'data_pedido', 'DataPedido', 'Data_Pedido', 'DtPedido', 'dtPedido', 'data') || '',
    data_faturamento: dataFaturamento,
    status: normalizedStatus,

    // Tipo + valor_real (regra do banco)
    tipo: tipoNormalized as 'PEDIDO' | 'DEVOLUCAO',
    valor_real: valorReal,
    // Empresa 1001 (Caspper): o próprio PEDIDO traz o campo `valor_devolucao`.
    // Precisamos preservá-lo para que a Receita = SUM(valor_bruto) − SUM(valor_devolucao do pedido)
    // reproduza a regra do BI antigo sem depender do endpoint /devolucoes (evita dupla contagem).
    valor_devolucao_real: tipoNormalized === 'DEVOLUCAO' ? valorDevolucaoAbs : valorDevolucaoExplicito,

    // Empresa BI (constante do cliente, ex: 1003) - NÃO usar campos de filial (Empresa_Codigo, empresa_codigo)
    cod_empresa_bi: String(getFieldValue<string | number>(item, 'CodEmpresa_bi', 'cod_empresa_bi', 'codEmpresaBi') || ''),
    
    // Filial (empresa no ERP - ex: Matriz SP)
    filial_codigo: getFieldValue<string | number>(item, 'cod_empresa', 'CodEmpresa', 'codEmpresa', 'filial_codigo', 'CodFilial', 'cod_filial'),
    filial_nome: getFieldValue<string>(item, 'Filial', 'filial', 'empresa', 'Empresa', 'filial_nome', 'NomeFilial'),
    
    // NF
    num_nf: getFieldValue<string>(item, 'num_nf', 'NumNf', 'numero_nf', 'NumeroNF'),
    
    // Cliente
    cliente_codigo: getFieldValue<string | number>(item, 'cod_cliente', 'cliente_codigo', 'ClienteCodigo', 'Cliente_Codigo', 'CodCliente', 'codCliente', 'cliente_cod') || '',
    cliente_razao: getFieldValue<string>(item, 'cliente', 'cliente_razao', 'ClienteRazao', 'Cliente_Razao', 'RazaoSocial', 'razao_social', 'NomeCliente'),
    cliente_fantasia: getFieldValue<string>(item, 'nome_fantasia', 'cliente_fantasia', 'ClienteFantasia', 'Cliente_Fantasia', 'Fantasia', 'fantasia'),
    cliente_cidade: getFieldValue<string>(item, 'cidade', 'cliente_cidade', 'ClienteCidade', 'Cliente_Cidade', 'Cidade'),
    cliente_uf: getFieldValue<string>(item, 'estado', 'cliente_uf', 'ClienteUf', 'Cliente_UF', 'UF', 'uf', 'Estado'),
    data_cadastro_cliente: getDataPrimeiraCompraOuCadastroCliente(item) || undefined,
    
    
    // Vendedor
    vendedor_codigo: getFieldValue<string | number>(item, 'cod_vendedor', 'vendedor_codigo', 'VendedorCodigo', 'Vendedor_Codigo', 'CodVendedor', 'codVendedor', 'vendedor_cod') || '',
    vendedor_nome: getFieldValue<string>(item, 'vendedor', 'vendedor_nome', 'VendedorNome', 'Vendedor_Nome', 'NomeVendedor', 'nomeVendedor'),
    meta_vendedor: parseComercialNumber(getFieldValue(item, 'MetaVendedor', 'meta_vendedor', 'Meta_Vendedor', 'metaVendedor')) || undefined,

    // Procedure 1005 atualizada — vendedor interno / externo / meta + metas por carteira
    cod_vendedor_interno: getFieldValue<string | number>(item, 'cod_vendedor_interno', 'CodVendedorInterno', 'Cod_Vendedor_Interno', 'CodVendInterno') ?? undefined,
    vendedor_interno: getFieldValue<string>(item, 'vendedor_interno', 'VendedorInterno', 'NomeInterno', 'nome_interno', 'Vendedor_Interno', 'Nome_Interno', 'NomeVendInterno'),
    cod_vendedor_externo: getFieldValue<string | number>(item, 'cod_vendedor_externo', 'CodVendedorExterno', 'Cod_Vendedor_Externo', 'CodVendExterno') ?? undefined,
    vendedor_externo: getFieldValue<string>(item, 'vendedor_externo', 'VendedorExterno', 'NomeExterno', 'nome_externo', 'Vendedor_Externo', 'Nome_Externo', 'NomeVendExterno'),
    cod_vendedor_meta: getFieldValue<string | number>(item, 'cod_vendedor_meta', 'CodVendedorMeta', 'Cod_Vendedor_Meta', 'CodVendMeta') ?? undefined,
    vendedor_meta: getFieldValue<string>(item, 'vendedor_meta', 'VendedorMeta', 'NomeVendedorMeta', 'Vendedor_Meta', 'Nome_Vendedor_Meta'),
    cod_vendedor_chevrolet: getFieldValue<string | number>(item, 'cod_vendedor_chevrolet', 'CodVendedorChevrolet', 'cod_vendedor_ch', 'CodVendedorCH', 'cod_vendedor_cch', 'CodVendedorCCH', 'cod_vendedor_comissao', 'CodVendedorComissao') ?? undefined,
    vendedor_chevrolet: getFieldValue<string>(item, 'vendedor_chevrolet', 'VendedorChevrolet', 'nome_vendedor_chevrolet', 'NomeVendedorChevrolet', 'vendedor_ch', 'VendedorCH', 'nome_vendedor_ch', 'NomeVendedorCH', 'vendedor_cch', 'VendedorCCH', 'nome_vendedor_cch', 'NomeVendedorCCH', 'vendedor_comissao', 'VendedorComissao', 'nome_vendedor_comissao', 'NomeVendedorComissao'),
    cod_vendedor_cch: getFieldValue<string | number>(item, 'cod_vendedor_cch', 'CodVendedorCCH', 'cod_vendedor_ch', 'CodVendedorCH') ?? undefined,
    vendedor_cch: getFieldValue<string>(item, 'vendedor_cch', 'VendedorCCH', 'nome_vendedor_cch', 'NomeVendedorCCH', 'vendedor_ch', 'VendedorCH', 'nome_vendedor_ch', 'NomeVendedorCH'),
    cod_vendedor_comissao: getFieldValue<string | number>(item, 'cod_vendedor_comissao', 'CodVendedorComissao') ?? undefined,
    vendedor_comissao: getFieldValue<string>(item, 'vendedor_comissao', 'VendedorComissao', 'nome_vendedor_comissao', 'NomeVendedorComissao'),
    cod_vendedor_representante: getFieldValue<string | number>(item, 'cod_vendedor_representante', 'CodVendedorRepresentante', 'cod_representante', 'CodRepresentante') ?? undefined,
    vendedor_representante: getFieldValue<string>(item, 'vendedor_representante', 'VendedorRepresentante', 'nome_representante', 'NomeRepresentante', 'representante', 'Representante'),
    cod_vendedor_filial: getFieldValue<string | number>(item, 'cod_vendedor_filial', 'CodVendedorFilial') ?? undefined,
    vendedor_filial: getFieldValue<string>(item, 'vendedor_filial', 'VendedorFilial', 'nome_vendedor_filial', 'NomeVendedorFilial'),
    cod_vendedor_origem: getFieldValue<string | number>(item, 'cod_vendedor_origem', 'CodVendedorOrigem') ?? undefined,
    vendedor_origem: getFieldValue<string>(item, 'vendedor_origem', 'VendedorOrigem', 'nome_vendedor_origem', 'NomeVendedorOrigem'),
    meta_vendedor_interno: parseComercialNumber(getFieldValue(item, 'meta_vendedor_interno', 'MetaVendedorInterno', 'Meta_Vendedor_Interno', 'valor_meta_interno', 'ValorMetaInterno', 'Valor_Meta_Interno')) || undefined,
    meta_vendedor_externo: parseComercialNumber(getFieldValue(item, 'meta_vendedor_externo', 'MetaVendedorExterno', 'Meta_Vendedor_Externo', 'valor_meta_externo', 'ValorMetaExterno', 'Valor_Meta_Externo')) || undefined,
    valor_meta: parseComercialNumber(getFieldValue(item, 'valor_meta', 'ValorMeta', 'Valor_Meta', 'meta_marca', 'MetaMarca', 'Meta_Marca')) || undefined,
    descricao_meta: getFieldValue<string>(item, 'descricao_meta', 'DescricaoMeta'),

    // Marca (sistema 1005 traz cod_marca diretamente no pedido)
    cod_marca: (() => {
      const v = getFieldValue<string | number>(item, 'cod_marca', 'CodMarca', 'codMarca', 'marca_codigo', 'MarcaCodigo');
      if (v == null) return undefined;
      const s = String(v).trim();
      return s || undefined;
    })(),
    marca: (() => {
      const v = getFieldValue<string>(item, 'descricao_marca', 'DescricaoMarca', 'desc_marca', 'DescMarca', 'marca_descricao', 'MarcaDescricao', 'nome_marca', 'NomeMarca', 'MarcaNome', 'marca', 'Marca');
      if (!v) return undefined;
      const s = String(v).trim();
      // Se vier apenas numérico, é o código — ignora (queremos descrição)
      if (/^\d+$/.test(s)) return undefined;
      return s || undefined;
    })(),
    
    // Valores
    // valor_liquido = "Faturado por linha" (sinal correto):
    //   PEDIDO    -> +Valor_Real
    //   DEVOLUCAO -> -Valor_Devolucao
    // Qualquer SUM(valor_liquido) já produz o Faturado correto.
    valor_bruto: tipoNormalized === 'DEVOLUCAO' ? -Math.abs(valorTotalPedido) : valorTotalPedido,
    valor_desconto: valorDescontoColuna,
    cfop: getFieldValue(item, 'num_cfop', 'NumCfop', 'num_CFOP', 'cfop', 'CFOP', 'Cfop', 'cod_cfop', 'CodCfop'),
    num_cfop: getFieldValue(item, 'num_cfop', 'NumCfop', 'num_CFOP', 'cfop', 'CFOP', 'Cfop', 'cod_cfop', 'CodCfop'),
    valor_liquido: valorFaturadoLinha,
    valor_liquido_coluna: tipoNormalized === 'DEVOLUCAO' ? -Math.abs(valorLiquidoColuna) : valorLiquidoColuna,
    // Pelegrini 1004: `ValorLiquidoFinal` = valor bruto já com desconto aplicado, por linha.
    // Guardamos positivo em PEDIDO (é a base oficial de Receita segundo o BI da Pelegrini).
    valor_liquido_final: isEmpresa1004Code(codEmpresaItem) && tipoNormalized !== 'DEVOLUCAO'
      ? Math.abs(
          parseComercialNumber(getFieldValue(item, 'ValorLiquidoFinal', 'valor_liquido_final'))
          || Math.max(0, valorTotalPedido - valorDescontoColuna)
          || valorRealAbs
        )
      : undefined,
    valor_custo: valorCustoColuna,
    margem: parseComercialNumber(getFieldValue(item, 'margem', 'Margem', 'margem_percentual', 'MargemPercentual')) || undefined,
    comissao: parseComercialNumber(getFieldValue(item, 'valor_comissao', 'comissao', 'Comissao', 'ValorComissao', 'percentual_comissao')) || undefined,
  };
}

function textMatch(value: unknown, target: unknown): boolean {
  const a = String(value ?? '').trim();
  const b = String(target ?? '').trim();
  if (!a || !b) return false;
  return a === b || a.toUpperCase() === b.toUpperCase();
}

function pedidoMatchesVendedor1005(p: Pedido, target: unknown): boolean {
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

function getVendedorRegistro10041(registro: Record<string, unknown>): { codigo: string; nome: string } | null {
  return getVendedorCasaChevrolet10041FromRecord(registro);
}

function pedidoMatchesVendedor10041(p: Pedido, target: unknown): boolean {
  const vendedor = getVendedorRegistro10041(p as unknown as Record<string, unknown>);
  return !!vendedor && vendedorMatchesFiltro1004(vendedor, target);
}

// Match usado no filtro geral do dashboard (visao geral): usa o vendedor
// Chevrolet canonico da linha, independentemente do campo vindo da API.
function registroMatchesVendedor10041(registro: Record<string, unknown>, target: unknown): boolean {
  const vendedor = getVendedorRegistro10041(registro);
  return !!vendedor && vendedorMatchesFiltro1004(vendedor, target);
}

function getVendedorChevrolet10041(p: Pedido): { codigo: string | number; nome: string } {
  const escolhido = getVendedorRegistro10041(p as unknown as Record<string, unknown>)
    || { codigo: 'SEM_VENDEDOR_CHEVROLET', nome: 'Sem vendedor Chevrolet' };
  const codigo = escolhido.codigo ?? escolhido.nome ?? 'SEM_VENDEDOR';
  const nome = String(escolhido.nome ?? `Vendedor ${codigo}`).trim() || `Vendedor ${codigo}`;
  return { codigo, nome };
}
function shouldUseVendedorChevrolet10041(codEmpresa: unknown, filialAtiva?: unknown): boolean {
  return isContextoChevrolet10041Util(codEmpresa, filialAtiva);
}

function pedidoMatchesVendedorPrincipal(p: Pedido, target: unknown): boolean {
  return textMatch(p.vendedor_codigo, target) || textMatch(p.vendedor_nome, target);
}

function getPedidoKey1005(p: Pedido): string {
  const numero = String((p as any).numero ?? '').trim();
  if (numero && numero !== '0') return `P:${numero}`;
  const nf = String((p as any).num_nf ?? '').trim();
  if (nf && nf !== '0') return `NF:${nf}`;
  const id = String((p as any).id ?? '').trim();
  return id ? `ID:${id}` : '';
}


function normalizeDevolucao(item: any): Devolucao {
  const valorTotalDevolucao = parseComercialNumber(
    getFieldValue(
      item,
      'valor_devolvido', 'ValorDevolvido', 'Valor_Devolvido',
      'Valor_Devolucao', 'ValorDevolucao', 'valor_devolucao', 'VALOR_DEVOLUCAO',
      'valor_liquido', 'ValorLiquido',
      'Valor_Real', 'valor_real', 'valor_total_nf', 'ValorTotalNF', 'valor_nf',
      'valor_total', 'valor_total_pedido', 'ValorTotal', 'Valor_Total', 'VlrTotal', 'total',
    )
  );
  const quantidadeDevolvida = parseComercialNumber(
    getFieldValue(item, 'quantidade_devolvida', 'QuantidadeDevolvida', 'qtd_devolvida', 'QtdDevolvida', 'quantidade', 'Quantidade')
  );

  const tipoVendedorRaw = getFieldValue<string | number>(
    item,
    'tipo_vendedor', 'TipoVendedor', 'tipoVendedor', 'tipo_vend', 'TipoVend', 'Tipo_Vendedor',
  );
  const tipoVendedorNum = tipoVendedorRaw === undefined || tipoVendedorRaw === null || tipoVendedorRaw === ''
    ? undefined
    : Number(tipoVendedorRaw);

  return {
    tipo_vendedor: Number.isFinite(tipoVendedorNum as number) ? (tipoVendedorNum as number) : undefined,
    id: getFieldValue<string | number>(item, 'cod_devolucao', 'id', 'ID', 'Id', 'codigo', 'Codigo') || Math.random().toString(),
    numero: getFieldValue<string>(item, 'cod_devolucao', 'numero', 'Numero', 'NumDevolucao', 'num_devolucao'),
    data: getFieldValue<string>(item, 'data_movimento', 'data', 'Data', 'data_devolucao', 'DataDevolucao', 'DtDevolucao') || '',
    
    // Empresa BI (constante do cliente) - NÃO usar campos de filial
    cod_empresa_bi: String(getFieldValue<string | number>(item, 'CodEmpresa_bi', 'cod_empresa_bi', 'codEmpresaBi') || ''),
    
    // Cliente
    cliente_codigo: getFieldValue<string | number>(item, 'cod_cliente', 'cliente_codigo', 'ClienteCodigo', 'Cliente_Codigo', 'CodCliente', 'codCliente') || '',
    cliente_razao: getFieldValue<string>(item, 'cliente', 'cliente_razao', 'ClienteRazao', 'Cliente_Razao', 'RazaoSocial', 'razao_social'),
    cliente_fantasia: getFieldValue<string>(item, 'nome_fantasia', 'cliente_fantasia', 'ClienteFantasia', 'Cliente_Fantasia', 'Fantasia'),
    cliente_cidade: getFieldValue<string>(item, 'cidade', 'cliente_cidade', 'ClienteCidade', 'Cliente_Cidade', 'Cidade'),
    cliente_uf: getFieldValue<string>(item, 'estado', 'cliente_uf', 'ClienteUf', 'Cliente_UF', 'UF', 'uf'),
    
    // Vendedor
    vendedor_codigo: getFieldValue<string | number>(item, 'cod_vendedor', 'vendedor_codigo', 'VendedorCodigo', 'Vendedor_Codigo', 'CodVendedor', 'codVendedor') || '',
    vendedor_nome: getFieldValue<string>(item, 'vendedor', 'vendedor_nome', 'VendedorNome', 'Vendedor_Nome', 'NomeVendedor'),
    cod_vendedor_chevrolet: getFieldValue<string | number>(item, 'cod_vendedor_chevrolet', 'CodVendedorChevrolet', 'cod_vendedor_ch', 'CodVendedorCH', 'cod_vendedor_cch', 'CodVendedorCCH', 'cod_vendedor_comissao', 'CodVendedorComissao') ?? undefined,
    vendedor_chevrolet: getFieldValue<string>(item, 'vendedor_chevrolet', 'VendedorChevrolet', 'nome_vendedor_chevrolet', 'NomeVendedorChevrolet', 'vendedor_ch', 'VendedorCH', 'nome_vendedor_ch', 'NomeVendedorCH', 'vendedor_cch', 'VendedorCCH', 'nome_vendedor_cch', 'NomeVendedorCCH', 'vendedor_comissao', 'VendedorComissao', 'nome_vendedor_comissao', 'NomeVendedorComissao'),
    cod_vendedor_cch: getFieldValue<string | number>(item, 'cod_vendedor_cch', 'CodVendedorCCH', 'cod_vendedor_ch', 'CodVendedorCH') ?? undefined,
    vendedor_cch: getFieldValue<string>(item, 'vendedor_cch', 'VendedorCCH', 'nome_vendedor_cch', 'NomeVendedorCCH', 'vendedor_ch', 'VendedorCH', 'nome_vendedor_ch', 'NomeVendedorCH'),
    cod_vendedor_comissao: getFieldValue<string | number>(item, 'cod_vendedor_comissao', 'CodVendedorComissao') ?? undefined,
    vendedor_comissao: getFieldValue<string>(item, 'vendedor_comissao', 'VendedorComissao', 'nome_vendedor_comissao', 'NomeVendedorComissao'),
    cod_vendedor_representante: getFieldValue<string | number>(item, 'cod_vendedor_representante', 'CodVendedorRepresentante', 'cod_representante', 'CodRepresentante') ?? undefined,
    vendedor_representante: getFieldValue<string>(item, 'vendedor_representante', 'VendedorRepresentante', 'nome_representante', 'NomeRepresentante', 'representante', 'Representante'),
    cod_vendedor_filial: getFieldValue<string | number>(item, 'cod_vendedor_filial', 'CodVendedorFilial') ?? undefined,
    vendedor_filial: getFieldValue<string>(item, 'vendedor_filial', 'VendedorFilial', 'nome_vendedor_filial', 'NomeVendedorFilial'),
    cod_vendedor_origem: getFieldValue<string | number>(item, 'cod_vendedor_origem', 'CodVendedorOrigem') ?? undefined,
    vendedor_origem: getFieldValue<string>(item, 'vendedor_origem', 'VendedorOrigem', 'nome_vendedor_origem', 'NomeVendedorOrigem'),
    
    // Valores
    valor_produtos: parseComercialNumber(getFieldValue(item, 'valor_produtos', 'ValorProdutos', 'Valor_Produtos', 'VlrProdutos')),
    valor_servicos: parseComercialNumber(getFieldValue(item, 'valor_servicos', 'ValorServicos', 'Valor_Servicos', 'VlrServicos')),
    valor_acessorios: parseComercialNumber(getFieldValue(item, 'valor_acessorio', 'valor_acessorios', 'ValorAcessorio', 'ValorAcessorios', 'Valor_Acessorios')),
    valor_desconto: parseComercialNumber(getFieldValue(item, 'valor_desconto', 'ValorDesconto', 'Valor_Desconto', 'VlrDesconto')),
    valor_total: valorTotalDevolucao,
    valor_custo: parseComercialNumber(getFieldValue(item, 'valor_custo', 'ValorCusto', 'Valor_Custo', 'VlrCusto')),
    valor_liquido: valorTotalDevolucao,
    quantidade_devolvida: quantidadeDevolvida,
    // Produto (quando o JSON traz uma linha por item devolvido)
    produto_codigo: getFieldValue<string | number>(item, 'cod_produto', 'codigo_produto', 'produto_codigo', 'CodProduto', 'CodigoProduto'),
    produto_nome: getFieldValue<string>(item, 'produto', 'nome_produto', 'descricao_produto', 'desc_produto', 'Produto', 'NomeProduto', 'DescricaoProduto', 'Descricao'),
    _raw: item,
  } as any;
}

function getDevolucaoValor(devolucao: Devolucao): number {
  return devolucao.valor_total || devolucao.valor_liquido || 0;
}

// ============================================================
// Funções de fetch do Storage (igual ao DRE)
// ============================================================

interface ComercialData {
  pedidos: Pedido[];
  devolucoes: Devolucao[];
}

/**
 * Sanitiza o texto JSON removendo caracteres problemáticos antes do parse
 * - Remove BOM (Byte Order Mark) que alguns editores adicionam
 * - Remove quebras de linha que estão dentro de strings JSON (corrompidas)
 * - Remove caracteres de controle ASCII inválidos
 * 
 * O problema específico: o arquivo JSON tem quebras de linha literais (\r\n)
 * inseridas no meio de valores de string, como:
 *   "nome_fantasia":"valor\r\n
 *   ,"proximo_campo":"..."
 * 
 * A solução: detectar padrões de quebra de linha seguidos por vírgula ou 
 * no meio de strings (não entre elementos do array)
 */
function sanitizeJsonText(text: string): string {
  // Remover BOM (Byte Order Mark) se presente
  let sanitized = text.replace(/^\uFEFF/, '');
  
  // Padrão 1: Remover \r\n que ocorrem NO MEIO de strings
  // Detectamos: texto entre aspas que foi cortado por \r\n
  // Ex: "data_cada\r\n," → "data_cada,"
  // O padrão busca \r\n que NÃO estão no início de um novo objeto
  sanitized = sanitized.replace(/\r\n/g, '');
  
  // Se a remoção de \r\n quebrar o JSON, pode ser que o arquivo 
  // tenha apenas \n como separador entre objetos - vamos tentar preservar isso
  // Padrão para arrays: }\n{ ou ]\n[ deve ser preservado, mas },\n{ não precisa do \n
  // Na verdade, JSON não precisa de quebras de linha, então remover tudo é seguro
  sanitized = sanitized.replace(/\r/g, '');
  sanitized = sanitized.replace(/\n/g, '');
  
  // Substituir caracteres de controle inválidos restantes
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  
  return sanitized;
}

async function fetchFromStorage(storagePath: string, codEmpresa?: string): Promise<ComercialData> {
  console.log(`[Comercial] Buscando do storage: ${storagePath}`);
  console.log(`[Comercial] Empresa solicitada: ${codEmpresa || 'todas'}`);
  
  // Extrair código da empresa do path (ex: "1003/comercial.json" → "1003")
  const empresaFromPath = storagePath.split('/')[0];
  console.log(`[Comercial] Empresa extraída do path: ${empresaFromPath}`);
  
  let data: Blob | null = null;
  let error: Error | null = null;
  
  try {
    const response = await supabase.storage
      .from('dados-json')
      .download(storagePath);
    
    data = response.data;
    error = response.error;
  } catch (fetchError) {
    console.error('[Comercial] Erro de rede ao baixar do storage:', fetchError);
    console.error('[Comercial] StoragePath:', storagePath);
    console.error('[Comercial] Empresa:', codEmpresa);
    // Re-throw para que o retry do React Query funcione
    throw new Error(`Falha de rede ao baixar arquivo: ${fetchError instanceof Error ? fetchError.message : 'Erro desconhecido'}`);
  }
  
  if (error) {
    console.error('[Comercial] Erro retornado pelo storage:', error);
    console.error('[Comercial] StoragePath:', storagePath);
    console.error('[Comercial] Empresa:', codEmpresa);
    throw error;
  }
  
  if (!data) {
    console.error('[Comercial] Arquivo não encontrado ou vazio:', storagePath);
    throw new Error(`Arquivo não encontrado: ${storagePath}`);
  }
  
  const text = await data.text();
  console.log(`[Comercial] Tamanho do texto: ${text.length} caracteres`);
  
  // Sanitizar texto antes de fazer parse (remove BOM e caracteres de controle)
  const sanitizedText = sanitizeJsonText(text);
  if (sanitizedText.length !== text.length) {
    console.log(`[Comercial] Texto sanitizado: ${sanitizedText.length} caracteres (removidos ${text.length - sanitizedText.length})`);
  }
  
  let jsonData: any;
  try {
    console.log('[Comercial] Iniciando JSON.parse de', sanitizedText.length, 'caracteres...');
    const parseStart = performance.now();
    jsonData = JSON.parse(sanitizedText);
    const parseEnd = performance.now();
    console.log(`[Comercial] JSON.parse concluído em ${(parseEnd - parseStart).toFixed(0)}ms`);
  } catch (parseError) {
    console.error('[Comercial] Erro ao fazer parse do JSON:', parseError);
    
    // Mostrar contexto do erro para debug
    if (parseError instanceof SyntaxError && parseError.message.includes('position')) {
      const positionMatch = parseError.message.match(/position (\d+)/);
      if (positionMatch) {
        const position = parseInt(positionMatch[1]);
        const context = sanitizedText.substring(Math.max(0, position - 50), position + 50);
        console.error('[Comercial] Contexto do erro (posição', position, '):', JSON.stringify(context));
      }
    }
    
    throw new Error(`JSON inválido: ${parseError instanceof Error ? parseError.message : 'Erro desconhecido'}`);
  }
  
  // Debug: mostrar estrutura do JSON
  if (Array.isArray(jsonData)) {
    console.log(`[Comercial] JSON é array com ${jsonData.length} itens`);
    if (jsonData[0]) {
      console.log(`[Comercial] Primeiro item tem campos:`, Object.keys(jsonData[0]).join(', '));
    }
  } else {
    console.log(`[Comercial] JSON é objeto com chaves:`, Object.keys(jsonData).join(', '));
  }
  
  // Verificar estrutura do JSON
  // Pode ser: { pedidos: [...], devolucoes: [...] } OU apenas um array de pedidos
  let rawPedidos: any[] = [];
  let rawDevolucoes: any[] = [];
  
  if (Array.isArray(jsonData)) {
    // Se for array direto, assumir que são pedidos
    rawPedidos = jsonData;
    console.log(`[Comercial] JSON é array direto com ${rawPedidos.length} itens (tratando como pedidos)`);
  } else if (jsonData.pedidos || jsonData.Pedidos) {
    // Se tiver propriedade pedidos
    rawPedidos = jsonData.pedidos || jsonData.Pedidos || [];
    rawDevolucoes = jsonData.devolucoes || jsonData.Devolucoes || [];
    console.log(`[Comercial] JSON estruturado: ${rawPedidos.length} pedidos, ${rawDevolucoes.length} devoluções`);
  } else {
    // Tentar encontrar arrays em qualquer propriedade
    const keys = Object.keys(jsonData);
    for (const key of keys) {
      if (Array.isArray(jsonData[key]) && jsonData[key].length > 0) {
        rawPedidos = jsonData[key];
        console.log(`[Comercial] Usando array da propriedade "${key}" com ${rawPedidos.length} itens`);
        break;
      }
    }
  }
  
  // Normalizar dados e atribuir cod_empresa_bi do path se não existir
  const pedidos = rawPedidos.map(item => {
    const pedido = normalizePedido(item);
    // Se não encontrou cod_empresa_bi no JSON, usar a empresa extraída do path
    if (!pedido.cod_empresa_bi || pedido.cod_empresa_bi === '') {
      pedido.cod_empresa_bi = empresaFromPath;
    }
    return pedido;
  });
  
  const devolucoes = rawDevolucoes.map(item => {
    const devolucao = normalizeDevolucao(item);
    // Se não encontrou cod_empresa_bi no JSON, usar a empresa extraída do path
    if (!devolucao.cod_empresa_bi || devolucao.cod_empresa_bi === '') {
      devolucao.cod_empresa_bi = empresaFromPath;
    }
    return devolucao;
  });

  // Folding: se vieram devoluções na estrutura legada, transformamos em
  // pseudo-pedidos com tipo=DEVOLUCAO e valor_real negativo, garantindo que
  // o restante do pipeline (que opera sobre pedidos) já contemple a regra
  // SUM(Valor_Real). Não fazemos joins antigos — apenas concatenamos.
  const devolucoesComoPedidos: Pedido[] = devolucoes.map(devolucaoToPedido);

  const pedidosUnificados = [...pedidos, ...devolucoesComoPedidos];

  console.log(`[Comercial] Normalizados: ${pedidos.length} pedidos + ${devolucoes.length} devoluções → ${pedidosUnificados.length} transações unificadas`);

  // O arquivo já está segregado por pasta (ex: 1003/comercial.json)
  // Não é necessário filtrar novamente por cod_empresa_bi aqui
  return { pedidos: pedidosUnificados, devolucoes };
}

// Converte uma Devolucao normalizada num pseudo-pedido (tipo=DEVOLUCAO, valor negativo)
function devolucaoToPedido(d: Devolucao): Pedido {
  const valorBase = Math.abs(getDevolucaoValor(d));
  return {
    id: d.id,
    numero: d.numero,
    data_pedido: d.data,
    data_faturamento: d.data,
    status: 'faturado',
    tipo: 'DEVOLUCAO',
    valor_real: -valorBase,
    cod_empresa_bi: d.cod_empresa_bi,
    cliente_codigo: d.cliente_codigo,
    cliente_razao: d.cliente_razao,
    cliente_fantasia: d.cliente_fantasia,
    cliente_cidade: d.cliente_cidade,
    cliente_uf: d.cliente_uf,
    vendedor_codigo: d.vendedor_codigo,
    vendedor_nome: d.vendedor_nome,
    cod_vendedor_chevrolet: (d as any).cod_vendedor_chevrolet,
    vendedor_chevrolet: (d as any).vendedor_chevrolet,
    cod_vendedor_cch: (d as any).cod_vendedor_cch,
    vendedor_cch: (d as any).vendedor_cch,
    cod_vendedor_comissao: (d as any).cod_vendedor_comissao,
    vendedor_comissao: (d as any).vendedor_comissao,
    cod_vendedor_representante: (d as any).cod_vendedor_representante,
    vendedor_representante: (d as any).vendedor_representante,
    cod_vendedor_filial: (d as any).cod_vendedor_filial,
    vendedor_filial: (d as any).vendedor_filial,
    cod_vendedor_origem: (d as any).cod_vendedor_origem,
    vendedor_origem: (d as any).vendedor_origem,
    valor_bruto: -valorBase,
    valor_desconto: d.valor_desconto || 0,
    valor_liquido: -valorBase,
    valor_liquido_coluna: -valorBase,
    valor_custo: d.valor_custo || 0,
  } as Pedido;
}

// Baixa e normaliza um JSON dedicado de devoluções do storage.
// Aceita { devolucoes: [...] } | { Devolucoes: [...] } | array direto.
async function fetchDevolucoesFromStorage(storagePath: string): Promise<Devolucao[]> {
  console.log(`[Comercial] Buscando devoluções do storage: ${storagePath}`);
  const empresaFromPath = storagePath.split('/')[0];
  const { data, error } = await supabase.storage.from('dados-json').download(storagePath);
  if (error || !data) {
    throw error || new Error(`Arquivo de devoluções não encontrado: ${storagePath}`);
  }
  const text = await data.text();
  const sanitized = sanitizeJsonText(text);
  const json = JSON.parse(sanitized);
  let raw: any[] = [];
  if (Array.isArray(json)) raw = json;
  else if (json.devolucoes || json.Devolucoes) raw = json.devolucoes || json.Devolucoes || [];
  else {
    for (const k of Object.keys(json)) {
      if (Array.isArray(json[k]) && json[k].length > 0) { raw = json[k]; break; }
    }
  }
  return raw.map(item => {
    const dev = normalizeDevolucao(item);
    if (!dev.cod_empresa_bi || dev.cod_empresa_bi === '') dev.cod_empresa_bi = empresaFromPath;
    return dev;
  });
}

async function fetchComercialData(empresa?: Empresa | null, codEmpresa?: string, isMaster?: boolean, periodo?: { inicio: string; fim: string }, filialAtiva?: string | null): Promise<ComercialData> {
  // Se módulo comercial não está habilitado, retornar vazio
  if (empresa && !empresa.modulo_comercial) {
    console.log('[Comercial] Módulo não habilitado para esta empresa');
    return { pedidos: [], devolucoes: [] };
  }

  // SEGURANÇA: Se não é master E não tem código da empresa, retornar vazio
  if (!isMaster && !codEmpresa) {
    console.log('[Comercial] Usuário sem empresa vinculada - retornando vazio');
    return { pedidos: [], devolucoes: [] };
  }

  let data: ComercialData = { pedidos: [], devolucoes: [] };

  // Prioridade 1: JSON no storage (upload do usuário) — resolve filial ativa
  const jsonComercialPath = resolveComercialJsonPath('pedidos', empresa, filialAtiva);
  if (jsonComercialPath?.startsWith('storage:')) {
    const storagePath = jsonComercialPath.replace('storage:', '');
    try {
      data = await fetchFromStorage(storagePath, codEmpresa);
      console.log(`[Comercial] Carregados ${data.pedidos.length} pedidos do storage (filial=${filialAtiva ?? 'default'})`);
    } catch (error) {
      console.error('[Comercial] Erro ao buscar do storage:', error);
    }

    // JSON dedicado de devoluções (ex.: 1003 mantém arquivo separado)
    const jsonDevolucoesPath = resolveComercialJsonPath('devolucoes', empresa, filialAtiva);
    if (jsonDevolucoesPath?.startsWith('storage:')) {
      const devPath = jsonDevolucoesPath.replace('storage:', '');
      try {
        const devsExtras = await fetchDevolucoesFromStorage(devPath);
        if (devsExtras.length > 0) {
          const pseudo = devsExtras.map(devolucaoToPedido);
          data = {
            pedidos: [...data.pedidos, ...pseudo],
            devolucoes: [...data.devolucoes, ...devsExtras],
          };
          console.log(`[Comercial][${codEmpresa ?? '?'}] devoluções (JSON dedicado) carregadas: ${devsExtras.length}`);
        }
      } catch (err) {
        console.error('[Comercial] Erro ao buscar devoluções do storage:', err);
      }
    }
  }


  // Prioridade 2: Endpoint configurado
  if (data.pedidos.length === 0 && (empresa?.endpoint_url || empresa?.usar_vps_intermediaria)) {
    try {
      const codEmpresaKey = String(codEmpresa ?? '').trim();
      const isPelegrini1004Raw = codEmpresaKey === '1004' || codEmpresaKey === '10041';
      const pedidosPathBase = resolveComercialEndpointPath('pedidos', empresa, filialAtiva);
      const devolucoesPathBase = resolveComercialEndpointPath('devolucoes', empresa, filialAtiva);
      const usaVps = !!empresa.usar_vps_intermediaria;

      // Sempre enviar filtros de data - usar período fornecido ou, na ausência,
      // o ÚLTIMO MÊS FECHADO (evita cair em mês corrente vazio na API/VPS).
      const _hojeRef = new Date();
      const _pad = (n: number) => String(n).padStart(2, '0');
      const _toLocal = (d: Date) => `${d.getFullYear()}-${_pad(d.getMonth() + 1)}-${_pad(d.getDate())}`;
      const _primeiroMesAtual = new Date(_hojeRef.getFullYear(), _hojeRef.getMonth(), 1);
      const _ultimoDiaMesAnt = new Date(_primeiroMesAtual.getTime() - 24 * 60 * 60 * 1000);
      const _fallbackIni = new Date(_ultimoDiaMesAnt.getFullYear(), _ultimoDiaMesAnt.getMonth(), 1);
      const dataInicio = periodo?.inicio || _toLocal(_fallbackIni);
      const dataFim = periodo?.fim || _toLocal(_ultimoDiaMesAnt);
      const codBiParam = resolveCodEmpresaBiParam(empresa, filialAtiva);
      const addDays = (iso: string, days: number) => {
        const d = new Date(`${iso}T00:00:00`);
        d.setDate(d.getDate() + days);
        return _toLocal(d);
      };
      // API Pelegrini CT trata data_fim como limite exclusivo. Para carregar
      // 30/06, a query precisa ir até 01/07; o filtro local continua inclusivo
      // no período escolhido, então registros de Julho não entram nos cards.
      const dataFimApi = isPelegrini1004Raw
        ? addDays(dataFim, 1)
        : dataFim;
      // A API real da empresa 1003 usa `data_ini`; com `data_inicio` ela ignora
      // o período e retorna dados recentes, causando autenticação sem matches.
      const keyIni = usaVps || codEmpresaKey === '1003' || isPelegrini1004Raw ? 'data_ini' : 'data_inicio';
      console.log(`[Comercial] Filtros de data (${usaVps ? 'VPS' : 'direto'}): ${keyIni}=${dataInicio}&data_fim=${dataFimApi}`);

      // Log da URL final montada (útil para diagnosticar roteamento VPS/proxy)
      const debugBase = usaVps
        ? `${(empresa.vps_base_url || '').replace(/\/+$/, '')}/${(empresa.vps_cliente_identificador || '').replace(/^\/+|\/+$/g, '')}`
        : (empresa.endpoint_url || '');
      const debugCodBi = codBiParam ? `&cod_empresa_bi=${codBiParam}` : '';
      console.log(`[Comercial] URL final upstream (pedidos): ${debugBase}${pedidosPathBase}?${keyIni}=${dataInicio}&data_fim=${dataFimApi}&page_size=5000${debugCodBi}`);
      console.log(`[Comercial] URL final upstream (devoluções): ${debugBase}${devolucoesPathBase}?${keyIni}=${dataInicio}&data_fim=${dataFimApi}&page_size=5000${debugCodBi}`);

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      };

      // Edge Function tem limite duro de 150s. Quando usamos VPS, quebramos
      // o range em janelas diárias (1 dia por chamada) e somamos os blocos
      // totalizadores no cliente. Sem VPS, mantemos a chamada única.
      const requestTimeoutMs = usaVps ? 145000 : 30000;
      const fetchWithTimeout = (url: string, opts: RequestInit, timeoutMs = requestTimeoutMs) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
      };

      const buildPathWithParams = (basePath: string, params: URLSearchParams) => {
        const [pathOnly, existingQuery = ''] = basePath.split('?');
        const merged = new URLSearchParams(existingQuery);
        params.forEach((value, key) => merged.set(key, value));
        return `${pathOnly}?${merged.toString()}`;
      };

      const extractArray = (json: any, key: 'pedidos' | 'devolucoes') => {
        const upperKey = key === 'pedidos' ? 'Pedidos' : 'Devolucoes';
        return Array.isArray(json) ? json : (json[key] || json[upperKey] || []);
      };

      // Gera janelas semanais [inicio, fim] entre as datas (ranges válidos,
      // pois a API ignora data_ini==data_fim).
      const enumerateWeeks = (inicio: string, fim: string): Array<[string, string]> => {
        const out: Array<[string, string]> = [];
        const d = new Date(`${inicio}T00:00:00`);
        const end = new Date(`${fim}T00:00:00`);
        while (d.getTime() <= end.getTime()) {
          const ini = d.toISOString().split('T')[0];
          const next = new Date(d);
          next.setDate(next.getDate() + 6);
          if (next.getTime() > end.getTime()) next.setTime(end.getTime());
          out.push([ini, next.toISOString().split('T')[0]]);
          d.setDate(d.getDate() + 7);
        }
        return out;
      };

      // Concorrência limitada para não estourar quota da edge
      const runWithConcurrency = async <T,>(
        items: Array<[string, string]>,
        worker: (item: [string, string]) => Promise<T[]>,
        concurrency = 3,
      ): Promise<T[]> => {
        const out: T[] = [];
        let i = 0;
        const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
          while (i < items.length) {
            const idx = i++;
            try {
              const part = await worker(items[idx]);
              out.push(...part);
            } catch (err) {
              console.warn(`[Comercial] Falha no chunk ${items[idx].join('..')}:`, err);
            }
          }
        });
        await Promise.all(runners);
        return out;
      };

      const fetchEndpointPaginated = async (basePath: string, key: 'pedidos' | 'devolucoes') => {
        if (key === 'devolucoes' && isPelegrini1004Raw && filialAtiva === 'chevrolet') {
          console.warn('[Comercial] Devoluções CH indisponíveis na API Pelegrini; seguindo sem chamada ao endpoint.');
          return [];
        }

        const fetchRange = async ([di, df]: [string, string]): Promise<any[]> => {
          const pageSize = 5000;
          const all: any[] = [];
          for (let page = 1; page <= 20; page++) {
            const params = new URLSearchParams();
            params.set(keyIni, di);
            params.set('data_fim', df);
            params.set('page', String(page));
            params.set('page_size', String(pageSize));
            if (codBiParam) params.set('cod_empresa_bi', codBiParam);
            const path = buildPathWithParams(basePath, params);
            const url = buildApiProxyUrl(empresa, path);
            // Retry para erros transitórios do edge (BOOT_ERROR 503) e do upstream
            let res: Response | null = null;
            let lastStatus = 0;
            const transient = new Set([500, 502, 503, 504]);
            for (let attempt = 1; attempt <= 4; attempt++) {
              res = await fetchWithTimeout(url, { headers });
              lastStatus = res.status;
              if (res.ok || !transient.has(res.status)) break;
              try { await res.text(); } catch {}
              const backoff = 400 * attempt + Math.floor(Math.random() * 300);
              console.warn(`[Comercial] ${key} ${di}..${df} pág ${page}: HTTP ${res.status} — retry ${attempt}/3 em ${backoff}ms`);
              await new Promise(r => setTimeout(r, backoff));
            }
            if (!res || !res.ok) {
              if (key === 'devolucoes') {
                console.warn(`[Comercial] Devoluções indisponíveis em ${di}..${df} página ${page}: HTTP ${lastStatus}. Seguindo sem devoluções.`);
                return all;
              }
              if (lastStatus === 504) {
                console.warn(
                  `[Comercial] ⚠️ TIMEOUT 504 no range ${di}..${df} (página ${page}) — ` +
                  `VPS ${empresa?.vps_base_url || ''} aguardou a API do cliente além do limite.`,
                );
              } else {
                console.warn(`[Comercial] ${key} ${di}..${df} página ${page}: HTTP ${lastStatus}`);
              }
              throw new Error(`${key} ${di}..${df} página ${page}: HTTP ${lastStatus}`);
            }

            const json = await res.json();
            const arr = extractArray(json, key);
            all.push(...arr);
            console.log(`[Comercial] ${key} ${di}..${df} página ${page}: ${arr.length} registros`);
            if (arr.length < pageSize) break;
          }
          console.log(`[Comercial] ${key} ${di}..${df}: ${all.length} registros`);
          return all;
        };

        if (usaVps && isPelegrini1004Raw) {
          // Dashboard Comercial Pelegrini: a VPS/procedure perde registros quando
          // o período é quebrado em semanas, pois data_fim é limite exclusivo.
          // Para CT e CCH, usar range completo com data_fim+1.
          console.log('[Comercial][1004][Fetch] usando range completo; fatiamento semanal desativado para não perder registros.');
          return fetchRange([dataInicio, dataFimApi]);
        }

        if (usaVps) {
          // Estratégia validada: fatiar em janelas semanais com concorrência
          // limitada. Foi o comportamento que bateu os valores do BI para
          // junho/2026 (Casa da Transmissão 1004). NÃO trocar por range
          // completo — a VPS pode devolver 504 e cortar o mês, ou variar a
          // paginação de forma inconsistente entre chamadas grandes.
          const semanas = enumerateWeeks(dataInicio, dataFimApi);
          console.log(`[Comercial] ${key}: ${semanas.length} janelas semanais (concorrência 3)`);
          const all = await runWithConcurrency(semanas, fetchRange, 3);
          console.log(`[Comercial] ${key} TOTAL semanal: ${all.length} registros`);
          return all;
        }


        // Não-VPS: chamada única com range completo
        return fetchRange([dataInicio, dataFimApi]);
      };



      // Buscar pedidos e devoluções em paralelo, sem limite de 500 linhas do endpoint
      const [pedidosRes, devolucoesRes] = await Promise.allSettled([
        fetchEndpointPaginated(pedidosPathBase, 'pedidos'),
        fetchEndpointPaginated(devolucoesPathBase, 'devolucoes'),
      ]);

      let rawPedidos: any[] = [];
      let rawDevolucoes: any[] = [];

      if (pedidosRes.status === 'fulfilled') {
        rawPedidos = pedidosRes.value;
        console.log(`[Comercial] Recebidos ${rawPedidos.length} pedidos do endpoint`);

        // Diagnóstico: alerta quando o upstream retorna dados de outra empresa
        // (indica roteamento errado na VPS/proxy do cliente).
        if (rawPedidos.length > 0 && codEmpresa) {
          const amostra = rawPedidos.slice(0, 200);
          const bis = new Map<string, number>();
          for (const p of amostra) {
            const bi = String(p.CodEmpresa_bi ?? p.cod_empresa_bi ?? '').trim();
            if (!bi) continue;
            bis.set(bi, (bis.get(bi) || 0) + 1);
          }
          const dominante = [...bis.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
          // Esperado = cod_empresa_bi resolvido conforme filial ativa
          // (Pelegrini CT=1004, CH=10041). Sem isso, alerta falso positivo.
          const esperado = String(codBiParam ?? codEmpresa);
          if (dominante && dominante !== esperado) {
            console.warn(
              `[Comercial] ⚠️ Divergência de empresa: esperado CodEmpresa_bi=${esperado} (filial=${filialAtiva ?? 'default'}), ` +
              `upstream retornou dominante=${dominante} (amostra ${amostra.length} registros). ` +
              `Verifique o roteamento da VPS ${empresa?.vps_base_url || ''}/${empresa?.vps_cliente_identificador || ''}.`,
            );
          }
        }
      } else {
        console.warn('[Comercial] Falha ao buscar pedidos do endpoint');
      }

      if (devolucoesRes.status === 'fulfilled') {
        rawDevolucoes = devolucoesRes.value;
        console.log(`[Comercial] Recebidas ${rawDevolucoes.length} devoluções do endpoint`);
      } else {
        console.warn('[Comercial] Falha ao buscar devoluções do endpoint (pode não existir)');
      }

      // PROTEÇÃO: só lançar erro quando a CHAMADA de pedidos falhou de fato
      // (rede/HTTP). Se o endpoint respondeu com sucesso mas não há registros
      // no período, seguir com base vazia — a UI mostra empty state em vez de
      // ficar em loading infinito por retries em cima de "sem dados".
      if (pedidosRes.status === 'rejected') {
        throw new Error('Pedidos indisponíveis no endpoint — abortando carga parcial para não exibir dados zerados');
      }
      if (rawPedidos.length === 0) {
        console.warn('[Comercial] Endpoint respondeu sem pedidos para o período solicitado — retornando estado vazio controlado.');
        return { pedidos: [], devolucoes: [] };
      }
      if (rawPedidos.length === 0 && rawDevolucoes.length === 0) {
        console.warn('[Comercial] Endpoint respondeu, mas não há pedidos nem devoluções no período. Renderizando vazio.');
        return { pedidos: [], devolucoes: [] };
      }

      if (rawPedidos.length > 0 || rawDevolucoes.length > 0) {
        const empresaFallback = String(codBiParam ?? codEmpresaKey ?? codEmpresa ?? '').trim();
        const withEmpresaFallback = (item: any) => ({
          ...item,
          CodEmpresa_bi: item?.CodEmpresa_bi ?? item?.cod_empresa_bi ?? item?.codEmpresaBi ?? empresaFallback,
        });

        const pedidosNorm = rawPedidos.map(item => normalizePedido(withEmpresaFallback(item)));
        const devolucoesNorm = rawDevolucoes.map(item => normalizeDevolucao(withEmpresaFallback(item)));

        // Mesma regra do storage: devoluções legadas viram tipo=DEVOLUCAO
        // com valor_real negativo, integradas ao stream de pedidos.
        // EXCEÇÃO 1001/Caspper: o endpoint /pedidos já traz as devoluções
        // como linhas tipo=DEVOLUCAO com valor_devolucao. Não podemos somar
        // também /comercial/devolucoes, senão o card Devoluções dobra.
        const devolucoesComoPedidos: Pedido[] = (codEmpresaKey === '1001' || isPelegrini1004Raw) ? [] : devolucoesNorm.map((d) => {
          const valorBase = Math.abs(getDevolucaoValor(d));
          return {
            id: d.id,
            numero: d.numero,
            data_pedido: d.data,
            data_faturamento: d.data,
            status: 'faturado',
            tipo: 'DEVOLUCAO',
            valor_real: -valorBase,
            cod_empresa_bi: d.cod_empresa_bi,
            cliente_codigo: d.cliente_codigo,
            cliente_razao: d.cliente_razao,
            cliente_fantasia: d.cliente_fantasia,
            cliente_cidade: d.cliente_cidade,
            cliente_uf: d.cliente_uf,
            vendedor_codigo: d.vendedor_codigo,
            vendedor_nome: d.vendedor_nome,
            valor_bruto: -valorBase,
            valor_desconto: d.valor_desconto || 0,
            valor_liquido: -valorBase,
            valor_liquido_coluna: -valorBase,
            valor_custo: d.valor_custo || 0,
          } as Pedido;
        });

        data = {
          pedidos: [...pedidosNorm, ...devolucoesComoPedidos],
          devolucoes: devolucoesNorm,
        };
        console.log(`[Comercial] Carregados ${pedidosNorm.length} pedidos + ${devolucoesNorm.length} devoluções → ${data.pedidos.length} transações unificadas`);
        if (String(codEmpresa ?? '') === '1001') {
          console.info('[Comercial][1001][Diagnóstico] /devolucoes mantido fora dos pedidos unificados para evitar dupla contagem no dashboard.');
        }
      }
    } catch (error) {
      console.error('[Comercial] Erro ao buscar do endpoint:', error);
      throw error instanceof Error ? error : new Error('Erro ao buscar dados comerciais do endpoint');
    }
  }

  // Se não encontrou dados, verificar se há fonte configurada antes de usar mock
  if (data.pedidos.length === 0) {
    const temFonteConfigurada = empresa?.json_path_comercial || empresa?.endpoint_url || empresa?.usar_vps_intermediaria;
    if (isMaster && !temFonteConfigurada) {
      console.log('[Comercial] Master sem fonte de dados configurada - usando dados de demonstração');
      data = { pedidos: mockPedidos, devolucoes: mockDevolucoes };
    } else if (temFonteConfigurada) {
      console.warn('[Comercial] Fonte configurada mas sem dados retornados - endpoint pode estar offline');
      return { pedidos: [], devolucoes: [] };
    } else {
      console.log('[Comercial] Usuário sem fonte de dados configurada - retornando vazio');
      return { pedidos: [], devolucoes: [] };
    }
  }

  if (empresaPossuiFiliais(codEmpresa) || String(codEmpresa ?? '').trim() === '10041') {
    data = {
      pedidos: filtrarPorFilial(data.pedidos as any[], codEmpresa, filialAtiva) as Pedido[],
      devolucoes: filtrarPorFilial(data.devolucoes as any[], codEmpresa, filialAtiva) as Devolucao[],
    };
  }

  // A segregação de dados é garantida pelo path do arquivo no Storage (ex: 1003/comercial.json)
  console.log(`[Comercial] Retornando ${data.pedidos.length} pedidos e ${data.devolucoes.length} devoluções`);
  return data;
}

// Hook para buscar dados do storage
export function useComercialRawData(
  periodo?: { inicio: string; fim: string },
  options?: { enabled?: boolean; keepPreviousData?: boolean },
) {
  const { empresa, codEmpresaAtiva, isLoading: isLoadingEmpresa, isMaster } = useEmpresaAtiva();
  const { filialAtiva } = useFilialSelecionada();

  const enabledFlag = options?.enabled !== false;

  // Sempre passar período para fetch — usado tanto pelo endpoint quanto
  // pelo complemento de devoluções aplicado em cima do storage.
  return useQuery({
    queryKey: [
      'comercial', 'raw',
      codEmpresaAtiva,
      '1004-inclusive-date-key-v4',
      filialAtiva,
      empresa?.json_path_comercial,
      empresa?.json_path_comercial_ch,
      empresa?.endpoint_url,
      empresa?.endpoint_path_comercial_pedidos,
      empresa?.endpoint_path_comercial_pedidos_ch,
      empresa?.endpoint_path_comercial_devolucoes,
      empresa?.endpoint_path_comercial_devolucoes_ch,
      isMaster,
      periodo?.inicio,
      periodo?.fim,
      enabledFlag,
      isEmpresa1004Code(codEmpresaAtiva) ? RECEITA_1004_RULE_VERSION : 'receita-padrao',
    ],
    queryFn: async () => fetchComercialData(empresa, codEmpresaAtiva || undefined, isMaster, periodo, filialAtiva),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    retryDelay: 1500,
    enabled: !isLoadingEmpresa && enabledFlag,
    placeholderData: options?.keepPreviousData === false ? undefined : keepPreviousData,
  });
}


export function useComercialData(filters?: ComercialFilters, options?: { enabled?: boolean; keepPreviousData?: boolean }) {
  const { codEmpresaAtiva, empresa } = useEmpresaAtiva();
  const { filialAtiva, filialNome } = useFilialSelecionada();
  // Usar o novo hook que busca do Storage/endpoint com filtros de período
  const { data: rawData, isLoading, error } = useComercialRawData(filters?.periodo, options);

  const allPedidos = rawData?.pedidos || [];
  const allDevolucoes = rawData?.devolucoes || [];
  // O 10041 compartilha a origem 1004, mas sempre deve usar somente a equipe Chevrolet.
  // Em alguns acessos o id da filial ainda nao foi hidratado; o nome evita cair na equipe CT.
  const empresaComFilial = filialNome
    ? { ...empresa, nome: `${empresa?.nome ?? ''} ${filialNome}` }
    : empresa;
  const isChevrolet10041Ativa = isContextoChevrolet10041Util(codEmpresaAtiva, filialAtiva, empresaComFilial);
  const codEmpresaFiltro10041 = isChevrolet10041Ativa ? '10041' : codEmpresaAtiva;

  // Filtro por filial (Casa da Transmissão / Casa da Chevrolet em 1004, etc.)
  const pedidosByCompany = useMemo(
    () => isChevrolet10041Ativa
      ? filtrarPorFilial(allPedidos as any[], '10041', 'chevrolet') as typeof allPedidos
      : filtrarPorFilial(allPedidos as any[], codEmpresaAtiva, filialAtiva) as typeof allPedidos,
    [allPedidos, codEmpresaAtiva, filialAtiva, isChevrolet10041Ativa],
  );
  const devolucoesByCompany = useMemo(
    () => isChevrolet10041Ativa
      ? filtrarPorFilial(allDevolucoes as any[], '10041', 'chevrolet') as typeof allDevolucoes
      : filtrarPorFilial(allDevolucoes as any[], codEmpresaAtiva, filialAtiva) as typeof allDevolucoes,
    [allDevolucoes, codEmpresaAtiva, filialAtiva, isChevrolet10041Ativa],
  );
  const pedidosBaseEmpresa = useMemo(
    () => filtrarEscopoPelegriniComercial1004(pedidosByCompany as unknown as Record<string, unknown>[], {
      codEmpresa: codEmpresaFiltro10041,
      isChevrolet10041Ativa,
    }) as typeof pedidosByCompany,
    [pedidosByCompany, codEmpresaFiltro10041, isChevrolet10041Ativa],
  );
  const devolucoesBaseEmpresa = useMemo(
    () => filtrarEscopoPelegriniComercial1004(devolucoesByCompany as unknown as Record<string, unknown>[], {
      codEmpresa: codEmpresaFiltro10041,
      isChevrolet10041Ativa,
    }) as typeof devolucoesByCompany,
    [devolucoesByCompany, codEmpresaFiltro10041, isChevrolet10041Ativa],
  );

  // Then apply additional filters
  const pedidosFiltrados = useMemo(() => {
    if (!pedidosBaseEmpresa.length) return [];
   
   // Se não há filtros definidos, retornar todos os dados sem filtrar
   if (!filters) return pedidosBaseEmpresa;
    
    const isEmpresa1004 = isEmpresa1004Code(codEmpresaFiltro10041);
    const is1005Like = codEmpresaAtiva === '1005' || String(codEmpresaAtiva ?? '').toUpperCase() === 'MASTER';
    const filtered = pedidosBaseEmpresa.filter(p => {
      // 1004: vendas precisam de cod_pedido válido; devoluções vêm do próprio
      // endpoint /pedidos com cod_pedido=0 e devem ser preservadas para o card.
      if (isEmpresa1004) {
        if (p.tipo === 'DEVOLUCAO') {
          if (!isDevolucaoValida1004(p)) return false;
        } else if (!isPedidoVendaValido1004(p)) {
          return false;
        }
      }
      if (filters?.periodo) {
        // 1001/1003: BI usa data_pedido. 1004: usa SOMENTE data_faturamento.
        const dataReferencia = isEmpresa1004
          ? p.data_faturamento
          : codEmpresaAtiva === '1003' || String(codEmpresaAtiva ?? '') === '1001'
            ? (p.data_pedido || p.data_faturamento)
            : (p.data_faturamento || p.data_pedido);
        // Comparar por chave YYYY-MM-DD, não por Date. A API pode retornar
        // data_faturamento com horário; usar Date excluía registros de 30/06
        // após 00:00 e derrubava o total da 1004 no Preview.
        if (!isDateKeyInRange(dataReferencia, filters.periodo.inicio, filters.periodo.fim)) return false;
      }
      if (isEmpresa1004) {
        const is10041 = isChevrolet10041Ativa || shouldUseVendedorChevrolet10041(codEmpresaFiltro10041, filialAtiva);
        const matchesVendedor = (target: unknown) => is10041
          ? pedidoMatchesVendedor10041(p, target)
          : String(target) === String(p.vendedor_codigo);
        const vendedoresFiltro = getFiltroVendedoresSemEquipeCt10041(filters?.vendedores, codEmpresaFiltro10041, filialAtiva);
        const vendedorFiltro = getFiltroVendedorSemEquipeCt10041(filters?.vendedor, codEmpresaFiltro10041, filialAtiva);
        if (vendedoresFiltro && vendedoresFiltro.length > 0) {
          if (!vendedoresFiltro.some(matchesVendedor)) return false;
        } else if (vendedorFiltro) {
          if (!matchesVendedor(vendedorFiltro)) return false;
        }
      } else {
        const f1005 = filters as any;
        if (f1005?.vendedor_externo && !pedidoMatchesVendedor1005(p, f1005.vendedor_externo)) return false;
        if (f1005?.vendedor_interno && !pedidoMatchesVendedor1005(p, f1005.vendedor_interno)) return false;
        if (f1005?.vendedor_meta && !pedidoMatchesVendedor1005(p, f1005.vendedor_meta)) return false;
        if (filters?.vendedores && filters.vendedores.length > 0) {
          // 1005-like: casa o vendedor em qualquer papel (principal / interno /
          // externo / meta). Dedup por pedido abaixo evita inflar totais.
          if (!filters.vendedores.some(v => is1005Like ? pedidoMatchesVendedor1005(p, v) : String(v) === String(p.vendedor_codigo))) return false;
        } else if (filters?.vendedor) {
          if (is1005Like) {
            if (!pedidoMatchesVendedor1005(p, filters.vendedor)) return false;
          } else if (p.vendedor_codigo !== filters.vendedor) return false;
        } else {

          const arr = filtrarPorEquipePadrao([p as any], codEmpresaFiltro10041, filialAtiva);
          if (arr.length === 0) return false;
        }
      }
      if (filters?.cliente && p.cliente_codigo !== filters.cliente) return false;
      if (!isEmpresa1004 && filters?.status && filters.status !== 'todos' && p.status !== filters.status) return false;
      if (!isEmpresa1004 && filters?.tipo && filters.tipo !== 'todos' && (p.tipo || 'PEDIDO') !== filters.tipo) return false;
      if (filters?.uf && p.cliente_uf !== filters.uf) return false;
      // ARMO (1005): restringe a Visão Geral e todos os KPIs derivados apenas
      // às marcas da Linha Técnica (mesma lista usada em Marcas/Metas).
      // Não afeta 1001/1002/1003/1004 nem outras empresas.
      if (codEmpresaAtiva === '1005') {
      }
      return true;
    });
    // 1005/MASTER: não deduplicar linhas financeiras por cod_pedido.
    // O JSON da ARMO contém múltiplas linhas válidas do mesmo pedido/NF
    // (itens/parcelas/serviços). A deduplicação antiga mantinha só a primeira
    // linha e descartava faturamento real, causando o card Faturado subavaliado.
    return filtered;
  }, [pedidosBaseEmpresa, filters, codEmpresaAtiva, codEmpresaFiltro10041, filialAtiva, isChevrolet10041Ativa]);


  const devolucoesFiltradas = useMemo(() => {
    if (!devolucoesBaseEmpresa.length) return [];
   
   // Se não há filtros definidos, retornar todos os dados sem filtrar
   if (!filters) return devolucoesBaseEmpresa;
    
    return devolucoesBaseEmpresa.filter(d => {
      if (filters?.periodo) {
        if (!isDateKeyInRange(d.data, filters.periodo.inicio, filters.periodo.fim)) return false;
      }
      const vendedoresFiltro = getFiltroVendedoresSemEquipeCt10041(filters?.vendedores, codEmpresaFiltro10041, filialAtiva);
      const vendedorFiltro = getFiltroVendedorSemEquipeCt10041(filters?.vendedor, codEmpresaFiltro10041, filialAtiva);
      const is10041 = isChevrolet10041Ativa || shouldUseVendedorChevrolet10041(codEmpresaFiltro10041, filialAtiva);
      const matchesVendedor = (target: unknown) => is10041
        ? registroMatchesVendedor10041(d as any, target)
        : String(target) === String(d.vendedor_codigo);
      if (vendedoresFiltro && vendedoresFiltro.length > 0) {
        if (!vendedoresFiltro.some(matchesVendedor)) return false;
      } else if (vendedorFiltro) {
        if (!matchesVendedor(vendedorFiltro)) return false;
      } else {
        const arr = filtrarPorEquipePadrao([d as any], codEmpresaFiltro10041, filialAtiva);
        if (arr.length === 0) return false;
      }
      if (filters?.cliente && d.cliente_codigo !== filters.cliente) return false;
      if (filters?.uf && d.cliente_uf !== filters.uf) return false;
      if (codEmpresaAtiva === '1005') {
      }
      return true;
    });
  }, [devolucoesBaseEmpresa, filters, codEmpresaAtiva, codEmpresaFiltro10041, filialAtiva, isChevrolet10041Ativa]);

  // Helper: valor_real assinado de uma transação (PEDIDO+, DEVOLUCAO-)
  const getValorReal = (p: Pedido): number => {
    if (typeof p.valor_real === 'number') return p.valor_real;
    const base = p.valor_liquido_coluna || p.valor_liquido || p.valor_bruto || 0;
    return p.tipo === 'DEVOLUCAO' ? -Math.abs(base) : Math.abs(base);
  };

  // KPIs gerais — todos os totais derivados de SUM(Valor_Real)
  const kpis = useMemo((): ComercialKPIs => {
    // Separar PEDIDO x DEVOLUCAO apenas para exibição opcional (regra do banco)
    const apenasPedidos = pedidosFiltrados.filter(p => (p.tipo || 'PEDIDO') === 'PEDIDO');
    const apenasDevolucoes = pedidosFiltrados.filter(p => p.tipo === 'DEVOLUCAO');

    // ===== Empresa 1001 (Caspper) — regra oficial do BI antigo =====
    // Receita = SUM(valor_bruto dos PEDIDOS)  − SUM(valor_devolucao do próprio PEDIDO)
    // Devoluções = SUM(valor_devolucao do próprio PEDIDO)  (NÃO somar /devolucoes → evita dupla contagem)
    // Qtd Pedidos = COUNT(DISTINCT cod_pedido/numero)
    const isEmpresa1004 = isEmpresa1004Code(codEmpresaAtiva);
    const isEmpresa1001 = String(codEmpresaAtiva ?? '') === '1001' || isEmpresa1004;
    const is1005Like = codEmpresaAtiva === '1005' || String(codEmpresaAtiva ?? '').toUpperCase() === 'MASTER';

    // Faturamento principal:
    //   1001 → SUM(valor_bruto) dos PEDIDOS (equivale a "Valor Total" do BI antes das devoluções)
    //   1005/MASTER → SUM(valor_liquido) que já é "faturado por linha": 0 quando
    //                 não há data_faturamento, +Valor_Real quando faturado, −Valor_Devolucao
    //                 na devolução. Isso impede que pedidos em aberto inflacionem o card.
    //   demais → SUM(Valor_Real) sobre toda a base unificada (comportamento existente)
    // 1004 (Pelegrini): Receita = SUM(ValorLiquidoFinal) - SUM(ValorDevolucao), sem /devolucoes legado.
    // 1001 (Caspper): mantém `valor_bruto` (regra do BI antigo).
    const faturamentoBase1001 = apenasPedidos.reduce((acc, p) => {
      if (isEmpresa1004) {
        return acc + getValorLiquidoFinal1004(p);
      }
      return acc + Math.abs(p.valor_bruto || 0);
    }, 0);
    const totalDevolucaoPedidoFld = (isEmpresa1004 ? apenasPedidos : pedidosFiltrados)
      .reduce((acc, p) => acc + (isEmpresa1004 ? getValorDevolucao1004(p) : Math.abs((p as any).valor_devolucao_real || 0)), 0);
    const totalDevolucao1004 = totalDevolucaoPedidoFld
      + apenasDevolucoes.reduce((acc, p) => acc + getValorDevolucao1004(p), 0);

    const faturamentoLiquido = isEmpresa1004
      ? pedidosFiltrados.reduce((acc, p) => acc + getReceitaLiquida1004(p), 0)
      : isEmpresa1001
      ? (faturamentoBase1001 - totalDevolucaoPedidoFld)
      : is1005Like
        ? pedidosFiltrados.reduce((acc, p) => acc + (p.valor_liquido || 0), 0)
        : pedidosFiltrados.reduce((acc, p) => acc + getValorReal(p), 0);

    // Total de devoluções:
    //   1001 → campo valor_devolucao dos próprios pedidos (bate com o BI)
    //   1005/MASTER → SUM(|valor_liquido|) das linhas DEVOLUCAO (já sinal correto)
    //   demais → SUM(|Valor_Real|) das linhas do endpoint /devolucoes (comportamento atual)
    const totalDevolucoes = isEmpresa1004
      ? totalDevolucao1004
      : isEmpresa1001
      ? totalDevolucaoPedidoFld
      : is1005Like
        ? apenasDevolucoes.reduce((acc, p) => acc + Math.abs(p.valor_liquido || 0), 0)
        : apenasDevolucoes.reduce((acc, p) => acc + Math.abs(getValorReal(p)), 0);

    const sumUniquePedido1005 = (rows: Pedido[], valueGetter: (p: Pedido) => number) => {
      const grouped = new Map<string, Pedido[]>();
      for (const p of rows) {
        const key = getPedidoKey1005(p);
        if (!key) continue;
        grouped.set(key, [...(grouped.get(key) || []), p]);
      }
      return Array.from(grouped.values()).reduce((acc, group) => {
        const values = group.map(valueGetter).filter(v => Number.isFinite(v));
        return acc + (values.length ? Math.max(...values) : 0);
      }, 0);
    };

    // Brutos (apenas pedidos, p/ ticket médio e indicadores secundários).
    // 1005: valor do pedido é total por documento; somar linhas inflaria o card.
    const totalValorPedido = is1005Like
      ? sumUniquePedido1005(apenasPedidos, p => p.valor_bruto || 0)
      : apenasPedidos.reduce((acc, p) => acc + (p.valor_bruto || 0), 0);
    const totalValorLiquidoColuna = apenasPedidos.reduce((acc, p) => acc + (p.valor_liquido_coluna || 0), 0);
    const totalValorCusto = apenasPedidos.reduce((acc, p) => acc + (p.valor_custo || 0), 0);
    const totalValorDesconto = apenasPedidos.reduce((acc, p) => acc + (p.valor_desconto || 0), 0);

    const pedidosFaturados = apenasPedidos.filter(p => p.status === 'faturado');
    const pedidosPendentes = apenasPedidos.filter(p => p.status === 'pendente');

    const realizadoFaturado = (isEmpresa1001 || isEmpresa1004)
      ? faturamentoLiquido
      : is1005Like
        ? pedidosFaturados.reduce((acc, p) => acc + (p.valor_liquido || 0), 0)
        : pedidosFaturados.reduce((acc, p) => acc + getValorReal(p), 0);
    const carteiraPendente = is1005Like
      ? sumUniquePedido1005(pedidosPendentes, p => p.valor_bruto || 0)
      : pedidosPendentes.reduce((acc, p) => acc + (p.valor_bruto || 0), 0);

    const clientesUnicos = new Set(pedidosFiltrados.map(p => p.cliente_codigo));
    const vendedoresUnicos = new Set(pedidosFiltrados.map(p =>
      (isChevrolet10041Ativa || shouldUseVendedorChevrolet10041(codEmpresaFiltro10041, filialAtiva)) ? getVendedorChevrolet10041(p).codigo : p.vendedor_codigo
    ));

    const getPedidoKey1001 = (p: Pedido) => {
      const numero = String((p as any).numero ?? '').trim();
      if (numero && numero !== '0') return `P:${numero}`;
      const nf = String((p as any).num_nf ?? '').trim();
      if (nf && nf !== '0') return `NF:${nf}`;
      const id = String((p as any).id ?? '').trim();
      return id ? `ID:${id}` : '';
    };

    const pedidosDistintos1004 = new Set(apenasPedidos.map(getPedidoKey1004).filter(Boolean)).size;
    // Qtd Pedidos: 10041 segue a coluna QTD. do FAT (movimentos de venda).
    // CT/1001 preservam DISTINCT para manter o comportamento historico validado.
    const qtdPedidos = isEmpresa1004
      ? resolverQuantidadeVendasPelegrini({
          isChevrolet10041: isChevrolet10041Ativa || shouldUseVendedorChevrolet10041(codEmpresaFiltro10041, filialAtiva),
          movimentosVenda: apenasPedidos.length,
          pedidosDistintos: pedidosDistintos1004,
        })
      : isEmpresa1001
      ? new Set(apenasPedidos.map(getPedidoKey1001).filter(Boolean)).size
      : is1005Like
        ? new Set(apenasPedidos.map(getPedidoKey1005).filter(Boolean)).size
      : apenasPedidos.length;

    const ticketMedio = qtdPedidos > 0 ? ((isEmpresa1001 || isEmpresa1004 || is1005Like) ? faturamentoLiquido : totalValorPedido) / qtdPedidos : 0;

    const margens = apenasPedidos.filter(p => p.margem !== undefined).map(p => p.margem!);
    const margemMedia = margens.length > 0 ? margens.reduce((a, b) => a + b, 0) / margens.length : undefined;

    if (isEmpresa1001 || isEmpresa1004) {
      const totalBrutoRecebido = pedidosByCompany
        .filter(p => (p.tipo || 'PEDIDO') === 'PEDIDO')
        .reduce((acc, p) => acc + Math.abs(p.valor_bruto || 0), 0);
      const totalBrutoAposFiltro = apenasPedidos.reduce((acc, p) => acc + Math.abs(p.valor_bruto || 0), 0);

      if (isEmpresa1004) {
        const summarize1004 = (stage: string, rows: Pedido[]) => {
          const vendas = rows.filter(isPedidoVendaValido1004);
          const devs = rows.filter(isDevolucaoValida1004);
          const receitaBase = vendas.reduce((acc, p) => acc + getValorLiquidoFinal1004(p), 0);
          const receitaBruta = vendas.reduce((acc, p) => acc + Math.abs(p.valor_bruto || 0), 0);
          const devolucoes = vendas.reduce((acc, p) => acc + getValorDevolucao1004(p), 0)
            + devs.reduce((acc, p) => acc + getValorDevolucao1004(p), 0);
          return {
            etapa: stage,
            registros: rows.length,
            vendasValidas: vendas.length,
            pedidosDistintos: new Set(vendas.map(getPedidoKey1004).filter(Boolean)).size,
            clientes: new Set([...vendas, ...devs].map(p => String(p.cliente_codigo ?? '').trim()).filter(Boolean)).size,
            vendedores: new Set([...vendas, ...devs].map(getVendedorNomeNormalizado).filter(Boolean)).size,
            receita: Number((receitaBase - devolucoes).toFixed(2)),
            receitaBrutaSemDesconto: Number(receitaBruta.toFixed(2)),
            devolucoes: Number(devolucoes.toFixed(2)),
          };
        };
        const semCodZero = allPedidos.filter(p => p.tipo === 'DEVOLUCAO' || getPedidoNumero(p) !== '0');
        const semVendedorVazio = semCodZero.filter(p => getVendedorNomeNormalizado(p));
        const aposFilial = semVendedorVazio.filter(p => !isCasaChevrolet(p));
        const aposEquipe = aposFilial; // 1004 não aplica equipePadrao nem lista fixa de vendedores.
        console.info('[Comercial][1004][Diagnóstico Fluxo] ' + JSON.stringify({
          periodo: filters?.periodo ?? null,
          build: import.meta.env.MODE,
          etapas: [
            summarize1004('bruto recebido da API/hook', allPedidos),
            summarize1004('após remoção de cod_pedido=0 em vendas', semCodZero),
            summarize1004('após remoção de vendedor vazio', semVendedorVazio),
            summarize1004('após filtro de filial sem Chevrolet', aposFilial),
            summarize1004('após filtro de equipe (não aplicado)', aposEquipe),
            summarize1004('final usado nos cards', pedidosFiltrados),
          ],
          kpisFinalHook: {
            receita: Number(faturamentoLiquido.toFixed(2)),
            devolucoes: Number(totalDevolucoes.toFixed(2)),
            vendas: qtdPedidos,
            clientes: clientesUnicos.size,
            vendedores: vendedoresUnicos.size,
          },
          regra: '1004: data_faturamento; Receita = SUM(ValorLiquidoFinal) - SUM(ValorDevolucao); cod_pedido=0/vendedor vazio/Casa da Chevrolet excluídos; sem /devolucoes legado.',
        }));
      } else {
        console.info('[Comercial][1001][Diagnóstico KPIs] ' + JSON.stringify({
          periodo: filters?.periodo ?? null,
          totalRegistrosRecebidos: pedidosByCompany.length,
          totalBrutoRecebido: Number(totalBrutoRecebido.toFixed(2)),
          totalRegistrosAposFiltroPeriodo: pedidosFiltrados.length,
          totalBrutoAposFiltroPeriodo: Number(totalBrutoAposFiltro.toFixed(2)),
          totalReceita: Number(faturamentoLiquido.toFixed(2)),
          totalDevolucoes: Number(totalDevolucoes.toFixed(2)),
          totalPedidosUnicos: qtdPedidos,
          regra: 'Receita = SUM(valor_bruto PEDIDO) - SUM(valor_devolucao do /pedidos); Devoluções = somente /pedidos.valor_devolucao; Vendas = COUNT DISTINCT cod_pedido/num_nf',
        }));
      }
    }

    if (is1005Like) {
      const inPeriodo = (p: Pedido) => {
        if (!filters?.periodo) return true;
        const ref = (p.data_faturamento || p.data_pedido || '').substring(0, 10);
        return ref >= filters.periodo.inicio && ref <= filters.periodo.fim;
      };
      const summarize1005 = (etapa: string, rows: Pedido[]) => {
        const faturados = rows.filter(p => (p.tipo || 'PEDIDO') === 'PEDIDO' && !!p.data_faturamento);
        return {
          etapa,
          registros: rows.length,
          faturados: faturados.length,
          pedidosDistintos: new Set(rows.map(getPedidoKey1005).filter(Boolean)).size,
          clientes: new Set(rows.map(p => String(p.cliente_codigo ?? '').trim()).filter(Boolean)).size,
          vendedores: new Set(rows.map(p => String(p.vendedor_codigo ?? '').trim()).filter(Boolean)).size,
          valorFaturado: Number(rows.reduce((acc, p) => acc + (p.valor_liquido || 0), 0).toFixed(2)),
          valorPedido: Number(rows.filter(p => (p.tipo || 'PEDIDO') === 'PEDIDO').reduce((acc, p) => acc + (p.valor_bruto || 0), 0).toFixed(2)),
        };
      };
      console.info('[Comercial][1005][Auditoria Visão Geral] ' + JSON.stringify({
        periodo: filters?.periodo ?? null,
        etapas: [
          summarize1005('bruto recebido do Storage/API', pedidosByCompany),
          summarize1005('após filtro de período', pedidosByCompany.filter(inPeriodo)),
          summarize1005('final usado nos cards', pedidosFiltrados),
        ],
        kpisFinalHook: {
          faturado: Number(faturamentoLiquido.toFixed(2)),
          valorPedido: Number(totalValorPedido.toFixed(2)),
          devolucoes: Number(totalDevolucoes.toFixed(2)),
          pedidosDistintos: qtdPedidos,
          clientes: clientesUnicos.size,
          vendedores: vendedoresUnicos.size,
        },
        regra: '1005: Faturado = SUM(valor_liquido por linha faturada/devolução), sem deduplicar cod_pedido; Pedidos = DISTINCT cod_pedido/num_nf.',
      }));
    }

    return {
      faturamentoBruto: (isEmpresa1001 || isEmpresa1004) ? faturamentoBase1001 : totalValorPedido,
      faturamentoLiquido,
      totalDevolucoes,
      totalValorPedido,
      totalValorLiquidoColuna,
      totalValorCusto,
      totalValorDesconto,
      margemMedia,
      ticketMedio,
      qtdPedidos,
      qtdClientes: clientesUnicos.size,
      qtdVendedores: vendedoresUnicos.size,
      carteiraPendente,
      realizadoFaturado,
    };
  }, [pedidosFiltrados, pedidosByCompany, filters?.periodo, codEmpresaAtiva]);

  // Performance por vendedor — ranking ordenado por SUM(Valor_Real)
  const vendedoresPerformance = useMemo((): VendedorPerformance[] => {
    const vendedorMap = new Map<string | number, VendedorPerformance>();

    const isEmpresa1004 = isEmpresa1004Code(codEmpresaAtiva);
    const is10041 = isChevrolet10041Ativa || shouldUseVendedorChevrolet10041(codEmpresaFiltro10041, filialAtiva);

    pedidosFiltrados.forEach(p => {
      const vendedor = is10041
        ? getVendedorChevrolet10041(p)
        : { codigo: p.vendedor_codigo, nome: p.vendedor_nome || `Vendedor ${p.vendedor_codigo}` };
      const key = vendedor.codigo;
      const existing = vendedorMap.get(key) || {
        codigo: key,
        nome: vendedor.nome,
        faturamentoLiquido: 0,
        valorFaturado: 0,
        valorPendente: 0,
        totalVendas: 0,
        totalDevolucoes: 0,
        pedidosFaturados: 0,
        pedidosPendentes: 0,
        ticketMedio: 0,
        participacao: 0,
        margem: 0,
        comissao: 0,
      };

      const vr = isEmpresa1004 ? getReceitaLiquida1004(p) : getValorReal(p);
      // SUM(Valor_Real) — não separar pedido/devolução no total
      existing.faturamentoLiquido += vr;

      if (p.tipo === 'DEVOLUCAO') {
        existing.totalDevolucoes += Math.abs(vr);
        // Devoluções reduzem o faturado
        existing.valorFaturado += vr;
      } else {
        if (isEmpresa1004) existing.totalDevolucoes += getValorDevolucao1004(p);
        existing.totalVendas += isEmpresa1004 ? getValorLiquidoFinal1004(p) : vr;
        if (p.status === 'faturado') {
          existing.pedidosFaturados++;
          existing.valorFaturado += vr;
        } else {
          existing.pedidosPendentes++;
          existing.valorPendente += vr;
        }
        if (p.margem) existing.margem = (existing.margem || 0) + p.margem;
        if (p.comissao) existing.comissao = (existing.comissao || 0) + p.comissao;
      }

      vendedorMap.set(key, existing);
    });

    const totalGeral = kpis.faturamentoLiquido;

    const resultado = Array.from(vendedorMap.values())
      .map(v => {
        const qtdPedidos = v.pedidosFaturados + v.pedidosPendentes;
        v.ticketMedio = qtdPedidos > 0 ? (isEmpresa1004 ? v.faturamentoLiquido : v.totalVendas) / qtdPedidos : 0;
        v.participacao = totalGeral > 0 ? (v.faturamentoLiquido / totalGeral) * 100 : 0;
        return v;
      })
      .sort((a, b) => b.faturamentoLiquido - a.faturamentoLiquido);

    // Auditoria 1004 (Casa da Transmissão) — compara com o relatório antigo do ERP
    if (isEmpresa1004 && filters?.periodo?.inicio === '2026-07-01' && filters?.periodo?.fim === '2026-07-24') {
      const referenciaERP: Record<string, number> = {
        'MARCIO CCH': 14330.62,
        'FERNANDO M CCH': 1883.22,
        'PAULO HENRIQUE': 291106.31,
        'RAFAEL CCH': 8.00,
        'DANIEL': 33500.02,
        'ELIANE': 24805.73,
        'FABIO R': 134183.98,
        'ERLAN': 247724.52,
        'BRUNO': 392841.87,
      };
      const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
      const linhas = resultado.map(v => {
        const alvo = referenciaERP[norm(v.nome)];
        return {
          cod_vendedor: v.codigo,
          vendedor: v.nome,
          sistema: Number(v.faturamentoLiquido.toFixed(2)),
          erp: alvo ?? null,
          diferenca: alvo == null ? null : Number((v.faturamentoLiquido - alvo).toFixed(2)),
        };
      });
      // eslint-disable-next-line no-console
      console.table(linhas);
      // eslint-disable-next-line no-console
      console.warn('[1004][auditoria] A API só retorna movimentos FATURADOS (status_pedido="Faturado"); não há base de pedidos em aberto ("A Faturar"), por isso o Valor Total do ERP não é reproduzível integralmente.');
    }

    return resultado;
  }, [pedidosFiltrados, kpis, codEmpresaAtiva, filters?.periodo?.inicio, filters?.periodo?.fim]);


  // Performance por cliente — também por SUM(Valor_Real)
  const primeirasComprasPorCliente = useMemo(
    () => calcularPrimeirasComprasPorCliente(pedidosBaseEmpresa, { periodoInicio: filters?.periodo?.inicio }),
    [pedidosBaseEmpresa, filters?.periodo?.inicio],
  );

  const clientesPerformance = useMemo((): ClientePerformance[] => {
    const clienteMap = new Map<string | number, ClientePerformance>();

    const isEmpresa1004 = isEmpresa1004Code(codEmpresaAtiva);

    pedidosFiltrados.forEach(p => {
      const key = p.cliente_codigo;
      const existing = clienteMap.get(key) || {
        codigo: key,
        razao: p.cliente_razao || `Cliente ${key}`,
        fantasia: p.cliente_fantasia,
        cidade: p.cliente_cidade,
        uf: p.cliente_uf,
        vendedor_codigo: undefined,
        vendedor_nome: undefined,
        faturamentoLiquido: 0,
        totalPedidos: 0,
        totalDevolucoes: 0,
        ticketMedio: 0,
        participacao: 0,
        ultimaCompra: undefined,
        primeiraCompra: primeirasComprasPorCliente.get(String(key).trim()),
      };

      const vr = isEmpresa1004 ? getReceitaLiquida1004(p) : getValorReal(p);
      existing.faturamentoLiquido += vr;

      if (p.tipo === 'DEVOLUCAO') {
        existing.totalDevolucoes += Math.abs(vr);
      } else {
        if (isEmpresa1004) existing.totalDevolucoes += getValorDevolucao1004(p);
        existing.totalPedidos++;
        if (!existing.ultimaCompra || p.data_pedido > existing.ultimaCompra) {
          existing.ultimaCompra = p.data_pedido;
        }
        // Vendedor: regra "último pedido vence" (ignora devoluções)
        if (p.vendedor_nome || p.vendedor_codigo != null) {
          if (!existing.vendedor_nome || (p.data_pedido && (!existing.ultimaCompra || p.data_pedido >= existing.ultimaCompra))) {
            existing.vendedor_codigo = p.vendedor_codigo ?? existing.vendedor_codigo;
            existing.vendedor_nome = p.vendedor_nome ?? existing.vendedor_nome;
          }
        }
      }

      // Fallback: se ainda nada, aceita até de devolução
      if (!existing.vendedor_nome && (p.vendedor_nome || p.vendedor_codigo != null)) {
        existing.vendedor_codigo = p.vendedor_codigo ?? existing.vendedor_codigo;
        existing.vendedor_nome = p.vendedor_nome ?? existing.vendedor_nome;
      }

      clienteMap.set(key, existing);
    });

    const totalGeral = kpis.faturamentoLiquido;

    return Array.from(clienteMap.values())
      .map(c => {
        c.ticketMedio = c.totalPedidos > 0 ? (c.faturamentoLiquido + c.totalDevolucoes) / c.totalPedidos : 0;
        c.participacao = totalGeral > 0 ? (c.faturamentoLiquido / totalGeral) * 100 : 0;
        return c;
      })
      .sort((a, b) => b.faturamentoLiquido - a.faturamentoLiquido);
  }, [pedidosFiltrados, kpis, codEmpresaAtiva, primeirasComprasPorCliente]);

  // Evolução diária — vendas/devolucoes/liquido a partir de Valor_Real
  const evolucaoDiaria = useMemo((): EvolucaoDiaria[] => {
    const diaMap = new Map<string, EvolucaoDiaria>();

    const isEmpresa1004 = isEmpresa1004Code(codEmpresaAtiva);

    pedidosFiltrados.forEach(p => {
      const data = ((isEmpresa1004 ? p.data_faturamento : p.data_pedido) || '').split('T')[0];
      if (!data) return;
      const existing = diaMap.get(data) || { data, vendas: 0, devolucoes: 0, liquido: 0, pedidos: 0 };
      const vr = isEmpresa1004 ? getReceitaLiquida1004(p) : getValorReal(p);
      if (p.tipo === 'DEVOLUCAO') {
        existing.devolucoes += Math.abs(vr);
      } else {
        existing.vendas += isEmpresa1004 ? getValorLiquidoFinal1004(p) : vr;
        if (isEmpresa1004) existing.devolucoes += getValorDevolucao1004(p);
        existing.pedidos++;
      }
      existing.liquido += vr;
      diaMap.set(data, existing);
    });

    return Array.from(diaMap.values()).sort((a, b) => a.data.localeCompare(b.data));
  }, [pedidosFiltrados, codEmpresaAtiva, filialAtiva]);

  // Evolução mensal — ignora filtro de período para sempre mostrar histórico
  const pedidosParaEvolucao = useMemo(() => {
    if (!pedidosBaseEmpresa.length) return [];
    if (!filters) return pedidosBaseEmpresa;
    const isEmpresa1004 = isEmpresa1004Code(codEmpresaAtiva);
    const is1005Like = codEmpresaAtiva === '1005' || String(codEmpresaAtiva ?? '').toUpperCase() === 'MASTER';
    const filtered = pedidosBaseEmpresa.filter(p => {
      if (isEmpresa1004) {
        if (p.tipo === 'DEVOLUCAO') {
          if (!isDevolucaoValida1004(p)) return false;
        } else if (!isPedidoVendaValido1004(p)) {
          return false;
        }
        const is10041 = isChevrolet10041Ativa || shouldUseVendedorChevrolet10041(codEmpresaFiltro10041, filialAtiva);
        const matchesVendedor = (target: unknown) => is10041
          ? pedidoMatchesVendedor10041(p, target)
          : String(target) === String(p.vendedor_codigo);
        const vendedoresFiltro = getFiltroVendedoresSemEquipeCt10041(filters?.vendedores, codEmpresaFiltro10041, filialAtiva);
        const vendedorFiltro = getFiltroVendedorSemEquipeCt10041(filters?.vendedor, codEmpresaFiltro10041, filialAtiva);
        if (vendedoresFiltro && vendedoresFiltro.length > 0) {
          if (!vendedoresFiltro.some(matchesVendedor)) return false;
        } else if (vendedorFiltro && !matchesVendedor(vendedorFiltro)) {
          return false;
        }
        if (filters?.cliente && p.cliente_codigo !== filters.cliente) return false;
        if (filters?.uf && p.cliente_uf !== filters.uf) return false;
        return true;
      }
      const f1005 = filters as any;
      if (f1005?.vendedor_externo && !pedidoMatchesVendedor1005(p, f1005.vendedor_externo)) return false;
      if (f1005?.vendedor_interno && !pedidoMatchesVendedor1005(p, f1005.vendedor_interno)) return false;
      if (f1005?.vendedor_meta && !pedidoMatchesVendedor1005(p, f1005.vendedor_meta)) return false;
      if (filters?.vendedores && filters.vendedores.length > 0) {
        if (!filters.vendedores.some(v => is1005Like ? pedidoMatchesVendedor1005(p, v) : String(v) === String(p.vendedor_codigo))) return false;
      } else if (filters?.vendedor) {
        if (is1005Like) {
          if (!pedidoMatchesVendedor1005(p, filters.vendedor)) return false;
        } else if (p.vendedor_codigo !== filters.vendedor) return false;
      } else {

        const arr = filtrarPorEquipePadrao([p as any], codEmpresaFiltro10041, filialAtiva);
        if (arr.length === 0) return false;
      }
      if (filters?.cliente && p.cliente_codigo !== filters.cliente) return false;
      if (filters?.status && filters.status !== 'todos' && p.status !== filters.status) return false;
      if (filters?.tipo && filters.tipo !== 'todos' && (p.tipo || 'PEDIDO') !== filters.tipo) return false;
      if (filters?.uf && p.cliente_uf !== filters.uf) return false;
      return true;
    });
    return filtered;
  }, [pedidosBaseEmpresa, filters, codEmpresaAtiva, codEmpresaFiltro10041, filialAtiva, isChevrolet10041Ativa]);

  const evolucaoMensal = useMemo((): EvolucaoMensal[] => {
    const mesMap = new Map<string, EvolucaoMensal>();

    pedidosParaEvolucao.forEach(p => {
      const isEmpresa1004 = isEmpresa1004Code(codEmpresaAtiva);
      const dataRef = isEmpresa1004
        ? p.data_faturamento
        : codEmpresaAtiva === '1003' || String(codEmpresaAtiva ?? '') === '1001'
          ? (p.data_pedido || p.data_faturamento)
          : (p.data_faturamento || p.data_pedido);
      const mes = (dataRef || '').substring(0, 7);
      if (!mes) return;
      const existing = mesMap.get(mes) || { mes, vendas: 0, devolucoes: 0, liquido: 0, pedidos: 0 };
      const vr = isEmpresa1004 ? getReceitaLiquida1004(p) : getValorReal(p);
      if (p.tipo === 'DEVOLUCAO') {
        existing.devolucoes += Math.abs(vr);
      } else {
        existing.vendas += isEmpresa1004 ? getValorLiquidoFinal1004(p) : vr;
        if (isEmpresa1004) existing.devolucoes += getValorDevolucao1004(p);
        existing.pedidos++;
      }
      existing.liquido += vr;
      mesMap.set(mes, existing);
    });

    return Array.from(mesMap.values()).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [pedidosParaEvolucao, codEmpresaAtiva]);


  // Insights inteligentes
  const insights = useMemo((): InsightData[] => {
    const result: InsightData[] = [];
    
    // Top 10 concentração
    const top10 = clientesPerformance.slice(0, 10);
    const totalTop10 = top10.reduce((acc, c) => acc + c.faturamentoLiquido, 0);
    const totalGeral = kpis.faturamentoLiquido - kpis.totalDevolucoes;
    const concentracao = totalGeral > 0 ? (totalTop10 / totalGeral) * 100 : 0;
    
    if (concentracao > 50) {
      result.push({
        tipo: 'alerta',
        titulo: 'Alta concentração de receita',
        descricao: `Top 10 clientes representam ${concentracao.toFixed(1)}% do faturamento`,
        valor: concentracao,
      });
    }
    
    // Devoluções altas
    const taxaDevolucao = kpis.faturamentoLiquido > 0 
      ? (kpis.totalDevolucoes / kpis.faturamentoLiquido) * 100 
      : 0;
    
    if (taxaDevolucao > 5) {
      result.push({
        tipo: 'alerta',
        titulo: 'Taxa de devolução elevada',
        descricao: `Devoluções representam ${taxaDevolucao.toFixed(1)}% das vendas`,
        valor: taxaDevolucao,
      });
    }
    
    // Carteira pendente grande
    const taxaCarteira = (kpis.faturamentoLiquido - kpis.totalDevolucoes) > 0
      ? (kpis.carteiraPendente / (kpis.faturamentoLiquido - kpis.totalDevolucoes)) * 100
      : 0;
    
    if (taxaCarteira > 30) {
      result.push({
        tipo: 'info',
        titulo: 'Carteira pendente significativa',
        descricao: `${taxaCarteira.toFixed(1)}% do valor ainda aguarda faturamento`,
        valor: kpis.carteiraPendente,
      });
    }
    
    // Vendedor destaque
    if (vendedoresPerformance.length > 0) {
      const top = vendedoresPerformance[0];
      if (top.participacao > 25) {
        result.push({
          tipo: 'oportunidade',
          titulo: 'Vendedor destaque',
          descricao: `${top.nome} lidera com ${top.participacao.toFixed(1)}% das vendas`,
          valor: top.faturamentoLiquido,
        });
      }
    }
    
    return result;
  }, [clientesPerformance, vendedoresPerformance, kpis]);

  // Listas únicas para filtros
  const vendedoresUnicos = useMemo(() => {
    const map = new Map<string | number, string>();
    const is10041 = isChevrolet10041Ativa || shouldUseVendedorChevrolet10041(codEmpresaFiltro10041, filialAtiva);
    pedidosFiltrados.forEach(p => {
      if (is10041) {
        const vendedor = getVendedorChevrolet10041(p);
        map.set(vendedor.codigo, vendedor.nome);
      } else {
        map.set(p.vendedor_codigo, p.vendedor_nome || `Vendedor ${p.vendedor_codigo}`);
      }
    });
    return Array.from(map.entries()).map(([codigo, nome]) => ({ codigo, nome }));
  }, [pedidosFiltrados, codEmpresaAtiva]);

  // Lista COMPLETA de vendedores da filial (antes do filtro de equipe padrão e vendedor),
  // usada para popular o dropdown — assim o usuário pode escolher qualquer vendedor,
  // mesmo fora da equipe padrão.
  const vendedoresDisponiveis = useMemo(() => {
    const is1005Like = codEmpresaAtiva === '1005' || String(codEmpresaAtiva ?? '').toUpperCase() === 'MASTER';
    const is10041 = isChevrolet10041Ativa || shouldUseVendedorChevrolet10041(codEmpresaFiltro10041, filialAtiva);
    const map = new Map<string | number, string>();
    const seenNames = new Set<string>();

    const addByCode = (codigo: unknown, nome: unknown) => {
      if (codigo === undefined || codigo === null || codigo === '') return;
      const nomeStr = (nome === undefined || nome === null || nome === '')
        ? `Vendedor ${codigo}`
        : String(nome).trim();
      if (!map.has(codigo as any)) {
        map.set(codigo as any, nomeStr);
        seenNames.add(nomeStr.toUpperCase());
      }
    };

    const addByName = (nome: unknown) => {
      if (nome === undefined || nome === null) return;
      const nomeStr = String(nome).trim();
      if (!nomeStr) return;
      const key = nomeStr.toUpperCase();
      if (seenNames.has(key)) return;
      seenNames.add(key);
      // Usa o próprio nome como chave (sem código disponível nesses campos).
      map.set(nomeStr, nomeStr);
    };

    pedidosBaseEmpresa.forEach(p => {
      const anyP = p as any;
      if (!is10041) {
        addByCode(p.vendedor_codigo, p.vendedor_nome);
      }
      if (is1005Like || is10041) {
        // Para 1005/MASTER, também expõe vendedor interno/externo/meta na
        // lista — assim carteiras que só aparecem nesses campos (ex.: um
        // vendedor externo sem pedidos como "vendedor principal") ficam
        // acessíveis no filtro.
        addByCode(anyP.cod_vendedor_chevrolet, anyP.vendedor_chevrolet ?? anyP.nome_vendedor_chevrolet);
        addByCode(anyP.cod_vendedor_cch, anyP.vendedor_cch ?? anyP.nome_vendedor_cch);
        addByCode(anyP.cod_vendedor_comissao, anyP.vendedor_comissao ?? anyP.nome_vendedor_comissao);
        addByCode(anyP.cod_vendedor_externo, anyP.vendedor_externo ?? anyP.nome_externo);
        addByCode(anyP.cod_vendedor_interno, anyP.vendedor_interno ?? anyP.nome_interno);
        addByCode(anyP.cod_vendedor_meta, anyP.vendedor_meta);
        addByName(anyP.vendedor_chevrolet ?? anyP.nome_vendedor_chevrolet);
        addByName(anyP.vendedor_cch ?? anyP.nome_vendedor_cch);
        addByName(anyP.vendedor_comissao ?? anyP.nome_vendedor_comissao);
        addByName(anyP.vendedor_externo ?? anyP.nome_externo);
        addByName(anyP.vendedor_interno ?? anyP.nome_interno);
        addByName(anyP.vendedor_meta);
      }
    });

    return Array.from(map.entries())
      .map(([codigo, nome]) => ({ codigo, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [pedidosBaseEmpresa, codEmpresaAtiva, codEmpresaFiltro10041, filialAtiva, isChevrolet10041Ativa]);

  const clientesUnicos = useMemo(() => {
    const map = new Map<string | number, { razao: string; fantasia?: string }>();
    pedidosFiltrados.forEach(p => map.set(p.cliente_codigo, { 
      razao: p.cliente_razao || `Cliente ${p.cliente_codigo}`,
      fantasia: p.cliente_fantasia 
    }));
    return Array.from(map.entries()).map(([codigo, info]) => ({ codigo, ...info }));
  }, [pedidosFiltrados]);

  const ufsUnicas = useMemo(() => {
    const set = new Set<string>();
    pedidosFiltrados.forEach(p => p.cliente_uf && set.add(p.cliente_uf));
    return Array.from(set).sort();
  }, [pedidosFiltrados]);

  // Período disponível nos dados (para filtros inteligentes)
  // Estratégia: o "último mês" sugerido é o último mês COMPLETO disponível.
  // Critério: usamos a data de faturamento como referência e contamos quantos
  // pedidos cada mês tem. O último mês é considerado parcial se tiver menos
  // de 30% do volume médio dos 3 meses anteriores — nesse caso, retrocedemos
  // para o mês imediatamente anterior (o "último mês fechado").
  const periodoDisponivel = useMemo(() => {
    if (allPedidos.length === 0) return null;

    const isValidDate = (dateStr?: string) => {
      if (!dateStr || typeof dateStr !== 'string') return false;
      return /^(19|20)\d{2}-\d{2}-\d{2}/.test(dateStr);
    };

    // Usar data_faturamento como referência principal (cai para data_pedido se ausente)
    const pedidosComDataValida = allPedidos.filter(p =>
      isValidDate((p.data_faturamento || p.data_pedido) as string)
    );
    if (pedidosComDataValida.length === 0) return null;

    // Contagem de pedidos por mês (YYYY-MM), considerando apenas tipo PEDIDO
    // para não inflar o mês com devoluções esparsas.
    const contagemPorMes = new Map<string, number>();
    let minDate = '';
    let maxDate = '';
    for (const p of pedidosComDataValida) {
      const dataRef = (p.data_faturamento || p.data_pedido) as string;
      const mesKey = dataRef.substring(0, 7); // YYYY-MM
      if ((p.tipo || 'PEDIDO') === 'PEDIDO') {
        contagemPorMes.set(mesKey, (contagemPorMes.get(mesKey) ?? 0) + 1);
      }
      if (!minDate || dataRef < minDate) minDate = dataRef;
      if (!maxDate || dataRef > maxDate) maxDate = dataRef;
    }

    // Lista ordenada de meses com pedidos
    const mesesOrdenados = Array.from(contagemPorMes.entries())
      .filter(([, c]) => c > 0)
      .sort((a, b) => a[0].localeCompare(b[0]));

    if (mesesOrdenados.length === 0) {
      return {
        inicio: minDate,
        fim: maxDate,
        ultimoAno: maxDate.substring(0, 4),
        ultimoMes: maxDate.substring(5, 7),
      };
    }

    // Pegar o último mês como candidato e comparar com a média dos 3 meses anteriores
    let ultimoMesKey = mesesOrdenados[mesesOrdenados.length - 1][0];
    const ultimoMesCount = contagemPorMes.get(ultimoMesKey) ?? 0;
    const anteriores = mesesOrdenados.slice(-4, -1).map(([, c]) => c);
    const mediaAnterior = anteriores.length
      ? anteriores.reduce((a, b) => a + b, 0) / anteriores.length
      : 0;

    // Se o último mês é claramente parcial (<30% da média), retroceder 1 mês.
    if (mediaAnterior > 0 && ultimoMesCount < mediaAnterior * 0.3 && mesesOrdenados.length > 1) {
      ultimoMesKey = mesesOrdenados[mesesOrdenados.length - 2][0];
    }

    return {
      inicio: minDate,
      fim: maxDate,
      ultimoAno: ultimoMesKey.substring(0, 4),
      ultimoMes: ultimoMesKey.substring(5, 7),
    };
  }, [allPedidos]);

  return {
    pedidos: pedidosFiltrados,
    devolucoes: devolucoesFiltradas,
    kpis,
    vendedoresPerformance,
    clientesPerformance,
    evolucaoDiaria,
    evolucaoMensal,
    insights,
    vendedoresUnicos,
    vendedoresDisponiveis,
    clientesUnicos,
    ufsUnicas,
    periodoDisponivel,
    isLoading,
    error,
  };
}
