import { describe, expect, it } from 'vitest';

import { stockProductIdentity } from './stockIdentity';

describe('stockProductIdentity', () => {
  it('usa codigo BI e produto sem depender da grafia da empresa', () => {
    expect(stockProductIdentity({ cod_empresa_bi: 1004, cod_empresa: 1, empresa: 'CT', cod_produto: 10 }))
      .toBe(stockProductIdentity({ cod_empresa_bi: 1004, cod_empresa: 99, empresa: 'CASA DA TRANSMISSAO', cod_produto: 10 }));
  });

  it('usa codigo da empresa e depois nome normalizado como fallback seguro', () => {
    expect(stockProductIdentity({ cod_empresa_bi: 0, cod_empresa: 7, empresa: 'Filial A', cod_produto: 10 })).toBe('empresa:7::produto:10');
    expect(stockProductIdentity({ cod_empresa_bi: 0, cod_empresa: 0, empresa: '  Casa da Transmissao  ', cod_produto: 10 }))
      .toBe('nome:CASA DA TRANSMISSAO::produto:10');
  });
});
