import { describe, expect, it } from 'vitest';
import { aplicarPrimeiraCompraClientesApi, montarMapaPrimeiraCompraApi } from './clientesPrimeiraCompraApi';
import type { ClientePerformance } from '@/types/comercial';

describe('clientesPrimeiraCompraApi', () => {
  it('monta um mapa por codigo usando primeira compra retornada pela API', () => {
    const mapa = montarMapaPrimeiraCompraApi([
      { cod_cliente: 'C001', DataPrimeiraCompra: '2026-08-04T00:00:00' },
      { CodCliente: 'C002', data_cadastro_cliente: '2026-07-20' },
      { CodigoCliente: 'C003', primeira_compra_periodo: '2026-08-12' },
    ]);

    expect(mapa.get('C001')).toBe('2026-08-04');
    expect(mapa.get('C002')).toBe('2026-07-20');
    expect(mapa.get('C003')).toBe('2026-08-12');
  });

  it('enriquece clientes da tela com a primeira compra da API', () => {
    const clientes = [
      {
        codigo: 'C001',
        razao: 'Cliente Um',
        faturamentoLiquido: 100,
        totalPedidos: 1,
        totalDevolucoes: 0,
        ticketMedio: 100,
        participacao: 100,
      },
    ] as ClientePerformance[];

    const enriquecidos = aplicarPrimeiraCompraClientesApi(clientes, [
      { cod_cliente: 'C001', primeira_compra: '2026-08-01' },
    ]);

    expect(enriquecidos[0].primeiraCompra).toBe('2026-08-01');
  });

  it('mantem a primeira compra ja calculada quando a API nao traz o cliente', () => {
    const clientes = [
      {
        codigo: 'C003',
        razao: 'Cliente Tres',
        primeiraCompra: '2026-06-10',
        faturamentoLiquido: 100,
        totalPedidos: 1,
        totalDevolucoes: 0,
        ticketMedio: 100,
        participacao: 100,
      },
    ] as ClientePerformance[];

    const enriquecidos = aplicarPrimeiraCompraClientesApi(clientes, []);

    expect(enriquecidos[0].primeiraCompra).toBe('2026-06-10');
  });
});
