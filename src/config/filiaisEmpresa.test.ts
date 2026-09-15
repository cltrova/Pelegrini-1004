import { describe, expect, it } from 'vitest';

import { EQUIPE_CHEVROLET_PELEGRINI } from './filiaisEmpresa';

describe('equipe da Casa da Chevrolet', () => {
  it('nao inclui vendedores identificados como Forca P', () => {
    expect(EQUIPE_CHEVROLET_PELEGRINI).not.toContain('DAYVID');
  });
});
