import { describe, expect, it } from 'vitest';
import { buildApiProxyUrl, resolveApiEndpoint } from './apiEndpointResolver';

describe('apiEndpointResolver', () => {
  it('monta endpoint da VPS com identificador do cliente', () => {
    expect(resolveApiEndpoint({
      endpoint_url: 'https://api.cliente.test',
      usar_vps_intermediaria: true,
      vps_base_url: 'http://127.0.0.1:9000',
      vps_cliente_identificador: 'pelegrini',
    } as any, '/comercial/pedidos?data_ini=2026-08-01')).toEqual({
      endpoint: 'http://127.0.0.1:9000',
      path: '/pelegrini/comercial/pedidos?data_ini=2026-08-01',
    });
  });

  it('usa proxy local quando o preview local esta ativo', () => {
    const url = buildApiProxyUrl(
      {
        endpoint_url: 'https://api.cliente.test',
        usar_vps_intermediaria: false,
      } as any,
      '/comercial/pedidos',
      undefined,
      { VITE_LOCAL_PREVIEW: 'true', VITE_SUPABASE_URL: 'https://example.supabase.co' },
    );

    expect(url).toBe('/api-proxy?endpoint=https%3A%2F%2Fapi.cliente.test&path=%2Fcomercial%2Fpedidos');
  });

  it('usa proxy local por padrao quando o env de preview nao foi definido', () => {
    const url = buildApiProxyUrl(
      {
        endpoint_url: 'https://api.cliente.test',
        usar_vps_intermediaria: false,
      } as any,
      '/comercial/pedidos',
      undefined,
      {},
    );

    expect(url).toBe('/api-proxy?endpoint=https%3A%2F%2Fapi.cliente.test&path=%2Fcomercial%2Fpedidos');
  });
});
