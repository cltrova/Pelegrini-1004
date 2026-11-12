import { cloneElement, type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';

import { buildOperacionalMenuItems } from '@/components/layout/operacionalSidebarItems';
import type { Empresa } from '@/hooks/useEmpresaConfig';
import ProdutividadePage, { buscarProdutividade } from './ProdutividadePage';

vi.mock('xlsx', async importOriginal => ({
  ...await importOriginal<typeof import('xlsx')>(),
  writeFile: vi.fn(),
}));

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
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 12));
  vi.mocked(XLSX.writeFile).mockClear();
  empresa.cod_empresa_bi = '10041';
  filial.ativa = 'chevrolet';
  vi.stubGlobal('fetch', vi.fn());
  mockResponse();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('produtividade Chevrolet', () => {
  it('abre com o mês inteiro e não mostra o horário da atualização', async () => {
    renderPage();
    await screen.findByRole('region', { name: 'Gráficos de produtividade' });
    const params = new URL(String(vi.mocked(fetch).mock.lastCall?.[0]), 'https://local.test').searchParams;
    expect(params.get('data_ini')).toBe('2026-11-01');
    expect(params.get('data_fim')).toBe('2026-11-30');
    expect(screen.queryByText(/Atualizado às/i)).not.toBeInTheDocument();
  });

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
    const cards = screen.getByRole('region', { name: 'Totalizadores de produtividade' });
    expect(within(cards).getAllByRole('button')).toHaveLength(8);
    expect(within(cards).getByRole('button', { name: 'Detalhar unidades por leitura' })).toHaveTextContent('273');
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    const guard = within(charts).getByRole('region', { name: 'Nível de serviço de guarda de NF' });
    expect(within(guard).getByText('69,91%')).toBeInTheDocument();
    expect(within(guard).getByRole('button', { name: 'Pendentes 34' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Detalhar pedidos conferidos' }));
    const dialog = screen.getByRole('dialog', { name: 'Conferência por colaborador' });
    expect(within(dialog).getByText('2.425')).toBeInTheDocument();
    expect(within(dialog).getByText('273')).toBeInTheDocument();
  });

  it('abre as atividades do responsável pelo gráfico e permite remover o filtro', async () => {
    mockResponse({ ...resposta, por_dia_responsavel: [...resposta.por_dia_responsavel, { ...linha, identificacao_responsavel: '456' }] });
    renderPage();
    const chart = await screen.findByRole('region', { name: 'Separação por colaborador' });
    const pedidos = within(chart).getByRole('button', { name: 'Pedidos separados' });
    fireEvent.click(pedidos);
    expect(pedidos).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(within(chart).getByRole('button', { name: /ver dados/i }));
    const table = screen.getByRole('dialog', { name: 'Separação por colaborador' });
    expect(within(table).getByRole('row', { name: 'Colaborador exemplo 2 20 42' })).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: 'Colaborador exemplo 3 10 21' })).toBeInTheDocument();
    fireEvent.click(within(table).getByRole('button', { name: 'Close' }));
    const bar = chart.querySelector('.recharts-bar-rectangle path');
    expect(bar).toBeTruthy();
    fireEvent.click(bar!);
    const activities = screen.getByRole('region', { name: 'Registros de produtividade' });
    const clear = within(activities).getByRole('button', { name: 'Remover filtro de Colaborador exemplo' });
    expect(within(activities).getByRole('combobox', { name: 'Responsável' })).toHaveValue(JSON.stringify([2, '123']));
    expect(screen.getByRole('tab', { name: 'Atividades por dia e responsável' })).toHaveAttribute('aria-selected', 'true');
    expect(within(activities).getByText('3 registros')).toBeInTheDocument();
    expect(within(activities).queryByText('Filial 2 · 456')).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(clear);
    expect(within(activities).getByText('4 registros')).toBeInTheDocument();
  });

  it('retira os lançamentos administrativos do estoque sem excluir um homônimo', async () => {
    vi.stubEnv('VITE_PRODUTIVIDADE_USUARIO_NF_ADMIN_FILIAL_2', 'usuario-rsys:teste-administrativo');
    const somenteNotas = {
      ...linha, pedidos_separados: 0, unidades_separadas: 0, pedidos_conferidos: 0,
      unidades_pedidos_marcados_conferidos: 0, unidades_conferidas_registradas: 0, unidades_guardadas: 0,
    };
    mockResponse({
      ...resposta, cod_empresas: [2],
      resumo: { ...resumo, notas_lancadas: 12 },
      por_dia_responsavel: [
        { ...somenteNotas, nome_responsavel: 'ANDRÉ', identificacao_responsavel: 'usuario-rsys:teste-administrativo', notas_lancadas: 7 },
        { ...somenteNotas, nome_responsavel: 'ANDRÉ LIMA', identificacao_responsavel: '321', notas_lancadas: 5 },
      ],
    });
    renderPage();
    const ranking = await screen.findByRole('region', { name: 'Lançamento de NF por colaborador' });
    expect(within(ranking).queryByRole('button', { name: /^ANDRÉ ·/ })).not.toBeInTheDocument();
    expect(within(ranking).getByRole('button', { name: 'ANDRÉ LIMA · Filial 2 · 5 notas lançadas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Detalhar notas lançadas' })).toHaveTextContent('5');
    fireEvent.click(screen.getByRole('tab', { name: 'Atividades por dia e responsável' }));
    const responsible = screen.getByRole('combobox', { name: 'Responsável' });
    expect(within(responsible).queryByRole('option', { name: 'ANDRÉ', exact: true })).not.toBeInTheDocument();
  });

  it('separa as atividades em uma subaba e permite buscar, agrupar e expandir os registros', async () => {
    renderPage();
    await screen.findByRole('region', { name: 'Gráficos de produtividade' });
    const tab = screen.getByRole('tab', { name: 'Atividades por dia e responsável' });
    fireEvent.click(tab);
    const activities = await screen.findByRole('region', { name: 'Registros de produtividade' });
    expect(screen.queryByRole('region', { name: 'Gráficos de produtividade' })).not.toBeInTheDocument();
    expect(within(activities).getByText('3 registros')).toBeInTheDocument();
    const search = within(activities).getByRole('searchbox', { name: 'Buscar responsável' });
    fireEvent.change(search, { target: { value: 'Não cadastrado' } });
    expect(within(activities).getByText('Nenhum responsável encontrado.')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'COLABORADOR' } });
    fireEvent.click(within(activities).getByRole('button', { name: 'Por responsável' }));
    expect(within(activities).getByText('Colaborador exemplo · Filial 2')).toBeInTheDocument();
    expect(within(activities).getByText('Colaborador exemplo · Filial 3')).toBeInTheDocument();
    const day = within(activities).getByText('10/11/2026').closest('summary');
    fireEvent.click(day!);
    expect(day?.parentElement).toHaveAttribute('open');
  });

  it('detalha a guarda por dia somando os registros das filiais no período', async () => {
    renderPage();
    const chart = await screen.findByRole('region', { name: 'Unidades guardadas por dia' });
    fireEvent.click(within(chart).getByRole('button', { name: 'Ver dados de unidades guardadas por dia' }));
    const modal = screen.getByRole('dialog', { name: 'Unidades guardadas por dia' });
    expect(within(modal).getByRole('row', { name: '09/11/2026 18' })).toBeInTheDocument();
    expect(within(modal).getByRole('row', { name: '10/11/2026 9' })).toBeInTheDocument();
  });

  it('mantém as datas e a filial aplicadas ao abrir as atividades pelo ranking', async () => {
    mockResponse({ ...resposta, cod_empresas: [2], por_dia_responsavel: [linha] });
    renderPage();
    await screen.findByRole('region', { name: 'Gráficos de produtividade' });
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    const filters = screen.getByRole('dialog', { name: 'Filtros de produtividade' });
    fireEvent.change(within(filters).getByLabelText('Data inicial'), { target: { value: '2026-11-01' } });
    fireEvent.change(within(filters).getByLabelText('Data final'), { target: { value: '2026-11-10' } });
    fireEvent.change(within(filters).getByLabelText('Filial'), { target: { value: '2' } });
    fireEvent.click(within(filters).getByRole('button', { name: 'Aplicar' }));
    const ranking = await screen.findByRole('region', { name: 'Lançamento de NF por colaborador' });
    fireEvent.click(within(ranking).getByRole('button', { name: 'Colaborador exemplo · Filial 2 · 5 notas lançadas' }));
    expect(screen.getByText('01/11/2026 a 10/11/2026 · Filial 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover filtro de Colaborador exemplo' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('exporta somente as linhas do colaborador, período e filial selecionados', async () => {
    const branchRows = [
      linha,
      { ...linha, data_atividade: '2026-11-10' },
      { ...linha, data_atividade: '2026-11-11' },
      { ...linha, identificacao_responsavel: '456', notas_lancadas: 1 },
    ];
    vi.mocked(fetch).mockImplementation(async input => {
      const selected = new URL(String(input), 'https://local.test').searchParams.has('cod_empresa');
      return new Response(JSON.stringify({
        ...resposta, cod_empresas: selected ? [2] : [2, 3],
        por_dia_responsavel: selected ? branchRows : [...branchRows, { ...linha, cod_empresa: 3 }],
      }), { status: 200 });
    });
    renderPage();
    await screen.findByRole('region', { name: 'Gráficos de produtividade' });
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    const filters = screen.getByRole('dialog', { name: 'Filtros de produtividade' });
    fireEvent.change(within(filters).getByLabelText('Data inicial'), { target: { value: '2026-11-09' } });
    fireEvent.change(within(filters).getByLabelText('Data final'), { target: { value: '2026-11-10' } });
    fireEvent.change(within(filters).getByLabelText('Filial'), { target: { value: '2' } });
    fireEvent.click(within(filters).getByRole('button', { name: 'Aplicar' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Atividades por dia e responsável' }));
    const responsible = await screen.findByRole('combobox', { name: 'Responsável' });
    const option = within(responsible).getByRole('option', { name: 'Colaborador exemplo · Filial 2 · 123' });
    fireEvent.change(responsible, { target: { value: (option as HTMLOptionElement).value } });
    expect(screen.getByText('2 registros')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar Excel' }));
    await waitFor(() => expect(XLSX.writeFile).toHaveBeenCalledTimes(1));
    const [workbook, name] = vi.mocked(XLSX.writeFile).mock.calls[0];
    expect(name).toBe('produtividade-atividades-2026-11-09-2026-11-10-filial-2.xlsx');
    expect(XLSX.utils.sheet_to_json(workbook.Sheets.Atividades)).toMatchObject([
      { Data: new Date(2026, 10, 10), Filial: 2, Identificação: '123', 'Pedidos separados': 10 },
      { Data: new Date(2026, 10, 9), Filial: 2, Identificação: '123', 'Pedidos separados': 10 },
    ]);
  });
});
