import { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ClipboardCheck, Download, FileText, PackageCheck, PackageOpen, Search, Users, X } from 'lucide-react';
import { toast } from 'sonner';

import type { ProdutividadeLinha } from '@/components/operacional/ProdutividadeDashboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getProdutividadeColaborador, matchesProdutividadeColaborador, type ProdutividadeColaborador } from './produtividadeColaborador';
import { exportarAtividadesExcel, type ProdutividadePeriodo } from './produtividadeExcel';

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const date = (value: string) => value.split('-').reverse().join('/');
const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim();
const groups = [
  { name: 'Separação', icon: PackageOpen, color: 'hsl(var(--chart-1))', fields: [['pedidos_separados', 'Pedidos'], ['unidades_separadas', 'Unidades']] },
  { name: 'Conferência', icon: ClipboardCheck, color: 'hsl(var(--chart-2))', fields: [['pedidos_conferidos', 'Pedidos'], ['unidades_pedidos_marcados_conferidos', 'Unidades dos pedidos'], ['unidades_conferidas_registradas', 'Unidades por leitura']] },
  { name: 'Notas fiscais', icon: FileText, color: 'hsl(var(--chart-4))', fields: [['notas_lancadas', 'Notas lançadas']] },
  { name: 'Guarda', icon: PackageCheck, color: 'hsl(var(--chart-3))', fields: [['unidades_guardadas', 'Unidades guardadas']] },
] as const;

