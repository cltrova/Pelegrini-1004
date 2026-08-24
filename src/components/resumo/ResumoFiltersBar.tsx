import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { ResumoFilters } from '@/types/resumo';

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

interface Props {
  filters: ResumoFilters;
  onChange: (f: ResumoFilters) => void;
  empresas: string[];
  anos?: string[];
}

export function ResumoFiltersBar({ filters, onChange, empresas, anos = [] }: Props) {
  const update = (patch: Partial<ResumoFilters>) => onChange({ ...filters, ...patch });

  const reset = () =>
    onChange({
      search: '',
      status: 'todos',
      empresa: 'todas',
      anos: [],
      meses: [],
      dataInicio: null,
      dataFim: null,
    });

  const hasFilter =
    filters.search ||
    filters.status !== 'todos' ||
    filters.empresa !== 'todas' ||
    (filters.anos?.length ?? 0) > 0 ||
    (filters.meses?.length ?? 0) > 0 ||
    filters.dataInicio ||
    filters.dataFim;

  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, código ou duplicata..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="pl-9 h-9"
          />
        </div>

        <Select value={filters.status} onValueChange={(v) => update({ status: v as ResumoFilters['status'] })}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="em_aberto_nao_faturado">Em aberto (não faturado)</SelectItem>
            <SelectItem value="faturado_a_receber">Faturado a receber</SelectItem>
            <SelectItem value="vencida">Vencidas</SelectItem>
            <SelectItem value="a_vencer">A vencer</SelectItem>
            <SelectItem value="pago">Pagas</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.empresa || 'todas'}
          onValueChange={(v) => update({ empresa: v })}
        >
          <SelectTrigger className="h-9 w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as filiais</SelectItem>
            {empresas.map((e) => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.anos?.[0] || 'todos'}
          onValueChange={(v) => update({ anos: v === 'todos' ? [] : [v] })}
        >
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os anos</SelectItem>
            {anos.map((ano) => (
              <SelectItem key={ano} value={ano}>{ano}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.meses?.[0] || 'todos'}
          onValueChange={(v) => update({ meses: v === 'todos' ? [] : [v] })}
        >
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os meses</SelectItem>
            {MESES.map((mes) => (
              <SelectItem key={mes.value} value={mes.value}>{mes.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Input
            type="date"
            value={filters.dataInicio ?? ''}
            onChange={(e) => update({ dataInicio: e.target.value || null })}
            className="h-9 w-[150px]"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            value={filters.dataFim ?? ''}
            onChange={(e) => update({ dataFim: e.target.value || null })}
            className="h-9 w-[150px]"
          />
        </div>

        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={reset} className="h-9">
            <X className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
      </div>
    </Card>
  );
}
