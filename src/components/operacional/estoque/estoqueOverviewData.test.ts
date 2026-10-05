import { describe, expect, it } from 'vitest';
import type { EstoqueRecord, GiroRecord } from '@/types/estoque';
import { buildStockOverviewProducts, buildStockOverviewSummary } from './estoqueOverviewData';
const stock = (code: number, bi = 1004, branch = 1) => ({ cod_produto: code, cod_empresa_bi: bi, cod_empresa: branch, quantidade_estoque: 10, valor_estoque: 100, marca: 'EATON', grupo: 'CAMBIO', empresa: 'CT' } as EstoqueRecord);
const move = (code: number, day: string, quantity: number, bi = 1004, branch = 1) => ({cod_produto:code,cod_empresa_bi:bi,cod_empresa:branch,data_movimento:day,quantidade_movimentada:quantity,valor_venda:quantity*20,tipo_movimento:'Venda',marca:'EATON',grupo:'CAMBIO',empresa:'CT'} as GiroRecord);
const now = new Date('2026-10-05T12:00:00Z');
describe('reconciliacao da analise', () => {
 it('separa produto igual de filiais e exclui Forca P', () => {
  const rows=buildStockOverviewProducts([stock(1),stock(1,1004,2),stock(2,80,80)], [move(1,'2026-09-01',3),move(1,'2026-09-01',7,1004,2),move(2,'2026-09-01',99,80,80)],3,1004,now);
  expect(rows).toHaveLength(2);expect(rows.map(r=>r.total_vendas)).toEqual([3,7]);
 });
 it('aplica o mesmo produto e periodo ao grafico e aos totais', () => {
  const movements=[move(1,'2026-08-01',2),move(1,'2026-09-01',3),move(2,'2026-09-01',100),move(1,'2026-07-01',500)];
  const rows=buildStockOverviewProducts([stock(1)],movements,3,1004,now).filter(r=>r.cod_produto===1);
  const summary=buildStockOverviewSummary(rows,movements,3,now);
  expect(summary.sales).toBe(5);expect(summary.months.map(m=>m.vendas)).toEqual([2,3,0]);
  expect(summary.months.map(m=>m.valor)).toEqual([40,60,0]);
  expect(summary.movements).toBe(5);
 });
 it('usa o mes local ao atravessar a virada de mes em UTC', () => {
  const localEndOfMonth = new Date(2026,8,30,23,0);
  const movements=[move(1,'2026-09-01',3)];
  const products=buildStockOverviewProducts([stock(1)],movements,1,1004,localEndOfMonth);
  const summary=buildStockOverviewSummary(products,movements,1,localEndOfMonth);
  expect(summary.sales).toBe(3);
  expect(summary.months[0].mes).toBe('09/26');
 });
 it('mantem devolucoes negativas e valores reais de compra', () => {
  const movements=[move(1,'2026-09-01',-2), {...move(1,'2026-09-01',4),tipo_movimento:'Compra'}];
  const products=buildStockOverviewProducts([stock(1)],movements,3,1004,now);
  const summary=buildStockOverviewSummary(products,movements,3,now);
  expect(summary.sales).toBe(-2);expect(summary.months[1]).toMatchObject({vendas:-2,compras:4,valor:-40,valor_compras:80});
 });
});