function ActivityRow({ row, byDay }: { row: ProdutividadeLinha; byDay: boolean }) {
  const person = row.nome_responsavel?.trim() || 'Sem nome';
  return (
    <details className="group/activity border-t border-border/60">
      <summary className="grid min-h-12 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 px-3 py-2 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto_auto] [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{byDay ? person : date(row.data_atividade)}</span>
          <span className="block text-xs text-muted-foreground">Filial {row.cod_empresa}{row.identificacao_responsavel && ' · ' + row.identificacao_responsavel}</span>
        </span>
        <span className="col-start-1 row-start-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground sm:col-start-2 sm:row-start-1">
          <span><strong className="tabular-nums text-foreground">{number.format(row.pedidos_separados)}</strong> separados</span>
          <span><strong className="tabular-nums text-foreground">{number.format(row.pedidos_conferidos)}</strong> conferidos</span>
          <span><strong className="tabular-nums text-foreground">{number.format(row.notas_lancadas)}</strong> NF</span>
          <span><strong className="tabular-nums text-foreground">{number.format(row.unidades_guardadas)}</strong> un. guardadas</span>
        </span>
        <ChevronDown className="col-start-2 row-start-1 h-4 w-4 text-muted-foreground transition-transform group-open/activity:rotate-180 sm:col-start-3" aria-hidden="true" />
      </summary>
      <div className="grid grid-cols-2 gap-2 bg-muted/20 px-3 pb-3 pt-1 lg:grid-cols-4">
        {groups.map(({ name, icon: Icon, color, fields }) => (
          <section key={name} className="min-w-0 rounded-sm border bg-card p-2.5">
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
              <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} aria-hidden="true" />{name}
            </h3>
            <dl className="space-y-1 text-xs">
              {fields.map(([key, label]) => (
                <div key={key} className="flex items-baseline justify-between gap-1.5">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-semibold tabular-nums">{number.format(row[key])}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </details>
  );
}

export function ProdutividadeAtividades({ rows, periodo, collaborator, onClearCollaborator }: {
  rows: ProdutividadeLinha[];
  periodo: ProdutividadePeriodo;
  collaborator: ProdutividadeColaborador | null;
  onClearCollaborator: () => void;
}) {
  const [query, setQuery] = useState('');
  const [groupBy, setGroupBy] = useState('dia');
  const [exporting, setExporting] = useState(false);
  const { inicio, fim, filial } = periodo;
  const byDay = groupBy === 'dia';
  const results = useMemo(() => {
    const term = normalize(query);
    const matching = rows.filter(row =>
      row.data_atividade >= inicio && row.data_atividade <= fim &&
      (!filial || Number(row.cod_empresa) === Number(filial)) &&
      (!collaborator || matchesProdutividadeColaborador(row, collaborator)) &&
      normalize((row.nome_responsavel ?? '') + ' ' + (row.identificacao_responsavel ?? '')).includes(term)
    );
    const buckets = new Map<string, { label: string; rows: ProdutividadeLinha[] }>();
    for (const row of matching) {
      const person = getProdutividadeColaborador(row);
      const key = byDay ? row.data_atividade : person.id;
      const label = byDay ? date(row.data_atividade) : person.name + ' · Filial ' + person.branch;
      const bucket = buckets.get(key) ?? { label, rows: [] };
      bucket.rows.push(row);
      buckets.set(key, bucket);
    }
    const sorted = [...buckets.entries()].sort(([keyA, a], [keyB, b]) =>
      byDay ? keyB.localeCompare(keyA) : a.label.localeCompare(b.label, 'pt-BR'));
    for (const [, bucket] of sorted) {
      bucket.rows.sort((a, b) => byDay
        ? (a.nome_responsavel ?? '').localeCompare(b.nome_responsavel ?? '', 'pt-BR') || a.cod_empresa - b.cod_empresa
        : b.data_atividade.localeCompare(a.data_atividade));
    }
    return { count: matching.length, sorted };
  }, [rows, query, byDay, collaborator, inicio, fim, filial]);

  async function exportActivities() {
    setExporting(true);
    try {
      await exportarAtividadesExcel(results.sorted.flatMap(([, group]) => group.rows), periodo);
    } catch {
      toast.error('Não foi possível exportar as atividades.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <section aria-label="Registros de produtividade" className="space-y-2">
      <div className="operational-toolbar flex flex-wrap items-center gap-2 rounded-sm border bg-card p-2">
        {collaborator && (
          <Button type="button" variant="outline" size="sm" className="h-8 max-w-full gap-1.5 border-primary/40 bg-primary/10 px-2.5 text-xs"
            aria-label={'Remover filtro de ' + collaborator.name} onClick={onClearCollaborator}>
            <Users className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">{collaborator.name}</span>
            <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </Button>
        )}
        <label className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <span className="sr-only">Buscar responsável</span>
          <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar responsável" className="h-8 pl-8 text-sm" />
        </label>
        <div role="group" aria-label="Agrupar atividades" className="flex gap-0.5 rounded-sm border bg-muted/30 p-0.5">
          <Button type="button" size="sm" variant={byDay ? 'outline' : 'ghost'} aria-pressed={byDay} onClick={() => setGroupBy('dia')} className="h-7 gap-1.5 px-2 text-xs">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />Por dia
          </Button>
          <Button type="button" size="sm" variant={byDay ? 'ghost' : 'outline'} aria-pressed={!byDay} onClick={() => setGroupBy('responsavel')} className="h-7 gap-1.5 px-2 text-xs">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />Por responsável
          </Button>
        </div>
        <span aria-live="polite" className="ml-auto px-1 text-xs text-muted-foreground">{number.format(results.count)} {results.count === 1 ? 'registro' : 'registros'}</span>
        <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1.5 text-xs"
          disabled={results.count === 0 || exporting} onClick={() => void exportActivities()}>
          <Download className="h-4 w-4" aria-hidden="true" />{exporting ? 'Exportando…' : 'Exportar Excel'}
        </Button>
      </div>
      {results.sorted.length === 0 && (
        <p className="operational-panel p-4 text-sm text-muted-foreground">
          {collaborator ? 'Nenhuma atividade para este responsável nos filtros atuais.' : rows.length ? 'Nenhum responsável encontrado.' : 'Nenhuma atividade no período.'}
        </p>
      )}
      {results.sorted.map(([key, group], index) => (
        <details key={groupBy + key} open={index === 0 ? true : undefined} className="group/bucket operational-table-frame overflow-hidden rounded-sm border bg-card">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 bg-muted/30 px-3 text-sm font-medium hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            {byDay ? <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" /> : <Users className="h-4 w-4 text-primary" aria-hidden="true" />}
            {group.label}
            <span className="ml-auto whitespace-nowrap text-xs font-normal text-muted-foreground">{group.rows.length} {group.rows.length === 1 ? 'registro' : 'registros'}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open/bucket:rotate-180" aria-hidden="true" />
          </summary>
          {group.rows.map((row, rowIndex) => (
            <ActivityRow key={[row.data_atividade, row.cod_empresa, row.identificacao_responsavel, rowIndex].join('|')} row={row} byDay={byDay} />
          ))}
        </details>
      ))}
    </section>
  );
}
