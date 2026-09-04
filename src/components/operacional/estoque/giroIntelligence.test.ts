import { describe, expect, it } from 'vitest';

import type { GiroProductSummary } from '@/types/estoque';

import { buildGiroManagementSummary } from './giroIntelligence';

function product(overrides: Partial<GiroProductSummary> = {}): GiroProductSummary {
  return {
    cod_produto: 1,
    produto: 'Produto',
    marca: 'Marca',
    grupo: 'Grupo',
    empresa: 'CT',
    quantidade_estoque: 10,
    valor_estoque: 1_000,
    total_vendas: 10,
    total_compras: 0,
    giro: 1,
    status: 'atendendo',
    dias_sem_venda: 10,
    ultima_venda: '2026-08-20',
    total_saida_venda: 10,
    total_entrada_compra: 0,
    total_saida_transferencia: 0,
    total_entrada_transferencia: 0,
    cobertura_meses: 1,
    classe_abc: 'A',
    ...overrides,
  };
}

describe('buildGiroManagementSummary', () => {
  it('conta cada status corretamente', () => {
    const summary = buildGiroManagementSummary([
      product({ cod_produto: 1, status: 'atendendo' }),
      product({ cod_produto: 2, status: 'alerta' }),
      product({ cod_produto: 3, status: 'faltando' }),
      product({ cod_produto: 4, status: 'excesso' }),
    ]);

    expect(summary.counts).toEqual({ atendendo: 1, alerta: 1, faltando: 1, excesso: 1 });
    expect(summary.statusDistribution.map(({ status, count }) => [status, count])).toEqual([
      ['atendendo', 1], ['alerta', 1], ['faltando', 1], ['excesso', 1],
    ]);
  });

  it('ignora produtos sem baseline de vendas na cobertura media', () => {
    const summary = buildGiroManagementSummary([
      product({ cod_produto: 1, cobertura_meses: 2 }),
      product({ cod_produto: 2, cobertura_meses: 4 }),
      product({ cod_produto: 3, cobertura_meses: null, total_vendas: 0 }),
    ]);

    expect(summary.averageKnownCoverageMonths).toBe(3);
    expect(summary.knownCoverageCount).toBe(2);
  });

  it('calcula capital parado para excesso ou estoque sem venda ha mais de 90 dias', () => {
    const summary = buildGiroManagementSummary([
      product({ cod_produto: 1, status: 'excesso', valor_estoque: 1_000, dias_sem_venda: 20 }),
      product({ cod_produto: 2, status: 'atendendo', valor_estoque: 2_000, dias_sem_venda: 91 }),
      product({ cod_produto: 3, status: 'alerta', valor_estoque: 4_000, dias_sem_venda: 30 }),
      product({ cod_produto: 4, status: 'excesso', valor_estoque: 8_000, quantidade_estoque: 0, dias_sem_venda: 120 }),
    ]);

    expect(summary.idleCapital).toBe(3_000);
    expect(summary.idleCapitalRanking.map(item => item.cod_produto)).toEqual([2, 1]);
  });

  it('nao trata idade desconhecida como mais de 90 dias', () => {
    const summary = buildGiroManagementSummary([
      product({
        cod_produto: 5,
        status: 'atendendo',
        quantidade_estoque: 8,
        valor_estoque: 9_000,
        dias_sem_venda: null,
        ultima_venda: null,
      }),
    ]);

    expect(summary.idleCapital).toBe(0);
    expect(summary.idleCapitalRanking).toEqual([]);
    expect(summary.noSaleBuckets).toEqual([{ faixa: 'Sem historico', count: 1 }]);
  });

  it('retorna zeros e datasets vazios para entrada vazia', () => {
    expect(buildGiroManagementSummary([])).toEqual({
      counts: { atendendo: 0, alerta: 0, faltando: 0, excesso: 0 },
      idleCapital: 0,
      averageKnownCoverageMonths: 0,
      knownCoverageCount: 0,
      statusDistribution: [],
      abcValueDistribution: [],
      stockVersusSales: [],
      noSaleBuckets: [],
      idleCapitalRanking: [],
    });
  });
});
