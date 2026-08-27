import { describe, expect, it } from 'vitest';
import {
  CLIENTE_COD_EMPRESA_BI_CHEVROLET,
  CLIENTE_COD_EMPRESA_BI_PADRAO,
  assertCliente1004,
  getCliente1004EmpresaFallback,
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

  it('mantem fallback de fonte da VPS para os codigos Pelegrini', () => {
    const transmissao = getCliente1004EmpresaFallback('1004');
    const chevrolet = getCliente1004EmpresaFallback('10041');

    expect(transmissao).toMatchObject({
      cod_empresa_bi: '1004',
      nome: 'Casa da Transmissão',
      modulo_comercial: true,
      usar_vps_intermediaria: true,
      vps_base_url: 'http://187.77.203.16',
      vps_cliente_identificador: 'pelegrini',
      endpoint_path_comercial_pedidos: '/comercial/pedidos',
      endpoint_path_comercial_devolucoes: '/comercial/devolucoes',
      endpoint_path_comercial_produtos: '/comercial/produtos',
      endpoint_path_comercial_pedidos_ch: '/comercial/pedidos_ch',
      endpoint_path_comercial_devolucoes_ch: '/comercial/devolucoes_ch',
      endpoint_path_comercial_produtos_ch: '/comercial/produtos_ch',
    });
    expect(chevrolet).toMatchObject({
      cod_empresa_bi: '10041',
      nome: 'Casa da Chevrolet',
      usar_vps_intermediaria: true,
      vps_cliente_identificador: 'pelegrini',
    });
    expect(getCliente1004EmpresaFallback('1001')).toBeNull();
  });
});
