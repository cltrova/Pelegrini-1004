import { describe, expect, it } from 'vitest';
import { getCorParticipacaoVendedor } from './VisaoGeralRapida1004';

describe('getCorParticipacaoVendedor', () => {
  it('usa rosa de alto contraste para Elielton em qualquer posicao', () => {
    expect(getCorParticipacaoVendedor('ELIELTON', 0)).toBe('#db2777');
    expect(getCorParticipacaoVendedor('Elielton', 5)).toBe('#db2777');
  });
});
