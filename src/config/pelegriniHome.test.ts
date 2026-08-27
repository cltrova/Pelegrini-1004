import { describe, expect, it } from 'vitest';
import { getPelegriniBranchAvailability, pelegriniAdminEntry, pelegriniBrand, pelegriniModules } from './pelegriniHome';

describe('pelegriniHome config', () => {
  it('uses Pelegrini as the visible product brand', () => {
    expect(pelegriniBrand.name).toBe('Pelegrini');
    expect(pelegriniBrand.headline).toContain('Pelegrini');
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

  it('uses automotive module copy and removes template residue', () => {
    const serialized = JSON.stringify({ pelegriniBrand, pelegriniModules, pelegriniAdminEntry });

    expect(serialized).toContain('Pedidos');
    expect(serialized).toContain('Estoque');
    expect(serialized).toContain('Cobranca');
    expect(serialized).not.toContain('Powered by React');
    expect(serialized).not.toContain('BI Reports');
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

  it('disables unavailable branch choices while keeping the local preview branches available', () => {
    expect(getPelegriniBranchAvailability({
      codEmpresa: null,
      isMaster: false,
      filiaisPermitidas: [],
      filialPadrao: null,
    })).toEqual({});

    expect(getPelegriniBranchAvailability({
      codEmpresa: '1004',
      isMaster: true,
      filiaisPermitidas: [],
      filialPadrao: null,
    })).toEqual({
      transmissao: true,
      chevrolet: true,
    });
  });
});
