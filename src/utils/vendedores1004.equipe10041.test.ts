import { describe, expect, it } from 'vitest';
import {
  aplicarEquipeChevrolet10041AoFiltro,
  aplicarEquipeContextualPelegrini1004AoFiltro,
  canonizarVendedorChevrolet1004,
  getEquipePadraoFiltro1004,
  getFiltroVendedoresChevrolet10041,
  isContextoChevrolet10041,
  montarVendedoresFiltroReceita1004,
  montarVendedoresFiltroVendasChevrolet10041,
  unirVendedoresFiltro1004,
  montarVendedoresVisualizacaoChevrolet10041,
  relacionarMovimentosVendedoresChevrolet10041,
  somarDevolucoesReceitaVendedores1004,
  vendedorOcultoFiltroContextual1004,
} from './vendedores1004';

describe('getEquipePadraoFiltro1004', () => {
  it('nao oculta XEXEU no contexto Chevrolet 10041', () => {
    expect(vendedorOcultoFiltroContextual1004('XEXEU', true)).toBe(false);
    expect(vendedorOcultoFiltroContextual1004('XEXEU', false)).toBe(true);
  });

  it('monta filtro de vendedores pela receita oficial incluindo XEXEU', () => {
    const vendedores = montarVendedoresFiltroReceita1004(new Map([
      ['47', { codigo: '47', nome: 'RAFAEL', receita: 94364.5 }],
      ['10', { codigo: '10', nome: 'XEXEU', receita: 94805.7 }],
      ['8', { codigo: '8', nome: 'DARI', receita: 3104 }],
    ]));

    expect(vendedores.map((v) => v.nome)).toEqual(['DARI', 'RAFAEL', 'XEXEU']);
  });

  it('soma devolucoes oficiais dos vendedores do relatorio 10041', () => {
    const total = somarDevolucoesReceitaVendedores1004([
      { totalDevolucoes: 0 },
      { totalDevolucoes: 2389.6 },
      { totalDevolucoes: 113.63 },
      { totalDevolucoes: 1010 },
      { totalDevolucoes: 4795.5 },
      { totalDevolucoes: 1817 },
      { totalDevolucoes: 3133.5 },
      { totalDevolucoes: 3673 },
      { totalDevolucoes: 1236 },
    ]);

    expect(total).toBeCloseTo(18_168.23, 2);
  });

  it('nao usa lista fixa na Chevrolet; vendedores devem vir da fonte', () => {
    expect(getEquipePadraoFiltro1004('chevrolet').codes).toEqual([]);
    expect(getEquipePadraoFiltro1004('chevrolet').label).toBe('Vendedores da fonte');
    expect(getEquipePadraoFiltro1004('transmissao').codes).toEqual(['78', '98', '59', '63', '71']);
  });

  it('reconhece Casa da Chevrolet mesmo quando a fonte de dados usa o codigo 1004', () => {
    expect(isContextoChevrolet10041('10041')).toBe(true);
    expect(isContextoChevrolet10041('1004', 'chevrolet')).toBe(true);
    expect(isContextoChevrolet10041('1004', 'cch')).toBe(true);
    expect(isContextoChevrolet10041('1004', 'casa-da-chevrolet')).toBe(true);
    expect(isContextoChevrolet10041('1004', undefined, { nome: 'Casa da Chevrolet' })).toBe(true);
    expect(isContextoChevrolet10041('1004', undefined, { nome: 'Casa da Transmissao' })).toBe(false);
  });

  it('limpa selecao antiga da CT para calcular toda a filial Chevrolet', () => {
    expect(
      aplicarEquipeChevrolet10041AoFiltro({
        vendedor: '78',
        vendedores: ['78', '98', '59', '63', '71'],
      }),
    ).toMatchObject({
      vendedor: undefined,
      vendedores: undefined,
      incluirTodasFiliais1004: false,
    });
  });

  it('usa equipe Chevrolet quando a empresa ativa e 1004 mas a filial e Casa da Chevrolet', () => {
    const filtro = aplicarEquipeContextualPelegrini1004AoFiltro(
      {
        vendedor: '78',
        vendedores: ['78', '98', '59', '63', '71'],
      },
      '1004',
      'chevrolet',
      { nome: 'Casa da Chevrolet' },
    );

    expect(filtro?.vendedores).toBeUndefined();
    expect(filtro?.vendedor).toBeUndefined();
  });

  it('nao transforma ausencia de vendedor em filtro fixo dos 9 no contexto 10041', () => {
    expect(getFiltroVendedoresChevrolet10041(undefined, '10041')).toBeUndefined();
    expect(getFiltroVendedoresChevrolet10041([], '1004', 'chevrolet')).toBeUndefined();
  });

  it('inclui ERLAN quando encontra selecao antiga de todos os vendedores CCH', () => {
    expect(
      getFiltroVendedoresChevrolet10041(
        ['8', '512', '99', '20', '34', '14', '11', '47', '10'],
        '10041',
      ),
    ).toEqual(['8', '512', '99', '20', '34', '14', '11', '47', '10', '59']);
  });

  it('preserva selecao manual da fonte mesmo quando nao esta na lista antiga oficial', () => {
    expect(
      aplicarEquipeChevrolet10041AoFiltro({
        vendedor: undefined,
        vendedores: ['30', '512'],
      }),
    ).toMatchObject({
      vendedor: undefined,
      vendedores: ['30', '512'],
      incluirTodasFiliais1004: false,
    });
  });

  it('relaciona somente vendedores retornados pela fonte', () => {
    const movimentos = [
      { codigo: '78', nome: 'BRUNO B', valor: 224 },
      { codigo: '99', nome: 'Nome divergente na API', valor: 7037.28 },
      { codigo: '11', nome: 'Outro nome', valor: 2841 },
      { codigo: '30', nome: 'FABIO HENRIQUE', valor: -310 },
    ];

    const relacionados = relacionarMovimentosVendedoresChevrolet10041(
      movimentos,
      undefined,
    );

    expect(relacionados).toHaveLength(4);
    expect(relacionados.map((item) => item.codigo)).toEqual(['78', '99', '11', '30']);
    expect(relacionados.find((item) => item.codigo === '99')).toMatchObject({
      codigo: '99',
      nome: 'Nome divergente na API',
      movimento: movimentos[1],
    });
  });

  it('canoniza BRUNO B da API 10041 como vendedor oficial 999 sem capturar BRUNO da CT', () => {
    expect(canonizarVendedorChevrolet1004({ codigo: '78', nome: 'BRUNO B' })).toEqual({
      codigo: '999',
      nome: 'BRUNO B',
    });
    expect(canonizarVendedorChevrolet1004({ codigo: '78', nome: 'BRUNO' })).toBeNull();
  });

  it('monta a visualizacao somente com os vendedores da fonte', () => {
    const visualizacao = montarVendedoresVisualizacaoChevrolet10041(
      [
        { codigo: '99', nome: 'ELIANE', faturamentoMesAtual: 6957.12, metaMensal: 0 },
        { codigo: '11', nome: 'MARCIO', faturamentoMesAtual: 2841, metaMensal: 0 },
        { codigo: '34', nome: 'FERNANDO M', faturamentoMesAtual: 1062, metaMensal: 0 },
        { codigo: '47', nome: 'RAFAEL', faturamentoMesAtual: 75, metaMensal: 0 },
        { codigo: '30', nome: 'FABIO HENRIQUE', faturamentoMesAtual: -310, metaMensal: 0 },
      ],
      ['78', '98', '59', '63', '71'],
      (vendedor) => ({
        codigo: vendedor.codigo,
        nome: vendedor.nome,
        faturamentoMesAtual: 0,
        metaMensal: 0,
      }),
    );

    expect(visualizacao).toHaveLength(5);
    expect(visualizacao.map((item) => item.codigo)).toEqual(['99', '11', '34', '47', '30']);
    expect(visualizacao.find((item) => item.codigo === '99')?.faturamentoMesAtual).toBe(6957.12);
  });

  it('mantem vendedores da fonte mesmo fora da lista antiga oficial', () => {
    const visualizacao = montarVendedoresVisualizacaoChevrolet10041(
      [
        { codigo: '11', nome: 'MARCIO', faturamentoMesAtual: 2841 },
        { codigo: '30', nome: 'FABIO HENRIQUE', faturamentoMesAtual: -310 },
      ],
      undefined,
      (vendedor) => ({
        codigo: vendedor.codigo,
        nome: vendedor.nome,
        faturamentoMesAtual: 0,
      }),
    );

    expect(visualizacao).toHaveLength(2);
    expect(visualizacao.some((item) => item.nome === 'FABIO HENRIQUE')).toBe(true);
    expect(visualizacao.find((item) => item.codigo === '11')?.faturamentoMesAtual).toBe(2841);
  });

  it('monta filtro do 10041 somente com vendedores que venderam no periodo da fonte', () => {
    const vendedores = montarVendedoresFiltroVendasChevrolet10041([
      {
        tipo: 'PEDIDO',
        cod_pedido: '100',
        CodEmpresa_bi: 10041,
        cod_vendedor: 47,
        vendedor: 'RAFAEL',
        ValorVenda: 1200,
      },
      {
        tipo: 'PEDIDO',
        cod_pedido: '101',
        CodEmpresa_bi: 10041,
        cod_vendedor: 1083,
        vendedor: 'NATA',
        ValorVenda: 90,
      },
      {
        tipo: 'DEVOLUCAO',
        cod_pedido: '0',
        CodEmpresa_bi: 10041,
        cod_vendedor: 512,
        vendedor: 'EDER',
        ValorDevolucao: 100,
      },
      {
        tipo: 'PEDIDO',
        cod_pedido: '0',
        CodEmpresa_bi: 10041,
        cod_vendedor: 20,
        vendedor: 'ELIELTON',
        ValorVenda: 500,
      },
      {
        tipo: 'PEDIDO',
        cod_pedido: '102',
        CodEmpresa_bi: 1004,
        cod_vendedor: 78,
        vendedor: 'BRUNO',
        ValorVenda: 800,
      },
    ]);

    expect(vendedores).toEqual([
      { codigo: '1083', nome: 'NATA' },
      { codigo: '47', nome: 'RAFAEL' },
    ]);
  });

  it('unifica vendedores do 10041 vindos da venda parcial e da receita oficial do mesmo periodo', () => {
    const vendedoresComVenda = montarVendedoresFiltroVendasChevrolet10041([
      {
        tipo: 'PEDIDO',
        cod_pedido: '100',
        CodEmpresa_bi: 10041,
        cod_vendedor: 47,
        vendedor: 'RAFAEL',
        ValorVenda: 1200,
      },
    ]);
    const vendedoresReceitaOficial = montarVendedoresFiltroReceita1004(new Map([
      ['59', { codigo: '59', nome: 'ERLAN C.CH', receita: 94 }],
    ]));

    expect(unirVendedoresFiltro1004(vendedoresComVenda, vendedoresReceitaOficial)).toEqual([
      { codigo: '59', nome: 'ERLAN C.CH' },
      { codigo: '47', nome: 'RAFAEL' },
    ]);
  });

  it('permite identificar quando a lista oficial do 10041 ainda nao carregou sem usar lista parcial', () => {
    const vendedoresComVenda = montarVendedoresFiltroVendasChevrolet10041([
      {
        tipo: 'PEDIDO',
        cod_pedido: '100',
        CodEmpresa_bi: 10041,
        cod_vendedor: 47,
        vendedor: 'RAFAEL',
        ValorVenda: 1200,
      },
    ]);

    expect(unirVendedoresFiltro1004(vendedoresComVenda, [])).toEqual([
      { codigo: '47', nome: 'RAFAEL' },
    ]);
    expect(montarVendedoresFiltroReceita1004(undefined)).toEqual([]);
  });
});
