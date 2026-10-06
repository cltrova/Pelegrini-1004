import { describe, expect, it } from 'vitest';
import { resolveCotacoesFilial } from './cotacoesFilial';

describe('resolveCotacoesFilial', () => {
  it('resolve a Casa da Transmissão na empresa 1004', () => {
    expect(resolveCotacoesFilial('1004', 'transmissao')).toEqual({
      filialId: 'transmissao',
      nome: 'Casa da Transmissão',
      codigoEmpresaBi: '1004',
      logoSrc: '/brand/casa-transmissao.png',
      logoAlt: 'Logo Casa da Transmissão',
    });
  });

  it.each(['1004', '10041'])('resolve a Casa do Chevrolet na empresa %s', codEmpresa => {
    expect(resolveCotacoesFilial(codEmpresa, 'chevrolet')).toEqual({
      filialId: 'chevrolet',
      nome: 'Casa do Chevrolet',
      codigoEmpresaBi: '10041',
      logoSrc: '/brand/casa-chevrolet-wordmark.png',
      logoAlt: 'Logo Casa do Chevrolet',
    });
  });

  it('não resolve empresa sem suporte', () => {
    expect(resolveCotacoesFilial('1005', 'chevrolet')).toBeNull();
  });

  it('não escolhe filial implicitamente na empresa 1004', () => {
    expect(resolveCotacoesFilial('1004', null)).toBeNull();
  });

  it('não resolve filial incompatível com a empresa', () => {
    expect(resolveCotacoesFilial('10041', 'transmissao')).toBeNull();
    expect(resolveCotacoesFilial('1004', 'outra')).toBeNull();
  });
});
