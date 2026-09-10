import { Filter, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ComercialFilterBar } from '@/components/comercial/compact';
import type { MotivoPerda } from '@/hooks/useMotivosPerda';
import type { CotacaoOrigem, CotacaoStatus, CotacoesFiltros } from '@/types/cotacoesComerciais';

export interface CotacoesFilterOption<TValue extends string = string> {
  value: TValue;
  label: string;
}

interface CotacoesFiltersProps {
  mode: CotacaoOrigem;
  pendingFilters: CotacoesFiltros;
  onPendingFiltersChange: (filters: CotacoesFiltros) => void;
  vendedores: readonly CotacoesFilterOption[];
  clientes: readonly CotacoesFilterOption[];
  motivos: readonly CotacoesFilterOption<MotivoPerda>[];
  onApply: (filters: CotacoesFiltros) => void;
  onClear: () => void;
}

const statusOptions: readonly CotacoesFilterOption<CotacaoStatus>[] = [
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'recusada', label: 'Recusada' },
  { value: 'vencida', label: 'Vencida' },
];

function toggleValue<TValue extends string>(values: readonly TValue[], value: TValue): TValue[] {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}

function CheckboxFilterGroup<TValue extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly CotacoesFilterOption<TValue>[];
  selected: readonly TValue[];
  onChange: (values: TValue[]) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-medium text-muted-foreground">{label}</legend>
      <div className="max-h-40 space-y-1 overflow-y-auto">
        {options.map((option) => {
          const inputId = `${label}-${option.value}`;
          return (
            <label key={option.value} htmlFor={inputId} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted">
              <Checkbox
                id={inputId}
                checked={selected.includes(option.value)}
                onCheckedChange={() => onChange(toggleValue(selected, option.value))}
              />
              <span className="min-w-0">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function parseAging(value: string): number | null {
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function copyFilters(filters: CotacoesFiltros): CotacoesFiltros {
  return {
    ...filters,
    vendedores: [...filters.vendedores],
    clientes: [...filters.clientes],
    status: [...filters.status],
    motivos: [...filters.motivos],
  };
}

export function CotacoesFilters({
  mode,
  pendingFilters,
  onPendingFiltersChange,
  vendedores,
  clientes,
  motivos,
  onApply,
  onClear,
}: CotacoesFiltersProps) {
  const isOpenQuotes = mode === 'abertas';
  const searchPlaceholder = isOpenQuotes
    ? 'Buscar cotacao, cliente ou vendedor'
    : 'Buscar venda, cliente ou vendedor';
  const updateFilters = (changes: Partial<CotacoesFiltros>) => {
    onPendingFiltersChange({ ...pendingFilters, ...changes });
  };

  const searchControl = (
    <div className="min-w-[13rem] flex-1">
      <label htmlFor="cotacoes-busca" className="sr-only">Buscar cotacoes</label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          id="cotacoes-busca"
          value={pendingFilters.busca}
          onChange={(event) => updateFilters({ busca: event.target.value })}
          placeholder={searchPlaceholder}
          className="h-9 pl-8"
        />
      </div>
    </div>
  );

  const secondaryControls = isOpenQuotes ? (
    <>
      <CheckboxFilterGroup
        label="Vendedores"
        options={vendedores}
        selected={pendingFilters.vendedores}
        onChange={(values) => updateFilters({ vendedores: values })}
      />
      <CheckboxFilterGroup
        label="Clientes"
        options={clientes}
        selected={pendingFilters.clientes}
        onChange={(values) => updateFilters({ clientes: values })}
      />
      <fieldset className="space-y-1.5">
        <legend className="text-xs font-medium text-muted-foreground">Faixa de dias em aberto</legend>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="cotacoes-dias-min" className="sr-only">Dias minimos em aberto</label>
            <Input
              id="cotacoes-dias-min"
              type="number"
              min={0}
              inputMode="numeric"
              value={pendingFilters.diasMin ?? ''}
              onChange={(event) => updateFilters({ diasMin: parseAging(event.target.value) })}
              placeholder="Dias min."
              className="h-9 tabular-nums"
            />
          </div>
          <div>
            <label htmlFor="cotacoes-dias-max" className="sr-only">Dias maximos em aberto</label>
            <Input
              id="cotacoes-dias-max"
              type="number"
              min={0}
              inputMode="numeric"
              value={pendingFilters.diasMax ?? ''}
              onChange={(event) => updateFilters({ diasMax: parseAging(event.target.value) })}
              placeholder="Dias max."
              className="h-9 tabular-nums"
            />
          </div>
        </div>
      </fieldset>
    </>
  ) : (
    <>
      <CheckboxFilterGroup
        label="Status"
        options={statusOptions}
        selected={pendingFilters.status}
        onChange={(values) => updateFilters({ status: values })}
      />
      <CheckboxFilterGroup
        label="Motivos"
        options={motivos}
        selected={pendingFilters.motivos}
        onChange={(values) => updateFilters({ motivos: values })}
      />
      <CheckboxFilterGroup
        label="Vendedores"
        options={vendedores}
        selected={pendingFilters.vendedores}
        onChange={(values) => updateFilters({ vendedores: values })}
      />
      <CheckboxFilterGroup
        label="Clientes"
        options={clientes}
        selected={pendingFilters.clientes}
        onChange={(values) => updateFilters({ clientes: values })}
      />
    </>
  );

  return (
    <ComercialFilterBar
      ariaLabel="Filtros de cotacoes"
      mode={mode}
      search={searchControl}
      primary={(
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-9">
              <Filter aria-hidden="true" className="h-3.5 w-3.5" />
              Mais filtros
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto p-3" aria-label="Filtros avancados de cotacoes">
            <div className="space-y-4">{secondaryControls}</div>
          </PopoverContent>
        </Popover>
      )}
      actions={(
        <>
          <Button type="button" size="sm" className="h-9" onClick={() => onApply(copyFilters(pendingFilters))}>
            Aplicar
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Limpar filtros" onClick={onClear}>
                  <RotateCcw aria-hidden="true" className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Limpar filtros</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </>
      )}
    />
  );
}
