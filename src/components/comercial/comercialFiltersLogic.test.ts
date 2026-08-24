import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  toLocalISO,
  computeFimPeriodo,
  getDefaultFilters,
  buildPeriodoUpdate,
  buildLimparFilters,
} from './comercialFiltersLogic';
import type { ComercialFilters as ComercialFiltersType } from '@/types/comercial';

const baseFilters: ComercialFiltersType = {
  anos: [],
  meses: [],
  status: 'todos',
  tipo: 'todos',
  vendedor: 'V1',
  vendedores: ['V1'],
  cliente: 'C1',
};

describe('toLocalISO (borda de fuso horário)', () => {
  it('formata usando componentes LOCAIS, não UTC', () => {
    // 01/07/2026 00:00 local — em UTC-3 seria 30/06 03:00 UTC.
    // toISOString() daria "2026-06-30..." → toLocalISO DEVE devolver 2026-07-01.
    const d = new Date(2026, 6, 1, 0, 0, 0);
    expect(toLocalISO(d)).toBe('2026-07-01');
  });

  it('último dia do mês não escorrega para o dia seguinte', () => {
    const d = new Date(2026, 5, 30, 23, 59, 59); // 30/06/2026
    expect(toLocalISO(d)).toBe('2026-06-30');
  });
});

describe('computeFimPeriodo', () => {
  const hoje = new Date(2026, 6, 13, 10, 0, 0); // 13/07/2026

  it('mês corrente → retorna HOJE (não o último dia do mês)', () => {
    expect(computeFimPeriodo(2026, 7, hoje)).toBe('2026-07-13');
  });

  it('mês passado → retorna último dia do mês (junho tem 30)', () => {
    expect(computeFimPeriodo(2026, 6, hoje)).toBe('2026-06-30');
  });

  it('fevereiro em ano não bissexto → dia 28', () => {
    expect(computeFimPeriodo(2025, 2, hoje)).toBe('2025-02-28');
  });

  it('fevereiro em ano bissexto → dia 29', () => {
    expect(computeFimPeriodo(2024, 2, hoje)).toBe('2024-02-29');
  });

  it('mês futuro → último dia do mês (não hoje)', () => {
    expect(computeFimPeriodo(2026, 8, hoje)).toBe('2026-08-31');
  });

  it('exclui data futura mesmo quando "hoje" é o dia 1 do mês', () => {
    const primeiroDoMes = new Date(2026, 6, 1, 8, 0, 0);
    expect(computeFimPeriodo(2026, 7, primeiroDoMes)).toBe('2026-07-01');
  });
});

describe('getDefaultFilters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mês corrente: início = dia 1 e fim = hoje (não último dia)', () => {
    vi.setSystemTime(new Date(2026, 6, 13, 9, 0, 0)); // 13/07/2026
    const f = getDefaultFilters();
    expect(f.anos).toEqual(['2026']);
    expect(f.meses).toEqual(['07']);
    expect(f.periodo?.inicio).toBe('2026-07-01');
    expect(f.periodo?.fim).toBe('2026-07-13');
    expect(f.status).toBe('todos');
    expect(f.tipo).toBe('todos');
  });

  it('primeiro dia do mês: início === fim === dia 1', () => {
    vi.setSystemTime(new Date(2026, 6, 1, 0, 30, 0));
    const f = getDefaultFilters();
    expect(f.periodo).toEqual({ inicio: '2026-07-01', fim: '2026-07-01' });
  });

  it('vira o ano: janeiro → início 01/01, fim = hoje', () => {
    vi.setSystemTime(new Date(2027, 0, 5, 12, 0, 0));
    const f = getDefaultFilters();
    expect(f.anos).toEqual(['2027']);
    expect(f.meses).toEqual(['01']);
    expect(f.periodo).toEqual({ inicio: '2027-01-01', fim: '2027-01-05' });
  });

  it('não é afetado por periodoDisponivel (assinatura atual ignora)', () => {
    vi.setSystemTime(new Date(2026, 6, 13, 9, 0, 0));
    const f = getDefaultFilters({ ultimoAno: '2025', ultimoMes: '11' });
    expect(f.periodo?.inicio).toBe('2026-07-01');
    expect(f.periodo?.fim).toBe('2026-07-13');
  });
});

