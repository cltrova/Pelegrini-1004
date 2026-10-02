import { Megaphone } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { useEcommerceData } from '@/hooks/useEcommerceData';
import { formatCurrency } from '@/utils/formatters';
import type { EcommerceListingStatus } from '@/modules/ecommerce/ecommerceTypes';

const statusLabels: Record<EcommerceListingStatus, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  closed: 'Encerrado',
  unknown: 'Indisponível',
};

const statusVariants: Record<EcommerceListingStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  paused: 'secondary',
  closed: 'outline',
  unknown: 'outline',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
}

function formatValue(value: number | null) {
  return value === null ? '—' : formatCurrency(value);
}

export default function EcommerceListingsPage() {
  const { filialAtiva, codEmpresaContexto } = useFilialSelecionada();
  const branch = filialAtiva === 'chevrolet' ? 'chevrolet' : 'transmissao';
  const { listings, state } = useEcommerceData({
    branch,
    companyCode: codEmpresaContexto,
  });

  if (state === 'loading' || listings.isPending) {
    return <LoadingState message="Carregando anúncios do Mercado Livre" variant="content" className="min-h-full" />;
  }

  if (state === 'error' || listings.isError) {
    return (
      <div className="flex min-h-full items-center justify-center p-4 md:p-6">
        <ErrorState
          title="Não foi possível carregar os anúncios"
          message="Confira a configuração da integração e tente novamente."
          onRetry={() => void listings.refetch()}
          className="w-full max-w-xl"
        />
      </div>
    );
  }

  if (state === 'not_configured' || listings.data?.state === 'not_configured') {
    return (
      <div className="flex min-h-full items-center justify-center p-4 md:p-6">
        <EmptyState
          title="Integração do Mercado Livre não configurada"
          message="Configure a integração para carregar os anúncios desta filial. Nenhum dado de produção foi carregado."
          icon={<Megaphone className="h-8 w-8 text-primary" />}
          className="w-full max-w-xl"
        />
      </div>
    );
  }

  const rows = listings.data?.rows ?? [];

  return (
    <section className="flex min-h-full flex-col gap-6 p-4 md:p-6" aria-labelledby="ecommerce-listings-title">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Megaphone className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 id="ecommerce-listings-title" className="text-2xl font-semibold tracking-tight text-foreground">Anúncios</h1>
        </div>
        <p className="text-sm text-muted-foreground">Acompanhe os anúncios da Casa do Chevrolet no Mercado Livre.</p>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title="Nenhum anúncio encontrado"
          message="Quando a integração estiver sincronizada, os anúncios aparecerão nesta tabela."
          icon={<Megaphone className="h-8 w-8 text-primary" />}
          className="min-h-64"
        />
      ) : (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-lg">Anúncios sincronizados</CardTitle>
            <CardDescription>{rows.length} anúncio(s) disponível(is) para consulta.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="w-full overflow-x-auto">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead className="text-right">Atualizado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-[280px] truncate font-medium" title={row.title}>{row.title}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{row.sku ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariants[row.status]}>{statusLabels[row.status]}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{formatValue(row.price)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{row.stock === null ? '—' : row.stock}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-muted-foreground">{formatDate(row.updatedAt)}</TableCell>
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
