import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StockColumnFilter } from './StockColumnFilter';

describe('StockColumnFilter', () => {
  it('keeps selections local until Aplicar and reopens with the applied selection', () => {
    const change = vi.fn();
    const options = [{ value: 'Câmbio', label: 'Câmbio' }, { value: 'Motor', label: 'Motor' }];
    const view = render(<StockColumnFilter column="group" label="Grupo" value={{}} options={options} onChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar Grupo' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Motor' }));
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(change).toHaveBeenCalledWith({ values: ['Motor'] });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    view.rerender(<StockColumnFilter column="group" label="Grupo" value={{ values: ['Motor'] }} options={options} onChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar Grupo' }));
    expect(screen.getByRole('checkbox', { name: 'Motor' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Câmbio' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Câmbio' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar Grupo' }));
    expect(screen.getByRole('checkbox', { name: 'Câmbio' })).not.toBeChecked();
    expect(change).toHaveBeenCalledTimes(1);
  });
  it('rejects inverted ranges and lets the user clear an applied column', () => {
    const change = vi.fn();
    render(<StockColumnFilter column="quantity" label="Quantidade" value={{ min: '2' }} onChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar Quantidade' }));
    fireEvent.change(screen.getByLabelText('Mínimo'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Máximo'), { target: { value: '1' } });
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtro' }));
    expect(change).toHaveBeenCalledWith({});
  });
  it('supports explicit missing-date filtering', () => {
    const change = vi.fn();
    render(<StockColumnFilter column="lastMovement" label="Última movimentação" value={{}} onChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar Última movimentação' }));
    fireEvent.change(screen.getByLabelText('Informação da data'), { target: { value: 'unknown' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(change).toHaveBeenCalledWith({ dateMode: 'unknown', from: '', to: '' });
  });
});
