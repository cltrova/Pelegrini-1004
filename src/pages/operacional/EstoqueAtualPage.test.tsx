import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Empresa } from '@/hooks/useEmpresaConfig';
import { payload } from '@/test/estoqueAtualFixture';
import { EstoqueAtualPage } from './EstoqueAtualPage';
vi.mock('@/integrations/supabase/client', () => ({supabase: {auth: {getSession: async () => ({data: {session: {access_token: 'test-session'}}})}}}));
const empresa = {id: 'ct', cod_empresa_bi: '1004', modulo_operacional: true, endpoint_url: 'https://api.test'} as Empresa;
function setup() {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  return render(<QueryClientProvider client={client}><EstoqueAtualPage empresa={empresa} onOpenProducts={() => {}} /></QueryClientProvider>);
}
beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {status: 200}))));
describe('tela de estoque atual', () => {
  it('apresenta totais oficiais e grupos, mantendo total geral ao filtrar', async () => {
    setup();
    await screen.findAllByText('R$ 3.812.529,38');
    expect(screen.getByText('02/10/2026')).toBeInTheDocument();
    expect(screen.getByText('EATON MEDIO/PESADO')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', {name: 'Buscar grupo'}), {target: {value: 'eaton'}});
    expect(screen.queryByText('MWM')).not.toBeInTheDocument();
    expect(screen.getAllByText('R$ 3.812.529,38')).toHaveLength(2);
    expect(screen.getByText(/1 de 2 grupos/)).toBeInTheDocument();
  });
  it('falha de atualizacao mostra erro e nao apresenta estoque antigo como atual', async () => {
    setup();
    await screen.findAllByText('R$ 3.812.529,38');
    vi.mocked(fetch).mockResolvedValue(new Response('[]', {status: 503}));
    fireEvent.click(screen.getByRole('button', {name: 'Atualizar estoque atual'}));
    await screen.findByText('Estoque atual indisponível');
    expect(screen.queryAllByText('R$ 3.812.529,38')).toHaveLength(0);
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(payload), {status: 200}));
    fireEvent.click(screen.getByRole('button', {name: 'Tentar novamente'}));
    await screen.findAllByText('R$ 3.812.529,38');
  });
});
