import { describe, expect, it } from 'vitest';
import { getFilialAccessState, normalizeFiliaisPermitidas } from './filialAccess';

describe('filialAccess', () => {
  it('allows master users to access all Pelegrini 1004 branches', () => {
    const state = getFilialAccessState({
      codEmpresa: '1004',
      isMaster: true,
      filiaisPermitidas: [],
      filialPadrao: null,
    });

    expect(state.available.map((f) => f.id)).toEqual(['transmissao', 'chevrolet']);
    expect(state.blocked).toEqual([]);
    expect(state.hasAnyAccess).toBe(true);
  });

  it('keeps both Pelegrini 1004 branches visible while blocking unauthorized branches', () => {
    const state = getFilialAccessState({
      codEmpresa: '1004',
      isMaster: false,
      filiaisPermitidas: ['transmissao'],
      filialPadrao: null,
    });

    expect(state.items).toEqual([
      expect.objectContaining({ id: 'transmissao', blocked: false }),
      expect.objectContaining({ id: 'chevrolet', blocked: true }),
    ]);
    expect(state.available.map((f) => f.id)).toEqual(['transmissao']);
    expect(state.blocked.map((f) => f.id)).toEqual(['chevrolet']);
    expect(state.hasAnyAccess).toBe(true);
  });

  it('shows all Pelegrini 1004 branches as blocked when the user has no branch access', () => {
    const state = getFilialAccessState({
      codEmpresa: '1004',
      isMaster: false,
      filiaisPermitidas: [],
      filialPadrao: null,
    });

    expect(state.items).toEqual([
      expect.objectContaining({ id: 'transmissao', blocked: true }),
      expect.objectContaining({ id: 'chevrolet', blocked: true }),
    ]);
    expect(state.available).toEqual([]);
    expect(state.hasAnyAccess).toBe(false);
  });

  it('uses legacy filial_id as access when filiais_permitidas was not configured yet', () => {
    expect(normalizeFiliaisPermitidas(undefined, 'chevrolet')).toEqual(['chevrolet']);
  });
});
