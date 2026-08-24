import { useMemo } from 'react';
import { EstoqueFiltersState } from '@/types/estoque';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FilterDropdownChip, MultiSelectOptions, SingleSelectOptions } from '@/components/common/FilterDropdownChip';
import { UnifiedFilterBar } from '@/components/common/UnifiedFilterBar';
import { Search, ToggleLeft, ToggleRight, Download, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  filters: EstoqueFiltersState;
  setFilters: React.Dispatch<React.SetStateAction<EstoqueFiltersState>>;
  filterOptions: {
    empresas: string[];
    marcas: string[];
    grupos: string[];
    curvasABC: string[];
  };
  filteredCount: number;
  totalCount: number;
  onExport?: () => void;
}

const CURVA_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'N'];

const DIAS_SEM_VENDA_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: '0', label: '0 dias' },
  { value: '7+', label: '7+' },
  { value: '15+', label: '15+' },
  { value: '30+', label: '30+' },
  { value: '60+', label: '60+' },
  { value: '90+', label: '90+' },
  { value: '180+', label: '180+' },
  { value: '360+', label: '360+' },
];

const PERIODO_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'custom', label: 'Personalizado' },
];

export function EstoqueFilters({ filters, setFilters, filterOptions, filteredCount, totalCount, onExport }: Props) {
  const toggleViewMode = () => {
    setFilters(f => ({
      ...f,
      viewMode: f.viewMode === 'consolidado' ? 'detalhado' : 'consolidado',
    }));
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.empresas.length > 0) count++;
    if (filters.marcas.length > 0) count++;
    if (filters.curvasABC.length > 0) count++;
    if (filters.diasSemVenda !== 'todos') count++;
    if (filters.periodo !== 'todos') count++;
    return count;
  }, [filters]);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (filters.empresas.length > 0) parts.push(`${filters.empresas.length} filial(is)`);
    if (filters.marcas.length > 0) parts.push(`${filters.marcas.length} marca(s)`);
    if (filters.curvasABC.length > 0) parts.push(`Curva ${filters.curvasABC.join(', ')}`);
    if (filters.diasSemVenda !== 'todos') parts.push(`${DIAS_SEM_VENDA_OPTIONS.find(o => o.value === filters.diasSemVenda)?.label} s/ venda`);
    if (filters.periodo !== 'todos') parts.push(PERIODO_OPTIONS.find(o => o.value === filters.periodo)?.label || '');
    return parts.join(' · ');
  }, [filters]);

  const clearFilters = () => {
    setFilters(f => ({
      ...f,
      empresas: [],
      marcas: [],
      grupos: [],
      curvasABC: [],
      searchTerm: '',
      diasSemVenda: 'todos',
      periodo: 'todos',
      periodoInicio: undefined,
      periodoFim: undefined,
    }));
  };

  return (
    <div className="space-y-3">
      {/* Top bar: view toggle + search + export */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={toggleViewMode}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
        >
          {filters.viewMode === 'consolidado' ? (
            <ToggleLeft className="h-5 w-5 text-amber-500" />
          ) : (
            <ToggleRight className="h-5 w-5 text-blue-500" />
          )}
          <span className="text-sm font-medium">
            {filters.viewMode === 'consolidado' ? 'Filial Consolidada' : 'Filial Separada'}
          </span>
        </button>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto, fabricante, marca..."
            value={filters.searchTerm}
            onChange={(e) => setFilters(f => ({ ...f, searchTerm: e.target.value }))}
            className="pl-9 h-9"
          />
        </div>

        <Badge variant="secondary" className="text-xs tabular-nums">
          {filteredCount.toLocaleString('pt-BR')} / {totalCount.toLocaleString('pt-BR')} itens
        </Badge>

        {onExport && (
          <Button variant="outline" size="sm" className="gap-2 ml-auto" onClick={onExport}>
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        )}
      </div>

      {/* Unified filter bar */}
      <UnifiedFilterBar
        activeCount={activeFiltersCount}
        summary={filterSummary}
        onClear={clearFilters}
      >
        <FilterDropdownChip
          label="Filial"
          displayValue={filters.empresas.length > 0 ? `${filters.empresas.length} selecionada(s)` : 'Todas'}
          isActive={filters.empresas.length > 0}
          onClear={() => setFilters(f => ({ ...f, empresas: [] }))}
        >
          <MultiSelectOptions
            options={filterOptions.empresas}
            selected={filters.empresas}
            onChange={(v) => setFilters(f => ({ ...f, empresas: v }))}
            allLabel="Todas"
          />
        </FilterDropdownChip>

        <FilterDropdownChip
          label="Marca"
          displayValue={filters.marcas.length > 0 ? `${filters.marcas.length} selecionada(s)` : 'Todas'}
          isActive={filters.marcas.length > 0}
          onClear={() => setFilters(f => ({ ...f, marcas: [] }))}
        >
          <MultiSelectOptions
            options={filterOptions.marcas}
            selected={filters.marcas}
            onChange={(v) => setFilters(f => ({ ...f, marcas: v }))}
            searchable
            allLabel="Todas"
          />
        </FilterDropdownChip>

        <FilterDropdownChip
          label="Curva"
          displayValue={filters.curvasABC.length > 0 ? filters.curvasABC.join(', ') : 'Todas'}
          isActive={filters.curvasABC.length > 0}
          onClear={() => setFilters(f => ({ ...f, curvasABC: [] }))}
        >
          <MultiSelectOptions
            options={CURVA_OPTIONS}
            selected={filters.curvasABC}
            onChange={(v) => setFilters(f => ({ ...f, curvasABC: v }))}
            allLabel="Todas"
          />
        </FilterDropdownChip>

        <FilterDropdownChip
          label="Dias s/ Venda"
          displayValue={DIAS_SEM_VENDA_OPTIONS.find(o => o.value === filters.diasSemVenda)?.label || 'Todos'}
          isActive={filters.diasSemVenda !== 'todos'}
          onClear={() => setFilters(f => ({ ...f, diasSemVenda: 'todos' }))}
        >
          <SingleSelectOptions
            options={DIAS_SEM_VENDA_OPTIONS}
            selected={filters.diasSemVenda}
            onChange={(v) => setFilters(f => ({ ...f, diasSemVenda: v }))}
          />
        </FilterDropdownChip>

        <FilterDropdownChip
          label="Período"
          displayValue={PERIODO_OPTIONS.find(o => o.value === filters.periodo)?.label || 'Todos'}
          isActive={filters.periodo !== 'todos'}
          onClear={() => setFilters(f => ({ ...f, periodo: 'todos', periodoInicio: undefined, periodoFim: undefined }))}
        >
          <div className="space-y-2">
            <SingleSelectOptions
              options={PERIODO_OPTIONS}
              selected={filters.periodo}
              onChange={(v) => setFilters(f => ({ ...f, periodo: v }))}
            />
            {filters.periodo === 'custom' && (
              <div className="flex items-center gap-2 pt-1 border-t border-border">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
                      <CalendarIcon className="h-3 w-3" />
                      {filters.periodoInicio
                        ? format(new Date(filters.periodoInicio), 'dd/MM/yy', { locale: ptBR })
                        : 'Início'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[60]" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.periodoInicio ? new Date(filters.periodoInicio) : undefined}
                      onSelect={(d) => setFilters(f => ({ ...f, periodoInicio: d?.toISOString() }))}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-[10px] text-muted-foreground">até</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
                      <CalendarIcon className="h-3 w-3" />
                      {filters.periodoFim
                        ? format(new Date(filters.periodoFim), 'dd/MM/yy', { locale: ptBR })
                        : 'Fim'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[60]" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.periodoFim ? new Date(filters.periodoFim) : undefined}
                      onSelect={(d) => setFilters(f => ({ ...f, periodoFim: d?.toISOString() }))}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </FilterDropdownChip>
      </UnifiedFilterBar>
    </div>
  );
}
