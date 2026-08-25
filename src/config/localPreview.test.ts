import { describe, expect, it } from 'vitest';
import {
  createLocalPreviewEmpresa,
  createLocalPreviewPermissions,
  isLocalPreviewEnabled,
  readLocalPreviewEmpresa,
  saveLocalPreviewEmpresa,
} from './localPreview';

describe('local preview mode', () => {
  it('ativa somente com VITE_LOCAL_PREVIEW=true', () => {
    expect(isLocalPreviewEnabled({ VITE_LOCAL_PREVIEW: 'true' })).toBe(true);
    expect(isLocalPreviewEnabled({ VITE_LOCAL_PREVIEW: 'false' })).toBe(false);
    expect(isLocalPreviewEnabled({})).toBe(false);
  });

  it('cria a empresa Pelegrini 1004 com os quatro modulos principais liberados', () => {
    expect(createLocalPreviewEmpresa()).toMatchObject({
      cod_empresa_bi: '1004',
      nome: 'Pelegrini',
      modulo_whatsapp: true,
      modulo_comercial: true,
      modulo_operacional: true,
      modulo_resumo: true,
      modulo_dre: true,
      modulo_variacao: true,
    });
  });

  it('cria permissoes completas para navegacao nos modulos', () => {
    expect(createLocalPreviewPermissions()).toEqual({
      modulo_whatsapp: true,
      modulo_comercial: true,
      modulo_operacional: true,
      modulo_resumo: true,
      modulo_dre: true,
      modulo_variacao: true,
      modulo_assistente_ia: true,
    });
  });

  it('persiste configuracao local da empresa Pelegrini', () => {
    const storage = new Map<string, string>();
    const localStorageLike = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };

    saveLocalPreviewEmpresa(
      {
        ...createLocalPreviewEmpresa(),
        endpoint_url: 'https://api.pelegrini.test',
        endpoint_path_comercial_pedidos: '/vendas/pedidos',
        usar_vps_intermediaria: true,
        vps_cliente_identificador: 'pelegrini',
      },
      localStorageLike
    );

    expect(readLocalPreviewEmpresa(localStorageLike)).toMatchObject({
      cod_empresa_bi: '1004',
      endpoint_url: 'https://api.pelegrini.test',
      endpoint_path_comercial_pedidos: '/vendas/pedidos',
      usar_vps_intermediaria: true,
      vps_cliente_identificador: 'pelegrini',
    });
  });
});
