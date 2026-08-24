import { describe, expect, it } from 'vitest';
import { filtrarPorEquipePadrao, filtrarPorFilial } from './filialFilter';
import { resolveCodEmpresaBiParam, resolveComercialJsonPath } from './filialEndpoint';
import {
  aplicarEquipeChevrolet10041AoFiltro,
  criarResolvedorVendedoresChevrolet10041,
  getVendedorCasaChevrolet10041FromRecord,
  getVendedorChevrolet1004FromRecord,
} from './vendedores1004';

describe('fluxo comercial Pelegrini 10041', () => {
  it('envia cod_empresa_bi 10041 para buscar todas as vendas da Casa da Chevrolet', () => {
    expect(resolveCodEmpresaBiParam({ cod_empresa_bi: '10041' }, null)).toBe('10041');
  });

  it('tambem envia cod_empresa_bi 10041 quando o contexto vem como 1004 + filial chevrolet', () => {
    expect(resolveCodEmpresaBiParam({ cod_empresa_bi: '1004' }, 'chevrolet')).toBe('10041');
  });

  it('usa o JSON da Casa da Chevrolet quando o projeto isolado e 10041', () => {
    expect(resolveComercialJsonPath('pedidos', {
      cod_empresa_bi: '10041',
      json_path_comercial: 'comercial/pedidos-ct.json',
      json_path_comercial_ch: 'comercial/pedidos-ch.json',
    }, null)).toBe('comercial/pedidos-ch.json');
  });

  it('usa o JSON da Casa da Chevrolet quando o contexto Chevrolet chega pela empresa 1004', () => {
    expect(resolveComercialJsonPath('pedidos', {
      cod_empresa_bi: '1004',
      json_path_comercial: 'comercial/pedidos-ct.json',
      json_path_comercial_ch: 'comercial/pedidos-ch.json',
    }, 'chevrolet')).toBe('comercial/pedidos-ch.json');
  });

  it('mantem somente registros 10041 no contexto Casa da Chevrolet', () => {
    const registros = [
      { cod_empresa_bi: '1004', filial_nome: 'Casa da Transmissao', valor: 100 },
      { cod_empresa_bi: '1004', filial_nome: 'Casa da Chevrolet', valor: 150 },
      { cod_empresa_bi: '10041', filial_nome: 'Casa da Chevrolet', valor: 200 },
      { CodEmpresa_bi: '10041', Filial: '', valor: 300 },
      { filial_nome: 'Casa da Chevrolet', valor: 350 },
      { cod_empresa_bi: '1005', filial_nome: 'Outra empresa', valor: 400 },
    ];

    expect(filtrarPorFilial(registros, '10041', 'chevrolet')).toEqual([
      { cod_empresa_bi: '10041', filial_nome: 'Casa da Chevrolet', valor: 200 },
      { CodEmpresa_bi: '10041', Filial: '', valor: 300 },
      { filial_nome: 'Casa da Chevrolet', valor: 350 },
    ]);
  });

  it('mantem registro 10041 puro para o recorte posterior por vendedor da linha', () => {
    const registros = [
      { cod_empresa_bi: '10041', filial_nome: 'Casa da Chevrolet', vendedor_nome: 'BRUNO B', valor: 445848.52 },
      { cod_empresa_bi: '1004', filial_nome: 'Casa da Transmissao', vendedor_nome: 'BRUNO', valor: 490430.05 },
    ];

    expect(filtrarPorFilial(registros, '10041', 'chevrolet')).toEqual([
      { cod_empresa_bi: '10041', filial_nome: 'Casa da Chevrolet', vendedor_nome: 'BRUNO B', valor: 445848.52 },
    ]);
  });

  it('canoniza vendedor Chevrolet em campos alternativos da API 1004', () => {
    expect(getVendedorChevrolet1004FromRecord({
      cod_vendedor_comissao: '45',
      vendedor_comissao: 'FERNANDO M CCH',
    })).toEqual({ codigo: '34', nome: 'FERNANDO M' });

    expect(getVendedorChevrolet1004FromRecord({
      CodVendedorRepresentante: '11',
      NomeRepresentante: 'MARCIO CCH',
    })).toEqual({ codigo: '11', nome: 'MARCIO' });

    expect(getVendedorChevrolet1004FromRecord({
      vendedor_codigo: '78',
      vendedor_nome: 'BRUNO',
    })).toBeNull();
  });

  it('nao usa vendedores da base 1004 no 10041, mesmo quando nao sao equipe fixa da CT', () => {
    expect(getVendedorCasaChevrolet10041FromRecord({
      cod_empresa_bi: '1004',
      filial_nome: 'Casa da Transmissao',
      vendedor_codigo: '999',
      vendedor_nome: 'BRUNO B',
    })).toBeNull();

    expect(getVendedorCasaChevrolet10041FromRecord({
      cod_empresa_bi: '1004',
      filial_nome: 'Casa da Transmissao',
      vendedor_codigo: '78',
      vendedor_nome: 'BRUNO',
    })).toBeNull();
  });

  it('ignora cod_vendedor zero na Casa da Chevrolet e usa o vendedor real da linha', () => {
    expect(getVendedorCasaChevrolet10041FromRecord({
      cod_empresa_bi: '10041',
      filial_nome: 'Casa da Chevrolet',
      vendedor_codigo: '0',
      vendedor_nome: '0',
      cod_vendedor_interno: '512',
      nome_interno: 'EDER',
    })).toEqual({ codigo: '512', nome: 'EDER' });

    expect(getVendedorCasaChevrolet10041FromRecord({
      cod_empresa_bi: '10041',
      filial_nome: 'Casa da Chevrolet',
      cod_vendedor: '0',
      Vendedor: '',
      cod_vendedor_externo: '777',
      vendedor_externo: 'VENDEDOR EXTERNO',
    })).toEqual({ codigo: '777', nome: 'VENDEDOR EXTERNO' });
  });

  it('atribui devolucao sem vendedor ao vendedor da venda original pelo documento', () => {
    const venda = {
      cod_empresa_bi: '10041',
      filial_nome: 'Casa da Chevrolet',
      cod_documento: '246509',
      num_nf: '177852',
      cod_pedido: '529460',
      cod_vendedor_interno: '512',
      nome_interno: 'EDER',
      tipo: 'PEDIDO',
      valor_total: 4898,
    };
    const devolucao = {
      cod_empresa_bi: '10041',
      filial_nome: 'Casa da Chevrolet',
      cod_documento: '246509',
      num_nf: '177852',
      cod_pedido: '0',
      cod_vendedor: '0',
      vendedor: '',
      tipo: 'DEVOLUCAO',
      valor_total: -4898,
    };

    const resolver = criarResolvedorVendedoresChevrolet10041([venda, devolucao]);

    expect(getVendedorCasaChevrolet10041FromRecord(devolucao)).toBeNull();
    expect(resolver(devolucao)).toEqual({ codigo: '512', nome: 'EDER' });
  });

  it('atribui devolucao sem vendedor por campos de origem da nota original', () => {
    const venda = {
      cod_empresa_bi: '10041',
      filial_nome: 'Casa da Chevrolet',
      cod_documento: '246509',
      num_nf: '177852',
      cod_pedido: '529460',
      vendedor_codigo: '99',
      vendedor_nome: 'ELIANE',
      tipo: 'PEDIDO',
      valor_total: 4898,
    };
    const devolucao = {
      cod_empresa_bi: '10041',
      filial_nome: 'Casa da Chevrolet',
      cod_documento: '294001',
      num_nf: '178999',
      cod_pedido: '0',
      documento_origem: '246509',
      nota_origem: '177852',
      pedido_origem: '529460',
      cod_vendedor: '0',
      vendedor: '',
      tipo: 'DEVOLUCAO',
      valor_total: -4898,
    };

    const resolver = criarResolvedorVendedoresChevrolet10041([venda, devolucao]);

    expect(resolver(devolucao)).toEqual({ codigo: '99', nome: 'ELIANE' });
  });

  it('atribui devolucao sem vendedor ao vendedor unico do cliente no periodo', () => {
    const venda = {
      cod_empresa_bi: '10041',
      filial_nome: 'Casa da Chevrolet',
      cod_documento: '246100',
      num_nf: '177100',
      cod_pedido: '529100',
      cod_cliente: 'C123',
      cliente: 'CLIENTE TESTE',
      cod_vendedor_interno: '512',
      nome_interno: 'EDER',
      tipo: 'PEDIDO',
      valor_total: 300,
    };
    const devolucao = {
      cod_empresa_bi: '10041',
      filial_nome: 'Casa da Chevrolet',
      cod_documento: '294500',
      num_nf: '178500',
      cod_pedido: '0',
      cod_cliente: 'C123',
      cliente: 'CLIENTE TESTE',
      cod_vendedor: '0',
      vendedor: '',
      tipo: 'DEVOLUCAO',
      valor_total: -4898,
    };

    const resolver = criarResolvedorVendedoresChevrolet10041([venda, devolucao]);

    expect(resolver(devolucao)).toEqual({ codigo: '512', nome: 'EDER' });
  });

  it('nao atribui por cliente quando o cliente tem vendedores diferentes no periodo', () => {
    const registros = [
      {
        cod_empresa_bi: '10041',
        filial_nome: 'Casa da Chevrolet',
        cod_cliente: 'C123',
        vendedor_codigo: '99',
        vendedor_nome: 'ELIANE',
      },
      {
        cod_empresa_bi: '10041',
        filial_nome: 'Casa da Chevrolet',
        cod_cliente: 'C123',
        vendedor_codigo: '512',
        vendedor_nome: 'EDER',
      },
      {
        cod_empresa_bi: '10041',
        filial_nome: 'Casa da Chevrolet',
        cod_cliente: 'C123',
        cod_vendedor: '0',
        vendedor: '',
        tipo: 'DEVOLUCAO',
        valor_total: -4898,
      },
    ];

    const resolver = criarResolvedorVendedoresChevrolet10041(registros);

    expect(resolver(registros[2])).toBeNull();
  });

  it('atribui devolucao sem vendedor pelo mesmo cliente produto e valor quando o cliente tem mais de um vendedor', () => {
    const registros = [
      {
        cod_empresa_bi: '10041',
        filial_nome: 'Casa da Chevrolet',
        cod_cliente: 'C268397',
        cliente: 'CONSORCIO PUBLICO INTER DE SAUDE DO T MINEIRO',
        tipo_movimento: 'Venda',
        produto: 'MOLA DIANTEIRA',
        ValorVenda: 4140,
        cod_vendedor: '78',
        vendedor: 'BRUNO B',
      },
      {
        cod_empresa_bi: '10041',
        filial_nome: 'Casa da Chevrolet',
        cod_cliente: 'C268397',
        cliente: 'CONSORCIO PUBLICO INTER DE SAUDE DO T MINEIRO',
        tipo_movimento: 'Venda',
        produto: 'SERVICOS',
        ValorVenda: 550,
        cod_vendedor: '250',
        vendedor: 'DAYVID',
      },
      {
        cod_empresa_bi: '10041',
        filial_nome: 'Casa da Chevrolet',
        cod_cliente: 'C268397',
        cliente: 'CONSORCIO PUBLICO INTER DE SAUDE DO T MINEIRO',
        tipo_movimento: 'Devolução',
        produto: 'MOLA DIANTEIRA',
        ValorDevolucao: 4140,
        cod_vendedor: '0',
        vendedor: null,
      },
    ];

    const resolver = criarResolvedorVendedoresChevrolet10041(registros);

    expect(resolver(registros[2])).toEqual({ codigo: '999', nome: 'BRUNO B' });
  });

  it('reatribui devolucao da 10041 com vendedor direto nao oficial ao vendedor da venda original', () => {
    const registros = [
      {
        cod_empresa_bi: '10041',
        filial_nome: 'Casa da Chevrolet',
        cod_cliente: 'C032303',
        cliente: 'LUIZ FERNANDO MACHADO CRUZ',
        tipo_movimento: 'Venda',
        produto: 'CILINDRO MESTRE',
        ValorVenda: 310,
        cod_vendedor: '11',
        vendedor: 'MARCIO',
      },
      {
        cod_empresa_bi: '10041',
        filial_nome: 'Casa da Chevrolet',
        cod_cliente: 'C032303',
        cliente: 'LUIZ FERNANDO MACHADO CRUZ',
        tipo_movimento: 'Devolucao',
        produto: 'CILINDRO MESTRE',
        ValorDevolucao: 310,
        cod_vendedor: '30',
        vendedor: 'FABIO HENRIQUE',
      },
    ];

    const resolver = criarResolvedorVendedoresChevrolet10041(registros);

    expect(resolver(registros[1])).toEqual({ codigo: '11', nome: 'MARCIO' });
  });

  it('mantem apenas vendedores da Casa da Chevrolet no 10041', () => {
    const registros = [
      { vendedor_nome: 'ELIANE', valor: 100 },
      { vendedor_nome: 'MARCIO CCH', valor: 200 },
      { vendedor_nome: 'BRUNO', valor: 300 },
      { vendedor_nome: 'PAULO HENRIQUE', valor: 400 },
    ];

    expect(filtrarPorEquipePadrao(registros, '10041', 'chevrolet')).toEqual([
      { vendedor_nome: 'ELIANE', valor: 100 },
      { vendedor_nome: 'MARCIO CCH', valor: 200 },
    ]);
  });

  it('reconhece vendedores Chevrolet em campos interno e externo no 10041', () => {
    const registros = [
      { vendedor_externo: 'ELIANE', valor: 100 },
      { nome_externo: 'MARCIO CCH', valor: 200 },
      { vendedor_interno: 'FERNANDO M CCH', valor: 300 },
      { vendedor_externo: 'BRUNO', valor: 400 },
    ];

    expect(filtrarPorEquipePadrao(registros, '10041', 'chevrolet')).toEqual([
      { vendedor_externo: 'ELIANE', valor: 100 },
      { nome_externo: 'MARCIO CCH', valor: 200 },
      { vendedor_interno: 'FERNANDO M CCH', valor: 300 },
    ]);
  });

  it('mantem apenas vendedores da Chevrolet quando a filial ativa e chevrolet na empresa 1004', () => {
    const registros = [
      { vendedor_nome: 'ELIANE', valor: 100 },
      { vendedor_nome: 'DARI', valor: 200 },
      { vendedor_nome: 'BRUNO', valor: 300 },
      { vendedor_nome: 'ERLAN', valor: 400 },
      { vendedor_nome: 'PAULO HENRIQUE', valor: 500 },
    ];

    expect(filtrarPorEquipePadrao(registros, '1004', 'chevrolet')).toEqual([
      { vendedor_nome: 'ELIANE', valor: 100 },
      { vendedor_nome: 'DARI', valor: 200 },
    ]);
  });

  it('mantem somente base 10041 para a filial chevrolet', () => {
    const registros = [
      { cod_empresa_bi: '1004', filial_nome: 'Casa da Transmissao', vendedor_nome: 'BRUNO B', valor: 100 },
      { cod_empresa_bi: '1004', filial_nome: 'Casa da Transmissao', vendedor_nome: 'BRUNO', valor: 200 },
      { cod_empresa_bi: '10041', filial_nome: 'Casa da Chevrolet', vendedor_nome: 'DARI', valor: 300 },
    ];

    expect(filtrarPorFilial(registros, '1004', 'chevrolet')).toEqual([
      { cod_empresa_bi: '10041', filial_nome: 'Casa da Chevrolet', vendedor_nome: 'DARI', valor: 300 },
    ]);
  });

  it('abre o 10041 sem filtro fixo quando o filtro salvo esta antigo ou invalido', () => {
    const filtro = aplicarEquipeChevrolet10041AoFiltro({
      periodo: { inicio: '2026-08-01', fim: '2026-08-31' },
      vendedores: ['78', 'BRUNO B'],
    });

    expect(filtro?.vendedores).toBeUndefined();
  });

  it('abre o 10041 sem filtro fixo de vendedores quando nao existe selecao manual', () => {
    const filtro = aplicarEquipeChevrolet10041AoFiltro({
      periodo: { inicio: '2026-08-01', fim: '2026-08-31' },
      vendedores: undefined as string[] | undefined,
    });

    expect(filtro?.vendedores).toBeUndefined();
  });
});
