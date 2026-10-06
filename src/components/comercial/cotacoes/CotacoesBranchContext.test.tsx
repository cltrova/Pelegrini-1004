import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CotacoesFilialContext } from '@/utils/cotacoesFilial';
import { CotacoesBranchContext } from './CotacoesBranchContext';

const transmissao: CotacoesFilialContext = {
  filialId: 'transmissao',
  nome: 'Casa da Transmissão',
  codigoEmpresaBi: '1004',
  logoSrc: '/brand/casa-transmissao.png',
  logoAlt: 'Logo Casa da Transmissão',
};

const chevrolet: CotacoesFilialContext = {
  filialId: 'chevrolet',
  nome: 'Casa do Chevrolet',
  codigoEmpresaBi: '10041',
  logoSrc: '/brand/casa-chevrolet-wordmark.png',
  logoAlt: 'Logo Casa do Chevrolet',
};

describe('CotacoesBranchContext', () => {
  it.each([transmissao, chevrolet])('identifies the $filialId branch with its name, BI code, and logo', (context) => {
    render(<CotacoesBranchContext context={context} />);

    expect(screen.getByText(context.nome)).toBeInTheDocument();
    expect(screen.getByText(`BI ${context.codigoEmpresaBi}`)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: context.logoAlt })).toHaveAttribute('src', context.logoSrc);
  });

  it('calls onRefresh when the refresh button is activated', () => {
    const onRefresh = vi.fn();
    render(<CotacoesBranchContext context={transmissao} onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar dados da filial' }));

    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('disables refresh while the branch data is refreshing', () => {
    render(<CotacoesBranchContext context={chevrolet} isRefreshing onRefresh={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Atualizar dados da filial' })).toBeDisabled();
  });
});
