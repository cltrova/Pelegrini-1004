import { describe, expect, it } from 'vitest';
import { pelegriniAdminEntry, pelegriniBrand, pelegriniModules } from './pelegriniHome';

describe('pelegriniHome config', () => {
  it('uses Pelegrini as the visible product brand', () => {
    expect(pelegriniBrand.name).toBe('Pelegrini');
    expect(pelegriniBrand.subtitle).toBe('Painel modular de gestao');
    expect(pelegriniBrand.footer).toContain('Pelegrini');
  });

  it('defines the four main Pelegrini modules in order', () => {
    expect(pelegriniModules.map((module) => module.title)).toEqual([
      'WhatsApp',
      'Comercial',
      'Operacional',
      'Financeiro',
    ]);
  });

  it('keeps each module connected to an entry route and permission key', () => {
    expect(pelegriniModules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'WhatsApp', path: '/whatsapp', moduloKey: 'whatsapp' }),
        expect.objectContaining({ title: 'Comercial', path: '/comercial/dashboard', moduloKey: 'comercial' }),
        expect.objectContaining({ title: 'Operacional', path: '/operacional/estoque', moduloKey: 'operacional' }),
        expect.objectContaining({ title: 'Financeiro', path: '/financeiro', moduloKey: 'financeiro' }),
      ]),
    );
  });

  it('defines a configuration entry for endpoint setup', () => {
    expect(pelegriniAdminEntry).toMatchObject({
      title: 'Configuracoes',
      path: '/configuracoes',
    });
    expect(pelegriniAdminEntry.features).toContain('Endpoints');
  });
});
