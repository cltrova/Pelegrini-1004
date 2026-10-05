import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EcommerceIntegrationPage } from './EcommerceIntegrationPage';
import type { EcommerceDataQueries } from '@/hooks/useEcommerceData';

const mocks = vi.hoisted(() => ({
  data: null as EcommerceDataQueries | null,
}));

vi.mock('@/contexts/FilialSelecionadaContext', () => ({
  useFilialSelecionada: () => ({
    filialAtiva: 'chevrolet',
    codEmpresaContexto: '10041',
  }),
}));

vi.mock('@/hooks/useEcommerceData', () => ({
  useEcommerceData: vi.fn(() => mocks.data),
}));

function queryResult<T>(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    data: undefined,
    error: null,
    isError: false,
    isFetching: false,
    isPending: false,
    ...overrides,
  };
}

function ecommerceState(overrides: Partial<EcommerceDataQueries> = {}) {
  return {
    state: 'not_configured',
    connection: queryResult({
      data: {
        state: 'not_configured',
        connection: {
          status: 'not_configured',
          lastSyncAt: null,
          message: 'A integração ainda não foi configurada.',
        },
        integration: {
          provider: 'mercado_livre',
          configured: false,
          clientIdConfigured: false,
          redirectUri: null,
          scopes: [],
          canConnect: false,
          canDisconnect: false,
          message: 'O backend OAuth ainda não está disponível.',
        },
      },
    }),
    overview: queryResult(),
    listings: queryResult(),
    orders: queryResult(),
    queryKeys: {
      connection: ['ecommerce', 'connection'],
      overview: ['ecommerce', 'overview'],
      listings: ['ecommerce', 'listings'],
      orders: ['ecommerce', 'orders'],
    },
    ...overrides,
  } as unknown as EcommerceDataQueries;
}

describe('EcommerceIntegrationPage', () => {
  beforeEach(() => {
    mocks.data = ecommerceState();
  });

  it('presents the disconnected and backend-not-configured state', () => {
    render(<EcommerceIntegrationPage />);

    expect(screen.getByRole('heading', { name: 'Configurações' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Mercado Livre' })).toBeInTheDocument();
    expect(screen.getByText('Integração não configurada')).toBeInTheDocument();
    expect(screen.getByText(/backend OAuth ainda não está disponível/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conectar Mercado Livre' })).toBeDisabled();
    expect(screen.queryByRole('textbox', { name: /client secret|token|senha/i })).not.toBeInTheDocument();
  });

  it('presents connected metadata and keeps reconnect/disconnect controlled', () => {
    mocks.data = ecommerceState({
      state: 'ready',
      connection: queryResult({
        data: {
          state: 'connected',
          connection: {
            status: 'connected',
            accountName: 'Casa do Chevrolet',
            connectedAt: '2026-10-02T12:00:00.000Z',
            lastSyncAt: '2026-10-02T12:30:00.000Z',
          },
          integration: {
            provider: 'mercado_livre',
            configured: true,
            clientIdConfigured: true,
            redirectUri: 'https://app.example.com/oauth/mercado-livre/callback',
            scopes: ['read', 'write'],
            canConnect: false,
            canDisconnect: false,
          },
        },
      }),
    });

    render(<EcommerceIntegrationPage />);

    expect(screen.getByText('Conectado')).toBeInTheDocument();
    expect(screen.getByText('Casa do Chevrolet')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://app.example.com/oauth/mercado-livre/callback')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Reconectar Mercado Livre' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Desconectar Mercado Livre' })).toBeDisabled();

    expect(screen.getByText(/credenciais da aplicação Mercado Livre no servidor/i)).toBeInTheDocument();
  });

  it('shows synchronization progress while an existing connection is refreshing', () => {
    mocks.data = ecommerceState({
      state: 'ready',
      connection: queryResult({
        isFetching: true,
        data: {
          state: 'connected',
          connection: { status: 'connected', lastSyncAt: '2026-10-02T12:30:00.000Z' },
          integration: {
            provider: 'mercado_livre',
            configured: true,
            clientIdConfigured: true,
            redirectUri: null,
            scopes: [],
            canConnect: false,
            canDisconnect: false,
          },
        },
      }),
    });

    render(<EcommerceIntegrationPage />);

    expect(screen.getByText('Sincronizando informações')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('presents the connection error without exposing an action that cannot run', () => {
    mocks.data = ecommerceState({
      state: 'error',
      connection: queryResult({
        isError: true,
        error: new Error('OAuth indisponível'),
      }),
    });

    render(<EcommerceIntegrationPage />);

    expect(screen.getByText('Não foi possível carregar a integração')).toBeInTheDocument();
    expect(screen.getByText(/OAuth indisponível/i)).toBeInTheDocument();
  });

  it('enables connection only when the backend confirms it is configured', () => {
    mocks.data = ecommerceState({
      connection: queryResult({
        data: {
          state: 'disconnected',
          connection: { status: 'disconnected', lastSyncAt: null },
          integration: {
            provider: 'mercado_livre',
            configured: true,
            clientIdConfigured: true,
            redirectUri: 'https://ml-api.pelegrini.t2a.ia.br/api/mercadolivre/oauth/callback',
            scopes: [],
            canConnect: true,
            canDisconnect: false,
          },
        },
      }),
    });

    render(<EcommerceIntegrationPage />);

    expect(screen.getByRole('button', { name: 'Conectar Mercado Livre' })).toBeEnabled();
    expect(screen.getByDisplayValue('https://ml-api.pelegrini.t2a.ia.br/api/mercadolivre/oauth/callback'))
      .toHaveAttribute('readonly');
  });
});
