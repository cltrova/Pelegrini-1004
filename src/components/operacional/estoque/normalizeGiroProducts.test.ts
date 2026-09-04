import { describe, expect, it } from 'vitest';

import type { EstoqueRecord, GiroRecord } from '@/types/estoque';
import {
  calculateGiroStatus,
  daysSince,
  giroProductKey,
  normalizeGiroProducts,
} from './normalizeGiroProducts';

const now = new Date('2026-09-04T12:00:00Z');

function stockRow(overrides: Partial<EstoqueRecord> = {}): EstoqueRecord {
  return {
    cod_empresa_bi: 1004,
    cod_empresa: 1,
    empresa: 'CASA DA TRANSMISSAO',
    cod_produto: 99,
    produto: 'PRODUTO 99',
    cod_fabricante: '',
    cod_fornecedor: '',
    cod_grupo_produto: 10,
    grupo: 'GRUPO',
    cod_marca_produto: '1',
    marca: 'MARCA',
    cod_linha: '',
    linha: null,
    nr_fabricante: '',
    nr_original: '',
    aplicacao_produto: '',
    classe_abc: 'A',
    quantidade_estoque: 8,
    data_ultima_compra: null,
    operacao_ultima_compra: null,
    data_ultima_transferencia: null,
    operacao_ultima_transferencia: null,
    data_ultima_venda: '2026-09-01T00:00:00Z',
    cod_cliente_ultima_venda: '',
    cliente_ultima_venda: '',
    quantidade_compra_produto: 0,
    valor_estoque: 800,
    custo: 100,
    custo_fornecedor: 100,
    custo_medio: 100,
    custo_ultima_compra: 100,
    tipo_relatorio: 'FILIAL CONSOLIDADA',
    ...overrides,
  };
}

function saleRow(overrides: Partial<GiroRecord> = {}): GiroRecord {
  return {
    cod_empresa_bi: 1004,
    empresa: 'CASA DA TRANSMISSAO',
    cod_empresa: 1,
    data_movimento: '2026-09-01T00:00:00Z',
    cod_produto: 99,
    produto: 'PRODUTO 99',
    cod_fabricante: '',
    cod_marca: '1',
    marca: 'MARCA',
    cod_grupo: 10,
    grupo: 'GRUPO',
    saida_venda: 4,
    saida_transferencia: 0,
    saida_outras: 0,
    saida_devolucao: 0,
    entrada_compra: 0,
    entrada_transferencia: 0,
    entrada_outras: 0,
    entrada_devolucao: 0,
    valor_total_movimento: 0,
    valor_venda: 0,
    quantidade_movimentada: 4,
    valor_estoque: 800,
    quantidade_estoque: 8,
    tipo_movimento: 'Venda',
    cod_linha: null,
    linha: null,
    ...overrides,
  };
}

describe('normalizeGiroProducts', () => {
  it('combina saldo e vendas em uma linha por filial e produto', () => {
    const result = normalizeGiroProducts(
      [
        saleRow({ saida_venda: 2, quantidade_movimentada: 2 }),
        saleRow({ data_movimento: '2026-08-20T00:00:00Z', saida_venda: 2, quantidade_movimentada: 2 }),
      ],
      [stockRow({ quantidade_estoque: 3, valor_estoque: 300 }), stockRow({ quantidade_estoque: 5, valor_estoque: 500 })],
      '1004',
      3,
      now,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      cod_produto: 99,
      quantidade_estoque: 8,
      valor_estoque: 800,
      total_vendas: 4,
      total_saida_venda: 4,
    });
  });

  it('remove registros CT quando CCH esta ativa', () => {
    const result = normalizeGiroProducts(
      [
        saleRow({ cod_empresa_bi: 1004, cod_produto: 1 }),
        saleRow({ cod_empresa_bi: 10041, cod_produto: 2, empresa: 'CASA DO CHEVROLET' }),
      ],
      [],
      '10041',
      3,
      now,
    );

    expect(result.map((item) => item.cod_produto)).toEqual([2]);
  });

  it('associa movimento sem codigo BI somente quando o estoque ativo prova a filial', () => {
    const result = normalizeGiroProducts(
      [
        saleRow({ cod_empresa_bi: 0, cod_empresa: 77, cod_produto: 99 }),
        saleRow({ cod_empresa_bi: 0, cod_empresa: 77, cod_produto: 100, produto: 'SEM PROVA' }),
      ],
      [stockRow()],
      '1004',
      3,
      now,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ cod_empresa_bi: 1004, cod_produto: 99, total_vendas: 4 });
  });

  it('preserva as regras atuais de status, cobertura e dias sem venda', () => {
    expect(calculateGiroStatus(0, 1, 3)).toBe('faltando');
    expect(calculateGiroStatus(10, 0, 3)).toBe('excesso');
    expect(calculateGiroStatus(2, 9, 3)).toBe('faltando');
    expect(calculateGiroStatus(4, 9, 3)).toBe('alerta');
    expect(calculateGiroStatus(10, 9, 3)).toBe('atendendo');
    expect(calculateGiroStatus(20, 9, 3)).toBe('excesso');
    expect(daysSince('2026-09-01T00:00:00Z', now)).toBe(3);
    expect(daysSince(null, now)).toBeNull();
  });

  it('gera uma chave estavel com filial e produto', () => {
    expect(giroProductKey(1004, 1, 99)).toBe('1004:1:99');
  });
});
