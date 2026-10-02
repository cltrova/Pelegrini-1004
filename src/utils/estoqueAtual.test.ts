import { describe, expect, it } from 'vitest';
import { parseEstoqueAtual, filterEstoqueAtualGrupos, estoqueAtualCsv } from './estoqueAtual';

import { payload } from '@/test/estoqueAtualFixture';

describe('relatorio de estoque atual CT', () => {
  it('preserva valores SQL e separa totais gerais do recorte de grupos', () => {
    const report = parseEstoqueAtual(payload);
    expect(report.stockTotal).toBe(3812529.3842);
    expect(report.salesTotal).toBe(82652.79);
    expect(report.groups[0]).toMatchObject({ code: '10100', name: 'EATON MEDIO/PESADO', quantity: 2826, stockValue: 281148.4184, salesQuantity: 76 });
    expect(filterEstoqueAtualGrupos(report.groups, 'eaton')).toHaveLength(1);
    expect(filterEstoqueAtualGrupos(report.groups, '10200')[0].name).toBe('MWM');
    expect(report.stockTotal).not.toBe(report.groups.reduce((sum, row) => sum + row.stockValue, 0));
  });
  it.each([80, 10041])('rejeita outra empresa BI %s', code => {
    expect(() => parseEstoqueAtual({ ...payload, cod_empresa_bi: code })).toThrow();
  });
  it('rejeita Forca P pelo codigo de estoque e metadados', () => {
    expect(() => parseEstoqueAtual({ ...payload, empresa_estoque: 80 })).toThrow();
    expect(() => parseEstoqueAtual({ ...payload, empresa: [{ Empresa: '000080' }] })).toThrow();
  });
  it('rejeita datas retroativas nas movimentacoes e formato de lista legado', () => {
    expect(() => parseEstoqueAtual({ ...payload, periodo_movimentacao: { data_ini: '2026-09-01', data_fim: '2026-10-02' } })).toThrow();
    expect(() => parseEstoqueAtual([])).toThrow();
  });
  it('nao converte total ausente ou numero invalido em zero', () => {
    expect(() => parseEstoqueAtual({ ...payload, totais_estoque: {} })).toThrow();
    expect(() => parseEstoqueAtual({ ...payload, agrupado: [{ ...payload.agrupado[0], 'TotEst.ValorEstoque': null }] })).toThrow();
  });
});

describe('exportacao do relatorio atual', () => {
  it('exporta os valores com precisao original e todas as colunas dos grupos filtrados', () => {
    const groups = filterEstoqueAtualGrupos(parseEstoqueAtual(payload).groups, 'eaton');
    const csv = estoqueAtualCsv(groups);
    expect(csv).toContain('"TotEst.ValorEstoque"');
    expect(csv).toContain('"281148,4184"');
    expect(csv).not.toContain('MWM');
    expect(csv.split('\r\n')).toHaveLength(2);
  });
});
