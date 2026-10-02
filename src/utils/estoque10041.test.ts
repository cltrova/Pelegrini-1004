import { describe, expect, it } from 'vitest';
import { filtrarEstoqueCasaChevrolet10041, isAgraleEstoque10041 } from './estoque10041';

describe('filtrarEstoqueCasaChevrolet10041', () => {
  it('remove Agrale e registros de outra empresa no estoque do cliente 10041', () => {
    const rows = [
      { cod_empresa_bi: 10041, marca: 'CHEVROLET', produto: 'Filtro' },
      { cod_empresa_bi: 10041, marca: 'Agrale', produto: 'Peca Agrale' },
      { cod_empresa_bi: 1004, marca: 'CHEVROLET', produto: 'Item CT' },
      { cod_empresa_bi: '', empresa: 'CASA DA TRANSMISSAO MOTORES E PECAS LTDA', marca: 'MWM', produto: 'Base compartilhada' },
    ];

    expect(filtrarEstoqueCasaChevrolet10041(rows, '10041')).toEqual([
      { cod_empresa_bi: 10041, marca: 'CHEVROLET', produto: 'Filtro' },
      { cod_empresa_bi: '', empresa: 'CASA DA TRANSMISSAO MOTORES E PECAS LTDA', marca: 'MWM', produto: 'Base compartilhada' },
    ]);
  });

  it('recorta CT sem misturar registros identificados como CCH e preserva payload sem codigo', () => {
    const rows = [
      { cod_empresa_bi: 1004, marca: 'Agrale', produto: 'Item CT' },
      { cod_empresa_bi: 10041, marca: 'CHEVROLET', produto: 'Item CCH' },
      { cod_empresa_bi: '', empresa: '', marca: 'MWM', produto: 'Sem codigo' },
    ];

    expect(filtrarEstoqueCasaChevrolet10041(rows, '1004')).toEqual([
      { cod_empresa_bi: 1004, marca: 'Agrale', produto: 'Item CT' },
      { cod_empresa_bi: '', empresa: '', marca: 'MWM', produto: 'Sem codigo' },
    ]);
  });

  it('identifica Agrale sem depender de acentos ou caixa', () => {
    expect(isAgraleEstoque10041({ marca: 'AGRALE' })).toBe(true);
    expect(isAgraleEstoque10041({ marca: 'Linha Agrale Pecas' })).toBe(true);
    expect(isAgraleEstoque10041({ marca: 'CHEVROLET' })).toBe(false);
  });
});

// Forca P nunca participa das fontes de estoque usadas pela interface.
describe('exclusao Forca P do estoque', () => {
  it.each(['1004', '10041'])('remove codigo 80 e nomes Forca P antes dos totais em %s', code => {
    const rows = [
      { cod_empresa_bi: Number(code), cod_empresa: 1, empresa: 'CASA DA TRANSMISSAO', produto: 'Permitido' },
      { cod_empresa_bi: Number(code), cod_empresa: 80, empresa: 'Outra', produto: 'Bloqueado codigo' },
      { cod_empresa_bi: Number(code), cod_empresa: 3, empresa: 'Força P. LTDA', produto: 'Bloqueado nome' },
      { CodEmpresa_bi: Number(code), CodEmpresa: '000080', produto: 'Bloqueado variante' },
    ];
    expect(filtrarEstoqueCasaChevrolet10041(rows, code).map(row => row.produto)).toEqual(['Permitido']);
  });
});
