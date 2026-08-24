import { describe, expect, it } from 'vitest';
import {
  calcularReceitaComissaoOficial1004,
  completarReceitaOficialChevrolet10041,
  normalizeComissao1004,
  normalizarFiltroVendedoresReceitaOficial1004,
  produtoPertenceEscopoPelegrini1004,
  resolverReceitaComissaoOficial1004,
  resolveComissao1004Path,
  deveAplicarFiltroOcultosTotalizador1004,
} from './useComercialProdutos';

describe('normalizeComissao1004', () => {
  it('mantem codigo e nome quando a comissao vem com cabecalhos do relatorio FAT', () => {
    const linha = normalizeComissao1004({
      'COD VENDEDOR': '00047',
      VENDEDOR: 'RAFAEL',
      QTD: '428',
      ACUMULADA: '84.283,00',
      'DEVOLUCAO VENDA': '3.673,00',
      'ST VENDA': '0,00',
    });

    expect(linha.codigo).toBe('00047');
    expect(linha.nome).toBe('RAFAEL');
    expect(linha.qtdFat).toBe(428);
    expect(linha.faturadoAteHoje).toBeCloseTo(84_283, 2);
    expect(linha.devolucaoVenda).toBeCloseTo(3_673, 2);
    expect(linha.stVenda).toBe(0);
  });
});

describe('fonte oficial de receita 1004/10041', () => {
  it('usa o endpoint de comissao da CCH quando esta no contexto Chevrolet', () => {
    expect(resolveComissao1004Path(true)).toBe('/comercial/comissoes_ch');
    expect(resolveComissao1004Path(false)).toBe('/comercial/comissoes');
  });

  it('mantem a receita acumulada do relatorio na CCH sem aplicar ajustes da CT', () => {
    const receita = calcularReceitaComissaoOficial1004(
      { faturadoAteHoje: 84_283, stVenda: 500 },
      true,
      1_200,
    );

    expect(receita).toBe(84_283);
  });

  it('na CCH nao substitui o acumulado oficial pelo total do detalhamento', () => {
    const receita = resolverReceitaComissaoOficial1004({
      receitaBase: 81_850,
      detalhe: { total: 82_188, corrigido: 338 },
      isContextoChevrolet10041Ativo: true,
    });

    expect(receita).toBe(81_850);
  });

  it('completa ERLAN da CCH pelo detalhamento quando a comissao oficial nao retorna a linha', () => {
    const oficiais = new Map([
      ['47', { codigo: '47', nome: 'RAFAEL', receita: 281_206.93, devolucoes: 6_647.48, qtdFat: 1246, raw: {} }],
    ]);
    const detalhes = new Map([
      ['47', { codigo: '47', nome: 'RAFAEL', total: 282_000, devolucoes: 0, qtdFat: 1246, corrigido: 0 }],
      ['59', { codigo: '59', nome: 'ERLAN C.CH', total: 94, devolucoes: 0, qtdFat: 2, corrigido: 0 }],
      ['78', { codigo: '78', nome: 'BRUNO B', total: 22_622.20, devolucoes: 0, qtdFat: 80, corrigido: 0 }],
    ]);

    const resultado = completarReceitaOficialChevrolet10041(oficiais, detalhes, true);

    expect(Array.from(resultado.keys()).sort()).toEqual(['47', '59']);
    expect(resultado.get('59')?.receita).toBe(94);
    expect(resultado.get('59')?.nome).toBe('ERLAN C.CH');
    expect(resultado.get('59')?.qtdFat).toBe(2);
  });

  it('trata selecao antiga com todos os vendedores menos ERLAN como Todos na CCH', () => {
    const receita = new Map([
      ['8', { codigo: '8', nome: 'DARI', receita: 7_350.54, devolucoes: 75, qtdFat: 28, raw: {} }],
      ['512', { codigo: '512', nome: 'EDER', receita: 87_194.86, devolucoes: 1_031.80, qtdFat: 318, raw: {} }],
      ['99', { codigo: '99', nome: 'ELIANE', receita: 4_996.42, devolucoes: 647.85, qtdFat: 42, raw: {} }],
      ['20', { codigo: '20', nome: 'ELIELTON', receita: 80_198, devolucoes: 1_998, qtdFat: 393, raw: {} }],
      ['59', { codigo: '59', nome: 'ERLAN C.CH', receita: 94, devolucoes: 0, qtdFat: 2, raw: {} }],
      ['34', { codigo: '34', nome: 'FERNANDO M', receita: 198_426.56, devolucoes: 12_155.35, qtdFat: 929, raw: {} }],
      ['14', { codigo: '14', nome: 'MAGALHAES', receita: 149_646.17, devolucoes: 5_813, qtdFat: 702, raw: {} }],
      ['11', { codigo: '11', nome: 'MARCIO', receita: 222_965.31, devolucoes: 6_473, qtdFat: 949, raw: {} }],
      ['47', { codigo: '47', nome: 'RAFAEL', receita: 281_206.93, devolucoes: 6_647.48, qtdFat: 1246, raw: {} }],
      ['10', { codigo: '10', nome: 'XEXEU', receita: 244_099.78, devolucoes: 6_471, qtdFat: 1056, raw: {} }],
    ]);

    const filtro = normalizarFiltroVendedoresReceitaOficial1004(
      ['8', '512', '99', '20', '34', '14', '11', '47', '10'],
      receita,
      true,
    );

    expect(filtro).toBeUndefined();
  });

  it('aplica o filtro de vendedores ocultos apenas na CT', () => {
    expect(deveAplicarFiltroOcultosTotalizador1004(true, true)).toBe(false);
    expect(deveAplicarFiltroOcultosTotalizador1004(true, false)).toBe(true);
    expect(deveAplicarFiltroOcultosTotalizador1004(false, false)).toBe(false);
  });

  it('no dashboard 10041 mantem somente dados da Chevrolet e remove CT/Forca P', () => {
    expect(produtoPertenceEscopoPelegrini1004({
      cod_empresa_bi: '10041',
      filial_nome: 'Casa da Chevrolet',
      cod_vendedor_interno: '99',
      nome_interno: 'ELIANE',
      cliente_razao: 'CLIENTE CHEVROLET',
    }, {
      codEmpresa: '10041',
      isContextoChevrolet10041Ativo: true,
    })).toBe(true);

    expect(produtoPertenceEscopoPelegrini1004({
      cod_empresa_bi: '1004',
      filial_nome: 'Casa da Transmissao',
      vendedor_nome: 'RAFAEL',
      cliente_razao: 'CLIENTE CT',
    }, {
      codEmpresa: '10041',
      isContextoChevrolet10041Ativo: true,
    })).toBe(false);

    expect(produtoPertenceEscopoPelegrini1004({
      cod_empresa_bi: '10041',
      filial_nome: 'Casa da Chevrolet',
      vendedor_nome: 'DAYVID',
      cliente_razao: 'CLIENTE FORCA P',
    }, {
      codEmpresa: '10041',
      isContextoChevrolet10041Ativo: true,
    })).toBe(false);
  });
});
