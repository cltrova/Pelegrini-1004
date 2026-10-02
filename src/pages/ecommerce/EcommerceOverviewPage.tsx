import { Activity, ArrowRight, CheckCircle2, Clock3, Link2, Package, RefreshCw, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { EnterprisePageHeader } from '@/components/enterprise';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { useEcommerceData } from '@/hooks/useEcommerceData';

function formatSyncDate(value: string | null | undefined) {
  if (!value) return 'Ainda não sincronizado';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function metricValue(value: number | null | undefined) {
  return value === null || value === undefined ? 'Indisponível' : value.toLocaleString('pt-BR');
}

function connectionLabel(status: string | undefined) {
  if (status === 'connected') return 'Conectado';
  if (status === 'disconnected') return 'Desconectado';
  return 'Não configurado';
}

function syncLabel(health: string | undefined) {
  if (health === 'healthy') return 'Sincronização saudável';
  if (health === 'stale') return 'Sincronização atrasada';
  if (health === 'error') return 'Falha na sincronização';
  return 'Sincronização não configurada';
}

export default function EcommerceOverviewPage() {
  const { filialAtiva } = useFilialSelecionada();
  const { codEmpresaAtiva } = useEmpresaAtiva();
  const data = useEcommerceData({
    branch: filialAtiva === 'chevrolet' ? 'chevrolet' : 'transmissao',
    companyCode: codEmpresaAtiva,
  });

  if (data.state === 'loading') {
    return <LoadingState message="Carregando visão geral do E-Commerce" variant="content" className="min-h-[420px]" />;
  }

  if (data.state === 'error') {
    const error = data.overview.error ?? data.connection.error;
    return (
      <ErrorState
        title="Não foi possível carregar a visão geral"
        message={error instanceof Error ? error.message : 'Tente novamente para consultar o status do Mercado Livre.'}
        onRetry={() => void data.overview.refetch()}
        className="min-h-[420px]"
      />
    );
  }

  const connection = data.connection.data;
  const overview = data.overview.data;
  const isNotConfigured = data.state === 'not_configured' || connection?.connection.status === 'not_configured';
  const isDisconnected = connection?.connection.status === 'disconnected';

  if (isNotConfigured || isDisconnected) {
    return (
      <div className="enterprise-page-shell min-w-0 space-y-5">
        <EnterprisePageHeader
          title="Visão geral"
          subtitle="Acompanhe a operação da Casa do Chevrolet no Mercado Livre"
          metadata="E-Commerce"
        />
        <EmptyState
          title="Mercado Livre não conectado"
          message={connection?.connection.message ?? 'Configure a integração para acompanhar anúncios, pedidos e sincronizações.'}
          icon={<Link2 className="h-8 w-8 text-primary" />}
          className="min-h-[360px]"
        />
        <div className="flex justify-center">
          <Button asChild>
            <Link to="/ecommerce/configuracoes">
              Configurar integração
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const metrics = overview?.metrics;
  const sync = overview?.sync;
  const lastSyncAt = sync?.lastSyncAt ?? connection?.connection.lastSyncAt;

  return (
    <div className="enterprise-page-shell min-w-0 space-y-5">
      <EnterprisePageHeader
        title="Visão geral"
        subtitle="Acompanhe a operação da Casa do Chevrolet no Mercado Livre"
        metadata={connection?.connection.accountName ?? 'Mercado Livre'}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/ecommerce/configuracoes">
              <Link2 />
              Integração
            </Link>
          </Button>
        }
      />

      <section aria-label="Status da integração" className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Conexão</p>
              <p className="truncate font-semibold">{connectionLabel(connection?.connection.status)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock3 className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Última sincronização</p>
              <p className="truncate font-semibold">{formatSyncDate(lastSyncAt)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Activity className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Saúde da sincronização</p>
              <p className="truncate font-semibold">{syncLabel(sync?.health)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <RefreshCw className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Conta</p>
              <p className="truncate font-semibold">{connection?.connection.accountName ?? 'Mercado Livre'}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-label="Indicadores do E-Commerce" className="grid min-w-0 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anúncios ativos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{metricValue(metrics?.activeListings)}</p>
            <p className="text-xs text-muted-foreground">Publicações disponíveis no canal</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos pendentes</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{metricValue(metrics?.pendingOrders)}</p>
            <p className="text-xs text-muted-foreground">Aguardando tratamento no canal</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos sincronizados</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{metricValue(metrics?.syncedOrders)}</p>
            <p className="text-xs text-muted-foreground">Histórico recebido do Mercado Livre</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
