import { describe, expect, it } from 'vitest';

import { buildDistributorEvolutionPath } from './useDistributorEvolution';

describe('buildDistributorEvolutionPath', () => {
  it('envia o contrato oficial da analise de distribuidores', () => {
    const path = buildDistributorEvolutionPath({
      dataInicio: '2025-09-01',
      dataFim: '2026-08-31',
      marcas: ['MWM', 'EATON', 'ZF', 'CUMMINS', 'MERITOR'],
      considerarPedidosAbertos: true,
      considerarTransferenciaCompra: false,
      imputarTransferenciaVenda: false,
      operacaoFiscalInicial: 0,
      operacaoFiscalFinal: 99999,
    });
    const query = new URLSearchParams(path.split('?')[1]);

    expect(path.split('?')[0]).toBe('/operacional/estoque/evolucao-distribuidores');
    expect(query.get('cod_empresa_bi')).toBe('1004');
    expect(query.get('marcas')).toBe('MWM,EATON,ZF,CUMMINS,MERITOR');
    expect(query.get('custo')).toBe('fornecedor');
    expect(query.get('considerar_pedidos_abertos')).toBe('true');
    expect(query.get('operacao_fiscal_ini')).toBe('0');
    expect(query.get('operacao_fiscal_fim')).toBe('99999');
  });
});
