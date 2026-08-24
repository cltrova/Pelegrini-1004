import { describe, expect, it } from 'vitest';
import { filtrarEstoqueCasaChevrolet10041, isAgraleEstoque10041 } from './estoque10041';

describe('filtrarEstoqueCasaChevrolet10041', () => {
  it('remove Agrale e registros de outra empresa no estoque do cliente 10041', () => {
    const rows = [
      { cod_empresa_bi: 10041, marca: 'CHEVROLET', produto: 'Filtro' },
      { cod_empresa_bi: 10041, marca: 'Agrale', produto: 'Peca Agrale' },
      { cod_empresa_bi: 1004, marca: 'CHEVROLET', produto: 'Item CT' },
      { cod_empresa_bi: '', marca: 'MWM', produto: 'Sem cod BI' },
    ];

    expect(filtrarEstoqueCasaChevrolet10041(rows, '10041')).toEqual([
      { cod_empresa_bi: 10041, marca: 'CHEVROLET', produto: 'Filtro' },
      { cod_empresa_bi: '', marca: 'MWM', produto: 'Sem cod BI' },
    ]);
  });

  it('nao altera estoque de outros clientes', () => {
    const rows = [
      { cod_empresa_bi: 1004, marca: 'Agrale', produto: 'Item CT' },
    ];

    expect(filtrarEstoqueCasaChevrolet10041(rows, '1004')).toEqual(rows);
  });

  it('identifica Agrale sem depender de acentos ou caixa', () => {
    expect(isAgraleEstoque10041({ marca: 'AGRALE' })).toBe(true);
    expect(isAgraleEstoque10041({ marca: 'Linha Agrale Pecas' })).toBe(true);
    expect(isAgraleEstoque10041({ marca: 'CHEVROLET' })).toBe(false);
  });
});
