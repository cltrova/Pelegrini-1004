import { describe, expect, it } from 'vitest';
import {
  aplicarEquipePrincipal1004AoFiltro,
  calcularReceitaLinha1004,
  calcularValorDevolucaoReceita1004,
  corrigirVendedorAusente1004,
  criarFiltroTotalizadores1004,
  isServicoForaRelatorioChevrolet10041,
  montarVendedoresElegiveisFiltro1004,
  vendedorMatchesFiltro1004,
  vendedorForcaP1004,
  vendedorNaoComissionavel1004,
  vendedorPertenceRelatorioChevrolet10041,
} from './vendedores1004';
import {
  vendedorPertenceCampanha1004,
} from './campanhasVendedores';
import {
  mesesCampanha1004,
  fimConsolidadoCampanha1004,
  periodoBuscaCampanha1004,
} from './campanhasPeriodo1004';
import { valorFaturamentoCampanha, valorReceitaCampanha } from './campanhasValores';

describe('criarFiltroTotalizadores1004', () => {
  it('campanhas 1004 contam CT por padrao e extras Chevrolet apenas quando selecionados', () => {
    expect(vendedorPertenceCampanha1004({ cod_vendedor_externo: '78', nome_externo: 'BRUNO' })).toBe(true);
    expect(vendedorPertenceCampanha1004({ cod_vendedor_externo: '99', nome_externo: 'ELIANE' })).toBe(false);
    expect(vendedorPertenceCampanha1004({ cod_vendedor_externo: '99', nome_externo: 'ELIANE' }, new Set(['99']))).toBe(true);
    expect(vendedorPertenceCampanha1004({ cod_vendedor_externo: '45', nome_externo: 'FERNANDO M CCH' }, new Set(['34']))).toBe(true);
    expect(vendedorPertenceCampanha1004({ cod_vendedor_externo: '85', nome_externo: 'RAFAEL CCH' }, new Set(['47']))).toBe(true);
    expect(vendedorPertenceCampanha1004({ cod_vendedor_externo: '250', nome_externo: 'DAYVID' }, new Set(['250']))).toBe(false);
    expect(vendedorPertenceCampanha1004({ cod_vendedor_externo: '10', nome_externo: 'XEXEU CCH' }, new Set(['10']))).toBe(false);
  });

  it('campanhas 1004 nao atribuem ao vendedor itens corrigidos fora do relatorio FAT', () => {
    expect(vendedorPertenceCampanha1004({
      cod_vendedor_externo: '63',
      nome_externo: 'FABIO R',
      vendedor_corrigido_1004: true,
    })).toBe(false);
  });

  it('calcula devolucao liquida CFOP 2202 conforme relatorio RSYS/FAT da 1004', () => {
    expect(calcularValorDevolucaoReceita1004({
      valorDevolucao: 833.50,
      valorDescontoItem: 393.41,
      cfop: '2.202',
    })).toBeCloseTo(440.09, 2);

    expect(calcularValorDevolucaoReceita1004({
      valorDevolucao: 1250,
      valorDescontoItem: 500,
      cfop: '1.202',
    })).toBe(1250);

    expect(calcularValorDevolucaoReceita1004({
      valorDevolucao: 102.96,
      valorLiquidoFinalRaw: -114.40,
      cfop: '1.411',
    })).toBeCloseTo(114.40, 2);
  });

  it('fecha o Bruno de julho/2026 com a mesma regra do relatorio RSYS/FAT', () => {
    const vendaBruta = 514_537.92;
    const devolucaoBruta = 24_030.62;
    const descontoDevolucaoCfop2202 = 4_371.86;
    const receita = vendaBruta - (devolucaoBruta - descontoDevolucaoCfop2202);

    expect(receita).toBeCloseTo(494_879.16, 2);
  });

  it('usa a mesma receita assinada para pedidos e devolucoes da 1004', () => {
    const venda = calcularReceitaLinha1004({
      tipo: 'PEDIDO',
      valorVenda: 514_537.92,
      valorLiquidoFinal: 510_000,
    });
    const devolucaoCfop2202 = calcularReceitaLinha1004({
      tipo: 'DEVOLUCAO',
      valorDevolucao: 24_030.62,
      valorDescontoItem: 4_371.86,
      cfop: '2.202',
    });

    expect(venda).toBeCloseTo(514_537.92, 2);
    expect(devolucaoCfop2202).toBeCloseTo(-19_658.76, 2);
    expect(venda + devolucaoCfop2202).toBeCloseTo(494_879.16, 2);
  });

  it('campanhas 1004 usam a receita normalizada do produto, nao a devolucao bruta', () => {
    expect(valorReceitaCampanha({
      cod_empresa_bi: '1004',
      tipo: 'DEVOLUCAO',
      valor_total: -440.09,
      valor_venda_item: 0,
      valor_devolucao_item: 833.50,
      valor_desconto: 393.41,
      cfop: '2.202',
    }, '1004')).toBeCloseTo(-440.09, 2);

    expect(valorReceitaCampanha({
      cod_empresa_bi: '1004',
      tipo: 'PEDIDO',
      valor_total: 1200,
      valor_venda_item: 1200,
      valor_devolucao_item: 0,
    }, '1004')).toBeCloseTo(1200, 2);
  });

  it('campanhas 1004 usam a receita normalizada validada no comercial', () => {
    expect(valorFaturamentoCampanha({
      cod_empresa_bi: '1004',
      tipo: 'PEDIDO',
      valor_total: 900,
      valor_venda_item: 1200,
      valor_devolucao_item: 300,
    }, '1004')).toBeCloseTo(900, 2);

    expect(valorFaturamentoCampanha({
      cod_empresa_bi: '1004',
      tipo: 'PEDIDO',
      valor_total: 1200,
      valor_venda_item: 1200,
      valor_devolucao_item: 300,
    }, '1004')).toBeCloseTo(1200, 2);

    expect(valorFaturamentoCampanha({
      cod_empresa_bi: '1004',
      tipo: 'DEVOLUCAO',
      valor_total: -300,
      valor_venda_item: 0,
      valor_devolucao_item: 300,
    }, '1004')).toBeCloseTo(-300, 2);

    expect(valorFaturamentoCampanha({
      cod_empresa_bi: '1004',
      tipo: 'DEVOLUCAO',
      valor_venda_item: 0,
      valor_devolucao_item: 102.96,
      valor_liquido_final_item: -114.40,
    }, '1004')).toBeCloseTo(-114.40, 2);

    expect(valorFaturamentoCampanha({
      cod_empresa_bi: '1004',
      tipo: 'PEDIDO',
      valor_venda_item: 1200,
      valor_devolucao_item: 0,
    }, '1004')).toBeCloseTo(1200, 2);
  });

  it('corrige vinculo ausente de lancamento validado no relatorio de junho/2026', () => {
    expect(corrigirVendedorAusente1004({
      CodEmpresa_bi: 1004,
      cod_pedido: 529460,
      num_lancamento: 2176384,
      cod_documento: 246509,
      num_nf: 177852,
      cod_vendedor: 0,
      vendedor: null,
    })).toEqual({ codigo: '63', nome: 'FABIO R' });

    expect(corrigirVendedorAusente1004({
      CodEmpresa_bi: 1004,
      cod_pedido: 531907,
      num_lancamento: 2187678,
      cod_documento: 0,
      num_nf: 179085,
      cod_vendedor: 0,
      vendedor: null,
    })).toBeNull();
  });

  it('campanha historica MWM/EATON 1004 fecha junho no ultimo dia do mes', () => {
    const campanha = {
      cod_empresa_bi: '1004',
      nome: 'Forca Total - MWM + Eaton',
      data_inicio: '2026-04-30',
      data_fim: '2026-06-29',
      marcas: [{ marca: 'MWM' }, { marca: 'EATON' }],
    };

    expect(periodoBuscaCampanha1004(campanha)).toEqual({
      inicio: '2026-04-30',
      fim: '2026-06-30',
    });

    const meses = mesesCampanha1004(campanha);
    expect(meses.map((m) => m.key)).toEqual(['2026-05', '2026-06']);
    expect(meses[1].fim.getFullYear()).toBe(2026);
    expect(meses[1].fim.getMonth()).toBe(5);
    expect(meses[1].fim.getDate()).toBe(30);
  });

  it('campanha 1004 em mes aberto consolida ate o dia atual da base oficial', () => {
    const fimOriginal = new Date(2026, 7, 31, 23, 59, 59, 999);
    const hoje = new Date(2026, 7, 12, 10, 30, 0, 0);
    const fim = fimConsolidadoCampanha1004({ cod_empresa_bi: '1004' }, fimOriginal, hoje);

    expect(fim.getFullYear()).toBe(2026);
    expect(fim.getMonth()).toBe(7);
    expect(fim.getDate()).toBe(12);
    expect(fim.getHours()).toBe(23);
    expect(fim.getMinutes()).toBe(59);
  });

  it('mantem periodo e vendedores selecionados nos totalizadores', () => {
    const filtros = criarFiltroTotalizadores1004({
      anos: ['2026'],
      meses: ['7'],
      periodo: { inicio: '2026-07-01', fim: '2026-07-31' },
      vendedores: ['78', '98'],
      vendedor: '59',
      cliente: '123',
      incluirTodasFiliais1004: false,
    });

    expect(filtros).toEqual({
      anos: ['2026'],
      meses: ['7'],
      periodo: { inicio: '2026-07-01', fim: '2026-07-31' },
      vendedores: ['78', '98'],
      vendedor: '59',
      cliente: '123',
      incluirTodasFiliais1004: false,
      ignorarEquipePadrao: true,
      excluirVendedoresOcultos1004: true,
    });
  });

  it('usa equipe padrao somente quando nao ha vendedor selecionado', () => {
    expect(aplicarEquipePrincipal1004AoFiltro<Record<string, unknown>>({ meses: ['8'] })?.vendedores).toEqual(['78', '98', '59', '63', '71']);
    expect(aplicarEquipePrincipal1004AoFiltro<Record<string, unknown>>({ vendedores: ['8', '47'] })?.vendedores).toEqual(['8', '47']);
    expect(aplicarEquipePrincipal1004AoFiltro<Record<string, unknown>>({ vendedores: ['8'], vendedor: '47' })?.vendedores).toEqual(['8', '47']);
  });

  it('mantem a base da transmissao mesmo quando seleciona vendedor da Chevrolet', () => {
    expect(aplicarEquipePrincipal1004AoFiltro<Record<string, unknown>>({ vendedores: ['78', '98'] })?.incluirTodasFiliais1004).toBe(false);
    expect(aplicarEquipePrincipal1004AoFiltro<Record<string, unknown>>({ vendedores: ['78', '8', '250'] })?.incluirTodasFiliais1004).toBe(false);
    expect(aplicarEquipePrincipal1004AoFiltro<Record<string, unknown>>({ vendedor: '512' })?.incluirTodasFiliais1004).toBe(false);
  });

  it('identifica vendedores nao comissionaveis usados fora do total oficial', () => {
    expect(vendedorNaoComissionavel1004({ codigo: '1032', nome: 'DAYVID' })).toBe(true);
    expect(vendedorNaoComissionavel1004({ codigo: '8', nome: 'XEXEU CCH' })).toBe(true);
    expect(vendedorNaoComissionavel1004({ codigo: '1082', nome: 'NATA' })).toBe(true);
    expect(vendedorNaoComissionavel1004({ codigo: '929', nome: 'THIAGO TOMAS' })).toBe(true);
    expect(vendedorNaoComissionavel1004({ codigo: '78', nome: 'BRUNO' })).toBe(false);
  });

  it('identifica vendedores da Forca P que devem sair do sistema 1004', () => {
    expect(vendedorForcaP1004({ codigo: '250', nome: 'DAYVID' })).toBe(true);
    expect(vendedorForcaP1004({ codigo: '1032', nome: 'DAYVID' })).toBe(true);
    expect(vendedorForcaP1004({ codigo: '999', nome: 'BRUNO B' })).toBe(true);
    expect(vendedorForcaP1004({ codigo: '78', nome: 'BRUNO B' })).toBe(true);
    expect(vendedorForcaP1004({ codigo: '155', nome: 'SERVIÇO DE TERCEIRO' })).toBe(true);
    expect(vendedorForcaP1004({ codigo: '1083', nome: 'NATA' })).toBe(true);
    expect(vendedorForcaP1004({ codigo: '54', nome: 'WANDERSON VIANA' })).toBe(true);

    expect(vendedorForcaP1004({ codigo: '10', nome: 'XEXEU' })).toBe(false);
    expect(vendedorForcaP1004({ codigo: '78', nome: 'BRUNO' })).toBe(false);
    expect(vendedorForcaP1004({ codigo: '59', nome: 'ERLAN' })).toBe(false);
  });

  it('limita a base CCH aos vendedores que aparecem no relatorio sintetico', () => {
    expect(vendedorPertenceRelatorioChevrolet10041({ codigo: '47', nome: 'RAFAEL' })).toBe(true);
    expect(vendedorPertenceRelatorioChevrolet10041({ codigo: '59', nome: 'ERLAN C.CH' })).toBe(true);
    expect(vendedorPertenceRelatorioChevrolet10041({ codigo: '10', nome: 'XEXEU' })).toBe(true);
    expect(vendedorPertenceRelatorioChevrolet10041({ codigo: '51', nome: 'WANDERSON (LIGEI' })).toBe(true);

    expect(vendedorPertenceRelatorioChevrolet10041({ codigo: '78', nome: 'BRUNO B' })).toBe(false);
    expect(vendedorPertenceRelatorioChevrolet10041({ codigo: '250', nome: 'DAYVID' })).toBe(false);
    expect(vendedorPertenceRelatorioChevrolet10041({ codigo: '1083', nome: 'NATA' })).toBe(false);
    expect(vendedorPertenceRelatorioChevrolet10041({ codigo: '940', nome: 'THIAGO TOMAS' })).toBe(false);
    expect(vendedorPertenceRelatorioChevrolet10041({ codigo: '588', nome: 'WANDERSON VIANA' })).toBe(false);
    expect(vendedorPertenceRelatorioChevrolet10041({ codigo: '155', nome: 'SERVIÇO DE TERCEIRO' })).toBe(false);
  });

  it('remove servicos e CFOP de servico da base do relatorio CCH', () => {
    expect(isServicoForaRelatorioChevrolet10041({ descricao: 'SERVICOS' })).toBe(true);
    expect(isServicoForaRelatorioChevrolet10041({ Produto: 'Serviço' })).toBe(true);
    expect(isServicoForaRelatorioChevrolet10041({ cfop: '5.933', descricao: 'MAO DE OBRA' })).toBe(true);
    expect(isServicoForaRelatorioChevrolet10041({ CFOP: '6.933', descricao: 'MAO DE OBRA' })).toBe(true);
    expect(isServicoForaRelatorioChevrolet10041({ cfop: '5.102', descricao: 'FILTRO OLEO' })).toBe(false);
  });

  it('mapeia codigos do filtro Chevrolet para os codigos retornados pela API', () => {
    expect(vendedorMatchesFiltro1004({ codigo: '1032', nome: 'DAYVID' }, '250')).toBe(true);
    expect(vendedorMatchesFiltro1004({ codigo: '45', nome: 'FERNANDO M CCH' }, '34')).toBe(true);
    expect(vendedorMatchesFiltro1004({ codigo: '85', nome: 'RAFAEL CCH' }, '47')).toBe(true);
    expect(vendedorMatchesFiltro1004({ codigo: '8', nome: 'XEXEU CCH' }, '10')).toBe(true);
    expect(vendedorMatchesFiltro1004({ codigo: '8', nome: 'XEXEU CCH' }, '8')).toBe(false);
  });

  it('monta o filtro somente com vendedores retornados pela API da Casa da Transmissao', () => {
    const vendedores = montarVendedoresElegiveisFiltro1004([
      { codigo: '78', nome: 'BRUNO' },
      { codigo: '1032', nome: 'DAYVID' },
      { codigo: '85', nome: 'RAFAEL CCH' },
      { codigo: '8', nome: 'XEXEU CCH' },
      { codigo: '1082', nome: 'NATA' },
      { codigo: '54', nome: 'WANDERSON VIANA' },
    ]);

    expect(vendedores.map((v) => String(v.codigo))).toEqual(['78', '47']);
    expect(vendedores.some((v) => v.nome === 'ELIANE')).toBe(false);
    expect(vendedores.some((v) => v.nome === 'MARCIO')).toBe(false);
    expect(vendedores.some((v) => v.nome === 'DAYVID')).toBe(false);
    expect(vendedores.some((v) => v.nome === 'XEXEU CCH')).toBe(false);
    expect(vendedores.some((v) => v.nome === 'NATA')).toBe(false);
    expect(vendedores.some((v) => v.nome === 'WANDERSON VIANA')).toBe(false);
  });
});
