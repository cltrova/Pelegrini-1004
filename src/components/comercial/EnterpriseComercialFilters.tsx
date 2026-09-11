import { useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import {
  EnterpriseFilterBar,
  type EnterpriseOption,
} from '@/components/enterprise';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ComercialFilters as ComercialFiltersType } from '@/types/comercial';
import {
  COMERCIAL_MESES,
  ComercialFilters,
  computeFimPeriodo,
  countActiveFilters,
  getComercialFiltersSummary,
  getMesAtual,
} from './ComercialFilters';

interface EnterpriseComercialFiltersProps {
  pendingFilters: ComercialFiltersType;
  appliedFilters: ComercialFiltersType;
  onPendingFiltersChange: (filters: ComercialFiltersType) => void;
  onApply: () => void;
  onClear: () => void;
  hasChanges: boolean;
  anos: string[];
  vendedores?: { codigo: string | number; nome: string }[];
  clientes?: { codigo: string | number; nome: string }[];
  marcas?: string[];
  empresas?: string[];
  resultCount?: number;
  showVendedorFilter?: boolean;
  showClienteFilter?: boolean;
  showMarcaFilter?: boolean;
  vendedorFilterVariant1004?: 'default' | 'campanhas';
  vendedorFilterEquipe1004?: 'transmissao' | 'chevrolet';
  monthOnly?: boolean;
  extraFields?: ReactNode;
  useNativeControls?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const toOptions = (
  items: readonly { codigo: string | number; nome: string }[] = [],
): EnterpriseOption[] =>
  items.map((item) => ({
    value: String(item.codigo),
    label: item.nome,
    description: `#${item.codigo}`,
  }));

const monthOptions: EnterpriseOption[] = COMERCIAL_MESES.map((mes) => ({
  value: mes.value,
  label: mes.label.replace(/^./, (char) => char.toUpperCase()),
}));

function CommercialFieldShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="min-w-[9rem] max-w-full flex-1 space-y-1 sm:flex-none">
      <span className="block text-[10px] font-semibold uppercase text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function CommercialSelectFilter({
  label,
  value,
  options,
  onChange,
  allLabel = 'Todos',
}: {
  label: string;
  value?: string;
  options: EnterpriseOption[];
  onChange: (value: string | undefined) => void;
  allLabel?: string;
}) {
  return (
    <CommercialFieldShell label={label}>
      <Select value={value ?? '__all'} onValueChange={(next) => onChange(next === '__all' ? undefined : next)}>
        <SelectTrigger aria-label={label} className="h-8 min-w-[9rem] bg-background text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="commercial-overlay">
          <SelectItem value="__all">{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </CommercialFieldShell>
  );
}

function CommercialMultiSelectFilter({
  label,
  values,
  options,
  onChange,
  searchable = true,
  allLabel = 'Todos',
}: {
  label: string;
  values: string[];
  options: EnterpriseOption[];
  onChange: (values: string[]) => void;
  searchable?: boolean;
  allLabel?: string;
}) {
  const [search, setSearch] = useState('');
  const selected = new Set(values);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? options.filter((option) => `${option.label} ${option.value}`.toLowerCase().includes(query))
      : options;
  }, [options, search]);
  const display = values.length === 0
    ? allLabel
    : values.length === 1
      ? options.find((option) => option.value === values[0])?.label ?? values[0]
      : `${values.length} selecionados`;

  return (
    <div className="min-w-[9rem] max-w-full flex-1 space-y-1 sm:flex-none">
      <span className="block text-[10px] font-semibold uppercase text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button aria-label={`${label}: ${display}`} className="h-8 min-w-[9rem] max-w-[15rem] justify-between bg-background px-2 text-xs font-normal" type="button" variant="outline">
            <span className="truncate">{display}</span>
            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="commercial-overlay w-[18rem] p-2">
          {searchable && (
            <div className="relative mb-2">
              <Search aria-hidden="true" className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 pl-7 text-xs" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar..." value={search} />
            </div>
          )}
          <button className="mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => onChange([])} type="button">
            <span className="flex h-4 w-4 items-center justify-center rounded border border-border">{values.length === 0 && <Check className="h-3 w-3" />}</span>
            {allLabel}
          </button>
          <div className="max-h-56 overflow-y-auto">
            {filtered.map((option) => {
              const active = selected.has(option.value);
              return (
                <button
                  className={cn('flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted', active && 'bg-muted/70')}
                  key={option.value}
                  onClick={() => onChange(active ? values.filter((selectedValue) => selectedValue !== option.value) : [...values, option.value])}
                  type="button"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border bg-background">
                    {active && <Check aria-hidden="true" className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.description && <span className="shrink-0 text-[10px] text-muted-foreground">{option.description}</span>}
                </button>
              );
            })}
          </div>
          {values.length > 0 && (
            <Button className="mt-2 h-8 w-full gap-1.5 text-xs" onClick={() => onChange([])} size="sm" type="button" variant="ghost">
              <X aria-hidden="true" className="h-3.5 w-3.5" />
              Limpar {label.toLowerCase()}
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

const toPeriodo = (anos: string[] = [], meses: string[] = []): ComercialFiltersType['periodo'] => {
  const anosValidos = Array.from(
    new Set(
      anos
        .map(Number)
        .filter((ano) => Number.isInteger(ano) && ano >= 2000 && ano <= 2100),
    ),
  ).sort((a, b) => a - b);
  const mesesValidos = meses.map(Number).filter((mes) => Number.isInteger(mes) && mes >= 1 && mes <= 12);

  if (anosValidos.length === 0 || mesesValidos.length === 0) return undefined;

  const menorAno = anosValidos[0];
  const maiorAno = anosValidos[anosValidos.length - 1];
  const menorMes = Math.min(...mesesValidos);
  const maiorMes = Math.max(...mesesValidos);
  const inicio = new Date(menorAno, menorMes - 1, 1);
  const yyyy = inicio.getFullYear();
  const mm = String(inicio.getMonth() + 1).padStart(2, '0');
  const dd = String(inicio.getDate()).padStart(2, '0');

  return {
    inicio: `${yyyy}-${mm}-${dd}`,
    fim: computeFimPeriodo(maiorAno, maiorMes),
  };
};

export function EnterpriseComercialFilters({
  pendingFilters,
  appliedFilters,
  onPendingFiltersChange,
  onApply,
  onClear,
  hasChanges,
  anos,
  vendedores = [],
  clientes = [],
  marcas = [],
  empresas = [],
  resultCount,
  showVendedorFilter = false,
  showClienteFilter = false,
  showMarcaFilter = false,
  vendedorFilterVariant1004 = 'default',
  vendedorFilterEquipe1004 = 'transmissao',
  monthOnly = false,
  extraFields,
  useNativeControls = false,
  isOpen,
  onOpenChange,
}: EnterpriseComercialFiltersProps) {
  const summary = getComercialFiltersSummary(appliedFilters, vendedores, clientes)
    .map((item) => `${item.label}: ${item.value}`)
    .join(' | ');
  const activeCount = countActiveFilters(appliedFilters);
  const update = (patch: Partial<ComercialFiltersType>) =>
    onPendingFiltersChange({ ...pendingFilters, ...patch });
  const updatePeriodo = (nextAnos: string[], nextMeses: string[]) =>
    update({
      anos: nextAnos,
      meses: nextMeses,
      periodo: toPeriodo(nextAnos, nextMeses),
    });
  const pendingVendedores = (
    pendingFilters.vendedores || (pendingFilters.vendedor ? [pendingFilters.vendedor] : [])
  ).map(String);
  const pendingMarcas = (
    pendingFilters.marcas || (pendingFilters.marca ? [pendingFilters.marca] : [])
  ).map(String);

  if (useNativeControls) {
    return (
      <EnterpriseFilterBar
        activeCount={activeCount}
        applyLabel="Buscar"
        onApply={onApply}
        onClear={onClear}
        resultCount={resultCount}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        summary={summary}
      >
        <div className="basis-full min-w-0">
          <ComercialFilters
            anos={anos}
            clientes={clientes}
            collapsible={false}
            embedded
            empresas={empresas}
            extraFields={extraFields}
            filters={pendingFilters}
            hasChanges={hasChanges}
            hideActions
            marcas={marcas}
            monthOnly={monthOnly}
            onFiltersChange={onPendingFiltersChange}
            showClienteFilter={showClienteFilter}
            showMarcaFilter={showMarcaFilter}
            showVendedorFilter={showVendedorFilter}
            vendedorFilterEquipe1004={vendedorFilterEquipe1004}
            vendedorFilterVariant1004={vendedorFilterVariant1004}
            vendedores={vendedores}
          />
        </div>
      </EnterpriseFilterBar>
    );
  }

  return (
    <EnterpriseFilterBar
      activeCount={activeCount}
      applyLabel="Buscar"
      onApply={onApply}
      onClear={onClear}
      resultCount={resultCount}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      summary={summary}
    >
      <CommercialSelectFilter
        allLabel="Todos os anos"
        label="Ano"
        onChange={(value) =>
          updatePeriodo(value ? [value] : [], pendingFilters.meses?.length ? pendingFilters.meses.map(String) : [getMesAtual()])
        }
        options={anos.map((ano) => ({ value: ano, label: ano }))}
        value={pendingFilters.anos?.[0]}
      />
      <CommercialMultiSelectFilter
        allLabel="Todos os meses"
        label="Periodo"
        onChange={(values) => updatePeriodo((pendingFilters.anos || []).map(String), values)}
        options={monthOptions}
        values={(pendingFilters.meses || []).map(String)}
      />
      {showVendedorFilter && (
        <CommercialMultiSelectFilter
          allLabel="Todos os vendedores"
          label="Vendedor"
          onChange={(values) =>
            update({
              vendedores: values.length ? values : undefined,
              vendedor: values.length === 1 ? values[0] : undefined,
            })
          }
          options={toOptions(vendedores)}
          values={pendingVendedores}
        />
      )}
      {showClienteFilter && (
        <CommercialSelectFilter
          allLabel="Todos os clientes"
          label="Cliente"
          onChange={(value) => update({ cliente: value })}
          options={toOptions(clientes)}
          value={pendingFilters.cliente ? String(pendingFilters.cliente) : undefined}
        />
      )}
      {showMarcaFilter && (
        <CommercialMultiSelectFilter
          allLabel="Todas as marcas"
          label="Marca"
          onChange={(values) =>
            update({
              marcas: values.length ? values : undefined,
              marca: values.length === 1 ? values[0] : undefined,
            })
          }
          options={marcas.map((marca) => ({ value: marca, label: marca }))}
          values={pendingMarcas}
        />
      )}
      <CommercialSelectFilter
        allLabel="Pedidos e devolucoes"
        label="Tipo"
        onChange={(value) => update({ tipo: (value as ComercialFiltersType['tipo']) || 'todos' })}
        options={[
          { value: 'PEDIDO', label: 'Apenas pedidos' },
          { value: 'DEVOLUCAO', label: 'Apenas devolucoes' },
        ]}
        value={pendingFilters.tipo === 'todos' ? undefined : pendingFilters.tipo}
      />
    </EnterpriseFilterBar>
  );
}
