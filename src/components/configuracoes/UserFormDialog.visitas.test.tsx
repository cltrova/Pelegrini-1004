import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserFormDialog } from './UserFormDialog';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  toast: vi.fn(),
  onSuccess: vi.fn(),
  empresas: [{ id: 'pelegrini', cod_empresa_bi: '1004', nome: 'Pelegrini', ativo: true }],
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isMaster: true, isGerencial: false, codEmpresa: '1004' }),
}));
vi.mock('@/hooks/useEmpresaConfig', () => ({
  useEmpresas: () => ({ data: mocks.empresas }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));
vi.mock('@/config/localPreview', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/config/localPreview')>(),
  isLocalPreviewEnabled: () => false,
}));

describe('Cadastro de Visitador', () => {
  const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invoke.mockResolvedValue({ data: { success: true }, error: null });
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalScrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    }
  });

  it('oferece Visitador junto aos perfis do cadastro', async () => {
    render(<UserFormDialog open onOpenChange={() => {}} onSuccess={mocks.onSuccess} />);
    fireEvent.keyDown(screen.getAllByRole('combobox')[0], { key: 'ArrowDown' });
    for (const name of ['Master', 'Gerencial', 'Vendedor', 'Visitador']) {
      expect(await screen.findByRole('option', { name })).toBeInTheDocument();
    }
  });

  it('usa o cadastro principal e exige a filial do Visitador', async () => {
    render(<UserFormDialog open onOpenChange={() => {}} onSuccess={mocks.onSuccess}
      defaultRole="visitador" defaultCodEmpresa="1004" />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'visitador@example.test' } });
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Visitador Teste' } });
    const criar = screen.getByRole('button', { name: 'Criar Usuário' });
    fireEvent.click(criar);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Selecione a filial do Visitador' }));
    expect(mocks.invoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', { name: /^Casa da Chevrolet/ }));
    fireEvent.click(criar);
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith('create-user', {
      body: expect.objectContaining({
        role: 'visitador', filial_id: 'chevrolet', filiais_permitidas: ['chevrolet'],
        module_permissions: expect.objectContaining({ modulo_comercial: false, permissoes_paginas: {} }),
      }),
    }));
  });
});
