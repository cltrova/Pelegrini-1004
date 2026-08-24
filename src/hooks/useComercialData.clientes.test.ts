import { describe, expect, it } from 'vitest';
import {
  calcularPrimeirasComprasPorCliente,
  filtrarEscopoPelegriniComercial1004,
  pedidoPertenceForcaP1004,
} from './useComercialData';
import type { Pedido } from '@/types/comercial';

describe('calcularPrimeirasComprasPorCliente', () => {
  it('remove vendedores da Forca P da base do 10041 antes de agregar clientes', () => {
    const pedidos = [
      {
        id: 'casa-chevrolet',
        CodEmpresa_bi: 10041,
        filial_nome: 'Casa da Chevrolet',
        cliente_codigo: 'CCH001',
        vendedor_codigo: '47',
        vendedor_nome: 'RAFAEL',
        valor_liquido: 1000,
      },
      {
        id: 'forca-p',
        CodEmpresa_bi: 10041,
        filial_nome: 'Casa da Chevrolet',
        cliente_codigo: 'FP001',
        vendedor_codigo: '250',
        vendedor_nome: 'DAYVID',
        valor_liquido: 900,
      },
    ] as unknown as Pedido[];

    const filtrados = filtrarEscopoPelegriniComercial1004(pedidos, {
      codEmpresa: '10041',
      isChevrolet10041Ativa: true,
    });

    expect(filtrados.map((pedido) => pedido.cliente_codigo)).toEqual(['CCH001']);
  });

  it('mantem no 10041 somente vendedores que pertencem ao relatorio CCH oficial', () => {
    const pedidos = [
      {
        id: 'relatorio-cch',
        CodEmpresa_bi: 10041,
        filial_nome: 'Casa da Chevrolet',
        cliente_codigo: 'CCH001',
        vendedor_codigo: '99',
        vendedor_nome: 'ELIANE',
        valor_liquido: 1000,
      },
      {
        id: 'fora-cch',
        CodEmpresa_bi: 10041,
        filial_nome: 'Casa da Chevrolet',
        cliente_codigo: 'CT001',
        vendedor_codigo: '98',
        vendedor_nome: 'DANIEL',
        valor_liquido: 900,
      },
    ] as unknown as Pedido[];

    const filtrados = filtrarEscopoPelegriniComercial1004(pedidos, {
      codEmpresa: '10041',
      isChevrolet10041Ativa: true,
    });

    expect(filtrados.map((pedido) => pedido.cliente_codigo)).toEqual(['CCH001']);
  });

  it('identifica vendedores Forca P no fluxo de clientes 1004', () => {
    expect(pedidoPertenceForcaP1004({ vendedor_codigo: '250', vendedor_nome: 'DAYVID' })).toBe(true);
    expect(pedidoPertenceForcaP1004({ vendedor_codigo: '1083', vendedor_nome: 'NATA' })).toBe(true);
    expect(pedidoPertenceForcaP1004({ vendedor_codigo: '54', vendedor_nome: 'WANDERSON VIANA' })).toBe(true);
    expect(pedidoPertenceForcaP1004({ vendedor_codigo: '155', vendedor_nome: 'SERVIÇO DE TERCEIRO' })).toBe(true);
    expect(pedidoPertenceForcaP1004({ cod_vendedor_externo: '1032', nome_externo: 'DAYVID' })).toBe(true);

    expect(pedidoPertenceForcaP1004({ vendedor_codigo: '10', vendedor_nome: 'XEXEU' })).toBe(false);
    expect(pedidoPertenceForcaP1004({ vendedor_codigo: '59', vendedor_nome: 'ERLAN' })).toBe(false);
  });

  it('mantem a primeira compra historica do cliente fora do periodo filtrado', () => {
    const pedidos = [
      {
        id: 'historico',
        cliente_codigo: 'C001',
        data_pedido: '2026-06-15',
        tipo: 'PEDIDO',
        status: 'faturado',
        vendedor_codigo: 1,
        valor_bruto: 100,
        valor_liquido: 100,
      },
      {
        id: 'periodo',
        cliente_codigo: 'C001',
        data_pedido: '2026-08-10',
        tipo: 'PEDIDO',
        status: 'faturado',
        vendedor_codigo: 1,
        valor_bruto: 200,
        valor_liquido: 200,
      },
    ] as Pedido[];

    const primeirasCompras = calcularPrimeirasComprasPorCliente(pedidos);

    expect(primeirasCompras.get('C001')).toBe('2026-06-15');
  });

  it('ignora devolucoes ao calcular primeira compra', () => {
    const pedidos = [
      {
        id: 'devolucao',
        cliente_codigo: 'C002',
        data_pedido: '2026-05-01',
        tipo: 'DEVOLUCAO',
        status: 'faturado',
        vendedor_codigo: 1,
        valor_bruto: 0,
        valor_liquido: -50,
      },
      {
        id: 'pedido',
        cliente_codigo: 'C002',
        data_pedido: '2026-08-01',
        tipo: 'PEDIDO',
        status: 'faturado',
        vendedor_codigo: 1,
        valor_bruto: 100,
        valor_liquido: 100,
      },
    ] as Pedido[];

    const primeirasCompras = calcularPrimeirasComprasPorCliente(pedidos);

    expect(primeirasCompras.get('C002')).toBe('2026-08-01');
  });

  it('prefere a data de cadastro do cliente quando a API retorna apenas o periodo filtrado', () => {
    const pedidos = [
      {
        id: 'periodo',
        cliente_codigo: 'C003',
        data_pedido: '2026-08-10',
        data_cadastro_cliente: '2026-06-03',
        tipo: 'PEDIDO',
        status: 'faturado',
        vendedor_codigo: 1,
        valor_bruto: 200,
        valor_liquido: 200,
      },
    ] as Pedido[];

    const primeirasCompras = calcularPrimeirasComprasPorCliente(pedidos);

    expect(primeirasCompras.get('C003')).toBe('2026-06-03');
  });

  it('reconhece aliases de primeira compra ou cadastro vindos da API', () => {
    const pedidos = [
      {
        id: 'primeira-compra-alias',
        cliente_codigo: 'C007',
        data_pedido: '2026-08-10',
        DataPrimeiraCompra: '2026-08-02',
        tipo: 'PEDIDO',
        status: 'faturado',
        vendedor_codigo: 1,
        valor_bruto: 200,
        valor_liquido: 200,
      },
      {
        id: 'cadastro-alias',
        cliente_codigo: 'C008',
        data_pedido: '2026-08-11',
        DataCadastro: '2026-07-29',
        tipo: 'PEDIDO',
        status: 'faturado',
        vendedor_codigo: 1,
        valor_bruto: 300,
        valor_liquido: 300,
      },
    ] as Pedido[];

    const primeirasCompras = calcularPrimeirasComprasPorCliente(pedidos, { periodoInicio: '2026-08-01' });

    expect(primeirasCompras.get('C007')).toBe('2026-08-02');
    expect(primeirasCompras.get('C008')).toBe('2026-07-29');
  });

  it('nao infere cliente novo quando a API retorna apenas vendas dentro do periodo', () => {
    const pedidos = [
      {
        id: 'periodo',
        cliente_codigo: 'C004',
        data_pedido: '2026-08-10',
        tipo: 'PEDIDO',
        status: 'faturado',
        vendedor_codigo: 1,
        valor_bruto: 200,
        valor_liquido: 200,
      },
    ] as Pedido[];

    const primeirasCompras = calcularPrimeirasComprasPorCliente(pedidos, { periodoInicio: '2026-08-01' });

    expect(primeirasCompras.has('C004')).toBe(false);
  });

  it('usa primeira compra do periodo quando a base carregada tambem contem historico anterior', () => {
    const pedidos = [
      {
        id: 'historico-outro-cliente',
        cliente_codigo: 'C005',
        data_pedido: '2026-07-20',
        tipo: 'PEDIDO',
        status: 'faturado',
        vendedor_codigo: 1,
        valor_bruto: 100,
        valor_liquido: 100,
      },
      {
        id: 'novo-no-periodo',
        cliente_codigo: 'C006',
        data_pedido: '2026-08-10',
        tipo: 'PEDIDO',
        status: 'faturado',
        vendedor_codigo: 1,
        valor_bruto: 200,
        valor_liquido: 200,
      },
    ] as Pedido[];

    const primeirasCompras = calcularPrimeirasComprasPorCliente(pedidos, { periodoInicio: '2026-08-01' });

    expect(primeirasCompras.get('C006')).toBe('2026-08-10');
  });
});
