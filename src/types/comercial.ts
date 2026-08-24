// Tipos para os dados do Módulo Comercial

export type TipoTransacao = 'PEDIDO' | 'DEVOLUCAO';

export interface Pedido {
  id: string | number;
  numero?: string;
  data_pedido: string;
  data_faturamento?: string;
  status: 'pendente' | 'faturado' | string;

  // Tipo da transação e valor real assinado vindo do banco
  // PEDIDO -> valor_real positivo; DEVOLUCAO -> valor_real negativo
  tipo?: TipoTransacao;
  valor_real?: number;
  // Valor de devolução por linha (positivo). Só preenchido quando tipo = DEVOLUCAO.
  valor_devolucao_real?: number;
  
  // Empresa BI (constante do cliente)
  cod_empresa_bi?: string;
  
  // Filial (empresa no ERP)
  filial_codigo?: string | number;
  filial_nome?: string;
  
  // NF
  num_nf?: string;
  
  // Cliente
  cliente_codigo: string | number;
  cliente_razao?: string;
  cliente_fantasia?: string;
  cliente_cidade?: string;
  cliente_uf?: string;
  
  // Vendedor
  vendedor_codigo: string | number;
  vendedor_nome?: string;
  meta_vendedor?: number;
  cod_vendedor_chevrolet?: string | number;
  vendedor_chevrolet?: string;
  cod_vendedor_cch?: string | number;
  vendedor_cch?: string;
  cod_vendedor_comissao?: string | number;
  vendedor_comissao?: string;

  // Marca (quando o JSON do ERP traz por pedido — ex: sistema 1005)
  cod_marca?: string;
  marca?: string;

  
  // Valores
  valor_bruto: number;
  valor_desconto?: number;
  valor_liquido: number;
  valor_liquido_coluna?: number;
  /** ValorLiquidoFinal (Pelegrini 1004): valor bruto já com desconto aplicado, por linha (positivo em PEDIDO). */
  valor_liquido_final?: number;
  valor_custo?: number;
  margem?: number;
  comissao?: number;
  
  [key: string]: unknown;
}

export interface Devolucao {
  id: string | number;
  numero?: string;
  data: string;
  
  // Empresa
  cod_empresa_bi?: string;
  
  // Cliente
  cliente_codigo: string | number;
  cliente_razao?: string;
  cliente_fantasia?: string;
  cliente_cidade?: string;
  cliente_uf?: string;
  
  // Vendedor
  vendedor_codigo: string | number;
  vendedor_nome?: string;
  
  // Valores
  valor_produtos: number;
  valor_servicos?: number;
  valor_acessorios?: number;
  valor_desconto?: number;
  valor_total: number;
  valor_custo?: number;
  valor_liquido: number;
  
  [key: string]: unknown;
}

export interface VendedorPerformance {
  codigo: string | number;
  nome: string;
  foto?: string;
  faturamentoLiquido: number;
  valorFaturado: number;
  valorPendente: number;
  totalVendas: number;
  totalDevolucoes: number;
  pedidosFaturados: number;
  pedidosPendentes: number;
  ticketMedio: number;
  meta?: number;
  metaMensal?: number;
  atingimentoMeta?: number;
  participacao: number;
  margem?: number;
  comissao?: number;
}

export interface VendedorMetaDiaria extends VendedorPerformance {
  ranking: number;
  metaDiaria: number;
  metaEsperada: number;
  metaReal: number;
  diferenca: number;
  mediaDiaria: number;
  percentualAtingimento: number;
  status: 'acima' | 'proximo' | 'abaixo';
}

export interface ClientePerformance {
  codigo: string | number;
  razao: string;
  fantasia?: string;
  cidade?: string;
  uf?: string;
  vendedor_codigo?: string | number;
  vendedor_nome?: string;
  faturamentoLiquido: number;
  totalPedidos: number;
  totalDevolucoes: number;
  ticketMedio: number;
  participacao: number;
  ultimaCompra?: string;
  primeiraCompra?: string;
  diasSemCompra?: number;
  mesesAtivos?: number;
  mediaMensal?: number;
  maximoMes?: number;
}

export interface EvolucaoDiaria {
  data: string;
  vendas: number;
  devolucoes: number;
  liquido: number;
  pedidos: number;
}

export interface EvolucaoMensal {
  mes: string;
  vendas: number;
  devolucoes: number;
  liquido: number;
  pedidos: number;
  meta?: number;
}

export interface ComercialFilters {
  periodo?: {
    inicio: string;
    fim: string;
  };
  anos?: string[];
  meses?: string[];
  vendedor?: string | number;
  vendedores?: (string | number)[];
  cliente?: string | number;
  status?: 'pendente' | 'faturado' | 'todos';
  tipo?: 'PEDIDO' | 'DEVOLUCAO' | 'todos';
  uf?: string;
  ordenacao?: 'faturamento' | 'nome' | 'ultima_compra' | 'dias_sem_compra';
  ordem?: 'asc' | 'desc';
  // Filtros específicos do sistema 1005 (procedure por marca × vendedor_meta)
  marca?: string;
  marcas?: string[];
  vendedor_interno?: string;
  vendedor_externo?: string;
  vendedor_meta?: string;
  ignorarEquipePadrao?: boolean;
  incluirTodasFiliais1004?: boolean;
  excluirVendedoresOcultos1004?: boolean;
}


export interface ComercialKPIs {
  faturamentoBruto: number;
  faturamentoLiquido: number;
  totalDevolucoes: number;
  totalValorPedido: number;
  totalValorLiquidoColuna: number;
  totalValorCusto: number;
  totalValorDesconto: number;
  margemMedia?: number;
  ticketMedio: number;
  qtdPedidos: number;
  qtdClientes: number;
  qtdVendedores: number;
  carteiraPendente: number;
  realizadoFaturado: number;
}

export interface InsightData {
  tipo: 'alerta' | 'oportunidade' | 'info';
  titulo: string;
  descricao: string;
  valor?: number;
  variacao?: number;
}

export interface MetaVendedor {
  vendedor_codigo: string | number;
  meta_mensal: number;
  meta_anual?: number;
}

function formatDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isDiaUtil(date: Date, feriados: Set<string>): boolean {
  const diaSemana = date.getDay();
  return diaSemana !== 0 && diaSemana !== 6 && !feriados.has(formatDateKey(date));
}

// Utilitários para cálculos de dias úteis
export function getDiasUteisNoMes(ano: number, mes: number, feriados: string[] = []): number {
  const primeiroDia = new Date(ano, mes, 1);
  const ultimoDia = new Date(ano, mes + 1, 0);
  const feriadosSet = new Set(feriados);
  let diasUteis = 0;
  
  for (let d = primeiroDia; d <= ultimoDia; d.setDate(d.getDate() + 1)) {
    if (isDiaUtil(d, feriadosSet)) {
      diasUteis++;
    }
  }
  
  return diasUteis;
}

export function getDiasUteisDecorridos(ano: number, mes: number, diaAtual: number, feriados: string[] = []): number {
  const primeiroDia = new Date(ano, mes, 1);
  const hoje = new Date(ano, mes, diaAtual);
  const feriadosSet = new Set(feriados);
  let diasUteis = 0;
  
  for (let d = new Date(primeiroDia); d <= hoje; d.setDate(d.getDate() + 1)) {
    if (isDiaUtil(d, feriadosSet)) {
      diasUteis++;
    }
  }
  
  return diasUteis;
}
