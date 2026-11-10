import { describe, expect, it } from 'vitest';
import { buildStockInsights, sortStockInsights } from './estoqueIntelligence';
import { estoqueFixture, NOW } from './estoqueFixtures';
import { columnFilterError, filterStockColumns, stockClassificationOptions, reconcileStockBrands } from './stockColumnFilters';

const base = buildStockInsights(estoqueFixture, [], NOW)[0];
const rows = [
  { ...base, cod_produto: 1, produto: 'Zeta', grupo: 'Motor', marca: 'ZF', quantidade_estoque: 10, valor_estoque: 1234.56, lastMovementDate: '2026-11-06', status: 'available' as const },
  { ...base, cod_produto: 2, produto: 'Bomba', grupo: 'Câmbio', marca: 'ZF', quantidade_estoque: 0, valor_estoque: 0, lastMovementDate: null, status: 'out' as const },
  { ...base, cod_produto: 3, produto: 'Anel', grupo: 'Câmbio', marca: 'Eaton', quantidade_estoque: 5, valor_estoque: 100, lastMovementDate: '2026-10-20', status: 'low' as const },
  { ...base, cod_produto: 4, produto: 'Bucha', grupo: 'Câmbio', marca: 'Eaton', quantidade_estoque: 7, valor_estoque: 140, lastMovementDate: '2026-11-01', status: 'available' as const },
];

describe('stock column filters', () => {
  it('organizes the full list by Grupo, then Marca, then Produto without mutating it', () => {
    expect(sortStockInsights(rows, 'group-brand-product').map(row => row.cod_produto)).toEqual([3, 4, 2, 1]);
    expect(rows.map(row => row.cod_produto)).toEqual([1, 2, 3, 4]);
  });
  it('combines categorical filters, accent-insensitive text, and inclusive numeric boundaries', () => {
    expect(filterStockColumns(rows, { group: { values: ['Câmbio'] }, brand: { values: ['Eaton'] }, quantity: { min: '5', max: '5' }, product: { text: 'anel' } }).map(row => row.cod_produto)).toEqual([3]);
    expect(filterStockColumns(rows, { value: { min: '1.234,56', max: '1234.56' } }).map(row => row.cod_produto)).toEqual([1]);
    expect(filterStockColumns(rows, { quantity: { min: '0', max: '0' } }).map(row => row.cod_produto)).toEqual([2]);
    expect(filterStockColumns(rows, { value: { min: '1.000' } }).map(row => row.cod_produto)).toEqual([1]);
  });
  it('filters complete civil-day intervals and unknown dates explicitly', () => {
    expect(filterStockColumns(rows, { lastMovement: { from: '2026-11-01', to: '2026-11-06' } }).map(row => row.cod_produto)).toEqual([1, 4]);
    expect(filterStockColumns(rows, { lastMovement: { dateMode: 'unknown' } }).map(row => row.cod_produto)).toEqual([2]);
    expect(filterStockColumns(rows, { status: { values: ['out'] } }).map(row => row.cod_produto)).toEqual([2]);
  });
  it('narrows brands by selected groups and removes incompatible previous brands', () => {
    const motor = stockClassificationOptions(rows, ['Motor']);
    expect(motor.brands).toEqual(['ZF']);
    expect(motor.groups).toEqual(['Câmbio', 'Motor']);
    expect(reconcileStockBrands(['Eaton', 'ZF'], motor.brands)).toEqual(['ZF']);
    expect(stockClassificationOptions(rows, []).brands).toEqual(['Eaton', 'ZF']);
  });
  it('validates malformed or inverted ranges before applying them', () => {
    expect(columnFilterError('quantity', { min: 'x' })).toBeTruthy();
    expect(columnFilterError('value', { min: '10', max: '2' })).toBeTruthy();
    expect(columnFilterError('lastSale', { from: '2026-11-06', to: '2026-10-01' })).toBeTruthy();
    expect(columnFilterError('quantity', { min: '0' })).toBeNull();
  });
  it('filters the detailed columns independently without confusing blank locations with numeric zero', () => {
    const detailed = [{ ...rows[0], empresa: 'FILIAL A', localizacao_produto: 'A-01', custo_medio: 0 }, { ...rows[1], empresa: 'FILIAL B', localizacao_produto: '', custo_medio: 5 }];
    expect(filterStockColumns(detailed, { branch: { values: ['FILIAL A'] }, location: { values: ['A-01'] }, averageCost: { min: '0', max: '0' } })).toEqual([detailed[0]]);
  });
});
