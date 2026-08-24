import { describe, expect, it } from 'vitest';
import {
  createLocalPreviewEmpresa,
  createLocalPreviewPermissions,
  isLocalPreviewEnabled,
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
});
