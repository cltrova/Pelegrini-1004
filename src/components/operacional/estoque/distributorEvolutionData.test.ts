import { describe, expect, it } from 'vitest';

import {
  buildClosedMonthsRange,
  buildDistributorEvolution,
  calculateVariation,
  canViewDistributorEvolution,
  buildDistributorRowsFromProducts,
  normalizeDistributorRows,
} from './distributorEvolutionData';

describe('distributorEvolutionData', () => {
  it('restringe a analise a Casa da Transmissao', () => {
    expect(canViewDistributorEvolution('1004', 'transmissao')).toBe(true);
    expect(canViewDistributorEvolution('1004', 'chevrolet')).toBe(false);
    expect(canViewDistributorEvolution('10041', 'chevrolet')).toBe(false);
  });

  it('calcula os doze meses fechados sem incluir o mes atual', () => {
    expect(buildClosedMonthsRange(new Date('2026-09-10T12:00:00-03:00'))).toEqual({
      dataInicio: '2025-09-01',
      dataFim: '2026-08-31',
    });
  });

  it('nao inventa variacao quando o periodo anterior nao tem base', () => {
    expect(calculateVariation(100, undefined)).toBeNull();
    expect(calculateVariation(100, 0)).toBeNull();
    expect(calculateVariation(150, 100)).toBe(0.5);
  });

  it('aceita apenas os distribuidores configurados e preserva indicadores nulos', () => {
    expect(normalizeDistributorRows([
      {
        mes: '2026-08', marca: ' mwm ', cod_grupo: '01', grupo: 'Motores',
        valor_estoque: '1000,50', margem_venda: null,
      },
      { mes: '2026-08', marca: 'Outra', grupo: 'Descartar', valor_estoque: 99 },
    ])).toEqual([
      expect.objectContaining({
        mes: '2026-08', marca: 'MWM', grupo: 'Motores', valor_estoque: 1000.5,
        margem_venda: null,
      }),
    ]);
  });

  it('inclui MIC entre as marcas de distribuidores', () => {
    expect(normalizeDistributorRows([
      { mes: '2026-08', marca: 'MIC', grupo: 'MIC', valor_estoque: 250 },
    ])).toEqual([
      expect.objectContaining({ marca: 'MIC', valor_estoque: 250 }),
    ]);
  });

  it('consolida grupos sem duplicar totais e calcula a variacao mensal', () => {
    const result = buildDistributorEvolution(normalizeDistributorRows([
      { mes: '2026-06', marca: 'ZF', cod_grupo: '1', grupo: 'ZF Pesado', valor_estoque: 0, valor_vendas: 10 },
      { mes: '2026-07', marca: 'ZF', cod_grupo: '1', grupo: 'ZF Pesado', valor_estoque: 60, valor_vendas: 20 },
      { mes: '2026-07', marca: 'ZF', cod_grupo: '2', grupo: 'ZF Medio', valor_estoque: 40, valor_vendas: 30 },
      { mes: '2026-08', marca: 'ZF', cod_grupo: '1', grupo: 'ZF Pesado', valor_estoque: 90, valor_vendas: 40 },
      { mes: '2026-08', marca: 'ZF', cod_grupo: '2', grupo: 'ZF Medio', valor_estoque: 60, valor_vendas: 50 },
    ]));

    expect(result.months).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(result.brands[0].months.map((month) => ({
      mes: month.mes,
      valor: month.valor_estoque,
      variacao: month.variacao_valor_estoque,
    }))).toEqual([
      { mes: '2026-06', valor: 0, variacao: null },
      { mes: '2026-07', valor: 100, variacao: null },
      { mes: '2026-08', valor: 150, variacao: 0.5 },
    ]);
    expect(result.brands[0].groups).toHaveLength(2);
    expect(result.summary.valor_estoque).toBe(150);
    expect(result.summary.valor_vendas).toBe(90);
  });

  it('cria uma visualizacao provisoria com vendas e devolucoes faturadas de Produtos', () => {
    const rows = buildDistributorRowsFromProducts([
      { tipo: 'PEDIDO', data_faturamento: '2026-08-05', marca: 'ZF', grupo: 'ZF PESADO', valor_total: 120 },
      { tipo: 'DEVOLUCAO', data_faturamento: '2026-08-06', marca: 'ZF', grupo: 'ZF PESADO', valor_total: -20 },
      { tipo: 'PEDIDO', data_faturamento: null, marca: 'ZF', grupo: 'ZF PESADO', valor_total: 500 },
      { tipo: 'PEDIDO', data_faturamento: '2026-08-07', marca: 'OUTRA', grupo: 'OUTRA', valor_total: 900 },
    ], {
      dataInicio: '2026-08-01',
      dataFim: '2026-08-31',
      marcas: ['ZF'],
    });

    expect(rows).toHaveLength(2);
    expect(buildDistributorEvolution(rows).summary).toEqual(expect.objectContaining({
      valor_vendas: 120,
      valor_devolucoes: 20,
    }));
  });
});
