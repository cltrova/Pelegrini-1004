import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({ user: { id: 'user-1' } as { id: string } | null }));
const supabaseFrom = vi.hoisted(() => vi.fn());

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: supabaseFrom },
}));

import {
  buildMotivoPerdaUpsert,
  useMotivosPerda10041,
  useSalvarMotivoPerda10041,
  validarMotivoPerda,
} from './useMotivosPerda';
import { readLocalPreviewMotivosPerda, saveLocalPreviewMotivoPerda } from '@/config/localPreview';

function queryWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  vi.stubEnv('VITE_LOCAL_PREVIEW', 'false');
});

afterEach(() => {
  authState.user = { id: 'user-1' };
  supabaseFrom.mockReset();
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe('validarMotivoPerda', () => {
  it('rejeita id de cotacao vazio apos normalizacao', () => {
    expect(validarMotivoPerda({ idCotacao: '   ', motivo: 'preco' })).toEqual({
      valido: false,
      erro: 'Informe a cotação.',
    });
  });

  it('rejeita Outro sem observacao preenchida', () => {
    expect(validarMotivoPerda({ motivo: 'outro', observacao: '  ' })).toEqual({
      valido: false,
      erro: 'Informe a observação para o motivo Outro.',
    });
  });

  it('aceita Outro com observacao preenchida', () => {
    expect(validarMotivoPerda({ motivo: 'outro', observacao: 'Cliente fechou mais tarde.' })).toEqual({
      valido: true,
    });
  });
});

describe('buildMotivoPerdaUpsert', () => {
  it('rejeita id de cotacao vazio apos normalizacao', () => {
    expect(() => buildMotivoPerdaUpsert('   ', { motivo: 'preco' }, 'user-1'))
      .toThrowError('Informe a cotação.');
  });

  it('normaliza observacao vazia para null e fixa a empresa 10041', () => {
    expect(buildMotivoPerdaUpsert('9012', { motivo: 'preco', observacao: '' }, 'user-1')).toEqual({
      cod_empresa_bi: '10041',
      id_cotacao: '9012',
      motivo: 'preco',
      observacao: null,
      created_by: 'user-1',
    });
  });

  it('remove espacos externos da observacao antes de persistir', () => {
    expect(buildMotivoPerdaUpsert('9012', { motivo: 'outro', observacao: '  Preco concorrente.  ' }, 'user-1'))
      .toMatchObject({ observacao: 'Preco concorrente.' });
  });
});

describe('useMotivosPerda10041', () => {
  it('does not read loss reasons when the user is unauthenticated', () => {
    authState.user = null;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { unmount } = renderHook(() => useMotivosPerda10041(['9012']), {
      wrapper: queryWrapper(queryClient),
    });

    expect(supabaseFrom).not.toHaveBeenCalled();

    unmount();
    queryClient.clear();
  });

  it('does not read loss reasons when quotation ids contain only whitespace', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result, unmount } = renderHook(() => useMotivosPerda10041(['', '   ']), {
      wrapper: queryWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(supabaseFrom).not.toHaveBeenCalled();

    unmount();
    queryClient.clear();
  });

  it('reads only the requested 10041 quotation ids', async () => {
    const inIds = vi.fn().mockResolvedValue({ data: [], error: null });
    const eqCompany = vi.fn().mockReturnValue({ in: inIds });
    const select = vi.fn().mockReturnValue({ eq: eqCompany });
    supabaseFrom.mockReturnValue({ select });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result, unmount } = renderHook(() => useMotivosPerda10041(['9012']), {
      wrapper: queryWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(supabaseFrom).toHaveBeenCalledWith('comercial_motivos_perda');
    expect(select).toHaveBeenCalledWith('*');
    expect(eqCompany).toHaveBeenCalledWith('cod_empresa_bi', '10041');
    expect(inIds).toHaveBeenCalledWith('id_cotacao', ['9012']);

    unmount();
    queryClient.clear();
  });

  it('surfaces Supabase read errors through the query result', async () => {
    const readError = new Error('Leitura negada.');
    const inIds = vi.fn().mockResolvedValue({ data: null, error: readError });
    const eqCompany = vi.fn().mockReturnValue({ in: inIds });
    const select = vi.fn().mockReturnValue({ eq: eqCompany });
    supabaseFrom.mockReturnValue({ select });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result, unmount } = renderHook(() => useMotivosPerda10041(['9012']), {
      wrapper: queryWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(readError);

    unmount();
    queryClient.clear();
  });

  it('reads local preview loss reasons without Supabase', async () => {
    vi.stubEnv('VITE_LOCAL_PREVIEW', 'true');
    saveLocalPreviewMotivoPerda({
      cod_empresa_bi: '10041',
      id_cotacao: '9012',
      motivo: 'preco',
      observacao: null,
      created_by: 'user-1',
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result, unmount } = renderHook(() => useMotivosPerda10041(['9012', '9999']), {
      wrapper: queryWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject([{ id_cotacao: '9012', motivo: 'preco' }]);
    expect(supabaseFrom).not.toHaveBeenCalled();

    unmount();
    queryClient.clear();
  });
});

describe('useSalvarMotivoPerda10041', () => {
  it('rejects saves when the user is unauthenticated', async () => {
    authState.user = null;
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result, unmount } = renderHook(() => useSalvarMotivoPerda10041(), {
      wrapper: queryWrapper(queryClient),
    });

    await act(async () => {
      await expect(result.current.mutateAsync({ idCotacao: '9012', motivo: 'preco' }))
        .rejects.toThrowError('Usuário não autenticado.');
    });
    expect(supabaseFrom).not.toHaveBeenCalled();

    unmount();
    queryClient.clear();
  });

  it('rejects blank quotation ids before calling Supabase', async () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result, unmount } = renderHook(() => useSalvarMotivoPerda10041(), {
      wrapper: queryWrapper(queryClient),
    });

    await act(async () => {
      await expect(result.current.mutateAsync({ idCotacao: '   ', motivo: 'preco' }))
        .rejects.toThrowError('Informe a cotação.');
    });
    expect(supabaseFrom).not.toHaveBeenCalled();

    unmount();
    queryClient.clear();
  });

  it('rejects Outro without an observation before calling Supabase', async () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result, unmount } = renderHook(() => useSalvarMotivoPerda10041(), {
      wrapper: queryWrapper(queryClient),
    });

    await act(async () => {
      await expect(result.current.mutateAsync({
        idCotacao: '9012',
        motivo: 'outro',
        observacao: '   ',
      })).rejects.toThrowError('Informe a observação para o motivo Outro.');
    });
    expect(supabaseFrom).not.toHaveBeenCalled();

    unmount();
    queryClient.clear();
  });

  it('upserts the authenticated users normalized loss reason', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'reason-1' }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const upsert = vi.fn().mockReturnValue({ select });
    supabaseFrom.mockReturnValue({ upsert });
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result, unmount } = renderHook(() => useSalvarMotivoPerda10041(), {
      wrapper: queryWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        idCotacao: '9012',
        motivo: 'preco',
        observacao: '',
      });
    });

    expect(supabaseFrom).toHaveBeenCalledWith('comercial_motivos_perda');
    expect(upsert).toHaveBeenCalledWith({
      cod_empresa_bi: '10041',
      id_cotacao: '9012',
      motivo: 'preco',
      observacao: null,
      created_by: 'user-1',
    }, { onConflict: 'cod_empresa_bi,id_cotacao' });

    unmount();
    queryClient.clear();
  });

  it('invalidates cached 10041 loss reasons after a successful save', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'reason-1' }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const upsert = vi.fn().mockReturnValue({ select });
    supabaseFrom.mockReturnValue({ upsert });
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const cachedQueryKey = ['comercial-motivos-perda', '10041', ['9012']] as const;
    queryClient.setQueryData(cachedQueryKey, []);

    const { result, unmount } = renderHook(() => useSalvarMotivoPerda10041(), {
      wrapper: queryWrapper(queryClient),
    });

    expect(queryClient.getQueryState(cachedQueryKey)?.isInvalidated).toBe(false);

    await act(async () => {
      await result.current.mutateAsync({ idCotacao: '9012', motivo: 'preco' });
    });

    expect(queryClient.getQueryState(cachedQueryKey)?.isInvalidated).toBe(true);

    unmount();
    queryClient.clear();
  });

  it('surfaces Supabase save errors to the caller', async () => {
    const saveError = new Error('Permissao negada.');
    const single = vi.fn().mockResolvedValue({ data: null, error: saveError });
    const select = vi.fn().mockReturnValue({ single });
    const upsert = vi.fn().mockReturnValue({ select });
    supabaseFrom.mockReturnValue({ upsert });
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result, unmount } = renderHook(() => useSalvarMotivoPerda10041(), {
      wrapper: queryWrapper(queryClient),
    });

    await act(async () => {
      await expect(result.current.mutateAsync({
        idCotacao: '9012',
        motivo: 'preco',
      })).rejects.toBe(saveError);
    });

    unmount();
    queryClient.clear();
  });

  it('saves local preview loss reasons without Supabase', async () => {
    vi.stubEnv('VITE_LOCAL_PREVIEW', 'true');
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result, unmount } = renderHook(() => useSalvarMotivoPerda10041(), {
      wrapper: queryWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        idCotacao: '9012',
        motivo: 'outro',
        observacao: 'Cliente escolheu concorrente.',
      });
    });

    expect(readLocalPreviewMotivosPerda()).toMatchObject([{
      cod_empresa_bi: '10041',
      id_cotacao: '9012',
      motivo: 'outro',
      observacao: 'Cliente escolheu concorrente.',
      created_by: 'user-1',
    }]);
    expect(supabaseFrom).not.toHaveBeenCalled();

    unmount();
    queryClient.clear();
  });
});
