import { describe, expect, it, vi } from 'vitest';
import { invalidarConsultasComerciais } from './comercialQueryInvalidation';

describe('invalidarConsultasComerciais', () => {
  it('forca recarga das consultas que alimentam a tela comercial', () => {
    const queryClient = {
      invalidateQueries: vi.fn(),
    };

    invalidarConsultasComerciais(queryClient);

    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(3);
    expect(queryClient.invalidateQueries).toHaveBeenNthCalledWith(1, { queryKey: ['comercial', 'raw'] });
    expect(queryClient.invalidateQueries).toHaveBeenNthCalledWith(2, { queryKey: ['comercial-produtos'] });
    expect(queryClient.invalidateQueries).toHaveBeenNthCalledWith(3, { queryKey: ['comercial-receita-comissao-1004'] });
  });
});
