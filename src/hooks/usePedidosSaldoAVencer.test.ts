import { describe, expect, it } from 'vitest';
import { enrichPedidoComDuplicataFinanceira } from './usePedidosSaldoAVencer';

describe('enrichPedidoComDuplicataFinanceira', () => {
  it('preenche vencimento real quando a duplicata financeira bate pelo pedido', () => {
    const pedido = {
      cod_pedido: 6495,
      num_nf: null,
      data_pedido: '2026-08-06T00:00:00',
    };
    const duplicatas = [
      {
        CodDuplicata: '6495',
        NumNF: '123456',
        DataVencimento: '2026-09-10T00:00:00',
        Parcela: '1/3',
      },
    ];

    expect(enrichPedidoComDuplicataFinanceira(pedido, duplicatas)).toEqual({
      vencimento: '2026-09-10T00:00:00',
      numNF: '123456',
      parcela: '1/3',
    });
  });

  it('reconhece NotaFisacal quando a API retorna o campo com esse nome', () => {
    const pedido = {
      cod_pedido: 6495,
      NotaFisacal: '98765',
    };
    const duplicatas = [
      {
        NotaFisacal: '98765',
        DataVencimento: '2026-10-15T00:00:00',
        Parcela: '2/3',
      },
    ];

    expect(enrichPedidoComDuplicataFinanceira(pedido, duplicatas)).toEqual({
      vencimento: '2026-10-15T00:00:00',
      numNF: '98765',
      parcela: '2/3',
    });
  });
});
