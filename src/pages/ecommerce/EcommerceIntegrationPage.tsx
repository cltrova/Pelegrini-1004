import { AlertCircle, CheckCircle2, CircleOff, ExternalLink, Link2, RefreshCw } from 'lucide-react';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useEcommerceData } from '@/hooks/useEcommerceData';
import { LoadingState } from '@/components/common/LoadingState';
import type { MercadoLivreConnectionStatus } from '@/modules/ecommerce/ecommerceTypes';

const unavailableActionsMessage =
  'As ações ficam disponíveis quando o backend OAuth do Mercado Livre estiver configurado.';

function formatDate(value: string | null | undefined) {
  if (!value) return 'Ainda não sincronizado';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function connectionLabel(status: MercadoLivreConnectionStatus | undefined) {
  switch (status) {
    case 'connected':
      return 'Conectado';
    case 'error':
      return 'Erro na conexão';
    case 'disconnected':
      return 'Desconectado';
    default:
      return 'Integração não configurada';
  }
}

function ConnectionIcon({ status }: { status: MercadoLivreConnectionStatus | undefined }) {
  if (status === 'connected') return <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />;
  if (status === 'error') return <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />;
  return <CircleOff className="h-5 w-5 text-muted-foreground" aria-hidden="true" />;
}

export function EcommerceIntegrationPage() {
  const { filialAtiva, codEmpresaContexto } = useFilialSelecionada();
  const branch = filialAtiva === 'chevrolet' ? 'chevrolet' : 'transmissao';
  const data = useEcommerceData({ branch, companyCode: codEmpresaContexto });
  const connectionQuery = data.connection;
  const connectionData = connectionQuery.data;
  const integration = connectionData?.integration;
  const connection = connectionData?.connection;
  const isInitialLoading = connectionQuery.isPending && !connectionData;
  const isSyncing = connectionQuery.isFetching && Boolean(connectionData);
  const hasError = data.state === 'error' || connectionQuery.isError;
  const isConnected = connection?.status === 'connected';
  const actionLabel = isConnected ? 'Reconectar Mercado Livre' : 'Conectar Mercado Livre';
  const errorMessage = connectionQuery.error instanceof Error
    ? connectionQuery.error.message
    : connection?.message ?? 'Tente novamente mais tarde.';

  if (isInitialLoading) {
    return <LoadingState message="Carregando integração do Mercado Livre" variant="content" />;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6" aria-labelledby="ecommerce-integration-title">
      <header className="flex flex-col gap-2 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">E-Commerce</p>
          <h1 id="ecommerce-integration-title" className="mt-1 text-2xl font-semibold tracking-tight">
            Integração Mercado Livre
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Prepare a conexão da Casa do Chevrolet com o Mercado Livre sem expor credenciais no navegador.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground">
          <Link2 className="h-4 w-4" aria-hidden="true" />
          Somente frontend
        </span>
      </header>

      {hasError ? (
        <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-5" role="alert">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">Não foi possível carregar a integração</h2>
              <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <ConnectionIcon status={connection?.status} />
                <div>
                  <h2 className="font-semibold">Status da conexão</h2>
                  <p className="text-sm text-muted-foreground">{connectionLabel(connection?.status)}</p>
                </div>
              </div>
              {isSyncing && (
                <span className="inline-flex items-center gap-2 text-sm text-primary" role="status">
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Sincronizando informações
                </span>
              )}
            </div>

            {connection?.accountName && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Conta conectada</p>
                  <p className="mt-1 font-medium">{connection.accountName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Última sincronização</p>
                  <p className="mt-1 font-medium">{formatDate(connection.lastSyncAt)}</p>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled
                aria-describedby="ecommerce-actions-note"
                className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-60"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {actionLabel}
              </button>
              {isConnected && (
                <button
                  type="button"
                  disabled={!integration?.canDisconnect}
                  aria-describedby="ecommerce-actions-note"
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium opacity-60"
                >
                  Desconectar Mercado Livre
                </button>
              )}
            </div>
            <p id="ecommerce-actions-note" className="mt-3 text-sm text-muted-foreground">
              {integration?.message ?? unavailableActionsMessage} {unavailableActionsMessage}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-semibold">Configuração segura</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
                <dt className="text-muted-foreground">Client ID</dt>
                <dd className="font-medium">{integration?.clientIdConfigured ? 'Configurado' : 'Não configurado'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">URI de redirecionamento</dt>
                <dd className="mt-2">
                  <input
                    aria-label="URI de redirecionamento"
                    value={integration?.redirectUri ?? 'Não configurada'}
                    readOnly
                    className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none"
                  />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
                <dt className="text-muted-foreground">Escopos</dt>
                <dd className="text-right font-medium">{integration?.scopes.length ? integration.scopes.join(', ') : 'Definidos no backend'}</dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-border bg-muted/20 p-5">
        <h2 className="font-semibold">Próxima etapa</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          O fluxo OAuth, os tokens e as chamadas ao Mercado Livre devem ser implementados no backend. Esta tela não solicita, armazena ou envia credenciais.
        </p>
      </section>
    </main>
  );
}

export default EcommerceIntegrationPage;
