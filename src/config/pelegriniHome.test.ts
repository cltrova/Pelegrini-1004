import { describe, expect, it } from 'vitest';
import {
  getPelegriniBranchAvailability,
  getPelegriniVisibleModules,
  pelegriniAdminEntry,
  pelegriniBrand,
  pelegriniModules,
} from './pelegriniHome';

describe('pelegriniHome config', () => {
  it('uses branch houses as the visible entry identity instead of generic Pelegrini chrome', () => {
    expect(pelegriniBrand.name).toBe('Operação CT/CCH');
    expect(pelegriniBrand.headline).toContain('Casa da Transmissão');
    expect(pelegriniBrand.headline).toContain('Casa do Chevrolet');
    expect(pelegriniBrand.footer).not.toContain('Pelegrini');
  });

  it('defines the four main Pelegrini modules in order', () => {
    expect(pelegriniModules.map((module) => module.title)).toEqual([
      'WhatsApp',
      'Comercial',
      'Operacional',
      'Financeiro',
      'E-Commerce',
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
        expect.objectContaining({
          title: 'E-Commerce',
          path: '/ecommerce',
          moduloKey: 'ecommerce',
          branchOnly: 'chevrolet',
        }),
      ]),
    );
  });

  it('hides WhatsApp from the module chooser without removing its route configuration', () => {
    expect(getPelegriniVisibleModules().map((module) => module.title)).toEqual([
      'Comercial',
      'Operacional',
      'Financeiro',
    ]);
    expect(pelegriniModules.find((module) => module.moduloKey === 'whatsapp')).toMatchObject({
      path: '/whatsapp',
      hidden: true,
    });
  });

  it('exposes E-Commerce only for the Casa do Chevrolet branch', () => {
    expect(getPelegriniVisibleModules('chevrolet').map((module) => module.title)).toContain('E-Commerce');
    expect(getPelegriniVisibleModules('transmissao').map((module) => module.title)).not.toContain('E-Commerce');
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
