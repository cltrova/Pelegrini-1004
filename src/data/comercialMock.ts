// Dados fictícios baseados em estrutura real da empresa Caspper
// Para visualização do layout - remover quando conectar API real

import type { Pedido, Devolucao } from '@/types/comercial';

// Filiais de emissão
const filiais = ['TELEVENDAS', 'CD GERAL', 'UBERABA', 'ITUMBIARA', 'VAREJO UBERLÂNDIA', 'PATOS DE MINAS', 'RIO VERDE'];

// Vendedores reais baseados na imagem
const vendedores = [
  { codigo: 1, nome: 'RICARDO' },
  { codigo: 2, nome: 'ELISANGELA BARBOSA' },
  { codigo: 3, nome: 'ROCHA (UBERABA)' },
  { codigo: 4, nome: 'LEONARDO JOSÉ' },
  { codigo: 5, nome: 'SILVIO ADVALDO' },
  { codigo: 6, nome: 'CLAUDIO MARQUES' },
  { codigo: 7, nome: 'LEONARDO CARLOS' },
  { codigo: 8, nome: 'PABLO (UBERABA)' },
  { codigo: 9, nome: 'ALAIR' },
  { codigo: 10, nome: 'MARCOS ANTONIO' },
  { codigo: 11, nome: 'FERNANDO SILVA' },
  { codigo: 12, nome: 'JOSÉ CARLOS' },
];

// Clientes reais baseados na imagem
const clientes = [
  { codigo: 1, razao: 'FLORESTA S/A ACUCAR E ALCOOL', fantasia: 'FLORESTA', cidade: 'ITURAMA', uf: 'MG' },
  { codigo: 2, razao: 'LUIZ ROBERTO DE MELO BORGES', fantasia: 'LUIZ ROBERTO', cidade: 'UBERLÂNDIA', uf: 'MG' },
  { codigo: 3, razao: 'UNIARCOS PECAS E ACESSORIOS LTDA', fantasia: 'UNIARCOS', cidade: 'ARCOS', uf: 'MG' },
  { codigo: 4, razao: 'RR DIESEL LTDA', fantasia: 'RR DIESEL', cidade: 'UBERABA', uf: 'MG' },
  { codigo: 5, razao: 'BRAVO SERVICOS LOGISTICOS LTDA', fantasia: 'BRAVO LOGÍSTICA', cidade: 'UBERLÂNDIA', uf: 'MG' },
  { codigo: 6, razao: 'CASA DA TRANSMISSAO CAMINHOES MOTORES', fantasia: 'CASA DA TRANSMISSÃO', cidade: 'GOIÂNIA', uf: 'GO' },
  { codigo: 7, razao: 'VALE DO TIJUCO ACUCAR E ALCOOL S.A.', fantasia: 'VALE DO TIJUCO', cidade: 'UBERABA', uf: 'MG' },
  { codigo: 8, razao: 'UBERABA TRANSMISSOES LTDA', fantasia: 'UBERABA TRANSMISSÕES', cidade: 'UBERABA', uf: 'MG' },
  { codigo: 9, razao: 'DF MONTAGEM INDUSTRIAL LTDA', fantasia: 'DF MONTAGEM', cidade: 'BRASÍLIA', uf: 'DF' },
  { codigo: 10, razao: 'VOLRRIBI MECANICA LTDA', fantasia: 'VOLRRIBI', cidade: 'RIBEIRÃO PRETO', uf: 'SP' },
  { codigo: 11, razao: 'TME TRANSPORTES MAQUINAS E EQUIPAMENTOS', fantasia: 'TME TRANSPORTES', cidade: 'UBERLÂNDIA', uf: 'MG' },
  { codigo: 12, razao: 'VIVAN TRANSPORTES LTDA', fantasia: 'VIVAN', cidade: 'UBERABA', uf: 'MG' },
  { codigo: 13, razao: 'G L DIESEL LTDA - EPP', fantasia: 'GL DIESEL', cidade: 'PATOS DE MINAS', uf: 'MG' },
  { codigo: 14, razao: 'GOBIRA PECAS E SERVICOS LTDA', fantasia: 'GOBIRA', cidade: 'ITUMBIARA', uf: 'GO' },
  { codigo: 15, razao: 'ADEMIR FERREIRA DE MELLO', fantasia: 'ADEMIR', cidade: 'UBERABA', uf: 'MG' },
  { codigo: 16, razao: 'TECNO VOLVO PECAS E SERVICOS LTDA', fantasia: 'TECNO VOLVO', cidade: 'GOIÂNIA', uf: 'GO' },
  { codigo: 17, razao: 'INOVA LOGISTICA INTEGRADA LTDA', fantasia: 'INOVA', cidade: 'UBERLÂNDIA', uf: 'MG' },
  { codigo: 18, razao: 'ARCOM S/A', fantasia: 'ARCOM', cidade: 'RIO VERDE', uf: 'GO' },
  { codigo: 19, razao: 'AUTO PECAS E SERVICOS MVR LTDA', fantasia: 'MVR', cidade: 'MONTES CLAROS', uf: 'MG' },
  { codigo: 20, razao: 'ORGANIZACOES FRANCAP S/A', fantasia: 'FRANCAP', cidade: 'UBERLÂNDIA', uf: 'MG' },
  { codigo: 21, razao: 'TRANSFORTALEZA LTDA', fantasia: 'TRANSFORTALEZA', cidade: 'FORTALEZA', uf: 'CE' },
  { codigo: 22, razao: 'CLAITON LUIZ MENDES', fantasia: 'CLAITON', cidade: 'UBERABA', uf: 'MG' },
  { codigo: 23, razao: 'AUTO PECAS E MECANICA TRES MENINAS L...', fantasia: 'TRÊS MENINAS', cidade: 'GOIÂNIA', uf: 'GO' },
  { codigo: 24, razao: 'CARLOTA TRANSPORTES E LOGISTICA LTDA', fantasia: 'CARLOTA', cidade: 'UBERLÂNDIA', uf: 'MG' },
  { codigo: 25, razao: 'DIESEL CAMBIO LTDA', fantasia: 'DIESEL CAMBIO', cidade: 'UBERABA', uf: 'MG' },
  { codigo: 26, razao: 'ELCIO ELETROMECANICA E COMERCIO LTDA', fantasia: 'ELCIO', cidade: 'PATROCÍNIO', uf: 'MG' },
  { codigo: 27, razao: 'TRANSPORTES BARKERT LTDA ME', fantasia: 'BARKERT', cidade: 'PATOS DE MINAS', uf: 'MG' },
  { codigo: 28, razao: 'MECANICA PESADA ITUMBIARA LTDA', fantasia: 'MEC. ITUMBIARA', cidade: 'ITUMBIARA', uf: 'GO' },
  { codigo: 29, razao: 'CAMINHOES E PECAS GOIAS LTDA', fantasia: 'CPG', cidade: 'GOIÂNIA', uf: 'GO' },
  { codigo: 30, razao: 'RETIFICA TRIÂNGULO LTDA', fantasia: 'RET. TRIÂNGULO', cidade: 'UBERLÂNDIA', uf: 'MG' },
];

