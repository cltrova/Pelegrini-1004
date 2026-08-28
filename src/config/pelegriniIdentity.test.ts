import { describe, expect, it } from 'vitest';
import {
  FORBIDDEN_TEMPLATE_TERMS,
  getPelegriniIdentity,
  getPelegriniModuleIdentity,
} from './pelegriniIdentity';

describe('pelegriniIdentity', () => {
  it('keeps Casa da Transmissao and Casa do Chevrolet visually distinct', () => {
    const ct = getPelegriniIdentity('transmissao');
    const cch = getPelegriniIdentity('chevrolet');

    expect(ct.heroSignal).toContain('Cambio');
    expect(ct.microIndicators).toEqual(expect.arrayContaining(['Cambio', 'Diferencial', 'ZF']));
    expect(cch.heroSignal).toContain('Original');
    expect(cch.microIndicators).toEqual(expect.arrayContaining(['Original GM', 'Desde 1992']));
  });

  it('does not expose template residue in identity copy', () => {
    const text = [
      getPelegriniIdentity('pelegrini'),
      getPelegriniIdentity('transmissao'),
      getPelegriniIdentity('chevrolet'),
      getPelegriniModuleIdentity('whatsapp'),
      getPelegriniModuleIdentity('comercial'),
      getPelegriniModuleIdentity('operacional'),
      getPelegriniModuleIdentity('financeiro'),
    ].map((item) => JSON.stringify(item)).join(' ');

    FORBIDDEN_TEMPLATE_TERMS.forEach((term) => {
      expect(text.toLowerCase()).not.toContain(term.toLowerCase());
    });
  });
});
