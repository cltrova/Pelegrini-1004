import { describe, expect, it } from 'vitest';
import {
  createLocalPreviewEmpresa,
  createLocalPreviewPermissions,
  createLocalPreviewUserAccount,
  deleteLocalPreviewUserAccount,
  getActiveLocalPreviewUserAccount,
  isLocalPreviewEnabled,
  readLocalPreviewEmpresa,
  readLocalPreviewMotivosPerda,
  readLocalPreviewUserAccounts,
  saveLocalPreviewEmpresa,
  saveLocalPreviewMotivoPerda,
  saveLocalPreviewUserAccount,
  setActiveLocalPreviewUserAccount,
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
      endpoint_path_comercial_cotacoes_abertas_ch: '/comercial/cotacoes_abertas_ch',
      endpoint_path_comercial_vendas_perdidas_ch: '/comercial/vendas_perdidas_ch',
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

  it('cria, lista e seleciona usuario local de preview', () => {
    const storage = new Map<string, string>();
    const localStorageLike = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    };

    const user = createLocalPreviewUserAccount({
      email: 'gerente@pelegrini.test',
      nome: 'Gerente Pelegrini',
      role: 'gerencial',
      codEmpresaBi: '1004',
      permissions: {
        ...createLocalPreviewPermissions(),
        modulo_whatsapp: false,
      },
    });

    saveLocalPreviewUserAccount(user, localStorageLike);
    setActiveLocalPreviewUserAccount(user.user.id, localStorageLike);

    expect(readLocalPreviewUserAccounts(localStorageLike)).toHaveLength(2);
    expect(getActiveLocalPreviewUserAccount(localStorageLike)).toMatchObject({
      profile: {
        email: 'gerente@pelegrini.test',
        nome: 'Gerente Pelegrini',
      },
      roles: ['gerencial'],
      permissions: expect.objectContaining({
        modulo_whatsapp: false,
        modulo_comercial: true,
      }),
    });

    deleteLocalPreviewUserAccount(user.user.id, localStorageLike);
    expect(readLocalPreviewUserAccounts(localStorageLike).map((account) => account.user.id)).not.toContain(user.user.id);
  });

  it('persiste motivos de vendas perdidas localmente para a empresa 10041', () => {
    const storage = new Map<string, string>();
    const localStorageLike = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };

    const primeiroRegistro = saveLocalPreviewMotivoPerda({
      cod_empresa_bi: '10041',
      id_cotacao: '9012',
      motivo: 'preco',
      observacao: null,
      created_by: 'user-1',
    }, localStorageLike);
    const registroAtualizado = saveLocalPreviewMotivoPerda({
      cod_empresa_bi: '10041',
      id_cotacao: '9012',
      motivo: 'outro',
      observacao: 'Cliente fechou com concorrente.',
      created_by: 'user-1',
    }, localStorageLike);

    expect(registroAtualizado.id).toBe(primeiroRegistro.id);
    expect(readLocalPreviewMotivosPerda(localStorageLike)).toMatchObject([{
      cod_empresa_bi: '10041',
      id_cotacao: '9012',
      motivo: 'outro',
      observacao: 'Cliente fechou com concorrente.',
      created_by: 'user-1',
    }]);
  });
});
