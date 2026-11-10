import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { EstoqueCommandCenter } from './EstoqueCommandCenter';
import { estoqueFixtureComTresItens } from './estoqueFixtures';
import { defaultStockPageQuery, type PelegriniStockPage } from './stockPagedApi';

beforeEach(() => window.localStorage.clear());
const page: PelegriniStockPage = { release: 'r15', cod_empresa_bi: 1004, cod_empresas: [1], atualizado_em: '', pagina: 2, tamanho_pagina: 50, total_paginas: 3, total_itens: 125, total_registros: 125, totais: { quantidade_estoque: 900, valor_estoque: 10000 }, opcoes: { grupos: ['FORA DA PAGINA', 'EMBREAGEM'], marcas: ['MARCA GLOBAL', 'ZF'], linhas: [], filiais: [{ codigo: 1, nome: 'CT' }], localizacoes: ['A', 'B'] }, itens: [] };
const stockData = estoqueFixtureComTresItens.slice(0, 2).map(row => ({ ...row, situacao: 'critical' as const }));
function setup() {
  const change = vi.fn();
  const props = { stockData, movementData: [], branchKey: '1004:transmissao', viewMode: 'consolidado' as const, onViewModeChange: vi.fn(), onExport: vi.fn(), serverPaged: true, stockColumnFiltersSupported: true, serverPage: page, stockPageQuery: { ...defaultStockPageQuery(), page: 2 }, onStockPageQueryChange: change };
  return { change, props, view: render(<EstoqueCommandCenter {...props} />) };
}
function open(label: string) { fireEvent.click(within(screen.getByRole('columnheader', { name: new RegExp(label) })).getByRole('button', { name: `Filtrar ${label}` })); }

it('uses global counts, official status and global options while requesting filters from page one', async () => {
  const { change } = setup();
  expect(screen.getByText('125 produto(s)')).toBeInTheDocument();
  expect(screen.getAllByLabelText('Situacao: Critico').length).toBeGreaterThan(0);
  expect(screen.getByText('Pagina 2 de 3')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ordenar por Grupo' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Baixar página de produtos' })).toBeInTheDocument();
  open('Grupo'); fireEvent.click(screen.getByRole('checkbox', { name: 'FORA DA PAGINA' }));
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
  await waitFor(() => expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, groups: ['FORA DA PAGINA'], sortMode: 'group-brand-product' })));
  // Awaiting a global response must not locally discard the current page or its headers.
  expect(screen.getAllByRole('button', { name: `Abrir ${stockData[0].produto}` }).length).toBeGreaterThan(0);
  open('Marca'); expect(screen.getByRole('checkbox', { name: 'MARCA GLOBAL' })).toBeInTheDocument();
});

it('requests server pagination and preserves header filters when no rows match', () => {
  const { change, props, view } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Proxima pagina' }));
  expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));
  view.rerender(<EstoqueCommandCenter {...props} stockData={[]} serverPage={{ ...page, total_itens: 0, total_paginas: 0, pagina: 1 }} />);
  expect(screen.getByText('0 produto(s)')).toBeInTheDocument();
  open('Quantidade'); expect(screen.getByLabelText('Mínimo')).toBeInTheDocument();
});
