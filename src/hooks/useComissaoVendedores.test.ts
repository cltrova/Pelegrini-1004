import { describe, expect, it } from 'vitest';
import {
  buildComissaoSearchParams,
  comissaoLinhaPertenceForcaP1004,
  deveExcluirForcaPComissao1004,
  mapComissaoLinha,
  resolveComissaoVendedoresPath,
} from './useComissaoVendedores';

describe('mapComissaoLinha', () => {
  it('interpreta os campos do relatorio sintetico FAT da Pelegrini', () => {
    const linha = mapComissaoLinha({
      CodVendedor: '00010',
      NomeVendedor: 'XEXEU',
      Qtd: 357,
      VendaDireta: '95.777,70',
      VendaIndireta: '0,00',
      DevolucaoVenda: '1.236,00',
      Margem: '37,62',
      PMV: 41,
      ValorComissao: '0,00',
      PercentualVenda: '0,00',
      Acumulada: '94.541,70',
    });

    expect(linha.vendedor).toBe('00010');
    expect(linha.nome).toBe('XEXEU');
    expect(linha.faturadoAteHoje).toBeCloseTo(94_541.70, 2);
    expect(linha.valorTotal).toBeCloseTo(95_777.70, 2);
    expect(linha.devolucao).toBeCloseTo(1_236, 2);
    expect(linha.margem).toBeCloseTo(37.62, 2);
    expect(linha.pmv).toBe(41);
  });

  it('interpreta cabecalhos com espaco iguais aos do relatorio impresso', () => {
    const linha = mapComissaoLinha({
      'COD VENDEDOR': '00034',
      VENDEDOR: 'FERNANDO M',
      'VENDA DIRETA': '81.513,50',
      'DEVOLUCAO VENDA': '4.268,50',
      MARGEM: '38,97',
      PMV: '21',
      'VALOR COMISSAO': '0,00',
      '% VENDA': '0,00',
      ACUMULADA: '77.245,00',
    });

    expect(linha.vendedor).toBe('00034');
    expect(linha.nome).toBe('FERNANDO M');
    expect(linha.faturadoAteHoje).toBeCloseTo(77_245, 2);
    expect(linha.valorTotal).toBeCloseTo(81_513.50, 2);
    expect(linha.devolucao).toBeCloseTo(4_268.50, 2);
  });

  it('mantem A FATURAR separado de pedidos em aberto', () => {
    const linha = mapComissaoLinha({
      'COD VENDEDOR': '00010',
      VENDEDOR: 'XEXEU',
      'OBJ MENSAL': '240.000,00',
      'FAT. ATÉ HOJE': '154.879,90',
      'A FATURAR': '4.341,00',
      'PEDIDOS EM ABERTO': '1.234,56',
      'NOVA PROJ.': '85.120,10',
    });

    expect(linha.faturadoAteHoje).toBeCloseTo(154_879.90, 2);
    expect(linha.aFaturar).toBeCloseTo(4_341, 2);
    expect(linha.pedidosAberto).toBeCloseTo(1_234.56, 2);
    expect(linha.novaProjecao).toBeCloseTo(85_120.10, 2);
  });

  it('usa A FATURAR como fallback quando a API nao envia campo de pedidos em aberto', () => {
    const linha = mapComissaoLinha({
      Vendedor: '10',
      NomeVendedor: 'XEXEU',
      AFaturar: 65_057.10,
    });

    expect(linha.aFaturar).toBeCloseTo(65_057.10, 2);
    expect(linha.pedidosAberto).toBeCloseTo(65_057.10, 2);
  });

  it('identifica linhas da Forca P na comissao do cliente 1004', () => {
    const dayvid = mapComissaoLinha({ cod_vendedor: '250', nome_vendedor: 'DAYVID' });
    const servico = mapComissaoLinha({ cod_vendedor: '155', nome_vendedor: 'SERVIÇO DE TERCEIRO' });
    const wander = mapComissaoLinha({ cod_vendedor: '54', nome_vendedor: 'WANDERSON VIANA' });

    expect(comissaoLinhaPertenceForcaP1004(dayvid)).toBe(true);
    expect(comissaoLinhaPertenceForcaP1004(servico)).toBe(true);
    expect(comissaoLinhaPertenceForcaP1004(wander)).toBe(true);

    expect(comissaoLinhaPertenceForcaP1004(mapComissaoLinha({ cod_vendedor: '10', nome_vendedor: 'XEXEU' }))).toBe(false);
    expect(comissaoLinhaPertenceForcaP1004(mapComissaoLinha({ cod_vendedor: '59', nome_vendedor: 'ERLAN' }))).toBe(false);
  });

  it('tambem exclui Forca P no contexto 10041 da comissao', () => {
    expect(deveExcluirForcaPComissao1004('10041', 'chevrolet')).toBe(true);
    expect(deveExcluirForcaPComissao1004('1004', 'transmissao')).toBe(true);
    expect(deveExcluirForcaPComissao1004('1001', undefined)).toBe(false);
  });

  it('usa o endpoint de comissao da Chevrolet quando a empresa ativa e 10041', () => {
    expect(resolveComissaoVendedoresPath('10041')).toBe('/comercial/comissoes_ch');
    expect(resolveComissaoVendedoresPath('1004', 'chevrolet')).toBe('/comercial/comissoes_ch');
    expect(resolveComissaoVendedoresPath('1004', 'transmissao')).toBe('/comercial/comissoes');
  });

  it('envia filtro de operacao fiscal quando preenchido manualmente', () => {
    const params = buildComissaoSearchParams({
      data_ini: '2026-08-01',
      data_fim: '2026-08-31',
      deduzir_devolucao: true,
      calcula_st: false,
      exibir_valores_margem: true,
      operacao_fiscal_inicial: '0',
      operacao_fiscal_final: '62',
    }, '10041');

    expect(params.get('operacao_fiscal_inicial')).toBe('0');
    expect(params.get('operacao_fiscal_final')).toBe('62');
    expect(params.get('cod_empresa_bi')).toBe('10041');
  });

  it('nao envia operacao fiscal quando o filtro fica vazio', () => {
    const params = buildComissaoSearchParams({
      data_ini: '2026-08-01',
      data_fim: '2026-08-31',
      deduzir_devolucao: true,
      calcula_st: false,
      exibir_valores_margem: true,
      operacao_fiscal_inicial: '',
      operacao_fiscal_final: '',
    }, '10041');

    expect(params.has('operacao_fiscal_inicial')).toBe(false);
    expect(params.has('operacao_fiscal_final')).toBe(false);
    expect(params.get('cod_empresa_bi')).toBe('10041');
  });
});
