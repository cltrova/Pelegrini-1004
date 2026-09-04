import { CircleCheck, PackageCheck, Search, SlidersHorizontal, X } from 'lucide-react';
import type { ReactNode } from 'react';

import { FilterDropdownChip, MultiSelectOptions } from '@/components/common/FilterDropdownChip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

import type { StockQuickFilter } from './estoqueIntelligence';

interface EstoqueFilterOptions {
  brands: string[];
  groups: string[];
  lines: string[];
}

interface EstoqueSmartFiltersProps {
  search: string;
  quickFilter: StockQuickFilter;
  brands: string[];
  groups: string[];
  lines: string[];
  options: EstoqueFilterOptions;
  onSearchChange: (search: string) => void;
  onQuickFilterChange: (filter: StockQuickFilter) => void;
  onBrandsChange: (brands: string[]) => void;
  onGroupsChange: (groups: string[]) => void;
  onLinesChange: (lines: string[]) => void;
  onClearAll: () => void;
  leading?: ReactNode;
  actions?: ReactNode;
}

const quickFilterLabels: Record<StockQuickFilter, string> = {
  all: 'Todos',
  available: 'Disponiveis',
  low: 'Estoque baixo',
  critical: 'Criticos',
  out: 'Sem estoque',
  stagnant: 'Parados',
  'with-stock': 'Com estoque',
  attention: 'Exigem atencao',
  excess: 'Capital em excesso',
};

interface ActiveChipProps {
  label: string;
  removeLabel: string;
  onRemove: () => void;
}

function ActiveChip({ label, removeLabel, onRemove }: ActiveChipProps) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-border bg-muted/50 py-1 pl-2 pr-1 text-xs text-foreground">
      <span className="truncate">{label}</span>
      <button
        aria-label={removeLabel}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onRemove}
        type="button"
      >
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

export function EstoqueSmartFilters({
  search,
  quickFilter,
  brands,
  groups,
  lines,
  options,
  onSearchChange,
  onQuickFilterChange,
  onBrandsChange,
  onGroupsChange,
  onLinesChange,
  onClearAll,
  leading,
  actions,
}: EstoqueSmartFiltersProps) {
  const hasFilters = Boolean(search || quickFilter !== 'all' || brands.length || groups.length || lines.length);
  const activeCount = Number(quickFilter !== 'all') + brands.length + groups.length + lines.length;

  return (
    <section className="min-w-0 space-y-2" aria-label="Busca e filtros do estoque">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {leading}
        <div className="relative min-w-[12rem] flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar no estoque"
            className="h-9 min-w-0 pl-9"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar produto, codigo ou referencia"
            type="search"
            value={search}
          />
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button aria-label={`Filtros${activeCount ? `, ${activeCount} ativos` : ''}`} className="h-9 gap-2" type="button" variant="outline">
              <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
              <span className="hidden sm:inline">Filtros</span>
              {activeCount > 0 && <span className="tabular-nums text-xs">{activeCount}</span>}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[min(92vw,25rem)] p-0 sm:max-w-md" side="right">
            <SheetHeader className="border-b border-border px-5 py-4 pr-12 text-left">
              <SheetTitle>Filtros do estoque</SheetTitle>
              <SheetDescription>Refine a listagem sem perder o contexto da consulta.</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 overflow-y-auto p-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Classificacao</p>
                <div className="flex flex-wrap gap-2">
                  <FilterDropdownChip
          displayValue={brands.length ? `${brands.length} selecionada(s)` : 'Todas'}
          isActive={brands.length > 0}
          label="Marca"
          onClear={() => onBrandsChange([])}
        >
          <MultiSelectOptions
            allLabel="Todas"
            onChange={onBrandsChange}
            options={options.brands}
            searchable
            selected={brands}
          />
                  </FilterDropdownChip>
                  <FilterDropdownChip
          displayValue={groups.length ? `${groups.length} selecionado(s)` : 'Todos'}
          isActive={groups.length > 0}
          label="Grupo"
          onClear={() => onGroupsChange([])}
        >
          <MultiSelectOptions
            allLabel="Todos"
            onChange={onGroupsChange}
            options={options.groups}
            searchable
            selected={groups}
          />
                  </FilterDropdownChip>
                  <FilterDropdownChip
          displayValue={lines.length ? `${lines.length} selecionada(s)` : 'Todas'}
          isActive={lines.length > 0}
          label="Linha"
          onClear={() => onLinesChange([])}
        >
          <MultiSelectOptions
            allLabel="Todas"
            onChange={onLinesChange}
            options={options.lines}
            searchable
            selected={lines}
          />
                  </FilterDropdownChip>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Disponibilidade</p>
                <div aria-label="Filtros rapidos de disponibilidade" className="flex flex-wrap items-center gap-2" role="group">
          <Button
            aria-pressed={quickFilter === 'available'}
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => onQuickFilterChange(quickFilter === 'available' ? 'all' : 'available')}
            size="sm"
            type="button"
            variant={quickFilter === 'available' ? 'secondary' : 'outline'}
          >
            <CircleCheck aria-hidden="true" className="h-3.5 w-3.5" />
            Disponiveis
          </Button>
          <Button
            aria-pressed={quickFilter === 'with-stock'}
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => onQuickFilterChange(quickFilter === 'with-stock' ? 'all' : 'with-stock')}
            size="sm"
            type="button"
            variant={quickFilter === 'with-stock' ? 'secondary' : 'outline'}
          >
            <PackageCheck aria-hidden="true" className="h-3.5 w-3.5" />
            Com estoque
          </Button>
                </div>
              </div>
              {hasFilters && (
                <Button aria-label="Limpar todos os filtros" className="w-full" onClick={onClearAll} size="sm" type="button" variant="outline">
                  <X aria-hidden="true" />
                  Limpar tudo
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
        {actions}
      </div>

      {hasFilters && (
        <div aria-label="Filtros ativos" className="flex min-w-0 flex-wrap gap-2">
          {search && <ActiveChip label={`Busca: ${search}`} onRemove={() => onSearchChange('')} removeLabel={`Remover busca ${search}`} />}
          {quickFilter !== 'all' && (
            <ActiveChip
              label={quickFilterLabels[quickFilter]}
              onRemove={() => onQuickFilterChange('all')}
              removeLabel={`Remover filtro ${quickFilterLabels[quickFilter]}`}
            />
          )}
          {brands.map((brand) => (
            <ActiveChip key={`brand:${brand}`} label={`Marca: ${brand}`} onRemove={() => onBrandsChange(brands.filter((item) => item !== brand))} removeLabel={`Remover marca ${brand}`} />
          ))}
          {groups.map((group) => (
            <ActiveChip key={`group:${group}`} label={`Grupo: ${group}`} onRemove={() => onGroupsChange(groups.filter((item) => item !== group))} removeLabel={`Remover grupo ${group}`} />
          ))}
          {lines.map((line) => (
            <ActiveChip key={`line:${line}`} label={`Linha: ${line}`} onRemove={() => onLinesChange(lines.filter((item) => item !== line))} removeLabel={`Remover linha ${line}`} />
          ))}
        </div>
      )}
    </section>
  );
}
