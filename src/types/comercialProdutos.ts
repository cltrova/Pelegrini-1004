// Tipos para o JSON de Produtos (itens dos pedidos)
// Cada registro = 1 linha de produto vendido em um pedido.

export interface ProdutoItem {
  // Identificação
  id: string;
  cod_produto: string | number;
  descricao: string;
  cod_pedido?: string | number;
  num_nf?: string;
  // Identificação técnica do lançamento (ERP Pelegrini 1004/10041)
  num_lancamento?: string | number;
  cod_documento?: string | number;

  // Datas
  data_pedido?: string;
  data_faturamento?: string;

  // Empresa / filial
  cod_empresa_bi?: string;
  filial_codigo?: string | number;
  filial_nome?: string;

  // Tipo da transação (PEDIDO ou DEVOLUCAO)
  tipo: 'PEDIDO' | 'DEVOLUCAO';

  // Classificação
  categoria?: string;
  grupo?: string;
  marca?: string;
  cod_marca?: string | number;
  fabricante?: string;
  linha?: string;

  // Cliente / vendedor para drill-down
  cliente_codigo?: string | number;
  cliente_razao?: string;
  cliente_cidade?: string;
  cliente_uf?: string;
  cod_grupo?: string | number;
  nome_grupo?: string;

  // Vendedor — o cliente (Power BI) usa NomeInterno e NomeExterno como colunas separadas.
  // A procedure atualizada passa a expor também vendedor_interno / vendedor_externo
  // (nomes) e vendedor_meta (carteira/vendedor responsável pela meta).
  vendedor_codigo?: string | number;
  vendedor_nome?: string;
  nome_interno?: string;
  nome_externo?: string;
  vendedor_interno?: string;
  vendedor_externo?: string;
  cod_vendedor_interno?: string | number;
  cod_vendedor_externo?: string | number;
  cod_vendedor_chevrolet?: string | number;
  vendedor_chevrolet?: string;
  cod_vendedor_cch?: string | number;
  vendedor_cch?: string;
  cod_vendedor_comissao?: string | number;
  vendedor_comissao?: string;
  vendedor_meta?: string;
  cod_vendedor_meta?: string | number;

  // Meta vinda no próprio item (replicada do JSON de pedidos do ERP).
  // valor_meta = meta total do vendedor_meta × marca (ou faixa de marcas)
  cod_meta?: string | number;
  valor_meta?: number;
  valor_meta_interno?: number;
  valor_meta_externo?: number;
  descricao_meta?: string;
  cod_marca_meta_inicial?: string | number;
  cod_marca_meta_final?: string | number;


  // Quantidades e valores (assinados: DEVOLUCAO -> negativo)
  quantidade: number;
  valor_unitario: number;
  valor_total: number; // já assinado — 1004: PEDIDO ValorVenda; DEVOLUCAO -ValorDevolucao
  valor_bruto_item?: number; // ValorVenda + ValorDescontoItem, usado em campanhas de venda bruta
  valor_custo?: number;
  valor_desconto?: number;
  // Campos brutos do JSON do cliente 1004 (preservados para auditoria)
  valor_venda_item?: number;
  valor_devolucao_item?: number;
  valor_total_nf?: number;

  [key: string]: unknown;
}

export interface TopProdutoAgg {
  cod_produto: string | number;
  descricao: string;
  categoria?: string;
  grupo?: string;
  marca?: string;
  quantidade: number;
  faturamento: number;
  pedidos: number;
  participacao: number;
}

export interface CategoriaAgg {
  chave: string;
  faturamento: number;
  quantidade: number;
  produtos: number;
  participacao: number;
}

export interface ProdutoSemGiro {
  cod_produto: string | number;
  descricao: string;
  categoria?: string;
  marca?: string;
  ultimaVenda?: string;
  diasSemVenda?: number;
}

// Agregação por marca (gráfico "RECEITA MARCAS" do Power BI)
export interface MarcaAgg {
  marca: string;
  faturamento: number;
  custo: number;
  lucro: number;
  margem: number;
  quantidade: number;
  produtos: number;
  participacao: number;
}

// Linha do "Resumo de Vendas" detalhado
export interface ResumoVendaLinha {
  data: string;
  num_nf?: string;
  cod_produto: string | number;
  descricao: string;
  marca?: string;
  cliente_codigo?: string | number;
  cliente_razao?: string;
  cliente_cidade?: string;
  receita: number;
  custo: number;
  lucro: number;
  margem: number;
  nome_interno?: string;
  nome_externo?: string;
  tipo: 'PEDIDO' | 'DEVOLUCAO';
}

// Resumo de vendedor (interno OU externo)
export interface ResumoVendedor {
  nome: string;
  vendas: number;
  receita: number;
  custo: number;
  lucro: number;
  margem: number;
  ticket_medio: number;
  meta?: number;
  atingimento?: number;
}

// Cliente x Grupo (tabela "CLIENTES POR GRUPO")
export interface ClienteGrupoLinha {
  cliente_codigo: string | number;
  cliente_razao: string;
  cidade?: string;
  cod_grupo?: string | number;
  nome_grupo: string;
  vendas: number;
  receita: number;
  custo: number;
  lucro: number;
  margem: number;
}
