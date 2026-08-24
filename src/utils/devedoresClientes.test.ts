import { describe, expect, it } from 'vitest';
import type { DuplicataRecord } from '@/hooks/useDuplicatasData';
import {
  agruparClientesDevedores,
  calcularResumoDevedores,
  getValorAReceberTitulo,
  listarVendedoresDevedores,
} from './devedoresClientes';

function dup(overrides: Partial<DuplicataRecord>): DuplicataRecord {
  return {
    CodEmpresa_bi: 1001,
    Empresa: 'Casper',
    Tipo: 'RECEBER',
    Origem: 'A RECEBER',
    Vendedor: 'RICARDO',
    CodCliente: '1',
    Fonte: '',
    Cliente: 'Cliente A',
    CodClienteRazao: '',
    CodBanco: '',
    Banco: '',
    Conta: '',
    Complemento: null,
    Observacao: null,
    CodDuplicata: 'D1',
    DataFluxo: null,
    DataDCTO: null,
    DataEmissao: '2026-07-01',
    DataVencimento: '2026-07-10',
    DataPagamento: null,
    ValorDuplicata: 1000,
    ValorJuros: null,
    ValorDesconto: null,
    ValorRecebimento: null,
    CodDepartamento: null,
    Departamento: null,
    CodConta: null,
    Descricao: null,
    ...overrides,
  };
}

describe('devedoresClientes', () => {
  it('soma o valor liquido a receber, sem usar novamente o valor original quando existe saldo', () => {
    const registros = [
      dup({ CodDuplicata: 'D1', CodCliente: '10', Cliente: 'Cliente X', SaldoAberto: 400, ValorDuplicata: 1000 }),
      dup({ CodDuplicata: 'D2', CodCliente: '10', Cliente: 'Cliente X', ValorDuplicata: 500, ValorRecebimento: 100 }),
    ];

    const [cliente] = agruparClientesDevedores(registros, {}, new Date('2026-07-15T12:00:00'));

    expect(getValorAReceberTitulo(registros[0])).toBe(400);
    expect(cliente.valorLiquidoAReceber).toBe(800);
    expect(cliente.titulos).toBe(2);
  });

  it('ignora duplicatas pagas, baixadas, canceladas, liquidadas e contas a pagar', () => {
    const registros = [
      dup({ CodCliente: '1', Cliente: 'Aberto', SaldoAberto: 250 }),
      dup({ CodCliente: '2', Cliente: 'Pago', SaldoAberto: 300, DataPagamento: '2026-07-11' }),
      dup({ CodCliente: '3', Cliente: 'Baixado', SaldoAberto: 300, DataBaixa: '2026-07-11' }),
      dup({ CodCliente: '4', Cliente: 'Cancelado', SaldoAberto: 300, DataCancelamento: '2026-07-11' }),
      dup({ CodCliente: '5', Cliente: 'Liquidado', SaldoAberto: 300, Status: 'Liquidado' }),
      dup({ CodCliente: '6', Cliente: 'Fornecedor', SaldoAberto: 300, Tipo: 'PAGAR', Origem: 'A PAGAR' }),
    ];

    const clientes = agruparClientesDevedores(registros, {}, new Date('2026-07-15T12:00:00'));

    expect(clientes).toHaveLength(1);
    expect(clientes[0].cliente).toBe('Aberto');
    expect(clientes[0].valorLiquidoAReceber).toBe(250);
  });

  it('ordena do maior devedor para o menor e calcula resumo', () => {
    const clientes = agruparClientesDevedores([
      dup({ CodCliente: '1', Cliente: 'Menor', SaldoAberto: 100 }),
      dup({ CodCliente: '2', Cliente: 'Maior', SaldoAberto: 700 }),
      dup({ CodCliente: '3', Cliente: 'Meio', SaldoAberto: 300 }),
    ], {}, new Date('2026-07-15T12:00:00'));
    const resumo = calcularResumoDevedores(clientes);

    expect(clientes.map((c) => c.cliente)).toEqual(['Maior', 'Meio', 'Menor']);
    expect(resumo.totalClientes).toBe(3);
    expect(resumo.totalTitulos).toBe(3);
    expect(resumo.totalAReceber).toBe(1100);
  });

  it('nao exibe parcela zerada como parcela valida', () => {
    const [cliente] = agruparClientesDevedores([
      dup({ CodCliente: '1', Cliente: 'Cliente Parcela', SaldoAberto: 100, Parcela: 0 }),
    ], {}, new Date('2026-07-15T12:00:00'));

    expect(cliente.titulosDetalhe[0].parcela).toBe('-');
  });

  it('respeita filtros de periodo de vencimento, vendedor, busca e status', () => {
    const registros = [
      dup({ CodCliente: '10', Cliente: 'Alpha Peças', Vendedor: 'RICARDO', SaldoAberto: 200, DataVencimento: '2026-07-05' }),
      dup({ CodCliente: '11', Cliente: 'Beta Auto', Vendedor: 'LEONARDO', SaldoAberto: 500, DataVencimento: '2026-08-10' }),
      dup({ CodCliente: '12', Cliente: 'Gamma Diesel', Vendedor: 'RICARDO', SaldoAberto: 900, DataVencimento: '2026-07-20' }),
    ];

    const clientes = agruparClientesDevedores(
      registros,
      { dataIni: '2026-07-01', dataFim: '2026-07-31', vendedor: 'RICARDO', search: 'gamma', status: 'EM_DIA' },
      new Date('2026-07-15T12:00:00'),
    );

    expect(clientes).toHaveLength(1);
    expect(clientes[0].cliente).toBe('Gamma Diesel');
    expect(listarVendedoresDevedores(registros)).toEqual(['LEONARDO', 'RICARDO']);
  });
});
