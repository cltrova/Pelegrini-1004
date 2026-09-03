import { Input } from '@/components/ui/input';
import {
  EnterpriseFilterBar,
  EnterpriseMultiSelectFilter,
  EnterpriseSearchFilter,
  EnterpriseSelectFilter,
} from '@/components/enterprise';
import type { ResumoFilters } from '@/types/resumo';

const MESES = [
  { value: '01', label: 'Jan' },
  { value: '02', label: 'Fev' },
  { value: '03', label: 'Mar' },
  { value: '04', label: 'Abr' },
  { value: '05', label: 'Mai' },
  { value: '06', label: 'Jun' },
  { value: '07', label: 'Jul' },
  { value: '08', label: 'Ago' },
  { value: '09', label: 'Set' },
  { value: '10', label: 'Out' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dez' },
];

const statusOptions: { value: ResumoFilters['status']; label: string }[] = [
  { value: 'em_aberto_nao_faturado', label: 'Em aberto (nao faturado)' },
  { value: 'faturado_a_receber', label: 'Faturado a receber' },
  { value: 'vencida', label: 'Vencidas' },
  { value: 'a_vencer', label: 'A vencer' },
  { value: 'pago', label: 'Pagas' },
];

const emptyFilters: ResumoFilters = {
  search: '',
  status: 'todos',
  empresa: 'todas',
  anos: [],
  meses: [],
  dataInicio: null,
  dataFim: null,
};

interface EnterpriseResumoFiltersProps {
  filters: ResumoFilters;
  onChange: (filters: ResumoFilters) => void;
  empresas: string[];
  anos?: string[];
}

export function EnterpriseResumoFilters({ filters, onChange, empresas, anos = [] }: EnterpriseResumoFiltersProps) {
  const update = (patch: Partial<ResumoFilters>) => onChange({ ...filters, ...patch });
  const activeCount = [
    filters.search,
    filters.status !== 'todos',
    filters.empresa !== 'todas',
    (filters.anos?.length ?? 0) > 0,
    (filters.meses?.length ?? 0) > 0,
    filters.dataInicio,
    filters.dataFim,
  ].filter(Boolean).length;
  const summary = [
    filters.search ? `Busca: ${filters.search}` : null,
    filters.status !== 'todos' ? statusOptions.find((option) => option.value === filters.status)?.label : null,
    filters.empresa !== 'todas' ? filters.empresa : null,
    filters.anos?.length ? `${filters.anos.length} ano(s)` : null,
    filters.meses?.length ? `${filters.meses.length} mes(es)` : null,
  ].filter(Boolean).join(' | ');

  return (
    <EnterpriseFilterBar activeCount={activeCount} onClear={() => onChange(emptyFilters)} summary={summary}>
      <EnterpriseSearchFilter
        label="Busca"
        onChange={(value) => update({ search: value })}
        placeholder="Buscar cliente, codigo ou duplicata..."
        value={filters.search}
      />
      <EnterpriseSelectFilter
        allLabel="Todos os status"
        label="Status"
        onChange={(value) => update({ status: (value as ResumoFilters['status'] | undefined) ?? 'todos' })}
        options={statusOptions}
        value={filters.status === 'todos' ? undefined : filters.status}
      />
      <EnterpriseSelectFilter
        allLabel="Todas as filiais"
        label="Filial"
        onChange={(value) => update({ empresa: value ?? 'todas' })}
        options={empresas.map((empresa) => ({ value: empresa, label: empresa }))}
        value={filters.empresa === 'todas' ? undefined : filters.empresa}
      />
      <EnterpriseMultiSelectFilter
        allLabel="Todos os anos"
        label="Ano"
        onChange={(values) => update({ anos: values })}
        options={anos.map((ano) => ({ value: ano, label: ano }))}
        searchable={false}
        values={filters.anos ?? []}
      />
      <EnterpriseMultiSelectFilter
        allLabel="Todos os meses"
        label="Mes"
        onChange={(values) => update({ meses: values })}
        options={MESES}
        searchable={false}
        values={filters.meses ?? []}
      />
      <label className="min-w-[9rem] max-w-full space-y-1">
        <span className="block text-[10px] font-semibold uppercase text-muted-foreground">Inicio</span>
        <Input className="h-8 text-xs" onChange={(event) => update({ dataInicio: event.target.value || null })} type="date" value={filters.dataInicio ?? ''} />
      </label>
      <label className="min-w-[9rem] max-w-full space-y-1">
        <span className="block text-[10px] font-semibold uppercase text-muted-foreground">Fim</span>
        <Input className="h-8 text-xs" onChange={(event) => update({ dataFim: event.target.value || null })} type="date" value={filters.dataFim ?? ''} />
      </label>
    </EnterpriseFilterBar>
  );
}
