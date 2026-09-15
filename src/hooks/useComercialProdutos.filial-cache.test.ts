import { describe, expect, it } from 'vitest';
import { resolveProdutosPlaceholderData } from './useComercialProdutos';

describe('cache de produtos por filial', () => {
  const produtosCt = [{ cod_produto: 99, descricao: 'ROLAMENTO CT' }];

  it('nao reaproveita produtos da CT enquanto a consulta da Chevrolet carrega', () => {
    expect(resolveProdutosPlaceholderData(
      produtosCt,
      ['comercial-produtos', '1004', 'transmissao'],
      '1004',
      'chevrolet',
    )).toBeUndefined();
  });

  it('nao reaproveita produtos da Chevrolet enquanto a consulta da CT carrega', () => {
    const produtosChevrolet = [{ cod_produto: 145, descricao: 'CORREIA GM' }];

    expect(resolveProdutosPlaceholderData(
      produtosChevrolet,
      ['comercial-produtos', '1004', 'chevrolet'],
      '1004',
      'transmissao',
    )).toBeUndefined();
  });

  it('pode preservar os produtos ao alterar filtros dentro da mesma filial', () => {
    expect(resolveProdutosPlaceholderData(
      produtosCt,
      ['comercial-produtos', '1004', 'transmissao'],
      '1004',
      'transmissao',
    )).toBe(produtosCt);
  });
});
