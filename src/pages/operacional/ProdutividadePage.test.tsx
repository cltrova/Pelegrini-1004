import { cloneElement, type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildOperacionalMenuItems } from '@/components/layout/operacionalSidebarItems';
import type { Empresa } from '@/hooks/useEmpresaConfig';
import ProdutividadePage, { buscarProdutividade } from './ProdutividadePage';

vi.mock('recharts', async importOriginal => ({
  ...await importOriginal<typeof import('recharts')>(),
  ResponsiveContainer: ({ children }: { children: ReactElement<{ width: number; height: number }> }) =>
    cloneElement(children, { width: 640, height: 156 }),
}));
vi.mock('@/hooks/useEmpresaAtiva', () => ({ useEmpresaAtiva: () => ({ empresa, isLoading: false }) }));
const filial = vi.hoisted(() => ({ ativa: 'chevrolet' as string | null }));
vi.mock('@/contexts/FilialSelecionadaContext', () => ({ useFilialSelecionada: () => ({ filialAtiva: filial.ativa }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {
  getSession: async () => ({ data: { session: { access_token: 'test-session' } } }),
} } }));

const empresa = { id: 'chevrolet', cod_empresa_bi: '10041' } as Empresa;
const linha = {
  data_atividade: '2026-11-09', cod_empresa_bi: 10041, cod_empresa: 2,
  identificacao_responsavel: '123', nome_responsavel: 'Colaborador exemplo',
  pedidos_separados: 10, unidades_separadas: 21, pedidos_conferidos: 7,
  unidades_pedidos_marcados_conferidos: 17, unidades_conferidas_registradas: 2,
  notas_lancadas: 5, unidades_guardadas: 9,
};
const resumo = {
  pedidos_separados: 858, unidades_separadas: 2381, pedidos_conferidos: 875,
  unidades_pedidos_marcados_conferidos: 2425, unidades_conferidas_registradas: 273,
  notas_lancadas: 113, unidades_guardadas: 1893, notas_guarda_consideradas: 113,
  notas_guarda_concluidas: 79, nivel_servico_guarda_pct: 69.9115,
};
const resposta = {
  cod_empresa_bi: 10041, cod_empresas: [2, 3], resumo, atualizado_em: '2026-11-09T12:00:00Z',
  por_dia_responsavel: [linha, { ...linha, data_atividade: '2026-11-10' }, { ...linha, cod_empresa: 3 }],
};
function mockResponse(data = resposta) {
  vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify(data), { status: 200 }));
}
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const element = () => <QueryClientProvider client={client}><ProdutividadePage /></QueryClientProvider>;
  return { ...render(element()), element };
}

beforeEach(() => {
  empresa.cod_empresa_bi = '10041';
  filial.ativa = 'chevrolet';
  vi.stubGlobal('fetch', vi.fn());
  mockResponse();
});

