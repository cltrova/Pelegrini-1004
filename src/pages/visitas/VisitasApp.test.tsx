import { fireEvent, render, screen } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import VisitasApp from './VisitasApp';

vi.mock('next-themes', () => ({ ThemeProvider: ({ children }: PropsWithChildren) => children }));

afterEach(() => vi.unstubAllGlobals());

it('pede a troca da senha temporária antes de abrir o formulário de visitas', async () => {
  const sessao = {
    id: 'visitador-1', nome: 'Visitador de teste', perfil: 'visitador',
    filiais: [{ cod_empresa_bi: '10041', filial_id: 'chevrolet' }],
    troca_senha_pendente: true,
  };
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (path) => {
    if (path === '/operacional/visitas/sessao') return Response.json(sessao);
    if (path === '/operacional/visitas/sessao/senha') return Response.json({ ...sessao, troca_senha_pendente: false });
    throw new Error('Requisição inesperada');
  });
  vi.stubGlobal('fetch', fetcher);
  render(<VisitasApp />);

  expect(await screen.findByRole('heading', { name: 'Defina sua senha' })).toBeVisible();
  expect(screen.queryByLabelText('Nome do cliente')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Nova senha', { exact: true }), { target: { value: 'NovaSenhaDeTeste-42' } });
  fireEvent.change(screen.getByLabelText('Confirme a nova senha'), { target: { value: 'SenhaDiferente-42' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar senha' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('As senhas precisam ser iguais.');
  expect(fetcher).toHaveBeenCalledTimes(1);

  fireEvent.change(screen.getByLabelText('Confirme a nova senha'), { target: { value: 'NovaSenhaDeTeste-42' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar senha' }));
  expect(await screen.findByLabelText('Nome do cliente')).toBeVisible();
  expect(fetcher).toHaveBeenLastCalledWith('/operacional/visitas/sessao/senha', expect.objectContaining({
    method: 'POST', credentials: 'same-origin', body: JSON.stringify({ senha: 'NovaSenhaDeTeste-42' }),
  }));
});
