import { describe, expect, it } from 'vitest';

import type { GiroRecord } from '@/types/estoque';
import { buildEstoqueFallbackFromGiro, withEstoqueCompanyCode } from './useEstoqueData';

const giro: GiroRecord = {
  cod_empresa_bi: null as unknown as number,
  empresa: 'CASA DA TRANSMISSAO MOTORES E PECAS LTDA',
  cod_empresa: 1,
  data_movimento: '2026-08-31T00:00:00',
  cod_produto: 23,
  produto: 'CALCO CAMISA 0,40',
  cod_fabricante: '10227',
  cod_marca: '49',
  marca: 'MWM',
  cod_grupo: 20000,
  grupo: 'MWM SERIE-10/12',
  saida_venda: 4,
  saida_transferencia: 0,
  saida_outras: 0,
  saida_devolucao: 0,
  entrada_compra: 10,
  entrada_transferencia: 0,
  entrada_outras: 0,
  entrada_devolucao: 0,
  valor_total_movimento: 600,
  valor_venda: 400,
  quantidade_movimentada: 14,
  valor_estoque: 627.7656,
  quantidade_estoque: 22,
  tipo_movimento: 'MOVIMENTO',
  cod_linha: 'PESADA',
  linha: 'Linha pesada',
};

describe('buildEstoqueFallbackFromGiro', () => {
  it('recupera quantidade e valor atuais quando o endpoint principal de estoque falha', () => {
    expect(buildEstoqueFallbackFromGiro([giro], '1004')).toEqual([
      expect.objectContaining({
        cod_empresa_bi: 1004,
        cod_empresa: 1,
        cod_produto: 23,
        produto: 'CALCO CAMISA 0,40',
        marca: 'MWM',
        grupo: 'MWM SERIE-10/12',
        quantidade_estoque: 22,
        valor_estoque: 627.7656,
        data_ultima_venda: '2026-08-31T00:00:00',
        data_ultima_compra: '2026-08-31T00:00:00',
        tipo_relatorio: 'GIRO API - CONTINGENCIA',
      }),
    ]);
  });

  it('mantem apenas o registro mais recente de cada produto', () => {
    const antigo = {
      ...giro,
      data_movimento: '2026-07-01T00:00:00',
      quantidade_estoque: 3,
      valor_estoque: 90,
    };

    const result = buildEstoqueFallbackFromGiro([antigo, giro], '1004');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ quantidade_estoque: 22, valor_estoque: 627.7656 });
  });

  it('nao reaproveita dados identificados como CT na Casa do Chevrolet', () => {
    expect(buildEstoqueFallbackFromGiro([giro], '10041')).toEqual([]);
  });
});

describe('withEstoqueCompanyCode', () => {
  it('envia a filial Chevrolet como 10041 sem perder outros filtros', () => {
    expect(withEstoqueCompanyCode('/operacional/estoque/giro?data_ini=2026-06-01', '10041'))
      .toBe('/operacional/estoque/giro?data_ini=2026-06-01&cod_empresa_bi=10041');
  });

  it('substitui um codigo antigo em vez de duplicar o parametro', () => {
    expect(withEstoqueCompanyCode('/operacional/estoque?cod_empresa_bi=1004&modo=detalhado', '10041'))
      .toBe('/operacional/estoque?cod_empresa_bi=10041&modo=detalhado');
  });
});