describe('produtividade Chevrolet', () => {
  it('consulta o período e a filial pela rota protegida usando a sessão', async () => {
    mockResponse({ ...resposta, cod_empresas: [2], por_dia_responsavel: [linha] });
    await buscarProdutividade(empresa, '2026-11-03', '2026-11-07', '2');
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    const parsed = new URL(String(url), 'https://local.test');
    expect(parsed.pathname).toBe('/api/produtividade/diario');
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      cod_empresa_bi: '10041', cod_empresa: '2', data_ini: '2026-11-03', data_fim: '2026-11-07',
    });
    expect(options?.headers).toMatchObject({ Authorization: 'Bearer test-session' });
  });

  it('rejeita dados de outra empresa mesmo com HTTP 200', async () => {
    mockResponse({ ...resposta, por_dia_responsavel: [{ ...linha, cod_empresa: 80 }] });
    await expect(buscarProdutividade(empresa, '2026-11-03', '2026-11-07', '')).rejects.toThrow('Casa Chevrolet');
  });

  it('mostra a navegação apenas no contexto Chevrolet', () => {
    expect(buildOperacionalMenuItems('1004', 'chevrolet').some(item => item.path === '/operacional/produtividade')).toBe(true);
    expect(buildOperacionalMenuItems('10041', 'chevrolet').some(item => item.path === '/operacional/produtividade')).toBe(true);
    expect(buildOperacionalMenuItems('1004', 'transmissao').some(item => item.path === '/operacional/produtividade')).toBe(false);
  });

  it('aguarda a filial sem consultar os dados fora do contexto Chevrolet', async () => {
    empresa.cod_empresa_bi = '1004';
    filial.ativa = null;
    const view = renderPage();
    expect(screen.getByText(/Selecione a Casa Chevrolet/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    filial.ativa = 'chevrolet';
    view.rerender(view.element());
    expect(await screen.findByRole('region', { name: 'Gráficos de produtividade' })).toBeInTheDocument();
  });

  it('abre o filtro compacto e só consulta as datas e filial escolhidas ao aplicar', async () => {
    mockResponse({ ...resposta, cod_empresas: [2], por_dia_responsavel: [linha] });
    renderPage();
    await screen.findByRole('region', { name: 'Gráficos de produtividade' });
    expect(screen.queryByLabelText('Data inicial')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    const filters = screen.getByRole('dialog', { name: 'Filtros de produtividade' });
    fireEvent.change(within(filters).getByLabelText('Data inicial'), { target: { value: '2026-09-05' } });
    fireEvent.change(within(filters).getByLabelText('Data final'), { target: { value: '2026-11-09' } });
    fireEvent.change(within(filters).getByLabelText('Filial'), { target: { value: '2' } });
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(within(filters).getByRole('button', { name: 'Aplicar' }));
    await waitFor(() => expect(String(vi.mocked(fetch).mock.lastCall?.[0])).toMatch(/data_ini=2026-09-05&data_fim=2026-11-09&cod_empresa=2/));
    expect(screen.queryByRole('dialog', { name: 'Filtros de produtividade' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filtros (2)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(screen.getByRole('dialog', { name: 'Filtros de produtividade' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('mostra os cinco gráficos e detalha o totalizador de conferência com as duas medidas', async () => {
    renderPage();
    const charts = await screen.findByRole('region', { name: 'Gráficos de produtividade' });
    expect(within(charts).getAllByRole('heading', { level: 2 })).toHaveLength(5);
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    const guard = within(charts).getByRole('region', { name: 'Nível de serviço de guarda de NF' });
    expect(within(guard).getByText('69,91%')).toBeInTheDocument();
    expect(within(guard).getByRole('button', { name: 'Pendentes 34' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Detalhar conferência' }));
    const dialog = screen.getByRole('dialog', { name: 'Conferência por colaborador' });
    expect(within(dialog).getByText('2.425')).toBeInTheDocument();
    expect(within(dialog).getByText('273')).toBeInTheDocument();
  });

  it('mostra o dia ao selecionar uma coluna e mantém a agregação por filial na tabela', async () => {
    renderPage();
    const chart = await screen.findByRole('region', { name: 'Separação por colaborador' });
    const pedidos = within(chart).getByRole('button', { name: 'Pedidos separados' });
    fireEvent.click(pedidos);
    expect(pedidos).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(within(chart).getByRole('button', { name: /ver dados/i }));
    const table = screen.getByRole('dialog', { name: 'Separação por colaborador' });
    expect(within(table).getByRole('row', { name: 'Colaborador exemplo 2 20 42' })).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: 'Colaborador exemplo 3 10 21' })).toBeInTheDocument();
    fireEvent.click(within(table).getByRole('button', { name: 'Ver dias de Colaborador exemplo · Filial 3' }));
    expect(within(table).getByRole('row', { name: '09/11/2026 3 10 21' })).toBeInTheDocument();
    fireEvent.click(within(table).getByRole('button', { name: 'Close' }));
    const bar = chart.querySelector('.recharts-bar-rectangle path');
    expect(bar).toBeTruthy();
    fireEvent.click(bar!);
    const person = screen.getByRole('dialog', { name: 'Separação por colaborador' });
    expect(within(person).getByText('Colaborador exemplo · Filial 2')).toBeInTheDocument();
    expect(within(person).getByRole('row', { name: '10/11/2026 2 10 21' })).toBeInTheDocument();
  });
});
