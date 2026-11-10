import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EstoqueCommandCenter } from './EstoqueCommandCenter';
import { estoqueFixtureComTresItens, giroFixture } from './estoqueFixtures';

function setup() {
  const onExport = vi.fn();
  render(<EstoqueCommandCenter stockData={estoqueFixtureComTresItens} movementData={giroFixture} branchKey="1004:transmissao" viewMode="consolidado" onViewModeChange={vi.fn()} onExport={onExport} />);
  return onExport;
}
function openColumn(label: string) {
  const header = screen.getByRole('columnheader', { name: new RegExp(label) });
  fireEvent.click(within(header).getByRole('button', { name: `Filtrar ${label}` }));
}
function selectAndApply(label: string, option: string) {
  openColumn(label);
  fireEvent.click(screen.getByRole('checkbox', { name: option }));
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
}

beforeEach(() => window.localStorage.clear());
describe('Central column filter workflow', () => {
  it('exports matches beyond the first page in hierarchy order', () => {
    const onExport = vi.fn();
    const stockData = Array.from({ length: 61 }, (_, index) => ({
      ...estoqueFixtureComTresItens[0], cod_produto: 1000 + index,
      produto: `PRODUTO ${index + 1}`, grupo: 'GRUPO TESTE', marca: 'MARCA TESTE',
    }));
    render(<EstoqueCommandCenter stockData={stockData} movementData={[]} branchKey="1004:transmissao" viewMode="consolidado" onViewModeChange={vi.fn()} onExport={onExport} />);
    selectAndApply('Grupo', 'GRUPO TESTE');
    expect(screen.queryByRole('button', { name: 'Abrir PRODUTO 61' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Baixar lista de produtos' }));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onExport.mock.calls[0][0]).toHaveLength(61);
    expect(onExport.mock.calls[0][0][60]).toMatchObject({ cod_produto: 1060 });
  }, 15000);
  it('shares Grupo and Marca filters, narrows brands and exports the full filtered result', () => {
    const exported = setup();
    expect(screen.getByText('1 Grupo → 2 Marca → 3 Produto')).toBeInTheDocument();
    selectAndApply('Grupo', 'EMBREAGEM');
    openColumn('Marca');
    expect(screen.getByRole('checkbox', { name: 'ZF' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'ACDelco' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'ZF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Baixar lista de produtos' }));
    expect(exported).toHaveBeenCalledWith([expect.objectContaining({ cod_produto: 101 })]);
  });
  it('removes a stale brand when the selected group changes', () => {
    setup();
    selectAndApply('Marca', 'ACDelco');
    selectAndApply('Grupo', 'EMBREAGEM');
    expect(screen.getAllByRole('button', { name: 'Abrir KIT EMBREAGEM PESADA' }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('button', { name: 'Abrir BOMBA D AGUA' })).toHaveLength(0);
  });
  it('keeps the filter accessible with no matches and clearing restores rows', () => {
    setup();
    openColumn('Quantidade');
    fireEvent.change(screen.getByLabelText('Mínimo'), { target: { value: '99999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(screen.queryAllByRole('button', { name: 'Abrir KIT EMBREAGEM PESADA' })).toHaveLength(0);
    openColumn('Quantidade');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtro' }));
    expect(screen.getAllByRole('button', { name: 'Abrir KIT EMBREAGEM PESADA' }).length).toBeGreaterThan(0);
  });
  it('resets additional column filters when changing company context', async () => {
    const props = { stockData: estoqueFixtureComTresItens, movementData: giroFixture, branchKey: '1004:transmissao', viewMode: 'consolidado' as const, onViewModeChange: vi.fn(), onExport: vi.fn() };
    const view = render(<EstoqueCommandCenter {...props} />);
    openColumn('Quantidade');
    fireEvent.change(screen.getByLabelText('Mínimo'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(screen.queryAllByRole('button', { name: 'Abrir BOMBA D AGUA' })).toHaveLength(0);
    view.rerender(<EstoqueCommandCenter {...props} stockData={[estoqueFixtureComTresItens[1]]} movementData={[]} branchKey="10041:chevrolet" />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Abrir BOMBA D AGUA' }).length).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: 'Remover filtro Quantidade' })).not.toBeInTheDocument();
  });
});