// Função auxiliar para gerar data aleatória dentro de um range
function randomDate(start: Date, end: Date): string {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString();
}

// Gerar pedidos mockados
export function generateMockPedidos(): Pedido[] {
  const pedidos: Pedido[] = [];
  let pedidoId = 1;
  
  // Distribuição de valores por vendedor baseada na imagem (% aproximado)
  const vendedorPesos = [15.60, 12.20, 11.27, 8.60, 8.11, 8.09, 7.56, 5.81, 5.38, 6.13, 5.87, 5.38];
  
  // Valor total desejado: ~R$ 30.500.000 (baseado na imagem)
  const valorTotalDesejado = 30511281;
  const qtdPedidosDesejado = 14751;
  const ticketMedio = valorTotalDesejado / qtdPedidosDesejado;
  
  // Gerar pedidos distribuídos ao longo de 2025
  for (let i = 0; i < qtdPedidosDesejado; i++) {
    const vendedorIndex = weightedRandom(vendedorPesos);
    const vendedor = vendedores[vendedorIndex];
    const cliente = clientes[Math.floor(Math.random() * clientes.length)];
    const filial = filiais[Math.floor(Math.random() * filiais.length)];
    
    // Valor com variação em torno do ticket médio
    const valorBruto = ticketMedio * (0.3 + Math.random() * 3);
    const desconto = valorBruto * (Math.random() * 0.15);
    const valorLiquido = valorBruto - desconto;
    const custo = valorLiquido * (0.55 + Math.random() * 0.15);
    const lucro = valorLiquido - custo;
    const margem = (lucro / valorLiquido) * 100;
    const comissao = valorLiquido * (0.02 + Math.random() * 0.03);
    
    // Status: maioria faturado
    const status = Math.random() > 0.15 ? 'faturado' : 'pendente';
    
    const dataPedido = randomDate(new Date('2025-01-01'), new Date('2025-12-27'));
    const dataFaturamento = status === 'faturado' 
      ? new Date(new Date(dataPedido).getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
    
    pedidos.push({
      id: pedidoId++,
      numero: `PED${String(pedidoId).padStart(6, '0')}`,
      data_pedido: dataPedido,
      data_faturamento: dataFaturamento,
      status: status as 'pendente' | 'faturado',
      cod_empresa_bi: '1001', // Caspper
      cliente_codigo: cliente.codigo,
      cliente_razao: cliente.razao,
      cliente_fantasia: cliente.fantasia,
      cliente_cidade: cliente.cidade,
      cliente_uf: cliente.uf,
      vendedor_codigo: vendedor.codigo,
      vendedor_nome: vendedor.nome,
      valor_bruto: Math.round(valorBruto * 100) / 100,
      valor_desconto: Math.round(desconto * 100) / 100,
      valor_liquido: Math.round(valorLiquido * 100) / 100,
      valor_custo: Math.round(custo * 100) / 100,
      margem: Math.round(margem * 100) / 100,
      comissao: Math.round(comissao * 100) / 100,
      filial_emissao: filial,
    });
  }
  
  return pedidos;
}

// Gerar devoluções mockadas
export function generateMockDevolucoes(): Devolucao[] {
  const devolucoes: Devolucao[] = [];
  let devolucaoId = 1;
  
  // Valor total de devoluções: ~R$ 410.466 (baseado na imagem)
  const valorTotalDevolucoes = 410466;
  const qtdDevolucoes = Math.floor(valorTotalDevolucoes / 2500); // ticket médio de devolução menor
  
  for (let i = 0; i < qtdDevolucoes; i++) {
    const vendedor = vendedores[Math.floor(Math.random() * vendedores.length)];
    const cliente = clientes[Math.floor(Math.random() * clientes.length)];
    
    const valorProdutos = 1500 + Math.random() * 4000;
    const valorServicos = Math.random() > 0.7 ? Math.random() * 500 : 0;
    const valorAcessorios = Math.random() > 0.8 ? Math.random() * 300 : 0;
    const valorDesconto = (valorProdutos + valorServicos + valorAcessorios) * Math.random() * 0.1;
    const valorTotal = valorProdutos + valorServicos + valorAcessorios - valorDesconto;
    const valorCusto = valorTotal * (0.55 + Math.random() * 0.15);
    const valorLiquido = valorTotal - valorCusto;
    
    devolucoes.push({
      id: devolucaoId++,
      numero: `DEV${String(devolucaoId).padStart(6, '0')}`,
      data: randomDate(new Date('2025-01-01'), new Date('2025-12-27')),
      cod_empresa_bi: '1001', // Caspper
      cliente_codigo: cliente.codigo,
      cliente_razao: cliente.razao,
      cliente_fantasia: cliente.fantasia,
      cliente_cidade: cliente.cidade,
      cliente_uf: cliente.uf,
      vendedor_codigo: vendedor.codigo,
      vendedor_nome: vendedor.nome,
      valor_produtos: Math.round(valorProdutos * 100) / 100,
      valor_servicos: Math.round(valorServicos * 100) / 100,
      valor_acessorios: Math.round(valorAcessorios * 100) / 100,
      valor_desconto: Math.round(valorDesconto * 100) / 100,
      valor_total: Math.round(valorTotal * 100) / 100,
      valor_custo: Math.round(valorCusto * 100) / 100,
      valor_liquido: Math.round(valorLiquido * 100) / 100,
    });
  }
  
  return devolucoes;
}

// Função auxiliar para seleção ponderada
function weightedRandom(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  const random = Math.random() * total;
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i];
    if (random <= sum) return i;
  }
  return weights.length - 1;
}

// Exportar dados pré-gerados para performance
export const mockPedidos = generateMockPedidos();
export const mockDevolucoes = generateMockDevolucoes();