describe('buildPeriodoUpdate (updatePeriodo puro)', () => {
  const hoje = new Date(2026, 6, 13, 9, 0, 0); // 13/07/2026

  it('mês corrente único: fim = hoje', () => {
    const r = buildPeriodoUpdate(baseFilters, ['2026'], ['07'], hoje);
    expect(r.periodo).toEqual({ inicio: '2026-07-01', fim: '2026-07-13' });
    expect(r.anos).toEqual(['2026']);
    expect(r.meses).toEqual(['07']);
  });

  it('mês passado único: fim = último dia do mês (inclusivo)', () => {
    const r = buildPeriodoUpdate(baseFilters, ['2026'], ['06'], hoje);
    expect(r.periodo).toEqual({ inicio: '2026-06-01', fim: '2026-06-30' });
  });

  it('vários meses passados: início do menor até fim do maior', () => {
    const r = buildPeriodoUpdate(baseFilters, ['2026'], ['03', '05', '06'], hoje);
    expect(r.periodo).toEqual({ inicio: '2026-03-01', fim: '2026-06-30' });
  });

  it('intervalo cruzando o mês corrente: fim = hoje', () => {
    const r = buildPeriodoUpdate(baseFilters, ['2026'], ['05', '06', '07'], hoje);
    expect(r.periodo).toEqual({ inicio: '2026-05-01', fim: '2026-07-13' });
  });

  it('vários anos: usa menor ano/mes e maior ano/mes', () => {
    const r = buildPeriodoUpdate(baseFilters, ['2025', '2026'], ['02', '06'], hoje);
    expect(r.periodo).toEqual({ inicio: '2025-02-01', fim: '2026-06-30' });
  });

  it('ano completo (12 meses) do ano corrente: fim = 31/12 (maior mês = 12, não corrente)', () => {
    const meses = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    const r = buildPeriodoUpdate(baseFilters, ['2026'], meses, hoje);
    expect(r.periodo).toEqual({ inicio: '2026-01-01', fim: '2026-12-31' });
  });

  it('ano completo de ano passado: fim = 31/12', () => {
    const meses = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    const r = buildPeriodoUpdate(baseFilters, ['2025'], meses, hoje);
    expect(r.periodo).toEqual({ inicio: '2025-01-01', fim: '2025-12-31' });
  });

  it('anos ou meses vazios: NÃO altera periodo, só limpa arrays', () => {
    const inputFilters = { ...baseFilters, periodo: { inicio: '2000-01-01', fim: '2000-01-31' } };
    const r1 = buildPeriodoUpdate(inputFilters, [], ['07'], hoje);
    expect(r1.periodo).toEqual({ inicio: '2000-01-01', fim: '2000-01-31' });
    expect(r1.anos).toEqual([]);
    const r2 = buildPeriodoUpdate(inputFilters, ['2026'], [], hoje);
    expect(r2.meses).toEqual([]);
  });

  it('preserva demais campos do filtro atual (vendedor, cliente, etc.)', () => {
    const r = buildPeriodoUpdate(baseFilters, ['2026'], ['06'], hoje);
    expect(r.vendedor).toBe('V1');
    expect(r.cliente).toBe('C1');
    expect(r.status).toBe('todos');
  });
});

describe('buildLimparFilters (handleLimpar puro)', () => {
  it('mês corrente: reseta vendedor/cliente e período = 01→hoje', () => {
    const hoje = new Date(2026, 6, 13, 9, 0, 0);
    const r = buildLimparFilters(baseFilters, hoje);
    expect(r.anos).toEqual(['2026']);
    expect(r.meses).toEqual(['07']);
    expect(r.vendedor).toBeUndefined();
    expect(r.vendedores).toBeUndefined();
    expect(r.cliente).toBeUndefined();
    expect(r.tipo).toBe('todos');
    expect(r.periodo).toEqual({ inicio: '2026-07-01', fim: '2026-07-13' });
  });

  it('quando "hoje" é 01 do mês, inicio === fim === 01', () => {
    const hoje = new Date(2026, 6, 1, 0, 5, 0);
    const r = buildLimparFilters(baseFilters, hoje);
    expect(r.periodo).toEqual({ inicio: '2026-07-01', fim: '2026-07-01' });
  });

  it('fim de mês (30/06) → fim = 2026-06-30 (não escorrega para julho)', () => {
    const hoje = new Date(2026, 5, 30, 23, 59, 30);
    const r = buildLimparFilters(baseFilters, hoje);
    expect(r.meses).toEqual(['06']);
    expect(r.periodo).toEqual({ inicio: '2026-06-01', fim: '2026-06-30' });
  });
});
