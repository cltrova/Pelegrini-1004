import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: () => ({ empresa: { cod_empresa_bi: 1004, api_url: 'https://api.example.com' } }),
}));

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({ filialAtiva: 'transmissao' }),
}));

vi.mock('@/utils/filialEndpoint', () => ({ resolveCodEmpresaBiParam: () => '1004' }));
vi.mock('@/utils/apiEndpointResolver', () => ({ buildApiProxyUrl: () => '/api/estoque/retroativo' }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) } },
}));

import EstoqueRetroativoPage from './EstoqueRetroativoPage';

describe('EstoqueRetroativoPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([
      {
        CodEmpresa_bi: 1004,
        empresa_codigo: 1,
        empresa_nome: 'Matriz',
        cod_produto: 12,
        descricao: 'KIT EMBREAGEM',
        marca: 'LUK',
        unidade: 'UN',
        saldo_estoque: 3,
        valor_unitario: 120,
        preco_venda_unitario: 180,
      },
    ]), { status: 200 })));
  });

  it('mostra resumo e resultados compactos depois da consulta', async () => {
    render(<EstoqueRetroativoPage />);

    fireEvent.change(screen.getByLabelText('Data do estoque'), { target: { value: '2026-08-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));

    await waitFor(() => expect(screen.getByText('1 produto')).toBeInTheDocument());
    expect(within(screen.getByRole('region', { name: 'Resumo da consulta' })).getByText('3,00')).toBeInTheDocument();
    expect(screen.getAllByText('KIT EMBREAGEM').length).toBeGreaterThan(0);
    expect(screen.getByRole('searchbox', { name: 'Buscar nos resultados' })).toBeInTheDocument();
  });
});
