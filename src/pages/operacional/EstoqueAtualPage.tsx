import { useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { EstoqueWorkspace } from '@/components/operacional/estoque/EstoqueWorkspace';
import { useEstoqueAtual } from '@/hooks/useEstoqueAtual';
import type { Empresa } from '@/hooks/useEmpresaConfig';
import { estoqueAtualCsv, filterEstoqueAtualGrupos, type EstoqueAtualGroup } from '@/utils/estoqueAtual';

const money = (value: number) => value.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
const quantity = (value: number) => value.toLocaleString('pt-BR', {maximumFractionDigits: 4});
const columns: Array<{label: string; key: keyof EstoqueAtualGroup; monetary?: boolean}> = [
  {label: 'Quantidade em estoque', key: 'quantity'},
  {label: 'Valor em estoque', key: 'stockValue', monetary: true},
  {label: 'Custo médio', key: 'averageCost', monetary: true},
  {label: 'Custo última compra', key: 'lastPurchaseCost', monetary: true},
  {label: 'Custo último real', key: 'lastRealCost', monetary: true},
  {label: 'Custo fornecedor', key: 'supplierCost', monetary: true},
  {label: 'Quantidade vendida hoje', key: 'salesQuantity'},
  {label: 'Valor de venda hoje', key: 'salesValue', monetary: true},
  {label: 'Venda líquida hoje', key: 'netSalesValue', monetary: true},
  {label: 'Compras hoje', key: 'purchaseValue', monetary: true},
];

function exportGroups(groups: EstoqueAtualGroup[], date: string) {
  const csv = estoqueAtualCsv(groups);
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], {type: 'text/csv;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url; link.download = `estoque-atual-ct-${date}.csv`; link.click();
  URL.revokeObjectURL(url);
}

export function EstoqueAtualPage({empresa, onOpenProducts}: {empresa: Empresa; onOpenProducts: () => void}) {
  const query = useEstoqueAtual(empresa, true);
  const [search, setSearch] = useState('');
  const groups = useMemo(() => filterEstoqueAtualGrupos(query.data?.groups ?? [], search), [query.data, search]);
  const report = query.isError ? undefined : query.data;
  const date = report?.date.split('-').reverse().join('/');
  const totals = report ? [
    ['Valor do estoque', report.stockTotal],
    ['Custo médio total', report.averageCostTotal],
    ['Custo última compra total', report.lastPurchaseCostTotal],
    ['Custo fornecedor total', report.supplierCostTotal],
    ['Vendas de hoje', report.salesTotal],
    ['Compras de hoje', report.purchasesTotal],
  ] as const : [];

  return <EstoqueWorkspace aria-label="Estoque atual da Casa da Transmissão" className="bg-background">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b p-4 max-md:pl-14">
      <div>
        <h1 className="text-lg font-semibold">Estoque atual</h1>
        <p className="text-sm text-muted-foreground">Casa da Transmissão · Estoque por grupo</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onOpenProducts}>Análise por produto</Button>
        <Button aria-label="Atualizar estoque atual" disabled={query.isFetching} onClick={() => {void query.refetch();}}>
          <RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} />
          {query.isFetching ? 'Atualizando' : 'Atualizar'}
        </Button>
      </div>
    </header>
    <div className="min-h-0 flex-1 overflow-auto p-4 space-y-4">
      {query.isPending && <LoadingState message="Consultando estoque atual e movimentos de hoje" variant="content" />}
      {query.isError && <ErrorState title="Estoque atual indisponível" message={query.error instanceof Error ? query.error.message : 'Tente atualizar novamente.'} onRetry={() => {void query.refetch();}} />}
      {report && <>
        <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
          <p>Data do estoque e das movimentações: <strong className="text-foreground">{date}</strong></p>
          <p role="status">{query.isFetching ? 'Atualizando consulta…' : `Consultado às ${new Date(query.dataUpdatedAt).toLocaleTimeString('pt-BR')}`} · Atualização automática a cada minuto</p>
        </div>
        <section aria-label="Totais gerais do estoque" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {totals.map(([label, value]) => <div key={label} className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <strong className="mt-1 block text-xl tabular-nums">{money(value)}</strong>
          </div>)}
        </section>
        <p className="text-xs text-muted-foreground">Totais gerais do relatório. A busca abaixo filtra apenas os grupos; os totais gerais mantêm os critérios do relatório.</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Input aria-label="Buscar grupo" placeholder="Buscar nome ou código do grupo" value={search} onChange={event => setSearch(event.target.value)} className="sm:max-w-sm" />
          <span className="text-sm text-muted-foreground">{groups.length} de {report.groups.length} grupos</span>
          <Button variant="outline" disabled={!groups.length} onClick={() => exportGroups(groups, report.date)}><Download className="mr-2 h-4 w-4" />Exportar grupos</Button>
        </div>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table aria-label="Estoque e movimentos de hoje por grupo" className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50"><th scope="col" className="p-3 text-left">Grupo</th>{columns.map(column => <th scope="col" className="p-3 text-right whitespace-nowrap" key={column.key}>{column.label}</th>)}</tr></thead>
            <tbody>{groups.map(group => <tr className="border-b last:border-0 hover:bg-muted/30" key={group.code}>
              <th scope="row" className="min-w-56 p-3 text-left font-medium"><span className="block text-xs text-muted-foreground">{group.code}</span>{group.name}</th>
              {columns.map(column => <td className="p-3 text-right tabular-nums whitespace-nowrap" key={column.key}>{column.monetary ? money(group[column.key] as number) : quantity(group[column.key] as number)}</td>)}
            </tr>)}</tbody>
          </table>
          {!groups.length && <p className="p-6 text-center text-muted-foreground">Nenhum grupo encontrado.</p>}
        </div>
      </>}
    </div>
  </EstoqueWorkspace>;
}
