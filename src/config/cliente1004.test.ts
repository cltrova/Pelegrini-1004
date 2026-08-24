import { describe, expect, it } from 'vitest';
import {
  CLIENTE_COD_EMPRESA_BI_CHEVROLET,
  CLIENTE_COD_EMPRESA_BI_PADRAO,
  assertCliente1004,
  isCliente1004,
  resolveCliente1004,
} from './cliente1004';

describe('cliente1004 config', () => {
  it('aceita os codigos da Pelegrini', () => {
    expect(CLIENTE_COD_EMPRESA_BI_PADRAO).toBe('1004');
    expect(CLIENTE_COD_EMPRESA_BI_CHEVROLET).toBe('10041');
    expect(isCliente1004('1004')).toBe(true);
    expect(isCliente1004('10041')).toBe(true);
    expect(isCliente1004(1004)).toBe(true);
    expect(isCliente1004(10041)).toBe(true);
    expect(resolveCliente1004(10041)).toBe('10041');
  });

  it('bloqueia codigos fora da Pelegrini', () => {
    expect(isCliente1004('1001')).toBe(false);
    expect(isCliente1004('1005')).toBe(false);
    expect(() => assertCliente1004('1004')).not.toThrow();
    expect(() => assertCliente1004('10041')).not.toThrow();
    expect(() => assertCliente1004('1001')).toThrow('Projeto dedicado aceita apenas cod_empresa_bi=1004 ou 10041');
    expect(resolveCliente1004('1001')).toBe('1004');
  });
});
