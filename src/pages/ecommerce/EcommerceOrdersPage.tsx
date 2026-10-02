import { ShoppingCart } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useEcommerceData } from '@/hooks/useEcommerceData';
import { formatCurrency } from '@/utils/formatters';
import type { EcommerceOrderRow } from '@/modules/ecommerce/ecommerceTypes';

const orderStatusLabels: Record<EcommerceOrderRow['status'], string> = {
  paid: 'Pago',
  pending: 'Pendente',
  cancelled: 'Cancelado',
  unknown: 'Indisponível',
};

const paymentStatusLabels: Record<EcommerceOrderRow['paymentStatus'], string> = {
  approved: 'Aprovado',
  pending: 'Pendente',
  refunded: 'Reembolsado',
  unknown: 'Indisponível',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
}

function formatOrderValue(value: number | null) {
  return value === null ? '—' : formatCurrency(value);
}

function statusVariant(status: EcommerceOrderRow['status']) {
  if (status === 'cancelled') return 'destructive' as const;
  if (status === 'pending' || status === 'unknown') return 'secondary' as const;
  return 'default' as const;
}

function paymentVariant(status: EcommerceOrderRow['paymentStatus']) {
  if (status === 'refunded') return 'destructive' as const;
  if (status === 'pending' || status === 'unknown') return 'secondary' as const;
  return 'outline' as const;
}

export default function EcommerceOrdersPage() {
  const { filialAtiva, codEmpresaContexto } = useFilialSelecionada();
  const branch = filialAtiva === 'chevrolet' ? 'chevrolet' : 'transmissao';
  const { orders, state } = useEcommerceData({
    branch,
    companyCode: codEmpresaContexto,
  });

  if (state === 'loading' || orders.isPending) {
    return <LoadingState message="Carregando pedidos do Mercado Livre" variant="content" className="min-h-full" />;
  }

  if (state === 'error' || orders.isError) {
    return (
      <div className="flex min-h-full items-center justify-center p-4 md:p-6">
        <ErrorState
          title="Não foi possível carregar os pedidos"
          message="Confira a configuração da integração e tente novamente."
          onRetry={() => void orders.refetch()}
          className="w-full max-w-xl"
        />
      </div>
    );
  }

  if (state === 'not_configured' || orders.data?.state === 'not_configured') {
    return (
      <div className="flex min-h-full items-center justify-center p-4 md:p-6">
        <EmptyState
          title="Integração do Mercado Livre não configurada"
          message="Configure a integração para carregar os pedidos desta filial. Nenhum dado de produção foi carregado."
          icon={<ShoppingCart className="h-8 w-8 text-primary" />}
          className="w-full max-w-xl"
        />
      </div>
    );
  }

  const rows = orders.data?.rows ?? [];

  return (
    <section className="flex min-h-full flex-col gap-6 p-4 md:p-6" aria-labelledby="ecommerce-orders-title">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 id="ecommerce-orders-title" className="text-2xl font-semibold tracking-tight text-foreground">Pedidos</h1>
        </div>
        <p className="text-sm text-muted-foreground">Consulte os pedidos sincronizados da Casa do Chevrolet.</p>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title="Nenhum pedido encontrado"
          message="Quando a integração estiver sincronizada, os pedidos aparecerão nesta tabela."
          icon={<ShoppingCart className="h-8 w-8 text-primary" />}
          className="min-h-64"
        />
      ) : (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-lg">Pedidos sincronizados</CardTitle>
            <CardDescription>{rows.length} pedido(s) disponível(is) para consulta.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="w-full overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Comprador</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status do pagamento</TableHead>
                    <TableHead className="text-right">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap font-medium">{row.id}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={row.buyerName ?? undefined}>{row.buyerName ?? '—'}</TableCell>
                      <TableCell><Badge variant={statusVariant(row.status)}>{orderStatusLabels[row.status]}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{formatOrderValue(row.total)}</TableCell>
                      <TableCell><Badge variant={paymentVariant(row.paymentStatus)}>{paymentStatusLabels[row.paymentStatus]}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap text-right text-muted-foreground">{formatDate(row.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
