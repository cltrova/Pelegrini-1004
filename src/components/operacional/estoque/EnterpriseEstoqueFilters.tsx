import { CircleCheck, PackageCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import {
  EnterpriseFilterBar,
  EnterpriseSearchFilter,
  EnterpriseSelectFilter,
  type EnterpriseOption,
} from '@/components/enterprise';
import { Button } from '@/components/ui/button';

import type { StockQuickFilter } from './estoqueIntelligence';

interface EstoqueFilterOptions {
  brands: string[];
  groups: string[];
  lines: string[];
}

interface EnterpriseEstoqueFiltersProps {
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
  resultCount?: number;
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
};

const quickFilterOptions: EnterpriseOption[] = [
  { value: 'all', label: 'Todos' },
  { value: 'low', label: 'Estoque baixo' },
  { value: 'critical', label: 'Criticos' },
  { value: 'out', label: 'Sem estoque' },
  { value: 'stagnant', label: 'Parados' },
  { value: 'attention', label: 'Exigem atencao' },
];

export function EnterpriseEstoqueFilters({
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
  resultCount,
}: EnterpriseEstoqueFiltersProps) {
  const [open, setOpen] = useState(false);
  const [expandedField, setExpandedField] = useState<'brand' | 'group' | 'line' | null>(null);
  const activeCount = Number(Boolean(search)) + Number(quickFilter !== 'all') + brands.length + groups.length + lines.length;
  const summaryParts = [
    quickFilter !== 'all' ? quickFilterLabels[quickFilter] : null,
    brands.length ? `${brands.length} marca(s)` : null,
    groups.length ? `${groups.length} grupo(s)` : null,
    lines.length ? `${lines.length} linha(s)` : null,
    search ? `Busca: ${search}` : null,
  ].filter(Boolean);

  return (
    <EnterpriseFilterBar
      activeCount={activeCount}
      applyLabel="Aplicar"
      className="min-w-0"
      isOpen={open}
      onApply={() => setOpen(false)}
      onClear={onClearAll}
      onOpenChange={setOpen}
      resultCount={resultCount}
      resultLabel="itens"
      summary={(
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
          {leading}
          <EnterpriseSearchFilter
            label="Buscar no estoque"
            onChange={onSearchChange}
            placeholder="Buscar produto, codigo ou referencia"
            value={search}
          />
          {actions}
          {summaryParts.length > 0 && (
            <span className="min-w-0 truncate pb-1 text-xs text-muted-foreground">
              {summaryParts.join(' | ')}
            </span>
          )}
        </div>
      )}
    >
      {open && (
        <>
          <InlineMultiFilter
            allLabel="Todas"
            expanded={expandedField === 'brand'}
            label="Marca"
            onExpandedChange={(expanded) => setExpandedField(expanded ? 'brand' : null)}
            onValuesChange={onBrandsChange}
            options={options.brands}
            values={brands}
          />
          <InlineMultiFilter
            allLabel="Todos"
            expanded={expandedField === 'group'}
            label="Grupo"
            onExpandedChange={(expanded) => setExpandedField(expanded ? 'group' : null)}
            onValuesChange={onGroupsChange}
            options={options.groups}
            values={groups}
          />
          <InlineMultiFilter
            allLabel="Todas"
            expanded={expandedField === 'line'}
            label="Linha"
            onExpandedChange={(expanded) => setExpandedField(expanded ? 'line' : null)}
            onValuesChange={onLinesChange}
            options={options.lines}
            values={lines}
          />
          <EnterpriseSelectFilter
            allLabel="Todos"
            label="Situacao"
            onChange={(value) => onQuickFilterChange((value as StockQuickFilter | undefined) ?? 'all')}
            options={quickFilterOptions.filter((option) => option.value !== 'all')}
            value={quickFilter === 'all' ? undefined : quickFilter}
          />
          <div aria-label="Filtros rapidos de disponibilidade" className="flex min-w-0 flex-wrap items-end gap-2" role="group">
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
          <Button
            aria-label="Close"
            className="h-8 self-end px-2.5 text-xs"
            onClick={() => setOpen(false)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Fechar
          </Button>
        </>
      )}
    </EnterpriseFilterBar>
  );
}

function InlineMultiFilter({
  allLabel,
  expanded,
  label,
  onExpandedChange,
  onValuesChange,
  options,
  values,
}: {
  allLabel: string;
  expanded: boolean;
  label: string;
  onExpandedChange: (expanded: boolean) => void;
  onValuesChange: (values: string[]) => void;
  options: string[];
  values: string[];
}) {
  const display = values.length === 0 ? allLabel : values.length === 1 ? values[0] : `${values.length} selecionados`;

  return (
    <div className="min-w-[9rem] max-w-full space-y-1">
      <span className="block text-[10px] font-semibold uppercase text-muted-foreground">{label}</span>
      <Button
        aria-expanded={expanded}
        aria-label={`${label}: ${display}`}
        className="h-8 min-w-[9rem] max-w-[15rem] justify-between bg-background px-2 text-xs font-normal"
        onClick={() => onExpandedChange(!expanded)}
        type="button"
        variant="outline"
      >
        <span className="truncate">{display}</span>
      </Button>
      {expanded && (
        <div className="max-h-48 min-w-[12rem] space-y-1 overflow-y-auto rounded-md border border-border bg-card p-1">
          <button
            className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
            onClick={() => onValuesChange([])}
            type="button"
          >
            {allLabel}
          </button>
          {options.map((option) => {
            const active = values.includes(option);
            return (
              <button
                className={`block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted ${active ? 'bg-muted font-semibold' : ''}`}
                key={option}
                onClick={() => onValuesChange(active ? values.filter((value) => value !== option) : [...values, option])}
                type="button"
              >
                {option}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
