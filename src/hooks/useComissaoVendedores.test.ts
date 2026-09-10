import { describe, expect, it } from 'vitest';
import {
  calcularPedidosAbertosPorVendedor,
  buildComissaoSearchParams,
  buildPedidosAbertosSearchParams,
  comissaoLinhaPertenceForcaP1004,
  deveExcluirForcaPComissao1004,
  getValorPedidoAberto,
  mapComissaoLinha,
  resolveComissaoPedidosPath,
  resolveComissaoVendedoresPath,
  fetchTodosPedidos,
} from './useComissaoVendedores';

describe('mapComissaoLinha', () => {
  it('carrega pedidos em lotes grandes para evitar o timeout da tela de comissao', async () => {
    const primeiroLote = Array.from({ length: 5_000 }, (_, index) => ({ cod_pedido: index + 1 }));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => primeiroLote })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ cod_pedido: 5_001 }] });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const rows = await fetchTodosPedidos(
        { endpoint_url: 'https://api.example.com' },
        '/comercial/pedidos_ch',
        new URLSearchParams({ data_ini: '2026-09-01', data_fim: '2026-09-10' }),
        {},
        new AbortController().signal,
      );

      expect(rows).toHaveLength(5_001);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[0][0])).toContain('page_size%3D5000');
    } finally {
      vi.unstubAllGlobals();
    }
  });

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

  it('nao usa AFaturar como pedidos em aberto', () => {
    const linha = mapComissaoLinha({
      Vendedor: '10',
      NomeVendedor: 'XEXEU',
      AFaturar: 65_057.10,
    });

    expect(linha.aFaturar).toBeCloseTo(65_057.10, 2);
    expect(linha.pedidosAberto).toBeNull();
  });

  it('preserva pedidos em aberto explicitamente zerados pela API', () => {
    const linha = mapComissaoLinha({ AFaturar: 53_850.70, PedidosEmAberto: 0 });
    expect(linha.pedidosAberto).toBe(0);
    expect(linha.aFaturar).toBeCloseTo(53_850.70, 2);
  });

  it('mantem pedidos em aberto indisponivel quando o campo calculado nao vem', () => {
    expect(mapComissaoLinha({ AFaturar: 100, PedidosEmAberto: null }).pedidosAberto).toBeNull();
    expect(mapComissaoLinha({ AFaturar: 100, PedidosEmAberto: '' }).pedidosAberto).toBeNull();
  });

  it('aceita somente aliases explicitos de pedidos em aberto', () => {
    expect(mapComissaoLinha({ PedidosAberto: 0 }).pedidosAberto).toBe(0);
    expect(mapComissaoLinha({ 'PEDIDOS EM ABERTO': '1.234,56' }).pedidosAberto).toBeCloseTo(1234.56, 2);
    expect(mapComissaoLinha({ a_faturar_pedidos: 100 }).pedidosAberto).toBe(100);
    expect(mapComissaoLinha({ valor_total_pedido: '2.345,67' }).pedidosAberto).toBeNull();
    expect(mapComissaoLinha({ AFaturar: 200 }).pedidosAberto).toBeNull();
    expect(mapComissaoLinha({}).pedidosAberto).toBeNull();
  });

  it('considera aberto somente quando data_faturamento nao esta preenchida', () => {
    expect(getValorPedidoAberto({ data_faturamento: null, valor_total_pedido: '1.234,56' })).toBeCloseTo(1234.56, 2);
    expect(getValorPedidoAberto({ data_faturamento: '', valor_total_pedido: 500 })).toBe(500);
    expect(getValorPedidoAberto({ data_faturamento: '2026-09-09', valor_total_pedido: 900 })).toBeNull();
  });

  it('soma pedidos abertos por vendedor sem repetir o mesmo pedido', () => {
    const totais = calcularPedidosAbertosPorVendedor([
      { cod_empresa: 1, cod_pedido: 10, cod_vendedor: 8, data_faturamento: null, valor_total_pedido: 500 },
      { cod_empresa: 1, cod_pedido: 10, cod_vendedor: 8, data_faturamento: null, valor_total_pedido: 500 },
      { cod_empresa: 1, cod_pedido: 11, cod_vendedor: 8, data_faturamento: '2026-09-09', valor_total_pedido: 900 },
      { cod_empresa: 1, cod_pedido: 12, cod_vendedor: 10, data_faturamento: null, valor_total_pedido: 250 },
    ]);

    expect(totais.get('8')).toBe(500);
    expect(totais.get('10')).toBe(250);
  });

  it('restringe os pedidos da Casa da Chevrolet a P.Empresa 2', () => {
    const totais = calcularPedidosAbertosPorVendedor([
      { cod_empresa: 2, cod_pedido: 20, cod_vendedor: 10, data_faturamento: null, valor_total_pedido: 300 },
      { cod_empresa: 1, cod_pedido: 21, cod_vendedor: 10, data_faturamento: null, valor_total_pedido: 50_000 },
    ], { codEmpresa: '2' });

    expect(totais.get('10')).toBe(300);
  });

  it('soma pedidos abertos nos formatos das procedures CT e CH', () => {
    const totais = calcularPedidosAbertosPorVendedor([
      {
        CodEmpresa_bi: 1004,
        cod_empresa: 1,
        cod_pedido: 533914,
        cod_vendedor: 78,
        cod_vendedor_interno: 78,
        status_pedido: 'Pendente',
        data_faturamento: null,
        valor_total_pedido: 1_250,
      },
      {
        CodEmpresa_bi: 10041,
        cod_empresa: 2,
        cod_pedido: 2356947,
        cod_vendedor_interno: 11,
        status_pedido: 'Pendente',
        data_faturamento: null,
        valor_total_pedido: 980,
      },
    ]);

    expect(totais.get('78')).toBe(1_250);
    expect(totais.get('11')).toBe(980);
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

  it('busca os pedidos Chevrolet no endpoint ligado a procedure sp_api_pedido_venda_ch', () => {
    expect(resolveComissaoPedidosPath({ cod_empresa_bi: '10041' }, 'chevrolet')).toBe('/comercial/pedidos_ch');
    expect(resolveComissaoPedidosPath({
      cod_empresa_bi: '1004',
      endpoint_path_comercial_pedidos: '/comercial/pedidos',
      endpoint_path_comercial_pedidos_ch: '/comercial/pedidos_ch',
    }, 'chevrolet')).toBe('/comercial/pedidos_ch');
  });

  it('envia ao endpoint de pedidos apenas o periodo exclusivo e a empresa', () => {
    const params = buildPedidosAbertosSearchParams({
      data_ini: '2026-09-01',
      data_fim: '2026-09-09',
      deduzir_devolucao: true,
      calcula_st: false,
      exibir_valores_margem: true,
      operacao_fiscal_inicial: '0',
      operacao_fiscal_final: '62',
    }, '10041', false);

    expect(params.get('data_ini')).toBe('2026-09-01');
    expect(params.get('data_fim')).toBe('2026-09-10');
    expect(params.has('cod_empresa_bi')).toBe(false);
    expect(params.has('deduzir_devolucao')).toBe(false);
    expect(params.has('operacao_fiscal_inicial')).toBe(false);
  });

  it('limita o mes atual ao dia seguinte de hoje para a procedure com fim exclusivo', () => {
    const params = buildPedidosAbertosSearchParams({
      data_ini: '2026-09-01',
      data_fim: '2026-09-30',
      deduzir_devolucao: true,
      calcula_st: false,
      exibir_valores_margem: true,
    }, '10041', false, new Date('2026-09-09T12:00:00'));

    expect(params.get('data_ini')).toBe('2026-09-01');
    expect(params.get('data_fim')).toBe('2026-09-10');
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
