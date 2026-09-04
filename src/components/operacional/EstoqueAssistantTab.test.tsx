import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EstoqueAssistantTab } from './EstoqueAssistantTab';
import { EstoqueInsights } from './EstoqueInsights';
import { estoqueFixture, giroFixture } from './estoque/estoqueFixtures';

const { activeCompany, activeBranch, queriedCompanies, mockMaybeSingle, mockRpc } = vi.hoisted(() => ({
  activeCompany: { value: '' },
  activeBranch: { value: 'transmissao' },
  queriedCompanies: [] as string[],
  mockMaybeSingle: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('@/hooks/useEmpresaAtiva', () => ({
  useEmpresaAtiva: () => ({ codEmpresaAtiva: activeCompany.value, empresa: { cod_empresa_bi: activeCompany.value || '1004' } }),
}));

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({ filialAtiva: activeBranch.value }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn((_column: string, value: string) => {
        queriedCompanies.push(value);
        return { maybeSingle: mockMaybeSingle };
      }) })),
    })),
    rpc: mockRpc,
  },
}));

describe('EstoqueAssistantTab', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    activeCompany.value = '';
    activeBranch.value = 'transmissao';
    queriedCompanies.length = 0;
    mockMaybeSingle.mockResolvedValue({ data: null });
    mockRpc.mockResolvedValue({ data: null });
  });

  it('renderiza insights locais mesmo sem configuracao de IA', () => {
    const onProductAction = vi.fn();
    render(
      <EstoqueAssistantTab
        estoqueData={[{ ...estoqueFixture[0], quantidade_estoque: 0 }]}
        giroData={giroFixture}
        now={new Date('2026-09-01T12:00:00-03:00')}
        onProductAction={onProductAction}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Insights' }));
    const localInsights = screen.getByRole('list', { name: 'Insights locais de estoque' });
    expect(localInsights).toHaveTextContent('Risco de ruptura');
    expect(localInsights).toHaveTextContent(/Estoque e movimentacoes/i);
    fireEvent.click(screen.getByRole('button', { name: /Abrir produto/i }));
    expect(onProductAction).toHaveBeenCalledWith(String(estoqueFixture[0].cod_produto));
  });

  it('mantem insights apos falha do chat e oferece retry apenas da pergunta', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ response: 'Resposta recuperada' }) });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <EstoqueAssistantTab
        estoqueData={[{ ...estoqueFixture[0], quantidade_estoque: 0 }]}
        giroData={giroFixture}
        now={new Date('2026-09-01T12:00:00-03:00')}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Pergunte sobre seu estoque...'), { target: { value: 'Analise a ruptura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pergunta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nao foi possivel concluir esta pergunta');
    fireEvent.click(screen.getByRole('tab', { name: 'Insights' }));
    expect(screen.getByRole('list', { name: 'Insights locais de estoque' })).toHaveTextContent('Risco de ruptura');
    fireEvent.click(screen.getByRole('tab', { name: 'Chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Resposta recuperada')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('expoe seis sugestoes acessiveis e envia pelo fluxo existente', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ response: 'Resumo pronto' }) }));
    vi.stubGlobal('fetch', fetchMock);
    render(<EstoqueAssistantTab estoqueData={estoqueFixture} giroData={giroFixture} />);

    const suggestions = screen.getAllByTestId('stock-assistant-suggestion');
    expect(suggestions).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Resumo diario' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).messages.at(-1).content).toMatch(/resumo/i);
  });

  it('bloqueia envio duplicado durante processamento e mantem o composer visivel', async () => {
    let resolveRequest: (value: unknown) => void = () => undefined;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { resolveRequest = resolve; })));
    render(<EstoqueAssistantTab estoqueData={estoqueFixture} giroData={giroFixture} />);

    const input = screen.getByPlaceholderText('Pergunte sobre seu estoque...');
    fireEvent.change(input, { target: { value: 'Teste' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(await screen.findByText('Analisando dados...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar pergunta' })).toBeDisabled();
    expect(screen.getByTestId('stock-assistant-composer')).toBeVisible();
    resolveRequest({ ok: true, json: async () => ({ response: 'OK' }) });
    expect(await screen.findByText('OK')).toBeInTheDocument();
  });

  it('mostra fonte e periodo em respostas', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ response: 'Analise concluida' }) }));
    vi.stubGlobal('fetch', fetchMock);
    render(<EstoqueAssistantTab estoqueData={estoqueFixture} giroData={giroFixture} />);
    fireEvent.change(screen.getByPlaceholderText('Pergunte sobre seu estoque...'), { target: { value: 'Analise' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pergunta' }));

    expect(await screen.findByText('Analise concluida')).toBeInTheDocument();
    expect(screen.getByText('Fonte: estoque atual e movimentacoes')).toBeInTheDocument();
    expect(screen.getByText('Periodo: estoque atual e movimentacoes disponiveis dos ultimos 90 dias')).toBeInTheDocument();
    const context = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).context;
    expect(context).toMatch(/GIRO POR MARCA \(90 DIAS\)/);
    expect(context).toMatch(/ltimos 7 dias/i);
    expect(context).toMatch(/EVOLU..O MENSAL \(\d+ MESES\)/i);
  });

  it('usa a empresa efetiva da filial Chevrolet nas configuracoes e creditos', async () => {
    activeCompany.value = '1004';
    activeBranch.value = 'chevrolet';

    render(<EstoqueAssistantTab estoqueData={estoqueFixture} giroData={giroFixture} />);

    await waitFor(() => expect(queriedCompanies.length).toBeGreaterThan(0));
    expect(queriedCompanies.every(code => code === '10041')).toBe(true);
  });

  it('trata ultima venda ausente como desconhecida no contexto', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ response: 'OK' }) }));
    vi.stubGlobal('fetch', fetchMock);
    render(<EstoqueAssistantTab estoqueData={[{ ...estoqueFixture[0], data_ultima_venda: null }]} giroData={[]} />);

    fireEvent.change(screen.getByPlaceholderText('Pergunte sobre seu estoque...'), { target: { value: 'Analise' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pergunta' }));
    await screen.findByText('OK');

    const context = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).context as string;
    expect(context).toMatch(/Itens com data de ultima venda desconhecida: 1/);
    expect(context).toMatch(/Itens sem venda >90 dias: 0/);
  });

  it('aplica limites inclusivos exatos nas janelas de 7, 30, 60 e 90 dias', async () => {
    const now = new Date('2026-09-03T12:00:00.000Z');
    const movements = [
      { ...giroFixture[0], data_movimento: '2026-08-27T12:00:00.000Z', saida_venda: 7, valor_venda: 7 },
      { ...giroFixture[0], data_movimento: '2026-08-27T11:59:59.999Z', saida_venda: 70, valor_venda: 70 },
      { ...giroFixture[0], data_movimento: '2026-08-04T12:00:00.000Z', saida_venda: 30, valor_venda: 30 },
      { ...giroFixture[0], data_movimento: '2026-07-05T12:00:00.000Z', saida_venda: 60, valor_venda: 60 },
      { ...giroFixture[0], data_movimento: '2026-06-05T12:00:00.000Z', saida_venda: 90, valor_venda: 90 },
      { ...giroFixture[0], data_movimento: '2026-09-03T12:00:00.001Z', saida_venda: 900_001, valor_venda: 900_001 },
    ];
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ response: 'OK' }) }));
    vi.stubGlobal('fetch', fetchMock);
    render(<EstoqueAssistantTab estoqueData={estoqueFixture} giroData={movements} now={now} />);

    fireEvent.change(screen.getByPlaceholderText('Pergunte sobre seu estoque...'), { target: { value: 'Analise' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pergunta' }));
    await screen.findByText('OK');

    const context = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).context as string;
    expect(context).toMatch(/ltimos 7 dias: 7 unidades/);
    expect(context).toMatch(/ltimos 30 dias: 107 unidades/);
    expect(context).toMatch(/ltimos 60 dias: 167 unidades/);
    expect(context).toMatch(/ltimos 90 dias: 257 unidades/);
    expect(context).not.toContain('900001');
  });

  it('limita a evolucao mensal a datas validas, nao futuras e aos tres meses consultados', async () => {
    const movements = [
      { ...giroFixture[0], data_movimento: '2026-06-01', saida_venda: 0, entrada_compra: 9 },
      { ...giroFixture[0], data_movimento: '2026-03-31', saida_venda: 0, entrada_compra: 900_002 },
      { ...giroFixture[0], data_movimento: '2026-08-20-invalid', saida_venda: 0, entrada_compra: 900_003 },
      { ...giroFixture[0], data_movimento: '2026-09-04', saida_venda: 0, entrada_compra: 900_004 },
    ];
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ response: 'OK' }) }));
    vi.stubGlobal('fetch', fetchMock);
    render(
      <EstoqueAssistantTab
        estoqueData={estoqueFixture}
        giroData={movements}
        now={new Date('2026-09-03T12:00:00.000Z')}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Pergunte sobre seu estoque...'), { target: { value: 'Analise' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pergunta' }));
    await screen.findByText('OK');

    const context = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).context as string;
    expect(context).toContain('2026-06|0|0|9');
    expect(context).not.toMatch(/900002|900003|900004/);
  });

  it('nao transforma falha de contabilizacao de credito em retry do chat', async () => {
    activeCompany.value = '1004';
    mockRpc.mockRejectedValueOnce(new Error('RPC indisponivel'));
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ response: 'Resposta entregue' }) }));
    vi.stubGlobal('fetch', fetchMock);
    render(<EstoqueAssistantTab estoqueData={estoqueFixture} giroData={giroFixture} />);

    fireEvent.change(screen.getByPlaceholderText('Pergunte sobre seu estoque...'), { target: { value: 'Analise' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pergunta' }));

    expect(await screen.findByText('Resposta entregue')).toBeInTheDocument();
    expect(await screen.findByText('Resposta entregue, mas o uso de credito nao foi atualizado.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('mantem navegacao por teclado e relacionamentos ARIA nas abas', async () => {
    render(<EstoqueAssistantTab estoqueData={estoqueFixture} giroData={giroFixture} />);
    const chatTab = screen.getByRole('tab', { name: 'Chat' });
    const insightsTab = screen.getByRole('tab', { name: 'Insights' });

    await act(async () => {
      chatTab.focus();
      fireEvent.keyDown(chatTab, { key: 'ArrowRight' });
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => expect(insightsTab).toHaveFocus());
    expect(insightsTab).toHaveAttribute('aria-controls');
    expect(screen.getByRole('tabpanel', { name: 'Insights' })).toHaveAttribute('aria-labelledby', insightsTab.id);
  });

  it('usa uma mensagem compacta e sem moldura quando nao ha insights locais', () => {
    render(<EstoqueInsights data={[]} />);

    const emptyState = screen.getByTestId('stock-insights-empty');
    expect(emptyState).toHaveTextContent('Nenhuma acao deterministica identificada');
    expect(emptyState.className).not.toMatch(/border|min-h/);
    expect(emptyState.querySelector('svg')).toBeNull();
  });
});
