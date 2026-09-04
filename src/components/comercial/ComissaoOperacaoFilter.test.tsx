import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ComissaoOperacaoFilter } from './ComissaoOperacaoFilter';

const operacoes = [
  { codigo: '0', nome: 'Venda' },
  { codigo: '12', nome: 'Devolução' },
  { codigo: '62', nome: 'Transferência' },
  { codigo: '80', nome: 'Compra' },
];

function Seletor() {
  const [selecionados, setSelecionados] = useState<string[] | null>(null);
  return <ComissaoOperacaoFilter operacoes={operacoes} selecionados={selecionados} onChange={setSelecionados} />;
}

function abrir() {
  fireEvent.click(screen.getByRole('button', { name: /Operações fiscais/ }));
}

describe('ComissaoOperacaoFilter', () => {
  it('seleciona somente as operacoes existentes entre 0 e 62 por padrao', () => {
    render(<Seletor />);
    abrir();
    expect(screen.getByRole('checkbox', { name: '0 - Venda' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '12 - Devolução' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '62 - Transferência' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '80 - Compra' })).not.toBeChecked();
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
  });

  it('preserva a selecao de codigos separados sem transformar em intervalo', () => {
    const onChange = vi.fn();
    render(<ComissaoOperacaoFilter operacoes={operacoes} selecionados={['0', '62']} onChange={onChange} />);
    abrir();
    fireEvent.click(screen.getByRole('checkbox', { name: '80 - Compra' }));
    expect(onChange).toHaveBeenCalledWith(['0', '62', '80']);
  });

  it('busca por codigo e descricao sem exigir acentos', () => {
    render(<Seletor />);
    abrir();
    const busca = screen.getByRole('textbox', { name: 'Buscar operação por código ou descrição' });
    fireEvent.change(busca, { target: { value: 'TRANSFERENCIA' } });
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.getByRole('checkbox', { name: '62 - Transferência' })).toBeChecked();
    fireEvent.change(busca, { target: { value: '12' } });
    expect(screen.getByRole('checkbox', { name: '12 - Devolução' })).toBeChecked();
  });

  it('seleciona todas, limpa e restaura o padrao sem perder a busca', () => {
    render(<Seletor />);
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar todas' }));
    expect(screen.getByRole('checkbox', { name: '80 - Compra' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar seleção' }));
    expect(screen.getAllByRole('checkbox').every((el) => el.getAttribute('aria-checked') === 'false')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Padrão 0 a 62' }));
    expect(screen.getByRole('checkbox', { name: '0 - Venda' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '80 - Compra' })).not.toBeChecked();
  });

  it('nao cria opcoes quando o cadastro esta vazio ou indisponivel', () => {
    const { rerender } = render(<ComissaoOperacaoFilter operacoes={[]} selecionados={null} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Operações fiscais/ })).toBeDisabled();
    rerender(<ComissaoOperacaoFilter operacoes={operacoes} selecionados={null} onChange={vi.fn()} isLoading />);
    expect(screen.getByRole('button', { name: /Operações fiscais/ })).toBeDisabled();
    expect(screen.getByText('Carregando operações…')).toBeInTheDocument();
  });
});
