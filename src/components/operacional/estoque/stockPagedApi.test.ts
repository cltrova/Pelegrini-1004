import { describe, expect, it } from 'vitest';
import { buildStockPageParams, normalizeStockPageRows, validateStockPage, supportsStockColumnFilters, defaultStockPageQuery } from './stockPagedApi';
import { estoqueFixtureComTresItens } from './estoqueFixtures';

const release = 'pelegrini-estoque-colunas-20261109-r15';
const row = { ...estoqueFixtureComTresItens[0], cod_empresa_bi: 10041, cod_empresa: 2, empresa: 'CHEVROLET 2', situacao: 'critical', quantidade_estoque: 2, valor_estoque: 20, quantidade_consolidada: 7, valor_estoque_consolidado: 100, custo_medio_consolidado: 100 / 7, data_ultima_movimentacao: '2026-11-09' };
const page = { release, cod_empresa_bi: 10041, cod_empresas: [2, 3], pagina: 1, tamanho_pagina: 50, total_paginas: 2, total_itens: 80, total_registros: 160, atualizado_em: '', totais: { quantidade_estoque: 500, valor_estoque: 9000 }, opcoes: { grupos: ['MOTOR', 'CAMBIO'], marcas: ['ZF'], linhas: [], filiais: [{ codigo: 2, nome: 'CHEVROLET 2' }, { codigo: 3, nome: 'CHEVROLET 3' }], localizacoes: ['A', 'B'] }, itens: [row, { ...row, cod_empresa: 3, empresa: 'CHEVROLET 3', quantidade_estoque: 5, valor_estoque: 80 }] };

describe('R15 paginated stock contract', () => {
  it('serializes multi selections, independent product search, decimal bounds and dates', () => {
    const params = buildStockPageParams('10041', { ...defaultStockPageQuery(), page: 3, search: 'geral', groups: ['MOTOR', 'CAMBIO'], brands: ['ZF', 'EATON'], columnFilters: { product: { text: '2312' }, branch: { values: ['2', '3'] }, location: { values: ['A', 'B'] }, quantity: { min: '1.234,50', max: '2000' }, value: { min: '1.000' }, averageCost: { max: '45,90' }, lastMovement: { from: '2026-11-01', to: '2026-11-09', dateMode: 'known' }, lastSale: { dateMode: 'unknown' }, status: { values: ['critical', 'low'] } } });
    expect(params.get('formato')).toBe('pagina'); expect(params.get('ordem')).toBe('grupo_marca_produto');
    expect(params.get('pagina')).toBe('3'); expect(params.getAll('grupo')).toEqual(['MOTOR', 'CAMBIO']);
    expect(params.getAll('marca')).toEqual(['ZF', 'EATON']); expect(params.getAll('filial')).toEqual(['2', '3']);
    expect(params.getAll('localizacao')).toEqual(['A', 'B']); expect(params.getAll('situacao')).toEqual(['critical', 'low']);
    expect(params.get('produto')).toBe('2312'); expect(params.get('busca')).toBe('geral');
    expect(params.get('quantidade_min')).toBe('1234.5'); expect(params.get('valor_min')).toBe('1000'); expect(params.get('custo_medio_max')).toBe('45.9');
    expect(params.get('ultima_movimentacao_ini')).toBe('2026-11-01'); expect(params.get('ultima_movimentacao_fim')).toBe('2026-11-09');
    expect(params.get('ultima_movimentacao_sem_data')).toBe('false'); expect(params.get('ultima_venda_sem_data')).toBe('true');
  });
  it('recognizes advertised capabilities instead of requiring the obsolete R11 release', () => {
    expect(supportsStockColumnFilters({ formatos_estoque: ['pagina'], ordenacoes_adicionais: ['grupo_marca_produto'], filtros_coluna: { multipla: ['grupo', 'marca', 'filial', 'localizacao', 'situacao'] } })).toBe(true);
    expect(supportsStockColumnFilters({ release: 'future-but-no-capabilities' })).toBe(false);
  });
  it('deduplicates consolidated products using repeated totals once and preserves official status/date', () => {
    const result = normalizeStockPageRows(validateStockPage(page, '10041'), 'consolidado');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ quantidade_estoque: 7, valor_estoque: 100, custo_medio: 100 / 7, situacao: 'critical', data_ultima_movimentacao: '2026-11-09' });
    expect(normalizeStockPageRows(validateStockPage(page, '10041'), 'detalhado')).toHaveLength(2);
  });
  it('preserves zero consolidated balances and unknown cost without using a branch cost', () => {
    const payload = { ...page, itens: page.itens.map(item => ({ ...item, quantidade_consolidada: 0, valor_estoque_consolidado: 0, custo_medio_consolidado: null })) };
    const result = normalizeStockPageRows(validateStockPage(payload, '10041'), 'consolidado');
    expect(result[0].quantidade_estoque).toBe(0); expect(result[0].valor_estoque).toBe(0);
    expect(result[0].custo_medio_consolidado).toBeNull();
  });
  it('rejects wrong company, foreign origins, foreign options and Força P rows', () => {
    expect(() => validateStockPage(page, '1004')).toThrow();
    expect(() => validateStockPage({ ...page, itens: [{ ...row, cod_empresa: 1 }] }, '10041')).toThrow();
    expect(() => validateStockPage({ ...page, opcoes: { ...page.opcoes, filiais: [{ codigo: 1, nome: 'CT' }] } }, '10041')).toThrow();
    expect(() => validateStockPage({ ...page, itens: [{ ...row, empresa: 'FORCA P' }] }, '10041')).toThrow();
  });
});
