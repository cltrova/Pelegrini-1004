import { describe, expect, it } from 'vitest';

import {
  buildStockEvolution,
  buildStockInsights,
  classifyStockTrend,
  consolidateStockRecords,
  detectStockGranularity,
  filterStockInsights,
  normalizeStockSearch,
  sortStockInsights,
} from './estoqueIntelligence';
import {
  estoqueFixture,
  estoqueFixtureComTresItens,
  giroEvolucaoFixture,
  giroFixture,
  NOW,
} from './estoqueFixtures';

describe('stock intelligence', () => {
  it('consolida registros duplicados por produto somando quantidade e valor e preservando as datas mais recentes', () => {
    const rows = [
      estoqueFixture[0],
      {
        ...estoqueFixture[0],
        cod_empresa: 2,
        empresa: 'FILIAL 2',
        quantidade_estoque: 7,
        valor_estoque: 3500,
        data_ultima_compra: '2026-08-25',
        data_ultima_venda: '2026-08-29',
        data_ultima_transferencia: '2026-08-30',
      },
    ];

    expect(consolidateStockRecords(rows)).toEqual([
      expect.objectContaining({
        cod_produto: 101,
        empresa: 'CASA DA TRANSMISSAO',
        quantidade_estoque: 17,
        valor_estoque: 8500,
        data_ultima_compra: '2026-08-25',
        data_ultima_venda: '2026-08-31',
        data_ultima_transferencia: '2026-08-30',
      }),
    ]);
    expect(rows[0].quantidade_estoque).toBe(10);
  });

  it('consolida por produto dentro do conjunto ativo mesmo com codigos BI diferentes', () => {
    const rows = [
      estoqueFixture[0],
      {
        ...estoqueFixture[0],
        cod_empresa_bi: 10041,
        cod_empresa: 2,
        quantidade_estoque: 5,
        valor_estoque: 2500,
      },
    ];

    expect(consolidateStockRecords(rows)).toEqual([
      expect.objectContaining({ cod_produto: 101, quantidade_estoque: 15, valor_estoque: 7500 }),
    ]);
  });

  it('agrega movimentos de todas as filiais contribuintes no insight consolidado', () => {
    const stock = consolidateStockRecords([
      estoqueFixture[0],
      { ...estoqueFixture[0], cod_empresa: 2, empresa: 'FILIAL 2', quantidade_estoque: 5 },
    ]);
    const movements = [
      { ...giroFixture[0], saida_venda: 10 },
      { ...giroFixture[0], cod_empresa: 2, empresa: 'FILIAL 2', saida_venda: 20 },
    ];

    expect(buildStockInsights(stock, movements, NOW, 'product')[0]).toMatchObject({
      totalOutbound: 30,
      totalSales: 30,
      movementDataAvailable: true,
    });
  });

  it('detecta localizacao como maior granularidade disponivel', () => {
    expect(detectStockGranularity([
      { ...estoqueFixture[0], localizacao_produto: 'A-01' },
      { ...estoqueFixture[0], cod_empresa: 2, empresa: 'FILIAL 2' },
    ])).toBe('location');
  });

  it('ignora datas operacionais impossiveis durante a consolidacao', () => {
    const rows = [
      { ...estoqueFixture[0], data_ultima_compra: '2026-01-31' },
      { ...estoqueFixture[0], cod_empresa: 2, data_ultima_compra: '2026-02-30' },
    ];

    expect(consolidateStockRecords(rows)[0].data_ultima_compra).toBe('2026-01-31');
  });

  it('descarta datas impossiveis presentes no primeiro ou unico registro consolidado', () => {
    const row = {
      ...estoqueFixture[0],
      data_ultima_compra: '2026-02-30',
      data_ultima_venda: 'invalida',
      data_ultima_transferencia: '2026-13-01',
    };

    expect(consolidateStockRecords([row])[0]).toMatchObject({
      data_ultima_compra: null,
      data_ultima_venda: null,
      data_ultima_transferencia: null,
    });
  });

  it('detecta filial quando existem filiais distintas sem localizacao', () => {
    expect(detectStockGranularity([
      estoqueFixture[0],
      { ...estoqueFixture[0], cod_empresa: 2, empresa: 'FILIAL 2' },
    ])).toBe('branch');
  });

  it('calcula minimo de 30 dias e classifica cobertura inferior a 15 dias como critica', () => {
    const insights = buildStockInsights(estoqueFixture, giroFixture, NOW);

    expect(insights[0]).toMatchObject({
      operationalMinimum: 30,
      coverageDays: 10,
      status: 'critical',
      totalOutbound: 30,
    });
  });

  it('exclui devolucoes do consumo operacional', () => {
    const movementsWithReturns = giroFixture.map((movement) => ({
      ...movement,
      saida_devolucao: 30,
    }));

    const insight = buildStockInsights(estoqueFixture, movementsWithReturns, NOW)[0];

    expect(insight).toMatchObject({
      totalOutbound: 30,
      totalPhysicalOutbound: 90,
      totalMovement: 90,
      operationalMinimum: 30,
      coverageDays: 10,
      status: 'critical',
    });
  });

  it('soma entradas e saidas fisicas absolutas incluindo devolucoes', () => {
    const movement = {
      ...giroFixture[0],
      saida_venda: 2,
      saida_transferencia: 3,
      saida_outras: 5,
      saida_devolucao: 7,
      entrada_compra: 11,
      entrada_transferencia: 13,
      entrada_outras: 17,
      entrada_devolucao: 19,
    };

    const insight = buildStockInsights(estoqueFixture, [movement], NOW)[0];

    expect(insight).toMatchObject({
      totalOutbound: 10,
      totalPhysicalOutbound: 17,
      totalInbound: 60,
      totalMovement: 77,
      totalSales: 2,
      totalWithdrawals: 15,
      primaryMovementType: 'entry',
    });
  });

  it.each([
    { quantity: 0, outbound: 30, expected: 'out' },
    { quantity: 14, outbound: 30, expected: 'critical' },
    { quantity: 15, outbound: 30, expected: 'low' },
    { quantity: 30, outbound: 30, expected: 'available' },
  ])('classifica $expected respeitando os limites de cobertura', ({ quantity, expected }) => {
    const stock = [{ ...estoqueFixture[0], quantidade_estoque: quantity }];

    expect(buildStockInsights(stock, giroFixture, NOW)[0].status).toBe(expected);
  });

  it('classifica produto com estoque e sem consumo como disponivel', () => {
    const insight = buildStockInsights(estoqueFixture, [], NOW)[0];

    expect(insight).toMatchObject({
      status: 'available',
      operationalMinimum: 0,
      coverageDays: null,
      movementDataAvailable: false,
    });
  });

  it('relaciona movimentos por empresa e produto dentro dos ultimos 90 dias', () => {
    const unrelated = giroFixture.map((row) => ({ ...row, cod_empresa: 2 }));
    const old = { ...giroFixture[0], data_movimento: '2026-05-01' };
    const future = { ...giroFixture[0], data_movimento: '2026-09-02' };

    const insight = buildStockInsights(estoqueFixture, [...giroFixture, ...unrelated, old, future], NOW)[0];

    expect(insight.movements).toHaveLength(2);
    expect(insight.totalOutbound).toBe(30);
  });

  it('inclui registros date-only exatamente no 90o dia civil e exclui o dia anterior', () => {
    const boundary = { ...giroFixture[0], data_movimento: '2026-06-03' };
    const outside = { ...giroFixture[0], data_movimento: '2026-06-02' };

    const insight = buildStockInsights(estoqueFixture, [boundary, outside], NOW)[0];

    expect(insight.movements.map((movement) => movement.data_movimento)).toEqual(['2026-06-03']);
  });

  it('normaliza caixa, acentos e espacos', () => {
    expect(normalizeStockSearch('  Transmissão  ')).toBe('transmissao');
  });

  it.each(['101', 'kit embreagem', 'zf', 'embreagem', 'linha pesada', 'caminhoes', 'ZF-101', '101-A', 'GM-101'])(
    'busca sem acento em codigo, produto, marca, grupo, linha, aplicacao e referencias: %s',
    (search) => {
      const insight = buildStockInsights(estoqueFixture, giroFixture, NOW)[0];

      expect(filterStockInsights([insight], { search, quickFilter: 'all' })).toHaveLength(1);
    },
  );

  it('aplica filtros dimensionais e rapido sem mutar a entrada', () => {
    const insights = buildStockInsights(estoqueFixtureComTresItens, giroFixture, NOW);
    const snapshot = [...insights];

    const result = filterStockInsights(insights, {
      search: '',
      quickFilter: 'with-stock',
      brands: ['ZF'],
      groups: ['EMBREAGEM'],
      lines: ['Linha pesada'],
    });

    expect(result.map((item) => item.cod_produto)).toEqual([101]);
    expect(insights).toEqual(snapshot);
  });

  it('filtra produtos parados ha mais de 90 dias', () => {
    const insights = buildStockInsights(estoqueFixtureComTresItens, giroFixture, NOW);

    expect(filterStockInsights(insights, { search: '', quickFilter: 'stagnant' }).map((item) => item.cod_produto)).toEqual([
      303,
    ]);
  });

  it('agrupa rupturas, criticos, baixos e parados no filtro de atencao', () => {
    const insights = buildStockInsights(estoqueFixtureComTresItens, giroFixture, NOW);

    expect(filterStockInsights(insights, { search: '', quickFilter: 'attention' }).map((item) => item.cod_produto)).toEqual([
      101,
      202,
      303,
    ]);
  });

  it('reconstroi o saldo anterior desfazendo entrada e saida', () => {
    const insight = buildStockInsights(estoqueFixture, giroEvolucaoFixture, NOW)[0];

    expect(buildStockEvolution(insight)).toEqual([
      { date: '2026-08-30', quantity: 25 },
      { date: '2026-08-31', quantity: 10 },
    ]);
  });

  it('desfaz saida de devolucao na evolucao fisica', () => {
    const movementsWithReturn = [
      giroEvolucaoFixture[0],
      {
        ...giroEvolucaoFixture[1],
        saida_venda: 0,
        saida_devolucao: 7,
        quantidade_movimentada: 7,
      },
    ];
    const insight = buildStockInsights(estoqueFixture, movementsWithReturn, NOW)[0];

    expect(buildStockEvolution(insight)).toEqual([
      { date: '2026-08-30', quantity: 17 },
      { date: '2026-08-31', quantity: 10 },
    ]);
  });

  it('agrupa a evolucao por dia sem mutar os movimentos', () => {
    const duplicatedDay = giroEvolucaoFixture.map((row) => ({ ...row, data_movimento: '2026-08-31' }));
    const insight = buildStockInsights(estoqueFixture, duplicatedDay, NOW)[0];
    const snapshot = [...insight.movements];

    expect(buildStockEvolution(insight)).toEqual([{ date: '2026-08-31', quantity: 10 }]);
    expect(insight.movements).toEqual(snapshot);
  });

  it.each([
    ['increasing', [10, 12, 12, 15]],
    ['decreasing', [15, 12, 12, 10]],
    ['stagnant', [10, 10, 10]],
    ['irregular', [10, 13, 11]],
  ] as const)('classifica tendencia %s por variacao diaria', (expected, quantities) => {
    const points = quantities.map((quantity, index) => ({
      date: `2026-08-${String(index + 1).padStart(2, '0')}`,
      quantity,
    }));

    expect(classifyStockTrend(points)).toBe(expected);
  });

  it('mantem produto sem data fora das faixas de inatividade', () => {
    const semDatas = estoqueFixture.map((item) => ({
      ...item,
      data_ultima_compra: null,
      data_ultima_venda: null,
      data_ultima_transferencia: null,
    }));

    const insight = buildStockInsights(semDatas, [], NOW)[0];

    expect(insight.stagnantDays).toBe(0);
    expect(insight.lastMovementDate).toBeNull();
  });

  it.each([
    ['stock-asc', [0, 10, 80]],
    ['stock-desc', [80, 10, 0]],
  ] as const)('ordena por estoque com %s sem mutar a entrada', (mode, expected) => {
    const original = buildStockInsights(estoqueFixtureComTresItens, giroFixture, NOW);
    const snapshot = [...original];

    const result = sortStockInsights(original, mode);

    expect(result.map((item) => item.quantidade_estoque)).toEqual(expected);
    expect(original).toEqual(snapshot);
  });

  it.each([
    ['product', [202, 101, 303]],
    ['brand', [202, 303, 101]],
    ['last-movement', [101, 202, 303]],
  ] as const)('ordena por %s', (mode, expected) => {
    const insights = buildStockInsights(estoqueFixtureComTresItens, giroFixture, NOW);

    expect(sortStockInsights(insights, mode).map((item) => item.cod_produto)).toEqual(expected);
  });
});
