import { describe, expect, it } from 'vitest';
import {
  getSelecaoVisualVendedorFilter1004,
  shouldShowVendedorGroupTabs1004,
  toggleSelecaoVisualVendedorFilter1004,
} from './VendedorFilter1004';

describe('VendedorFilter1004 selection state', () => {
  it('marca todos visualmente quando o modo Todos esta ativo', () => {
    expect(getSelecaoVisualVendedorFilter1004('todos', [], ['8', '10', '47'])).toEqual(['8', '10', '47']);
  });

  it('ao clicar em um vendedor no modo Todos, remove apenas ele da selecao visual', () => {
    expect(toggleSelecaoVisualVendedorFilter1004('todos', [], ['8', '10', '47'], '10')).toEqual(['8', '47']);
  });

  it('esconde abas Equipe e Comiss no contexto Chevrolet 10041', () => {
    expect(shouldShowVendedorGroupTabs1004('chevrolet')).toBe(false);
    expect(shouldShowVendedorGroupTabs1004('transmissao')).toBe(true);
  });
});
