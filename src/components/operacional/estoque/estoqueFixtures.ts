import type { EstoqueRecord, GiroRecord } from '@/types/estoque';

export const NOW = new Date('2026-09-01T12:00:00-03:00');

export const estoqueFixture: EstoqueRecord[] = [
  {
    cod_empresa_bi: 1004,
    cod_empresa: 1,
    empresa: 'CASA DA TRANSMISSAO',
    cod_produto: 101,
    produto: 'KIT EMBREAGEM PESADA',
    cod_fabricante: 'ZF-101',
    cod_fornecedor: '10',
    cod_grupo_produto: 5,
    grupo: 'EMBREAGEM',
    cod_marca_produto: 'ZF',
    marca: 'ZF',
    cod_linha: 'PESADA',
    linha: 'Linha pesada',
    nr_fabricante: '101-A',
    nr_original: 'GM-101',
    aplicacao_produto: 'CAMINHOES',
    classe_abc: 'A',
    quantidade_estoque: 10,
    data_ultima_compra: '2026-08-20',
    operacao_ultima_compra: 'COMPRA',
    data_ultima_transferencia: null,
    operacao_ultima_transferencia: null,
    data_ultima_venda: '2026-08-31',
    cod_cliente_ultima_venda: '1',
    cliente_ultima_venda: 'CLIENTE TESTE',
    quantidade_compra_produto: 20,
    valor_estoque: 5000,
    custo: 450,
    custo_fornecedor: 440,
    custo_medio: 500,
    custo_ultima_compra: 460,
    tipo_relatorio: 'FILIAL CONSOLIDADA',
  },
];

const movementBase: Omit<GiroRecord, 'data_movimento'> = {
  cod_empresa_bi: 1004,
  empresa: 'CASA DA TRANSMISSAO',
  cod_empresa: 1,
  cod_produto: 101,
  produto: 'KIT EMBREAGEM PESADA',
  cod_fabricante: 'ZF-101',
  cod_marca: 'ZF',
  marca: 'ZF',
  cod_grupo: 5,
  grupo: 'EMBREAGEM',
  saida_venda: 0,
  saida_transferencia: 0,
  saida_outras: 0,
  saida_devolucao: 0,
  entrada_compra: 0,
  entrada_transferencia: 0,
  entrada_outras: 0,
  entrada_devolucao: 0,
  valor_total_movimento: 0,
  valor_venda: 0,
  quantidade_movimentada: 0,
  valor_estoque: 5000,
  quantidade_estoque: 10,
  tipo_movimento: 'VENDA',
  cod_linha: 'PESADA',
  linha: 'Linha pesada',
};

export const giroFixture: GiroRecord[] = [
  {
    ...movementBase,
    data_movimento: '2026-08-03',
    saida_venda: 15,
    quantidade_movimentada: 15,
  },
  {
    ...movementBase,
    data_movimento: '2026-08-31',
    saida_venda: 15,
    quantidade_movimentada: 15,
  },
];

export const giroEvolucaoFixture: GiroRecord[] = [
  {
    ...movementBase,
    data_movimento: '2026-08-30',
    entrada_compra: 5,
    quantidade_movimentada: 5,
    tipo_movimento: 'COMPRA',
  },
  {
    ...movementBase,
    data_movimento: '2026-08-31',
    saida_venda: 15,
    quantidade_movimentada: 15,
  },
];

export const estoqueFixtureComTresItens: EstoqueRecord[] = [
  estoqueFixture[0],
  {
    ...estoqueFixture[0],
    cod_produto: 202,
    produto: 'BOMBA D AGUA',
    marca: 'ACDelco',
    grupo: 'ARREFECIMENTO',
    linha: 'Linha leve',
    quantidade_estoque: 0,
    data_ultima_venda: null,
  },
  {
    ...estoqueFixture[0],
    cod_produto: 303,
    produto: 'ROLAMENTO CARDAN',
    marca: 'Spicer',
    grupo: 'TRANSMISSAO',
    linha: null,
    quantidade_estoque: 80,
    data_ultima_compra: '2026-05-01',
    data_ultima_venda: '2026-05-01',
  },
];
